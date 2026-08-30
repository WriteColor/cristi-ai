/**
 * Cristi AI - Audio Output Service
 * Decodes 24,000 Hz 16-bit PCM base64 chunks from Gemini Live API,
 * schedules smooth continuous playback via Web Audio API,
 * analyzes live frequencies for Avatar Lip-Sync & visualizer,
 * and handles instantaneous cancellation on user interruption.
 */

import { eventBus, EVENTS } from './eventBus';
import { AudioAnalysisService } from './audioAnalysisService';

export class AudioOutputService {
  constructor({ onAudioStart, onAudioEnd, onLipSyncUpdate, onVolumeChange } = {}) {
    this.onAudioStart = onAudioStart || (() => {});
    this.onAudioEnd = onAudioEnd || (() => {});
    this.onLipSyncUpdate = onLipSyncUpdate || (() => {});
    this.onVolumeChange = onVolumeChange || (() => {});

    this.audioContext = null;
    this.analyserNode = null;
    this.gainNode = null;
    this.analysisService = null;
    this.isPlaying = false;
    this.nextScheduleTime = 0;
    this.activeSources = [];
    this.sampleRate = 24000; // Gemini Live audio output is 24kHz

    // Forward analysis events to constructor callbacks
    this.unsubscribeAnalysis = eventBus.on(EVENTS.AUDIO_ANALYSIS, (metrics) => {
      this.onVolumeChange(metrics.volume);
      this.onLipSyncUpdate(metrics.mouthOpen);
    });
  }

  initContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: this.sampleRate });

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // Connect to destination (speakers)
      this.gainNode.connect(this.audioContext.destination);

      // Create and attach AudioAnalysisService
      this.analysisService = new AudioAnalysisService(this.audioContext, this.gainNode);
      this.analysisService.connectSource(this.gainNode);
    }
  }

  async resumeContextIfNeeded() {
    this.initContext();
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async resumeContext() {
    return await this.resumeContextIfNeeded();
  }

  /**
   * Enqueue a chunk of base64 raw PCM 24kHz audio from Gemini Live
   */
  async playChunk(base64Data) {
    await this.resumeContextIfNeeded();

    if (!base64Data) return;

    eventBus.emit(EVENTS.AUDIO_CHUNK, { length: base64Data.length });

    // Convert base64 to binary ArrayBuffer
    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert 16-bit Int PCM (little endian) to Float32 [-1.0, 1.0]
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    // Create AudioBuffer
    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, this.sampleRate);
    audioBuffer.getChannelData(0).set(float32Array);

    // Create and schedule AudioBufferSourceNode
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    const currentTime = this.audioContext.currentTime;
    if (this.nextScheduleTime < currentTime) {
      this.nextScheduleTime = currentTime;
    }

    source.start(this.nextScheduleTime);
    this.nextScheduleTime += audioBuffer.duration;

    this.activeSources.push(source);

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.onAudioStart();
      eventBus.emit(EVENTS.AUDIO_START);
      if (this.analysisService) {
        this.analysisService.start();
      }
    }

    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
      if (this.activeSources.length === 0) {
        this.isPlaying = false;
        this.onAudioEnd();
        eventBus.emit(EVENTS.AUDIO_END);
        if (this.analysisService) {
          this.analysisService.stop();
        }
      }
    };
  }

  async playAudioChunk(base64Data) {
    return await this.playChunk(base64Data);
  }

  /**
   * Stop immediately (on user speech interruption / Barge-in)
   */
  stopImmediate() {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source might have already finished
      }
    });

    this.activeSources = [];
    this.isPlaying = false;
    if (this.audioContext) {
      this.nextScheduleTime = this.audioContext.currentTime;
    }

    if (this.analysisService) {
      this.analysisService.stop();
    }

    this.onLipSyncUpdate(0);
    this.onVolumeChange(0);
    this.onAudioEnd();

    eventBus.emit(EVENTS.AUDIO_END);
    eventBus.emit(EVENTS.BARGE_IN_TRIGGERED);
  }

  destroy() {
    this.stopImmediate();
    if (this.unsubscribeAnalysis) {
      this.unsubscribeAnalysis();
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
