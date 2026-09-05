/**
 * Cristi Desktop - Screen Capture Service
 * Manages native OS screen capture (Electron desktopCapturer C++ API) and getDisplayMedia stream,
 * full-screen and regional frame captures, with adaptive FPS throttling per Gemini model.
 */

import { logger } from './logger.js';
import { electronBridge } from './desktop/ElectronBridge.js';
import { eventBus, EVENTS } from './eventBus.js';
import { CaptureLoop } from './vision/CaptureLoop.js';

export class ScreenCaptureService {
  constructor({ onFrame, onError, onStreamReady, onStreamEnd } = {}) {
    this.onFrame = onFrame || (() => {});
    this.onError = onError || console.error;
    this.onStreamReady = onStreamReady || (() => {});
    this.onStreamEnd = onStreamEnd || (() => {});

    this.stream = null;
    this.videoEl = null;
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.isCapturing = false;
    this.fps = 1.0;
    this.captureGeneration = 0;
    this.streamRequestGeneration = 0;
    this.captureRequest = null;
    this.cancelCaptureSetup = null;
    this.captureLoop = new CaptureLoop({
      capture: async () => {
        const region = this.region;
        const frame = await this.captureActiveFrame();
        return region === this.region ? frame : null;
      },
      onFrame: frame => this.onFrame(frame),
      shouldCapture: () => !this.isAiSpeaking,
      onError: error => logger.warn('VISION', `Error capturando pantalla: ${error.message}`)
    });

    // Active region: null = full screen, else {x_pct, y_pct, w_pct, h_pct}
    this.region = null;
    this.screenW = typeof window !== 'undefined' ? window.screen.width : 1920;
    this.screenH = typeof window !== 'undefined' ? window.screen.height : 1080;

    // AI Speech Shield: suspend video frames while Cristi is speaking to prevent audio stuttering
    this.isAiSpeaking = false;
    this.subscribeAudio();
  }

  subscribeAudio() {
    if (this._unsubAudioStart) return;
    this._unsubAudioStart = eventBus.on(EVENTS.AUDIO_START, () => {
      this.isAiSpeaking = true;
    });
    this._unsubAudioEnd = eventBus.on(EVENTS.AUDIO_END, () => {
      this.isAiSpeaking = false;
      if (this.isCapturing) {
        this.triggerImmediateCapture();
      }
    });
  }

  /**
   * Captures the native OS desktop screen via Electron IPC (desktopCapturer / native C++).
   * Uses the Electron capture bridge; capture cost depends on display size and load.
   * @param {Object} [region] - Optional { x_pct, y_pct, w_pct, h_pct }
   */
  async captureNativeDesktop(region = null) {
    if (!electronBridge.isElectron) return null;

    try {
      const activeRegion = region || this.region;
      const base64 = await electronBridge.captureScreenNative(activeRegion);
      if (base64 && base64.length > 100) {
        return base64;
      }
    } catch (err) {
      logger.warn('VISION', `Fallo captura nativa de escritorio: ${err.message}`);
    }
    return null;
  }

  /** A late permission response cannot revive a stopped or replaced stream. */
  async requestCapture() {
    if (this.stream) return true;
    if (this.captureRequest) return this.captureRequest;
    const generation = this.streamRequestGeneration;
    const request = this.prepareCapture(generation);
    this.captureRequest = request;
    try {
      return await request;
    } finally {
      if (this.captureRequest === request) this.captureRequest = null;
    }
  }

  async prepareCapture(generation) {
    let stream;
    let video;
    let timeout;
    let cancel;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: 5, max: 10 },
          width: { ideal: window.screen.width },
          height: { ideal: window.screen.height }
        },
        audio: false
      });
      if (generation !== this.streamRequestGeneration) return false;
      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      const cancelled = new Promise((_, reject) => {
        cancel = () => reject(new Error('Captura de pantalla cancelada.'));
        this.cancelCaptureSetup = cancel;
        timeout = setTimeout(() => reject(new Error('La pantalla no entregó vídeo en 10 segundos.')), 10000);
      });
      await Promise.race([video.play(), cancelled]);
      if (generation !== this.streamRequestGeneration) return false;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo preparar el lienzo de captura.');
      this.stream = stream;
      this.videoEl = video;
      this.offscreenCanvas = canvas;
      this.offscreenCtx = context;
      stream.getVideoTracks()[0].onended = () => {
        if (this.stream !== stream) return;
        this.stopAll();
        this.onStreamEnd();
      };
      this.onStreamReady();
      return generation === this.streamRequestGeneration;
    } catch (error) {
      if (generation === this.streamRequestGeneration) this.onError(error);
      return false;
    } finally {
      clearTimeout(timeout);
      if (this.cancelCaptureSetup === cancel) this.cancelCaptureSetup = null;
      if (stream && this.stream !== stream) {
        stream.getTracks().forEach(track => track.stop());
        if (video) { video.pause(); video.srcObject = null; }
      }
    }
  }

  /**
   * Capture a single frame from the stream.
   * @param {object|null} region - {x, y, width, height} in pixels, or null for full.
   * @param {number} quality - JPEG quality 0–1.
   * @returns {string|null} base64 JPEG data.
   */
  captureFrame(region = null, quality = 0.55) {
    if (!this.videoEl || !this.offscreenCanvas || this.videoEl.readyState < 2) return null;

    const videoWidth = this.videoEl.videoWidth;
    const videoHeight = this.videoEl.videoHeight;
    const raw = region || { x: 0, y: 0, width: videoWidth, height: videoHeight };
    const x = Math.max(0, Math.min(videoWidth - 1, Math.round(raw.x || 0)));
    const y = Math.max(0, Math.min(videoHeight - 1, Math.round(raw.y || 0)));
    const width = Math.max(1, Math.min(videoWidth - x, Math.round(raw.width || videoWidth)));
    const height = Math.max(1, Math.min(videoHeight - y, Math.round(raw.height || videoHeight)));
    const src = { x, y, width, height };
    const maxWidth = 768;
    const scale = Math.min(1, maxWidth / src.width);
    const destW = Math.round(src.width * scale);
    const destH = Math.round(src.height * scale);

    this.offscreenCanvas.width = destW;
    this.offscreenCanvas.height = destH;

    this.offscreenCtx.drawImage(
      this.videoEl,
      src.x, src.y, src.width, src.height,
      0, 0, destW, destH
    );

    const dataUrl = this.offscreenCanvas.toDataURL('image/jpeg', quality);
    return dataUrl.split(',')[1];
  }

  /**
   * Capture active frame (prefers native IPC in Electron, falls back to stream).
   */
  async captureActiveFrame() {
    if (electronBridge.isElectron) {
      const nativeFrame = await this.captureNativeDesktop(this.region);
      if (nativeFrame) return nativeFrame;
    }

    if (this.stream && this.videoEl) {
      return this.captureFrame(this.activeRegionPixels());
    }

    return null;
  }

  /** Convert percentage-based region to pixel coordinates */
  activeRegionPixels() {
    if (!this.region || !this.videoEl) return null;
    const vw = this.videoEl.videoWidth;
    const vh = this.videoEl.videoHeight;
    return {
      x: Math.round((this.region.x_pct / 100) * vw),
      y: Math.round((this.region.y_pct / 100) * vh),
      width: Math.round((this.region.w_pct / 100) * vw),
      height: Math.round((this.region.h_pct / 100) * vh)
    };
  }

  setRegion({ x_pct, y_pct, w_pct, h_pct }) {
    const safeX = Math.max(0, Math.min(99, typeof x_pct === 'number' && !isNaN(x_pct) ? x_pct : 0));
    const safeY = Math.max(0, Math.min(99, typeof y_pct === 'number' && !isNaN(y_pct) ? y_pct : 0));
    const safeW = Math.max(1, Math.min(100 - safeX, typeof w_pct === 'number' && !isNaN(w_pct) ? w_pct : 100));
    const safeH = Math.max(1, Math.min(100 - safeY, typeof h_pct === 'number' && !isNaN(h_pct) ? h_pct : 100));

    this.region = { x_pct: safeX, y_pct: safeY, w_pct: safeW, h_pct: safeH };
    logger.info('VISION', `Región de visión configurada: x=${safeX}% y=${safeY}% w=${safeW}% h=${safeH}%`);
  }

  clearRegion() {
    this.region = null;
    logger.info('VISION', 'Región de visión restablecida a pantalla completa.');
  }

  /** Native and browser capture share one inFlight owner and one recurring timer. */
  async startContinuous(fps = 0.5) {
    if (this.isCapturing) return true;
    this.fps = Math.max(0.2, Math.min(0.5, Number.isFinite(fps) ? fps : 0.5));
    this.isCapturing = true;
    this.subscribeAudio();
    const generation = ++this.captureGeneration;
    if (!electronBridge.isElectron) {
      const ok = await this.requestCapture();
      if (generation !== this.captureGeneration) return false;
      if (!ok) {
        this.isCapturing = false;
        return false;
      }
    }
    this.captureLoop.start(Math.round(1000 / this.fps));
    logger.info('VISION', `Vigilancia continua de pantalla iniciada (${this.fps} FPS).`);
    return true;
  }

  stopContinuous() {
    this.isCapturing = false;
    this.captureGeneration++;
    if (this.captureRequest) {
      this.streamRequestGeneration++;
      this.cancelCaptureSetup?.();
      this.captureRequest = null;
    }
    this.captureLoop.stop();
  }

  triggerImmediateCapture() {
    if (this.isCapturing && !this.isAiSpeaking) this.captureLoop.requestImmediate();
  }

  stopAll() {
    this.stopContinuous();
    this.streamRequestGeneration++;
    this.cancelCaptureSetup?.();
    this.captureRequest = null;
    this._unsubAudioStart?.();
    this._unsubAudioEnd?.();
    this._unsubAudioStart = this._unsubAudioEnd = null;
    this.isAiSpeaking = false;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => {
        try { t.stop(); } catch (_) {}
      });
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
      try { this.videoEl.pause(); } catch (_) {}
      this.videoEl = null;
    }
    if (this.offscreenCanvas) {
      if (this.offscreenCtx) {
        try {
          this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        } catch (_) {}
      }
      this.offscreenCanvas.width = 0;
      this.offscreenCanvas.height = 0;
      this.offscreenCanvas = null;
      this.offscreenCtx = null;
    }
    this.region = null;
  }

  get isStreamActive() {
    return !!(this.stream && this.stream.active);
  }
}
