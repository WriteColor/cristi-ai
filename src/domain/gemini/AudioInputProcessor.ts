/**
 * Cristi AI - Audio Input Processor (Web Audio API & AudioWorklet)
 * 
 * Captures microphone stream at 16,000 Hz 16-bit PCM Little Endian for Gemini Live API.
 * Features:
 * - Dedicated low-latency AudioWorkletNode with ScriptProcessorNode fallback
 * - High-Pass Filter (HPF @ 80 Hz, Q: 0.707) eliminating sub-bass rumble, plosives, and table vibration
 * - Real-time Root-Mean-Square (RMS) computation for volume visualizers
 * - Built-in Voice Activity Detection (VAD) with configurable hangover time
 * - High-quality linear resampling to 16,000 Hz if hardware runs at 44.1kHz or 48kHz
 * - Instantaneous mute/unmute control
 */

export interface AudioInputProcessorOptions {
  targetSampleRate?: number;
  bufferDurationMs?: number;
  noiseGateThreshold?: number;
  vadThreshold?: number;
  vadHangoverMs?: number;
  gainMultiplier?: number;
  deviceId?: string;
  onAudioChunk?: (pcm16: Int16Array, base64: string) => void;
  onVolumeChange?: (volume: number) => void;
  onSpeechStateChange?: (isSpeaking: boolean) => void;
  onError?: (error: Error) => void;
}

export interface AudioInputTelemetry {
  isRecording: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  processorType: 'AudioWorklet' | 'ScriptProcessor' | 'None';
  sampleRate: number;
  targetSampleRate: number;
  processedChunks: number;
}

const WORKLET_PROCESSOR_CODE = `
class GeminiPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 20ms buffer @ sample rate
    this.bufferSize = Math.max(128, Math.round(sampleRate * 0.02));
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.noiseGateThreshold = 0.008; // -42dB soft noise floor
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channel = input[0];
    const len = channel.length;

    for (let i = 0; i < len; i++) {
      let sample = channel[i];

      // Soft noise gate attenuation
      const abs = Math.abs(sample);
      if (abs < this.noiseGateThreshold) {
        sample = sample * (abs / this.noiseGateThreshold);
      }

      this.buffer[this.bufferIndex++] = sample;

      if (this.bufferIndex >= this.bufferSize) {
        const chunk = new Float32Array(this.buffer);
        this.port.postMessage({ pcm: chunk }, [chunk.buffer]);
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('gemini-pcm-processor', GeminiPcmProcessor);
`;

export class AudioInputProcessor {
  private targetSampleRate: number;
  private vadThreshold: number;
  private vadHangoverMs: number;
  private gainMultiplier: number;
  private deviceId?: string;

  private onAudioChunk?: (pcm16: Int16Array, base64: string) => void;
  private onVolumeChange?: (volume: number) => void;
  private onSpeechStateChange?: (isSpeaking: boolean) => void;
  private onError?: (error: Error) => void;

  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private hpfFilterNode: BiquadFilterNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sinkGainNode: GainNode | null = null;

  private isRecordingState = false;
  private isMutedState = false;
  private isSpeakingState = false;
  private lastSpeechTime = 0;
  private processedChunksCount = 0;
  private processorType: 'AudioWorklet' | 'ScriptProcessor' | 'None' = 'None';
  private generation = 0;

  constructor(options: AudioInputProcessorOptions = {}) {
    this.targetSampleRate = options.targetSampleRate ?? 16000;
    this.vadThreshold = options.vadThreshold ?? 0.015;
    this.vadHangoverMs = options.vadHangoverMs ?? 250;
    this.gainMultiplier = options.gainMultiplier ?? 1.35;
    this.deviceId = options.deviceId;

    this.onAudioChunk = options.onAudioChunk;
    this.onVolumeChange = options.onVolumeChange;
    this.onSpeechStateChange = options.onSpeechStateChange;
    this.onError = options.onError;
  }

  public isRecording(): boolean {
    return this.isRecordingState;
  }

  public isMuted(): boolean {
    return this.isMutedState;
  }

  public isSpeaking(): boolean {
    return this.isSpeakingState;
  }

  public mute(): void {
    this.isMutedState = true;
    this.onVolumeChange?.(0);
  }

  public unmute(): void {
    this.isMutedState = false;
  }

  public toggleMute(): boolean {
    if (this.isMutedState) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.isMutedState;
  }

  public getTelemetry(): AudioInputTelemetry {
    return {
      isRecording: this.isRecordingState,
      isMuted: this.isMutedState,
      isSpeaking: this.isSpeakingState,
      processorType: this.processorType,
      sampleRate: this.audioContext?.sampleRate ?? 0,
      targetSampleRate: this.targetSampleRate,
      processedChunks: this.processedChunksCount
    };
  }

  public async start(): Promise<void> {
    if (this.isRecordingState) return;

    this.generation++;
    const currentGeneration = this.generation;

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(this.deviceId ? { deviceId: { exact: this.deviceId } } : {})
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (currentGeneration !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.mediaStream = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API (AudioContext) is not supported in this browser');
      }

      this.audioContext = new AudioContextClass({
        sampleRate: this.targetSampleRate,
        latencyHint: 'interactive'
      });

      if (this.audioContext.state === 'suspended' || (this.audioContext.state as string) === 'interrupted') {
        await this.audioContext.resume();
      }

      if (currentGeneration !== this.generation) return;

      const hardwareSampleRate = this.audioContext.sampleRate;
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);

      // 1. High-Pass Filter (HPF @ 80 Hz, Q: 0.707)
      this.hpfFilterNode = this.audioContext.createBiquadFilter();
      this.hpfFilterNode.type = 'highpass';
      this.hpfFilterNode.frequency.setValueAtTime(80, this.audioContext.currentTime);
      this.hpfFilterNode.Q.setValueAtTime(0.707, this.audioContext.currentTime);
      this.sourceNode.connect(this.hpfFilterNode);

      // 2. Pre-amplifier gain node for vocal clarity
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.setValueAtTime(this.gainMultiplier, this.audioContext.currentTime);
      this.hpfFilterNode.connect(this.gainNode);

      // 3. Analyser node for fast visual frequency monitoring
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.gainNode.connect(this.analyserNode);

      // 4. Sink gain node (muted destination to keep DSP active in Chromium)
      this.sinkGainNode = this.audioContext.createGain();
      this.sinkGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.sinkGainNode.connect(this.audioContext.destination);

      // 5. Try loading AudioWorklet processor; fallback to ScriptProcessorNode
      let workletSuccess = false;
      if (this.audioContext.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
        try {
          const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: 'application/javascript' });
          const workletUrl = URL.createObjectURL(blob);
          try {
            await this.audioContext.audioWorklet.addModule(workletUrl);
          } finally {
            URL.revokeObjectURL(workletUrl);
          }

          if (currentGeneration !== this.generation) return;

          this.workletNode = new AudioWorkletNode(this.audioContext, 'gemini-pcm-processor');
          this.workletNode.port.onmessage = (event: MessageEvent) => {
            if (!this.isRecordingState) return;
            const floatData = event.data.pcm as Float32Array;
            this.handleAudioSamples(floatData, hardwareSampleRate);
          };

          this.gainNode.connect(this.workletNode);
          this.workletNode.connect(this.sinkGainNode);
          this.processorType = 'AudioWorklet';
          workletSuccess = true;
        } catch (_) {
          workletSuccess = false;
        }
      }

      if (!workletSuccess) {
        // Fallback: ScriptProcessorNode (2048 samples = ~42ms @ 48kHz)
        const bufferSize = 2048;
        this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
          if (!this.isRecordingState) return;
          const channel = e.inputBuffer.getChannelData(0);
          this.handleAudioSamples(channel, hardwareSampleRate);
        };

        this.gainNode.connect(this.processorNode);
        this.processorNode.connect(this.sinkGainNode);
        this.processorType = 'ScriptProcessor';
      }

      this.isRecordingState = true;
    } catch (err: any) {
      if (currentGeneration !== this.generation) return;
      this.stop();
      this.onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  public stop(): void {
    this.generation++;
    this.isRecordingState = false;
    this.processorType = 'None';
    this.isSpeakingState = false;

    if (this.workletNode) {
      try {
        this.workletNode.port.onmessage = null;
        this.workletNode.disconnect();
      } catch (_) {}
      this.workletNode = null;
    }

    if (this.processorNode) {
      try {
        this.processorNode.onaudioprocess = null;
        this.processorNode.disconnect();
      } catch (_) {}
      this.processorNode = null;
    }

    if (this.sinkGainNode) {
      try { this.sinkGainNode.disconnect(); } catch (_) {}
      this.sinkGainNode = null;
    }

    if (this.gainNode) {
      try { this.gainNode.disconnect(); } catch (_) {}
      this.gainNode = null;
    }

    if (this.hpfFilterNode) {
      try { this.hpfFilterNode.disconnect(); } catch (_) {}
      this.hpfFilterNode = null;
    }

    if (this.analyserNode) {
      try { this.analyserNode.disconnect(); } catch (_) {}
      this.analyserNode = null;
    }

    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (_) {}
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        void this.audioContext.close();
      } catch (_) {}
      this.audioContext = null;
    }

    this.onVolumeChange?.(0);
  }

  // ---------------------------------------------------------------------------
  // Audio Signal DSP & Transformation
  // ---------------------------------------------------------------------------

  private handleAudioSamples(inputSamples: Float32Array, inputRate: number): void {
    if (this.isMutedState) {
      this.onVolumeChange?.(0);
      if (this.isSpeakingState) {
        this.isSpeakingState = false;
        this.onSpeechStateChange?.(false);
      }
      return;
    }

    // 1. RMS Energy computation
    let sumSquares = 0;
    const len = inputSamples.length;
    for (let i = 0; i < len; i++) {
      sumSquares += inputSamples[i] * inputSamples[i];
    }
    const rms = Math.sqrt(sumSquares / len);
    const volumeNormalized = Math.min(1, Math.max(0, rms * 4.5));
    this.onVolumeChange?.(volumeNormalized);

    // 2. Voice Activity Detection (VAD) with Hangover
    const isVoicePresent = volumeNormalized > this.vadThreshold;
    const now = Date.now();

    if (isVoicePresent) {
      this.lastSpeechTime = now;
      if (!this.isSpeakingState) {
        this.isSpeakingState = true;
        this.onSpeechStateChange?.(true);
      }
    } else if (this.isSpeakingState && now - this.lastSpeechTime > this.vadHangoverMs) {
      this.isSpeakingState = false;
      this.onSpeechStateChange?.(false);
    }

    // 3. Resample to target rate (16,000 Hz) if needed
    const resampled = this.resampleAudio(inputSamples, inputRate, this.targetSampleRate);

    // 4. Convert Float32 to 16-bit Int PCM Little Endian
    const pcm16 = this.floatToInt16PCM(resampled);
    const base64 = this.int16ArrayToBase64(pcm16);

    this.processedChunksCount++;
    this.onAudioChunk?.(pcm16, base64);
  }

  private resampleAudio(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return samples;
    const ratio = fromRate / toRate;
    const newLen = Math.round(samples.length / ratio);
    const result = new Float32Array(newLen);

    for (let i = 0; i < newLen; i++) {
      const origPos = i * ratio;
      const lowIndex = Math.floor(origPos);
      const highIndex = Math.min(lowIndex + 1, samples.length - 1);
      const frac = origPos - lowIndex;
      result[i] = samples[lowIndex] * (1 - frac) + samples[highIndex] * frac;
    }

    return result;
  }

  private floatToInt16PCM(float32: Float32Array): Int16Array {
    const len = float32.length;
    const pcm16 = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    }
    return pcm16;
  }

  private int16ArrayToBase64(pcm16: Int16Array): string {
    const uint8 = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
    let binary = '';
    const chunkSize = 8192;
    const len = uint8.length;
    for (let i = 0; i < len; i += chunkSize) {
      const slice = uint8.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, slice as unknown as number[]);
    }
    return btoa(binary);
  }
}
