/**
 * Cristi AI - Audio Output Service (Jitter-Buffered PCM Audio Output)
 * Decodes 24,000 Hz 16-bit PCM base64 chunks from Gemini Live API,
 * schedules smooth continuous playback with jitter buffering via Web Audio API,
 * analyzes live frequencies for Avatar Lip-Sync & visualizer,
 * and handles instantaneous cancellation on user interruption (Barge-in).
 */

import { eventBus, EVENTS } from './eventBus.js';
import { AudioAnalysisService } from './audioAnalysisService.js';

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

    // Jitter buffer lead-time (~35ms) to prevent audio underrun
    this.jitterLeadTime = 0.035;

    // Forward analysis events to constructor callbacks
    this.unsubscribeAnalysis = eventBus.on(EVENTS.AUDIO_ANALYSIS, (metrics) => {
      this.onVolumeChange(metrics.volume);
      this.onLipSyncUpdate(metrics.mouthOpen);
    });
  }

  getTelemetry() {
    return {
      isPlaying: this.isPlaying,
      activeSourcesCount: this.activeSources.length,
      sampleRate: this.sampleRate,
      jitterLeadTimeMs: Math.round(this.jitterLeadTime * 1000)
    };
  }

  initContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass = typeof window !== 'undefined'
        ? (window.AudioContext || window.webkitAudioContext)
        : null;

      if (!AudioContextClass) return;

      try {
        this.audioContext = new AudioContextClass({ sampleRate: this.sampleRate });
      } catch (_) {
        try {
          this.audioContext = new AudioContextClass();
        } catch (err) {
          console.warn('[AudioOutputService] Failed to initialize AudioContext:', err);
          return;
        }
      }

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // Connect to destination (speakers)
      this.gainNode.connect(this.audioContext.destination);

      // Create and attach AudioAnalysisService
      this.analysisService = new AudioAnalysisService(this.audioContext, this.gainNode);
      this.analysisService.connectSource(this.gainNode);

      // Global user interaction resume listener for strict autoplay policies
      if (typeof window !== 'undefined' && !this._unlockBound) {
        const unlock = async () => {
          if (this.audioContext && (this.audioContext.state === 'suspended' || this.audioContext.state === 'interrupted')) {
            try { await this.audioContext.resume(); } catch (_) {}
          }
        };
        ['click', 'keydown', 'touchstart'].forEach((evt) => {
          window.addEventListener(evt, unlock, { once: true, passive: true });
        });
        this._unlockBound = true;
      }
    }
  }

  async resumeContextIfNeeded() {
    this.initContext();
    if (this.audioContext && (this.audioContext.state === 'suspended' || this.audioContext.state === 'interrupted')) {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn('[AudioOutputService] Could not resume AudioContext:', e);
      }
    }
  }

  async resumeContext() {
    return await this.resumeContextIfNeeded();
  }

  /**
   * Enqueue a chunk of base64 raw PCM 24kHz audio from Gemini Live
   */
  async playChunk(base64Data) {
    if (!base64Data) return;

    await this.resumeContextIfNeeded();
    if (!this.audioContext || this.audioContext.state === 'closed') return;

    eventBus.emit(EVENTS.AUDIO_CHUNK, { length: base64Data.length });

    // Safe base64 decoding
    const atobFn = (typeof window !== 'undefined' && window.atob)
      ? window.atob
      : (typeof atob !== 'undefined' ? atob : (b64) => Buffer.from(b64, 'base64').toString('binary'));

    const binaryString = atobFn(base64Data);
    const len = binaryString.length;
    const sampleCount = Math.floor(len / 2);
    if (sampleCount === 0) return;

    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert 16-bit Int PCM (little endian) to Float32 [-1.0, 1.0] safely using DataView
    const dataView = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
    const float32Array = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      const s = dataView.getInt16(i * 2, true);
      float32Array[i] = s / 32768.0;
    }

    // Create AudioBuffer
    const audioBuffer = this.audioContext.createBuffer(1, sampleCount, this.sampleRate);
    audioBuffer.getChannelData(0).set(float32Array);

    // Create and schedule AudioBufferSourceNode
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    const currentTime = this.audioContext.currentTime;
    if (this.nextScheduleTime < currentTime) {
      // Apply jitter lead time on sequence start to prevent underrun
      this.nextScheduleTime = currentTime + this.jitterLeadTime;
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
      try {
        source.disconnect();
      } catch (_) {}
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
      if (this.activeSources.length === 0) {
        this.isPlaying = false;
        this.nextScheduleTime = 0;
        this.onLipSyncUpdate(0);
        this.onVolumeChange(0);
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
    // Duck gain instantaneously to avoid waveform pop/click
    if (this.gainNode && this.audioContext && this.audioContext.state === 'running') {
      try {
        const now = this.audioContext.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(0, now);
        this.gainNode.gain.setValueAtTime(1.0, now + 0.05);
      } catch (_) {}
    }

    this.activeSources.forEach((source) => {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source might have already finished
      }
    });

    this.activeSources = [];
    this.isPlaying = false;
    this.nextScheduleTime = 0;

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
      this.unsubscribeAnalysis = null;
    }
    if (this.analysisService) {
      if (typeof this.analysisService.destroy === 'function') {
        this.analysisService.destroy();
      }
      this.analysisService = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch (_) {}
      this.gainNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (_) {}
      this.audioContext = null;
    }
  }
}
