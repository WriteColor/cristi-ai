/**
 * Cristi AI - Modernized Vision Stream Manager
 * High-performance, low-latency visual perception engine for real-time continuous screen & camera streaming to Gemini Live.
 */

import { electronBridge } from '../desktop/ElectronBridge.js';
import { logger } from '../logger.js';
import { eventBus, EVENTS } from '../eventBus.js';
import { VisionFrameDispatcher } from './VisionFrameDispatcher.js';
import { CaptureLoop } from './CaptureLoop.js';

export class VisionStreamManager {
  constructor({ socketRef } = {}) {
    this.socketRef = socketRef; // Reference to active GeminiLiveSocket
    this.frameDispatcher = new VisionFrameDispatcher({ socketRef });

    // Screen Streamer State
    this.isScreenStreaming = false;
    this.screenLoop = new CaptureLoop({
      capture: async () => {
        const region = this.screenRegion;
        const frame = await this.captureScreenNative(region);
        return region === this.screenRegion ? frame : null;
      },
      onFrame: frame => this.frameDispatcher.enqueue(frame, 'screen'),
      shouldCapture: () => this.socketRef?.current?.isConnected
        && (this.socketRef.current.websocket?.bufferedAmount || 0) <= 65536,
      onError: error => logger.warn('VISION', 'Error capturando pantalla:', error.message)
    });
    this.screenFPS = 0.5; // 1 frame every 2 seconds default (energy efficient)
    this.screenRegion = null; // { x_pct, y_pct, w_pct, h_pct }

    // Camera Streamer State
    this.isCameraStreaming = false;
    this.cameraGeneration = 0;
    this.disposed = false;
    this.cameraLoop = new CaptureLoop({
      capture: () => {
        if (!this.videoElement || this.videoElement.readyState < 2 || !this.cameraCanvas) return null;
        const ctx = this.cameraCanvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(this.videoElement, 0, 0, this.cameraCanvas.width, this.cameraCanvas.height);
        return this.cameraCanvas.toDataURL('image/jpeg', 0.7).split(',')[1];
      },
      onFrame: frame => this.frameDispatcher.enqueue(frame, 'camera'),
      shouldCapture: () => this.socketRef?.current?.isConnected
        && (this.socketRef.current.websocket?.bufferedAmount || 0) <= 65536,
      onError: error => logger.warn('VISION', 'Error capturando cámara:', error.message)
    });
    this.cameraStream = null;
    this.videoElement = null;
    this.cameraCanvas = null;
    this.cameraFPS = 0.5;

    // Face / Emotion Detections Cache
    this.lastDetection = {
      isFacePresent: false,
      emotion: 'neutral',
      age: null,
      gender: null
    };

    // Audio state triggers a prompt fresh frame once speech ends. The shared
    // dispatcher keeps a low-rate visual budget during speech instead of
    // starving Gemini of context for the entire response.
    this.isAiSpeaking = false;
    this.unsubAudioStart = eventBus.on(EVENTS.AUDIO_START, () => {
      this.isAiSpeaking = true;
    });
    this.unsubAudioEnd = eventBus.on(EVENTS.AUDIO_END, () => {
      this.isAiSpeaking = false;
      this.screenLoop.requestImmediate();
      this.cameraLoop.requestImmediate();
    });
  }

  setSocketRef(socketRef) {
    this.socketRef = socketRef;
    this.frameDispatcher.setSocketRef(socketRef);
  }

  /**
   * Continuous Screen Capture Streamer directly sending frames to Gemini Live
   */
  startScreenMonitoring({ fps = 0.5, region = null } = {}) {
    if (this.disposed) return false;
    this.stopScreenMonitoring();
    this.screenFPS = Math.max(0.2, Math.min(0.5, Number.isFinite(fps) ? fps : 0.5));
    this.screenRegion = region;
    this.isScreenStreaming = true;
    // CaptureLoop keeps one inFlight operation even when monitoring is restarted.
    this.screenLoop.start(Math.round(1000 / this.screenFPS));
    eventBus.emit(EVENTS.CONFIG_CHANGED, { type: 'screen_monitoring_started', fps: this.screenFPS });
    return true;
  }

  stopScreenMonitoring() {
    this.isScreenStreaming = false;
    this.screenLoop.stop();
    this.frameDispatcher.clearSource('screen');
    eventBus.emit(EVENTS.CONFIG_CHANGED, { type: 'screen_monitoring_stopped' });
  }

  /**
   * Capture a single native high-resolution screen snapshot
   */
  async captureScreenNative(region = null) {
    try {
      if (electronBridge?.isElectron) {
        return await electronBridge.captureScreenNative(region);
      }
      return null;
    } catch (err) {
      logger.error('VISION', 'Error capturando pantalla nativa:', err);
      return null;
    }
  }

  /**
   * Continuous Camera Video Streamer to Gemini Live
   */
  async startCameraMonitoring({ fps = 0.5, deviceId = null } = {}) {
    if (this.disposed) return false;
    this.stopCameraMonitoring();
    const generation = this.cameraGeneration;
    let stream;
    let video;
    let timeout;
    let cancel;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { width: 640, height: 480 }
      });
      if (generation !== this.cameraGeneration || this.disposed) return false;
      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      const cancelled = new Promise((_, reject) => {
        cancel = () => reject(new Error('Cámara cancelada.'));
        this.cancelCameraSetup = cancel;
        timeout = setTimeout(() => reject(new Error('La cámara no entregó vídeo en 10 segundos.')), 10000);
      });
      await Promise.race([video.play(), cancelled]);
      if (generation !== this.cameraGeneration || this.disposed) return false;
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 360;
      this.cameraStream = stream;
      this.videoElement = video;
      this.cameraCanvas = canvas;
      this.cameraFPS = Math.max(0.2, Math.min(3.0, Number.isFinite(fps) ? fps : 0.5));
      this.isCameraStreaming = true;
      stream.getVideoTracks()[0].onended = () => {
        if (this.cameraStream === stream) this.stopCameraMonitoring();
      };
      this.cameraLoop.start(Math.round(1000 / this.cameraFPS));
      return true;
    } catch (error) {
      if (generation === this.cameraGeneration && !this.disposed) {
        logger.error('VISION', 'Error al acceder a la cámara web:', error.message);
      }
      return false;
    } finally {
      clearTimeout(timeout);
      if (this.cancelCameraSetup === cancel) this.cancelCameraSetup = null;
      if (stream && this.cameraStream !== stream) {
        stream.getTracks().forEach(track => track.stop());
        if (video) { video.pause(); video.srcObject = null; }
      }
    }
  }

  stopCameraMonitoring() {
    this.isCameraStreaming = false;
    this.cameraGeneration++;
    this.cancelCameraSetup?.();
    this.cameraLoop.stop();
    this.frameDispatcher.clearSource('camera');
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    this.cameraCanvas = null;
    logger.info('VISION', 'Monitoreo de cámara detenido.');
  }

  dispose() {
    this.disposed = true;
    this.unsubAudioStart?.();
    this.unsubAudioEnd?.();
    this.stopScreenMonitoring();
    this.stopCameraMonitoring();
    this.frameDispatcher.destroy();
  }
}

export const visionStreamManager = new VisionStreamManager();
