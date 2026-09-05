/**
 * Cristi AI - Audio Output Service (Adaptive Jitter-Buffered PCM Audio Output 2.0)
 * Decodes 24,000 Hz 16-bit PCM base64 chunks from Gemini Live API,
 * schedules ultra-smooth continuous playback with adaptive jitter buffering,
 * eliminates choppy playback caused by network jitter and false barge-in underruns,
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
    this.gainNode = null;
    this.analysisService = null;
    this.isPlaying = false;
    this.nextScheduleTime = 0;
    this.activeSources = [];
    this.sampleRate = 24000; // Gemini Live audio output is 24kHz
    this._generation = 0;
    this._destroyed = false;
    this._resumePromise = null;

    // Jitter buffer lead-time (~35ms) to prevent audio underrun
    this.jitterLeadTime = 0.035;

    // Queue & Pre-buffering Cushion
    this.pcmQueue = [];
    this.isTurnComplete = false;
    this._prebufferTimer = null;
    this._endGraceTimer = null;
    this._isPrebuffering = false;

    // Minimum cushion before starting playback from cold state (60ms for ultra-low latency)
    this.prebufferTargetDuration = 0.06;

    // Playback rate: 0.96 (4% deliberate tempo reduction for flirtatious, coquettish cadence)
    this.playbackRate = 0.96;

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
      jitterLeadTimeMs: Math.round(this.jitterLeadTime * 1000),
      queueLength: this.pcmQueue.length,
      isTurnComplete: this.isTurnComplete
    };
  }

  initContext() {
    if (this._destroyed) return;
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass = typeof window !== 'undefined'
        ? (window.AudioContext || window.webkitAudioContext)
        : null;

      if (!AudioContextClass) return;

      try {
        this.audioContext = new AudioContextClass({ latencyHint: 'interactive' });
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

      // Auto-heal onstatechange: if Chromium attempts to suspend AudioContext (e.g. background tab or lost focus), auto-resume immediately
      this.audioContext.onstatechange = () => {
        if (this.audioContext && (this.audioContext.state === 'suspended' || this.audioContext.state === 'interrupted')) {
          this.audioContext.resume().catch(() => {});
        }
      };

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
        this._unlock = unlock;
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
   * Signal from Gemini Live that the model has completed generating this turn
   */
  signalTurnComplete() {
    this.isTurnComplete = true;
    // If we have queued chunks, flush them immediately
    if (this._isPrebuffering) {
      this._flushQueue();
    }
    this._checkEndState();
  }

  /**
   * Enqueue a chunk of base64 raw PCM 24kHz audio from Gemini Live
   */
  async playChunk(base64Data) {
    if (!base64Data || this._destroyed) return;
    const generation = this._generation;
    this.isTurnComplete = false;

    // Fast path: bypass microtask await if AudioContext is already running
    if (!this.audioContext || this.audioContext.state !== 'running') {
      if (!this._resumePromise) {
        this._resumePromise = this.resumeContextIfNeeded().finally(() => { this._resumePromise = null; });
      }
      await this._resumePromise;
    }
    if (generation !== this._generation || this._destroyed) return;
    if (!this.audioContext || this.audioContext.state === 'closed') return;

    eventBus.emit(EVENTS.AUDIO_CHUNK, { length: base64Data.length });

    // Decode Base64 to Float32 array
    const float32Data = this._decodeBase64PCM(base64Data);
    if (!float32Data || float32Data.length === 0) return;

    if (this._endGraceTimer) {
      clearTimeout(this._endGraceTimer);
      this._endGraceTimer = null;
    }

    if (!this.isPlaying && !this._isPrebuffering && this.activeSources.length === 0) {
      // Begin pre-buffering cushion to absorb initial WebSocket transmission jitter
      this._isPrebuffering = true;
      this.pcmQueue.push(float32Data);

      if (this._prebufferTimer) clearTimeout(this._prebufferTimer);
      this._prebufferTimer = setTimeout(() => {
        this._flushQueue();
      }, 40); // Maximum wait of 40ms before forcing playback start (cuts initial silence in half)
      return;
    }

    if (this._isPrebuffering) {
      this.pcmQueue.push(float32Data);
      // Calculate total buffered duration
      let totalSamples = 0;
      for (const q of this.pcmQueue) totalSamples += q.length;
      const bufferedDuration = totalSamples / this.sampleRate;

      if (bufferedDuration >= this.prebufferTargetDuration) {
        this._flushQueue();
      }
      return;
    }

    // Already playing: schedule directly for seamless continuous playback
    this._scheduleAudioSamples(float32Data);
  }

  _decodeBase64PCM(base64Data) {
    try {
      const atobFn = (typeof window !== 'undefined' && window.atob)
        ? window.atob
        : (typeof atob !== 'undefined' ? atob : (b64) => Buffer.from(b64, 'base64').toString('binary'));

      const binaryString = atobFn(base64Data);
      const len = binaryString.length;
      const sampleCount = Math.floor(len / 2);
      if (sampleCount === 0) return null;

      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, sampleCount);
      const float32Array = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }
      return float32Array;
    } catch (err) {
      console.warn('[AudioOutputService] Error decoding PCM chunk:', err);
      return null;
    }
  }

  _flushQueue() {
    if (this._prebufferTimer) {
      clearTimeout(this._prebufferTimer);
      this._prebufferTimer = null;
    }
    this._isPrebuffering = false;

    if (this.pcmQueue.length === 0) return;

    // Concatenate all queued chunks into a single seamless buffer
    let totalLength = 0;
    for (const chunk of this.pcmQueue) {
      totalLength += chunk.length;
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.pcmQueue) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.pcmQueue = [];

    this._scheduleAudioSamples(merged);
  }

  _scheduleAudioSamples(float32Array) {
    if (!this.audioContext || this.audioContext.state === 'closed') return;
    const sampleCount = float32Array.length;
    if (sampleCount === 0) return;

    const audioBuffer = this.audioContext.createBuffer(1, sampleCount, this.sampleRate);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    if (source.playbackRate) {
      source.playbackRate.value = this.playbackRate;
    }
    source.connect(this.gainNode);

    // Ensure gain is fully restored to 1.0 (recovering from any ducking or stopImmediate)
    if (this.gainNode && this.audioContext && this.audioContext.state === 'running') {
      try {
        const now = this.audioContext.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(1.0, now);
      } catch (_) {}
    }

    const currentTime = this.audioContext.currentTime;
    if (this.nextScheduleTime <= currentTime) {
      // A future cursor is queued speech, not drift. Never rewind it: doing so
      // overlaps sources when Gemini sends a burst or the renderer stalls.
      this.nextScheduleTime = currentTime + 0.015;
    }

    const effectiveRate = source.playbackRate?.value || 1.0;
    source.start(this.nextScheduleTime);
    this.nextScheduleTime += audioBuffer.duration / effectiveRate;
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
      this._checkEndState();
    };
  }

  _checkEndState() {
    if (this.activeSources.length === 0 && this.pcmQueue.length === 0 && !this._isPrebuffering) {
      if (this._endGraceTimer) clearTimeout(this._endGraceTimer);

      // If turn is complete, short grace period (120ms) to ensure tail finishes.
      // If turn is still ongoing, generous grace period (650ms) to bridge natural inter-clause neural pauses without stuttering!
      const graceMs = this.isTurnComplete ? 120 : 650;

      this._endGraceTimer = setTimeout(() => {
        if (this.activeSources.length === 0 && this.pcmQueue.length === 0 && !this._isPrebuffering) {
          this.isPlaying = false;
          this.nextScheduleTime = 0;
          this.isTurnComplete = false;
          this.onLipSyncUpdate(0);
          this.onVolumeChange(0);
          this.onAudioEnd();
          eventBus.emit(EVENTS.AUDIO_END);
          if (this.analysisService) {
            this.analysisService.stop();
          }
        }
        this._endGraceTimer = null;
      }, graceMs);
    }
  }

  async playAudioChunk(base64Data) {
    return await this.playChunk(base64Data);
  }

  /**
   * Stop immediately (on user speech interruption / Barge-in)
   */
  stopImmediate() {
    this._generation++;
    if (this._prebufferTimer) {
      clearTimeout(this._prebufferTimer);
      this._prebufferTimer = null;
    }
    if (this._endGraceTimer) {
      clearTimeout(this._endGraceTimer);
      this._endGraceTimer = null;
    }

    this._isPrebuffering = false;
    this.pcmQueue = [];
    this.isTurnComplete = false;

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
    this._destroyed = true;
    this.stopImmediate();
    if (typeof window !== 'undefined' && this._unlock) {
      ['click', 'keydown', 'touchstart'].forEach((evt) => window.removeEventListener(evt, this._unlock));
      this._unlock = null;
    }
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
      this.audioContext.onstatechange = null;
      try {
        this.audioContext.close()?.catch(() => {});
      } catch (_) {}
      this.audioContext = null;
    }
  }
}
