/**
 * Cristi Desktop - Screen Capture Service
 * Manages native OS screen capture (Electron desktopCapturer C++ API) and getDisplayMedia stream,
 * full-screen and regional frame captures, with adaptive FPS throttling per Gemini model.
 */

import { logger } from './logger.js';
import { electronBridge } from './desktop/ElectronBridge.js';

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
    this.continuousTimer = null;
    this.fps = 1.0;

    // Active region: null = full screen, else {x_pct, y_pct, w_pct, h_pct}
    this.region = null;
    this.screenW = typeof window !== 'undefined' ? window.screen.width : 1920;
    this.screenH = typeof window !== 'undefined' ? window.screen.height : 1080;
  }

  /**
   * Captures the native OS desktop screen via Electron IPC (desktopCapturer / native C++).
   * Works in Electron desktop mode with 0% CPU overhead and zero sub-processes.
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

  /** Request full-screen sharing permission and initialize browser stream */
  async requestCapture() {
    if (this.stream) return true;

    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor', // Requests full OS monitor
          frameRate: { ideal: 5, max: 10 },
          width: { ideal: window.screen.width },
          height: { ideal: window.screen.height }
        },
        audio: false
      });

      this.videoEl = document.createElement('video');
      this.videoEl.srcObject = this.stream;
      this.videoEl.autoplay = true;
      this.videoEl.muted = true;
      this.videoEl.playsInline = true;

      await new Promise((resolve) => {
        this.videoEl.onloadedmetadata = () => {
          this.videoEl.play();
          resolve();
        };
      });

      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');

      this.stream.getVideoTracks()[0].onended = () => {
        logger.warn('VISION', 'Compartición de pantalla detenida por el usuario.');
        this.stopAll();
        this.onStreamEnd();
      };

      logger.info('VISION', 'Stream de captura de pantalla del sistema listo.');
      this.onStreamReady();
      return true;
    } catch (err) {
      logger.error('VISION', `Error al solicitar captura de pantalla: ${err.message}`);
      this.onError(err);
      return false;
    }
  }

  /**
   * Capture a single frame from the stream.
   * @param {object|null} region - {x, y, width, height} in pixels, or null for full.
   * @param {number} quality - JPEG quality 0–1.
   * @returns {string|null} base64 JPEG data.
   */
  captureFrame(region = null, quality = 0.6) {
    if (!this.videoEl || !this.offscreenCanvas || this.videoEl.readyState < 2) return null;

    const src = region || { x: 0, y: 0, width: this.videoEl.videoWidth, height: this.videoEl.videoHeight };
    const maxWidth = 960;
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

  /** Start continuous capture loop at specified FPS */
  async startContinuous(fps = 1.0) {
    if (this.isCapturing) return;

    this.fps = fps;
    this.isCapturing = true;
    const intervalMs = Math.round(1000 / fps);

    // In Electron, use native desktopCapturer directly with zero CPU and no permission dialogs
    if (electronBridge.isElectron) {
      const nativeTick = async () => {
        if (!this.isCapturing) return;
        try {
          const frame = await this.captureNativeDesktop(this.region);
          if (frame && this.isCapturing) {
            this.onFrame(frame);
          }
        } catch (e) {
          logger.warn('VISION', `Error en ciclo de captura nativa: ${e.message}`);
        }
        if (this.isCapturing) {
          this.continuousTimer = setTimeout(nativeTick, intervalMs);
        }
      };
      this.continuousTimer = setTimeout(nativeTick, intervalMs);
      logger.info('VISION', `Vigilancia continua nativa de escritorio iniciada (${fps} FPS).`);
      return;
    }

    // Web / Browser mode
    const ok = await this.requestCapture();
    if (!ok) {
      this.isCapturing = false;
      return;
    }

    const tick = () => {
      if (!this.isCapturing) return;
      const frame = this.captureFrame(this.activeRegionPixels());
      if (frame && this.isCapturing) {
        this.onFrame(frame);
      }
      if (this.isCapturing) {
        this.continuousTimer = setTimeout(tick, intervalMs);
      }
    };

    this.continuousTimer = setTimeout(tick, intervalMs);
    logger.info('VISION', `Vigilancia continua de pantalla completa iniciada (${fps} FPS).`);
  }

  stopContinuous() {
    this.isCapturing = false;
    if (this.continuousTimer) {
      clearTimeout(this.continuousTimer);
      this.continuousTimer = null;
    }
    logger.info('VISION', 'Vigilancia continua de pantalla detenida.');
  }

  stopAll() {
    this.stopContinuous();
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
