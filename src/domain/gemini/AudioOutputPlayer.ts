/**
 * Cristi AI - Audio Output Player (Adaptive Jitter Buffer & Live2D Lip-Sync)
 * 
 * High-performance Web Audio player for streaming 24,000 Hz 16-bit PCM:
 * - Ultra-smooth continuous playback with adaptive jitter buffer (30-40ms)
 * - Zero click/pop scheduling on audio stream chunks
 * - Real-time FFT spectral analysis for Live2D avatar lip-sync:
 *     * Low bands (80 - 450 Hz) for jaw opening (mouthOpen)
 *     * High bands (450 - 3500 Hz) for mouth spreading/form (mouthForm)
 * - Instantaneous barge-in buffer clearance (<50ms execution, immediate zeroing)
 */

import type { LipSyncMetrics } from '@/types';

export interface AudioOutputPlayerOptions {
  sampleRate?: number;
  jitterLeadTimeMs?: number;
  prebufferTargetMs?: number;
  volume?: number;
  onAudioStart?: () => void;
  onAudioEnd?: () => void;
  onLipSync?: (metrics: LipSyncMetrics) => void;
  onVolumeChange?: (volume: number) => void;
  onInterrupted?: () => void;
  onError?: (error: Error) => void;
}

export interface AudioOutputTelemetry {
  isPlaying: boolean;
  activeSourcesCount: number;
  sampleRate: number;
  jitterLeadTimeMs: number;
  bufferedChunksCount: number;
}

export class AudioOutputPlayer {
  private sampleRate: number;
  private jitterLeadTime: number; // in seconds (35ms = 0.035)
  private prebufferTargetSeconds: number;
  private masterVolume: number;

  private onAudioStart?: () => void;
  private onAudioEnd?: () => void;
  private onLipSync?: (metrics: LipSyncMetrics) => void;
  private onVolumeChange?: (volume: number) => void;
  private onInterrupted?: () => void;
  private onError?: (error: Error) => void;

  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private nextScheduleTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private pcmChunkQueue: Float32Array[] = [];
  private queuedDurationSeconds = 0;
  private isPrebuffering = true;
  private isPlayingState = false;

  // FFT analysis buffers
  private frequencyData: Uint8Array | null = null;
  private timeDomainData: Uint8Array | null = null;
  private animationFrameId: number | null = null;
  private smoothedVolume = 0;
  private smoothedMouthOpen = 0;
  private smoothedMouthForm = 0;
  private isSpeakingSpeech = false;
  private lastSpeechActivity = 0;

  private isDestroyed = false;
  private unlockBound = false;

  constructor(options: AudioOutputPlayerOptions = {}) {
    this.sampleRate = options.sampleRate ?? 24000;
    this.jitterLeadTime = (options.jitterLeadTimeMs ?? 35) / 1000;
    this.prebufferTargetSeconds = (options.prebufferTargetMs ?? 35) / 1000;
    this.masterVolume = options.volume ?? 1.0;

    this.onAudioStart = options.onAudioStart;
    this.onAudioEnd = options.onAudioEnd;
    this.onLipSync = options.onLipSync;
    this.onVolumeChange = options.onVolumeChange;
    this.onInterrupted = options.onInterrupted;
    this.onError = options.onError;
  }

  // ---------------------------------------------------------------------------
  // AudioContext Lifecycle & Autoplay Auto-Unlock
  // ---------------------------------------------------------------------------

  private initContext(): AudioContext {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      return this.audioContext;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API (AudioContext) is not supported in this environment');
    }

    this.audioContext = new AudioContextClass({ latencyHint: 'interactive' });

    // Auto-heal on state suspension
    this.audioContext.onstatechange = () => {
      if (this.audioContext && (this.audioContext.state === 'suspended' || (this.audioContext.state as string) === 'interrupted')) {
        void this.audioContext.resume().catch(() => {});
      }
    };

    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.audioContext.currentTime);

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.analyserNode.smoothingTimeConstant = 0.22;

    this.masterGainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);

    this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.timeDomainData = new Uint8Array(this.analyserNode.fftSize);

    this.bindAutoplayUnlock();
    return this.audioContext;
  }

  private bindAutoplayUnlock(): void {
    if (typeof window === 'undefined' || this.unlockBound) return;
    this.unlockBound = true;

    const unlock = async () => {
      if (this.audioContext && (this.audioContext.state === 'suspended' || (this.audioContext.state as string) === 'interrupted')) {
        try {
          await this.audioContext.resume();
        } catch (_) {}
      }
    };

    ['click', 'keydown', 'touchstart'].forEach((evt) => {
      window.addEventListener(evt, unlock, { once: true, passive: true });
    });
  }

  public async resumeContext(): Promise<void> {
    const ctx = this.initContext();
    if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
      await ctx.resume();
    }
  }

  // ---------------------------------------------------------------------------
  // Playback & Adaptive Jitter Buffer
  // ---------------------------------------------------------------------------

  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  public setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(2, vol));
    if (this.masterGainNode && this.audioContext) {
      this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.audioContext.currentTime);
    }
  }

  /**
   * Enqueue a chunk of 24,000 Hz 16-bit PCM audio (Int16Array, ArrayBuffer, or base64)
   */
  public playChunk(chunk: Int16Array | ArrayBuffer | string): void {
    if (this.isDestroyed) return;

    let int16Data: Int16Array;
    if (typeof chunk === 'string') {
      int16Data = base64ToInt16Array(chunk);
    } else if (chunk instanceof Int16Array) {
      int16Data = chunk;
    } else {
      int16Data = new Int16Array(chunk);
    }

    if (int16Data.length === 0) return;

    const floatSamples = this.int16ToFloat32(int16Data);
    const chunkDuration = floatSamples.length / this.sampleRate;

    // Buffer incoming chunk
    this.pcmChunkQueue.push(floatSamples);
    this.queuedDurationSeconds += chunkDuration;

    // Flush jitter cushion once accumulated or if already in playback
    if (this.isPrebuffering) {
      if (this.queuedDurationSeconds >= this.prebufferTargetSeconds) {
        this.isPrebuffering = false;
        this.flushQueue();
      }
    } else {
      this.flushQueue();
    }
  }

  private flushQueue(): void {
    if (this.pcmChunkQueue.length === 0 || this.isDestroyed) return;

    const ctx = this.initContext();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const wasIdle = !this.isPlayingState;
    if (wasIdle) {
      this.isPlayingState = true;
      this.onAudioStart?.();
      this.startAnalysisLoop();
    }

    const currentTime = ctx.currentTime;
    if (this.nextScheduleTime < currentTime) {
      this.nextScheduleTime = currentTime + this.jitterLeadTime;
    }

    while (this.pcmChunkQueue.length > 0) {
      const samples = this.pcmChunkQueue.shift()!;
      this.queuedDurationSeconds = Math.max(0, this.queuedDurationSeconds - samples.length / this.sampleRate);

      // Create audio buffer at 24kHz
      const audioBuffer = ctx.createBuffer(1, samples.length, this.sampleRate);
      audioBuffer.getChannelData(0).set(samples);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.masterGainNode!);

      const startTime = Math.max(currentTime + this.jitterLeadTime, this.nextScheduleTime);
      source.start(startTime);
      this.nextScheduleTime = startTime + audioBuffer.duration;

      this.activeSources.push(source);

      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index !== -1) {
          this.activeSources.splice(index, 1);
        }
        source.disconnect();

        if (this.activeSources.length === 0 && this.pcmChunkQueue.length === 0) {
          this.isPlayingState = false;
          this.isPrebuffering = true;
          this.stopAnalysisLoop();
          this.onAudioEnd?.();
        }
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Instantaneous Barge-In Buffer Flush (<50ms execution)
  // ---------------------------------------------------------------------------

  public clearBuffers(): void {
    // 1. Immediately terminate and disconnect all active sources in audio graph
    for (const source of this.activeSources) {
      try {
        source.onended = null;
        source.stop(0);
        source.disconnect();
      } catch (_) {
        // Source may already be stopped
      }
    }
    this.activeSources = [];

    // 2. Wipe queued chunks and resets scheduler timeline
    this.pcmChunkQueue = [];
    this.queuedDurationSeconds = 0;
    this.nextScheduleTime = 0;
    this.isPrebuffering = true;

    const wasPlaying = this.isPlayingState;
    this.isPlayingState = false;

    // 3. Stop FFT analysis and emit neutral lip-sync metrics immediately
    this.stopAnalysisLoop();
    this.onVolumeChange?.(0);
    this.onLipSync?.({
      mouthOpen: 0,
      mouthForm: 0,
      volume: 0,
      isSpeaking: false,
      spectralCentroid: 0
    });

    // 4. Notify barge-in callbacks
    this.onInterrupted?.();
    if (wasPlaying) {
      this.onAudioEnd?.();
    }
  }

  // ---------------------------------------------------------------------------
  // Continuous FFT Analysis for Live2D Lip-Sync
  // ---------------------------------------------------------------------------

  private startAnalysisLoop(): void {
    if (this.animationFrameId !== null) return;

    const loop = () => {
      if (!this.isPlayingState && this.activeSources.length === 0) {
        this.stopAnalysisLoop();
        return;
      }

      this.performAnalysis();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private stopAnalysisLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.smoothedVolume = 0;
    this.smoothedMouthOpen = 0;
    this.smoothedMouthForm = 0;
    this.isSpeakingSpeech = false;
  }

  private performAnalysis(): void {
    if (!this.analyserNode || !this.frequencyData || !this.timeDomainData || !this.audioContext) {
      return;
    }

    this.analyserNode.getByteFrequencyData(this.frequencyData as any);
    this.analyserNode.getByteTimeDomainData(this.timeDomainData as any);

    const binCount = this.frequencyData.length;
    const nyquist = this.audioContext.sampleRate / 2;
    const binWidth = nyquist / binCount;

    // 1. RMS Volume from Time Domain
    let sumSquares = 0;
    const timeLen = this.timeDomainData.length;
    for (let i = 0; i < timeLen; i++) {
      const norm = (this.timeDomainData[i] - 128) / 128;
      sumSquares += norm * norm;
    }
    const rawRms = Math.sqrt(sumSquares / timeLen);
    const volume = Math.min(Math.max(rawRms * 3.4, 0), 1);

    // Attack/Decay envelope for volume
    const isAttacking = volume > this.smoothedVolume;
    const rate = isAttacking ? 0.72 : 0.28;
    this.smoothedVolume += (volume - this.smoothedVolume) * rate;

    // 2. Multi-Band Spectral Decomposition
    // Low Band: 80 - 450 Hz (Vocal cords & jaw opening)
    // High Band: 450 - 3500 Hz (Vowel formants & lip spreading)
    let lowEnergy = 0;
    let highEnergy = 0;
    let totalWeightedFreq = 0;
    let totalMagnitude = 0;

    for (let i = 0; i < binCount; i++) {
      const freq = i * binWidth;
      const mag = this.frequencyData[i] / 255;

      totalMagnitude += mag;
      totalWeightedFreq += freq * mag;

      if (freq >= 80 && freq < 450) {
        lowEnergy += mag * 1.5;
      } else if (freq >= 450 && freq <= 3500) {
        highEnergy += mag * 1.2;
      }
    }

    const lowBinsCount = Math.max(1, Math.floor(370 / binWidth));
    const highBinsCount = Math.max(1, Math.floor(3050 / binWidth));
    const normLow = lowEnergy / lowBinsCount;
    const normHigh = highEnergy / highBinsCount;

    // 3. Spectral Centroid -> Mouth Form (-1.0 to 1.0)
    // -1.0 = Rounded 'O' / 'U' | +1.0 = Wide 'A' / 'E' / 'I'
    const centroid = totalMagnitude > 0.05 ? totalWeightedFreq / totalMagnitude : 1200;
    const rawForm = Math.min(Math.max((centroid - 1350) / 1000, -1), 1);
    this.smoothedMouthForm += (rawForm - this.smoothedMouthForm) * 0.22;

    // 4. Jaw Mouth Opening
    const jawEnergy = (normLow * 0.45) + (this.smoothedVolume * 0.55);
    const rawMouthOpen = Math.min(Math.max(Math.pow(jawEnergy, 0.8) * 1.5, 0), 1.0);
    this.smoothedMouthOpen += (rawMouthOpen - this.smoothedMouthOpen) * (isAttacking ? 0.8 : 0.35);

    // 5. Speech Activity
    const now = performance.now();
    const isSpeakingNow = this.smoothedVolume > 0.04;
    if (isSpeakingNow) {
      this.lastSpeechActivity = now;
      this.isSpeakingSpeech = true;
    } else if (now - this.lastSpeechActivity > 250) {
      this.isSpeakingSpeech = false;
    }

    const metrics: LipSyncMetrics = {
      mouthOpen: this.smoothedMouthOpen,
      mouthForm: this.smoothedMouthForm,
      volume: this.smoothedVolume,
      isSpeaking: this.isSpeakingSpeech,
      spectralCentroid: centroid
    };

    this.onVolumeChange?.(metrics.volume);
    this.onLipSync?.(metrics);
  }

  // ---------------------------------------------------------------------------
  // Cleanup & Diagnostics
  // ---------------------------------------------------------------------------

  public getTelemetry(): AudioOutputTelemetry {
    return {
      isPlaying: this.isPlayingState,
      activeSourcesCount: this.activeSources.length,
      sampleRate: this.sampleRate,
      jitterLeadTimeMs: Math.round(this.jitterLeadTime * 1000),
      bufferedChunksCount: this.pcmChunkQueue.length
    };
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.clearBuffers();

    if (this.masterGainNode) {
      try { this.masterGainNode.disconnect(); } catch (_) {}
      this.masterGainNode = null;
    }

    if (this.analyserNode) {
      try { this.analyserNode.disconnect(); } catch (_) {}
      this.analyserNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { void this.audioContext.close(); } catch (_) {}
      this.audioContext = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Data Conversions
  // ---------------------------------------------------------------------------

  private int16ToFloat32(int16: Int16Array): Float32Array {
    const len = int16.length;
    const float32 = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      float32[i] = int16[i] / 32768.0;
    }
    return float32;
  }
}

function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
}
