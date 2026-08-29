/**
 * Cristi AI - Screen Capture Service
 * Manages native OS screen capture (Neutralino/Windows) and getDisplayMedia stream,
 * full-screen and regional frame captures, with adaptive FPS throttling per Gemini model.
 */

import { logger } from './logger';

export class ScreenCaptureService {
  constructor({ onFrame, onError, onStreamReady, onStreamEnd }) {
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
    this.screenW = window.screen.width;
    this.screenH = window.screen.height;
  }

  /**
   * Captures the native OS desktop screen directly via Windows PowerShell/.NET.
   * Works in Neutralino desktop mode without requiring browser stream dialog.
   */
  async captureNativeDesktop() {
    if (!window.Neutralino) return null;

    try {
      const psScript = `
Add-Type -AssemblyName System.Windows.Forms,System.Drawing;
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height;
$g = [System.Drawing.Graphics]::FromImage($bmp);
$g.CopyFromScreen(0, 0, 0, 0, $bmp.Size);
$targetW = [Math]::Min(960, $bounds.Width);
$targetH = [Math]::Round(($bounds.Height / $bounds.Width) * $targetW);
$scaled = New-Object System.Drawing.Bitmap $targetW, $targetH;
$sg = [System.Drawing.Graphics]::FromImage($scaled);
$sg.DrawImage($bmp, 0, 0, $targetW, $targetH);
$ms = New-Object System.IO.MemoryStream;
$scaled.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg);
[Convert]::ToBase64String($ms.ToArray());
$g.Dispose(); $sg.Dispose(); $bmp.Dispose(); $scaled.Dispose(); $ms.Dispose();
      `.replace(/\r?\n/g, ' ');

      const res = await window.Neutralino.os.execCommand(`powershell -NoProfile -Command "${psScript}"`);
      const base64 = res.stdOut?.trim();
      if (base64 && base64.length > 500) {
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
   * Capture active frame (from native desktop if no stream, or active region stream).
   */
  async captureActiveFrame() {
    if (this.stream && this.videoEl) {
      return this.captureFrame(this.activeRegionPixels());
    }
    // Fallback to native OS desktop capture
    return await this.captureNativeDesktop();
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
    this.region = { x_pct, y_pct, w_pct, h_pct };
    logger.info('VISION', `Región de visión configurada: x=${x_pct}% y=${y_pct}% w=${w_pct}% h=${h_pct}%`);
  }

  clearRegion() {
    this.region = null;
    logger.info('VISION', 'Región de visión restablecida a pantalla completa.');
  }

  /** Start continuous capture loop at specified FPS */
  async startContinuous(fps = 1.0) {
    if (this.isCapturing) return;

    const ok = await this.requestCapture();
    if (!ok) {
      // In Neutralino, continuous capture can also work via native desktop loop
      if (window.Neutralino) {
        this.isCapturing = true;
        this.fps = fps;
        const intervalMs = Math.round(1000 / fps);
        const nativeTick = async () => {
          if (!this.isCapturing) return;
          const frame = await this.captureNativeDesktop();
          if (frame) {
            this.onFrame(frame);
          }
          this.continuousTimer = setTimeout(nativeTick, intervalMs);
        };
        this.continuousTimer = setTimeout(nativeTick, intervalMs);
        logger.info('VISION', `Vigilancia continua de escritorio iniciada (${fps} FPS).`);
        return;
      }
      return;
    }

    this.fps = fps;
    this.isCapturing = true;
    const intervalMs = Math.round(1000 / fps);

    const tick = () => {
      if (!this.isCapturing) return;
      const frame = this.captureFrame(this.activeRegionPixels());
      if (frame) {
        this.onFrame(frame);
      }
      this.continuousTimer = setTimeout(tick, intervalMs);
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
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
      this.videoEl = null;
    }
    this.region = null;
  }

  get isStreamActive() {
    return !!(this.stream && this.stream.active);
  }
}
