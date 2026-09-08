/**
 * Cristi AI - Screen Capture Engine
 * High-performance, low-latency desktop capture engine supporting:
 * - Native Electron desktopCapturer & WebRTC getDisplayMedia streaming at up to 60 FPS.
 * - Precision percentage region cropping ({ x, y, width, height }).
 * - JPEG and WebP compression optimized for Gemini Multimodal Live WebSocket streaming.
 */

import type {
  ScreenRegion,
  ScreenImageFormat,
  ScreenCaptureOptions,
  CapturedFrame
} from '@/types';

// Declare electronAPI on window for TypeScript
declare global {
  interface Window {
    electronAPI?: {
      isElectron?: boolean;
      captureScreenNative?: (region: { x_pct: number; y_pct: number; w_pct: number; h_pct: number } | null) => Promise<string | null>;
      [key: string]: unknown;
    };
  }
}

export class ScreenCaptureEngine {
  private options: Required<Omit<ScreenCaptureOptions, 'screenRegion'>> & { screenRegion: ScreenRegion | null };
  private isRunning: boolean = false;
  private isCaptureInProgress: boolean = false;
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private offscreenCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private offscreenCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private animFrameId: number | null = null;
  private frameIndex: number = 0;
  private lastFrameTimestamp: number = 0;
  private rollingFps: number = 0;
  private frameCountInWindow: number = 0;
  private fpsWindowStart: number = Date.now();

  private readonly frameListeners: Set<(frame: CapturedFrame) => void> = new Set();
  private readonly errorListeners: Set<(err: Error) => void> = new Set();

  constructor(options: ScreenCaptureOptions = {}) {
    this.options = {
      fps: Math.max(0.5, Math.min(60, options.fps ?? 30)),
      format: options.format ?? 'jpeg',
      quality: Math.max(0.1, Math.min(1.0, options.quality ?? 0.6)),
      maxWidth: Math.max(240, options.maxWidth ?? 768),
      maxHeight: options.maxHeight ?? 432,
      screenRegion: options.screenRegion ?? null,
      preferNativeIpc: options.preferNativeIpc ?? false
    };

    this.initCanvas();
  }

  /**
   * Initializes hardware-accelerated canvas context for fast blitting and compression.
   */
  private initCanvas(): void {
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        this.offscreenCanvas = new OffscreenCanvas(this.options.maxWidth, this.options.maxHeight);
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', {
          alpha: false,
          desynchronized: true,
          willReadFrequently: false
        });
        return;
      } catch (_) {
        // Fall back to DOM canvas
      }
    }

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = this.options.maxWidth;
      canvas.height = this.options.maxHeight;
      this.offscreenCanvas = canvas;
      this.offscreenCtx = canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
        willReadFrequently: false
      });
    }
  }

  /**
   * Normalize input region into standard clamped percentages (0 to 100).
   */
  private normalizeRegion(region: ScreenRegion | null): { xPct: number; yPct: number; wPct: number; hPct: number } | null {
    if (!region) return null;

    // Detect normalized (0.0 to 1.0) vs percentage (0 to 100)
    const isNormalized = region.width <= 1.0 && region.height <= 1.0 && (region.x > 0 || region.width > 0);
    const scale = isNormalized ? 100 : 1;

    const rawX = (typeof region.x === 'number' && !isNaN(region.x)) ? region.x * scale : 0;
    const rawY = (typeof region.y === 'number' && !isNaN(region.y)) ? region.y * scale : 0;
    const rawW = (typeof region.width === 'number' && !isNaN(region.width)) ? region.width * scale : 100;
    const rawH = (typeof region.height === 'number' && !isNaN(region.height)) ? region.height * scale : 100;

    const xPct = Math.max(0, Math.min(99, rawX));
    const yPct = Math.max(0, Math.min(99, rawY));
    const wPct = Math.max(1, Math.min(100 - xPct, rawW));
    const hPct = Math.max(1, Math.min(100 - yPct, rawH));

    return { xPct, yPct, wPct, hPct };
  }

  /**
   * Start continuous high-frame-rate screen capture loop.
   */
  public async start(options?: ScreenCaptureOptions): Promise<void> {
    if (this.isRunning) {
      if (options) this.updateConfig(options);
      return;
    }

    if (options) {
      this.updateConfig(options);
    }

    this.isRunning = true;
    this.frameCountInWindow = 0;
    this.fpsWindowStart = Date.now();

    // Check if running in Electron environment
    const hasElectronIpc = typeof window !== 'undefined' && Boolean(window.electronAPI?.captureScreenNative);

    // If high FPS (> 5 FPS) or running in browser, initialize MediaStream for real-time capture
    if (!this.options.preferNativeIpc || !hasElectronIpc) {
      try {
        await this.initializeMediaStream();
      } catch (streamErr) {
        if (!hasElectronIpc) {
          this.isRunning = false;
          const err = streamErr instanceof Error ? streamErr : new Error(String(streamErr));
          this.notifyError(err);
          throw err;
        }
        // Fall back to Electron IPC if stream permission was declined/failed
      }
    }

    this.scheduleNextTick();
  }

  /**
   * Initializes desktop video capture stream via MediaDevices API.
   */
  private async initializeMediaStream(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('WebRTC getDisplayMedia is not available in current context.');
    }

    if (this.stream) {
      return;
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: this.options.fps, max: 60 },
        cursor: 'always'
      } as MediaTrackConstraints,
      audio: false
    });

    this.stream = stream;

    if (typeof document !== 'undefined') {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;

      await new Promise<void>((resolve, reject) => {
        const onPlaying = () => {
          video.removeEventListener('playing', onPlaying);
          resolve();
        };
        video.addEventListener('playing', onPlaying);
        video.play().catch(reject);
      });

      this.videoEl = video;
    }

    // Auto-cleanup on stream stop
    const track = stream.getVideoTracks()[0];
    if (track) {
      track.onended = () => {
        this.stop();
      };
    }
  }

  /**
   * Stop the capture loop and release resources.
   */
  public stop(): void {
    this.isRunning = false;
    this.isCaptureInProgress = false;

    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    if (this.animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.srcObject = null;
      this.videoEl = null;
    }
  }

  /**
   * Updates configuration dynamically without interrupting capture.
   */
  public updateConfig(options: ScreenCaptureOptions): void {
    if (typeof options.fps === 'number') {
      this.options.fps = Math.max(0.5, Math.min(60, options.fps));
    }
    if (options.format) {
      this.options.format = options.format;
    }
    if (typeof options.quality === 'number') {
      this.options.quality = Math.max(0.1, Math.min(1.0, options.quality));
    }
    if (typeof options.maxWidth === 'number') {
      this.options.maxWidth = Math.max(240, options.maxWidth);
    }
    if (typeof options.maxHeight === 'number') {
      this.options.maxHeight = options.maxHeight;
    }
    if (options.screenRegion !== undefined) {
      this.options.screenRegion = options.screenRegion;
    }
    if (options.preferNativeIpc !== undefined) {
      this.options.preferNativeIpc = options.preferNativeIpc;
    }
  }

  public setRegion(region: ScreenRegion | null): void {
    this.options.screenRegion = region;
  }

  public getRegion(): ScreenRegion | null {
    return this.options.screenRegion;
  }

  public clearRegion(): void {
    this.options.screenRegion = null;
  }

  public setTargetFps(fps: number): void {
    this.options.fps = Math.max(0.5, Math.min(60, fps));
  }

  public setFormat(format: ScreenImageFormat, quality?: number): void {
    this.options.format = format;
    if (typeof quality === 'number') {
      this.options.quality = Math.max(0.1, Math.min(1.0, quality));
    }
  }

  /**
   * Internal scheduler respecting target FPS.
   */
  private scheduleNextTick(): void {
    if (!this.isRunning) return;

    const intervalMs = Math.max(16, Math.floor(1000 / this.options.fps));

    this.timerId = setTimeout(async () => {
      if (!this.isRunning) return;

      // Skip tick if previous capture is still encoding to prevent frame stacking
      if (!this.isCaptureInProgress) {
        try {
          this.isCaptureInProgress = true;
          const frame = await this.captureFrame(this.options.screenRegion);
          if (frame && this.isRunning) {
            this.updateFpsCounter();
            frame.fpsActual = this.rollingFps;
            this.notifyFrame(frame);
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          this.notifyError(error);
        } finally {
          this.isCaptureInProgress = false;
        }
      }

      this.scheduleNextTick();
    }, intervalMs);
  }

  private updateFpsCounter(): void {
    const now = Date.now();
    this.frameCountInWindow++;
    const elapsed = now - this.fpsWindowStart;
    if (elapsed >= 1000) {
      this.rollingFps = Math.round((this.frameCountInWindow * 1000) / elapsed);
      this.frameCountInWindow = 0;
      this.fpsWindowStart = now;
    }
  }

  /**
   * Captures a single frame, cropping region and compressing to Base64.
   */
  public async captureFrame(targetRegion: ScreenRegion | null = this.options.screenRegion): Promise<CapturedFrame | null> {
    const norm = this.normalizeRegion(targetRegion);

    // Option A: Fast WebRTC Stream path (capable of solid 60 FPS)
    if (this.videoEl && this.videoEl.readyState >= 2) {
      return this.captureFromVideoElement(this.videoEl, norm, targetRegion);
    }

    // Option B: Native Electron IPC desktopCapturer path
    if (typeof window !== 'undefined' && window.electronAPI?.captureScreenNative) {
      return this.captureFromElectronIpc(norm, targetRegion);
    }

    return null;
  }

  /**
   * Ultra-fast hardware canvas blitting from active HTMLVideoElement.
   */
  private async captureFromVideoElement(
    video: HTMLVideoElement,
    norm: { xPct: number; yPct: number; wPct: number; hPct: number } | null,
    originalRegion: ScreenRegion | null
  ): Promise<CapturedFrame | null> {
    const sourceW = video.videoWidth || 1920;
    const sourceH = video.videoHeight || 1080;

    let sx = 0;
    let sy = 0;
    let sw = sourceW;
    let sh = sourceH;

    if (norm) {
      sx = Math.floor((norm.xPct / 100) * sourceW);
      sy = Math.floor((norm.yPct / 100) * sourceH);
      sw = Math.max(1, Math.min(sourceW - sx, Math.floor((norm.wPct / 100) * sourceW)));
      sh = Math.max(1, Math.min(sourceH - sy, Math.floor((norm.hPct / 100) * sourceH)));
    }

    // Scale down proportionally to maxWidth for Gemini Multimodal Live bandwidth efficiency
    const targetW = Math.min(this.options.maxWidth, sw);
    const targetH = Math.max(1, Math.round((sh / Math.max(1, sw)) * targetW));

    const canvas = this.getSizedCanvas(targetW, targetH);
    const ctx = this.offscreenCtx;
    if (!ctx) return null;

    // Fast bilinear draw
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);

    const mimeType = this.options.format === 'webp' ? 'image/webp' : 'image/jpeg';
    const quality = this.options.quality;

    let dataBase64 = '';
    let dataUrl = '';

    if ('convertToBlob' in canvas) {
      // OffscreenCanvas modern async path
      const blob = await (canvas as OffscreenCanvas).convertToBlob({
        type: mimeType,
        quality
      });
      const buffer = await blob.arrayBuffer();
      dataBase64 = this.arrayBufferToBase64(buffer);
      dataUrl = `data:${mimeType};base64,${dataBase64}`;
    } else {
      // Standard HTMLCanvasElement path
      dataUrl = (canvas as HTMLCanvasElement).toDataURL(mimeType, quality);
      dataBase64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    }

    this.frameIndex++;
    this.lastFrameTimestamp = Date.now();

    return {
      dataBase64,
      dataUrl,
      mimeType,
      timestamp: this.lastFrameTimestamp,
      width: targetW,
      height: targetH,
      frameIndex: this.frameIndex,
      region: originalRegion
    };
  }

  /**
   * Native Electron IPC capture fallback using desktopCapturer.
   */
  private async captureFromElectronIpc(
    norm: { xPct: number; yPct: number; wPct: number; hPct: number } | null,
    originalRegion: ScreenRegion | null
  ): Promise<CapturedFrame | null> {
    try {
      const ipcRegion = norm
        ? { x_pct: norm.xPct, y_pct: norm.yPct, w_pct: norm.wPct, h_pct: norm.hPct }
        : null;

      const base64Result = await window.electronAPI!.captureScreenNative!(ipcRegion);
      if (!base64Result) return null;

      // Clean prefix if returned with data URL
      const cleanBase64 = base64Result.replace(/^data:image\/[a-z]+;base64,/, '');
      const mimeType = 'image/jpeg';

      this.frameIndex++;
      this.lastFrameTimestamp = Date.now();

      return {
        dataBase64: cleanBase64,
        dataUrl: `data:${mimeType};base64,${cleanBase64}`,
        mimeType,
        timestamp: this.lastFrameTimestamp,
        width: this.options.maxWidth,
        height: this.options.maxHeight,
        frameIndex: this.frameIndex,
        region: originalRegion
      };
    } catch (err) {
      return null;
    }
  }

  private getSizedCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
    if (!this.offscreenCanvas) {
      this.initCanvas();
    }
    if (this.offscreenCanvas!.width !== width || this.offscreenCanvas!.height !== height) {
      this.offscreenCanvas!.width = width;
      this.offscreenCanvas!.height = height;
    }
    return this.offscreenCanvas!;
  }

  /**
   * Zero-allocation chunked Base64 encoding for ArrayBuffer.
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    const chunkSize = 0x8000; // 32KB chunks to prevent maximum call stack size exceeded
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, Math.min(i + chunkSize, len)) as unknown as number[]
      );
    }
    return btoa(binary);
  }

  public onFrame(callback: (frame: CapturedFrame) => void): () => void {
    this.frameListeners.add(callback);
    return () => this.frameListeners.delete(callback);
  }

  public onError(callback: (err: Error) => void): () => void {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }

  private notifyFrame(frame: CapturedFrame): void {
    for (const listener of this.frameListeners) {
      try {
        listener(frame);
      } catch (e) {
        console.error('[ScreenCaptureEngine] Error in frame listener:', e);
      }
    }
  }

  private notifyError(err: Error): void {
    for (const listener of this.errorListeners) {
      try {
        listener(err);
      } catch (e) {
        console.error('[ScreenCaptureEngine] Error in error listener:', e);
      }
    }
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      currentFps: this.rollingFps,
      targetFps: this.options.fps,
      format: this.options.format,
      quality: this.options.quality,
      region: this.options.screenRegion,
      hasStream: Boolean(this.stream?.active),
      totalFramesCaptured: this.frameIndex
    };
  }

  public dispose(): void {
    this.stop();
    this.frameListeners.clear();
    this.errorListeners.clear();
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
  }
}
