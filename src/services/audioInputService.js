/**
 * Cristi AI - Audio Input Service (High-Performance AudioWorklet & Web Audio DSP)
 * Captures microphone stream at 16,000 Hz 16-bit PCM Little Endian for Gemini Live API.
 * 
 * Features:
 * - AudioWorkletNode dedicated processing (low latency, zero main-thread UI jank)
 * - 80 Hz High-Pass Filter (HPF) to eliminate pops, plosives, and sub-bass electrical hum
 * - Adaptive Noise Gate to attenuate background noise floor
 * - Transparent fallback to ScriptProcessorNode if AudioWorklet is unavailable
 * - Rolling PCM buffer for Speaker Biometrics and Diagnostics
 */

import { logger } from './logger.js';

const WORKLET_PROCESSOR_CODE = `
class CristiPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.noiseGateThreshold = 0.008; // -42dB noise floor
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    const inputLength = channelData.length;

    for (let i = 0; i < inputLength; i++) {
      let sample = channelData[i];

      // Soft Noise Gate: attenuate signal when below threshold
      const absSample = Math.abs(sample);
      if (absSample < this.noiseGateThreshold) {
        sample = sample * (absSample / this.noiseGateThreshold);
      }

      this.buffer[this.bufferIndex++] = sample;

      if (this.bufferIndex >= this.bufferSize) {
        // Send full buffer to main thread
        const copy = new Float32Array(this.buffer);
        this.port.postMessage({ pcmChunk: copy });
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('cristi-pcm-processor', CristiPcmProcessor);
`;

export class AudioInputService {
  constructor({ onAudioChunk, onAudioData, onRawPCMChunk, onVolumeChange, onError }) {
    this.onAudioChunk = onAudioChunk || onAudioData || (() => {});
    this.onRawPCMChunk = onRawPCMChunk || (() => {});
    this.onVolumeChange = onVolumeChange || (() => {});
    this.onError = onError || console.error;

    this.audioContext = null;
    this.mediaStream = null;
    this.workletNode = null;
    this.processorNode = null;
    this.sourceNode = null;
    this.hpfFilterNode = null;
    this.gainNode = null;
    this.analyserNode = null;
    this.muteNode = null;
    this.isRecording = false;
    this.targetSampleRate = 16000;

    // Rolling 4-second Float32 audio buffer for speaker verification & diagnostics
    this.rollingBufferSize = 16000 * 4;
    this.rollingBuffer = new Float32Array(this.rollingBufferSize);
    this.rollingBufferIndex = 0;
    this._processedChunksCount = 0;
  }

  getTelemetry() {
    return {
      isRecording: this.isRecording,
      processorType: this.workletNode ? 'AudioWorklet (Low Latency)' : 'ScriptProcessor (Fallback)',
      sampleRate: this.audioContext?.sampleRate || 0,
      targetRate: this.targetSampleRate,
      hpfEnabled: !!this.hpfFilterNode,
      processedChunksCount: this._processedChunksCount
    };
  }

  async start() {
    if (this.isRecording) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const inputSampleRate = this.audioContext.sampleRate;
      logger.info('AUDIO', `Micrófono activo (Entrada: ${inputSampleRate} Hz => Salida: 16000 Hz PCM)`);
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // 1. High-Pass Filter (HPF @ 80 Hz, Q: 0.707) to remove pops and low rumble
      this.hpfFilterNode = this.audioContext.createBiquadFilter();
      this.hpfFilterNode.type = 'highpass';
      this.hpfFilterNode.frequency.setValueAtTime(80, this.audioContext.currentTime);
      this.hpfFilterNode.Q.setValueAtTime(0.707, this.audioContext.currentTime);
      this.sourceNode.connect(this.hpfFilterNode);

      // 2. Volume booster gain node (1.35x for optimal vocal sensitivity)
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.35;
      this.hpfFilterNode.connect(this.gainNode);

      // 3. Volume Analyser for UI visualizers
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.gainNode.connect(this.analyserNode);

      // 4. Try loading AudioWorklet; fall back to ScriptProcessor if unavailable
      let workletSuccess = false;
      if (this.audioContext.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
        try {
          const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: 'application/javascript' });
          const workletUrl = URL.createObjectURL(blob);
          await this.audioContext.audioWorklet.addModule(workletUrl);
          URL.revokeObjectURL(workletUrl);

          this.workletNode = new AudioWorkletNode(this.audioContext, 'cristi-pcm-processor');
          this.workletNode.port.onmessage = (event) => {
            if (!this.isRecording) return;
            const rawChunk = event.data.pcmChunk;
            this.handleAudioBuffer(rawChunk, inputSampleRate);
          };

          this.gainNode.connect(this.workletNode);
          workletSuccess = true;
          logger.info('AUDIO', 'AudioWorklet DSP inicializado en hilo secundario de audio.');
        } catch (workletErr) {
          logger.warn('AUDIO', `Fallo al registrar AudioWorklet, usando fallback ScriptProcessor: ${workletErr.message}`);
          workletSuccess = false;
        }
      }

      if (!workletSuccess) {
        // Fallback: ScriptProcessorNode (2048 samples = ~42ms buffer)
        const bufferSize = 2048;
        this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        this.processorNode.onaudioprocess = (e) => {
          if (!this.isRecording) return;
          const inputData = e.inputBuffer.getChannelData(0);
          this.handleAudioBuffer(inputData, inputSampleRate);
        };
        this.gainNode.connect(this.processorNode);

        // Mute node to prevent feedback loop
        this.muteNode = this.audioContext.createGain();
        this.muteNode.gain.value = 0;
        this.processorNode.connect(this.muteNode);
        this.muteNode.connect(this.audioContext.destination);
      }

      this.isRecording = true;
    } catch (err) {
      this.onError(err);
      this.stop();
      throw err;
    }
  }

  handleAudioBuffer(inputData, inputSampleRate) {
    // Calculate RMS volume for audio visualizer
    let sumSquares = 0;
    for (let i = 0; i < inputData.length; i++) {
      sumSquares += inputData[i] * inputData[i];
    }
    const rms = Math.sqrt(sumSquares / inputData.length);
    const volumeNormalized = Math.min(1, rms * 4.5);
    this.onVolumeChange(volumeNormalized);

    // Resample to 16,000 Hz if input sample rate differs
    const resampledData = this.resampleAudio(inputData, inputSampleRate, this.targetSampleRate);

    // Store in rolling buffer for speaker verification
    for (let i = 0; i < resampledData.length; i++) {
      this.rollingBuffer[(this.rollingBufferIndex + i) % this.rollingBufferSize] = resampledData[i];
    }
    this.rollingBufferIndex = (this.rollingBufferIndex + resampledData.length) % this.rollingBufferSize;

    this.onRawPCMChunk(resampledData);

    this._processedChunksCount++;

    // Convert Float32Array to 16-bit Int PCM Little Endian
    const pcm16Buffer = this.floatTo16BitPCM(resampledData);

    // Convert ArrayBuffer to base64 string
    const base64Audio = this.arrayBufferToBase64(pcm16Buffer);

    this.onAudioChunk(base64Audio);
  }

  stop() {
    this.isRecording = false;

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.muteNode) {
      this.muteNode.disconnect();
      this.muteNode = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.hpfFilterNode) {
      this.hpfFilterNode.disconnect();
      this.hpfFilterNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.onVolumeChange(0);
  }

  /**
   * Linear interpolation resampling from sourceRate to targetRate
   */
  resampleAudio(inputSamples, sourceRate, targetRate) {
    if (sourceRate === targetRate) {
      return inputSamples;
    }
    const ratio = sourceRate / targetRate;
    const newLength = Math.round(inputSamples.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const originalIndex = i * ratio;
      const indexLow = Math.floor(originalIndex);
      const indexHigh = Math.min(indexLow + 1, inputSamples.length - 1);
      const weight = originalIndex - indexLow;
      result[i] = inputSamples[indexLow] * (1 - weight) + inputSamples[indexHigh] * weight;
    }
    return result;
  }

  /**
   * Convert Float32Array [-1.0, 1.0] to 16-bit Signed Integer PCM ArrayBuffer
   */
  floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); // Little endian
    }
    return buffer;
  }

  /**
   * Fast ArrayBuffer to Base64 String
   */
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Retrieve continuous Float32Array PCM samples from recent rolling buffer (e.g. past 1500ms)
   */
  getRecentAudioSamples(durationMs = 1500) {
    const numSamples = Math.min(Math.floor((durationMs / 1000) * this.targetSampleRate), this.rollingBufferSize);
    const result = new Float32Array(numSamples);
    const startIdx = (this.rollingBufferIndex - numSamples + this.rollingBufferSize) % this.rollingBufferSize;

    for (let i = 0; i < numSamples; i++) {
      result[i] = this.rollingBuffer[(startIdx + i) % this.rollingBufferSize];
    }
    return result;
  }
}
