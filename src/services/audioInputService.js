/**
 * Cristi AI - Audio Input Service
 * Captures microphone stream with auto-gain, echo-cancellation, volume amplification,
 * downsampling to 16,000 Hz 16-bit PCM Little Endian, and base64 streaming.
 */

import { logger } from './logger';

export class AudioInputService {
  constructor({ onAudioChunk, onAudioData, onVolumeChange, onError }) {
    this.onAudioChunk = onAudioChunk || onAudioData || (() => {});
    this.onVolumeChange = onVolumeChange || (() => {});
    this.onError = onError || console.error;

    this.audioContext = null;
    this.mediaStream = null;
    this.processorNode = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.analyserNode = null;
    this.muteNode = null;
    this.isRecording = false;
    this.targetSampleRate = 16000;
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
      logger.info('AUDIO', `Micrófono activado (Frecuencia de entrada: ${inputSampleRate} Hz => Salida: 16000 Hz PCM)`);
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Volume booster gain node (1.4x for clear mic sensitivity)
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.4;
      this.sourceNode.connect(this.gainNode);

      // Volume Analyser for UI visualizers
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.gainNode.connect(this.analyserNode);

      // ScriptProcessor node for PCM chunk extraction (2048 samples = ~42ms latency)
      const bufferSize = 2048;
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;

        const inputData = e.inputBuffer.getChannelData(0);

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

        // Convert Float32Array to 16-bit Int PCM Little Endian
        const pcm16Buffer = this.floatTo16BitPCM(resampledData);

        // Convert ArrayBuffer to base64 string
        const base64Audio = this.arrayBufferToBase64(pcm16Buffer);

        this.onAudioChunk(base64Audio);
      };

      this.gainNode.connect(this.processorNode);

      // Mute node to prevent speaker feedback loop in browser
      this.muteNode = this.audioContext.createGain();
      this.muteNode.gain.value = 0;
      this.processorNode.connect(this.muteNode);
      this.muteNode.connect(this.audioContext.destination);

      this.isRecording = true;
    } catch (err) {
      this.onError(err);
      this.stop();
      throw err;
    }
  }

  stop() {
    this.isRecording = false;

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
}
