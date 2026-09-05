/**
 * Cristi AI - Modernized Vision Stream Manager
 * High-performance, low-latency visual perception engine for real-time continuous screen & camera streaming to Gemini Live.
 */

import { electronBridge } from '../desktop/ElectronBridge.js';
import { logger } from '../logger.js';
import { eventBus, EVENTS } from '../eventBus.js';
import { VisionFrameDispatcher } from './VisionFrameDispatcher.js';

export class VisionStreamManager {
  constructor({ socketRef } = {}) {
    this.socketRef = socketRef; // Reference to active GeminiLiveSocket
    this.frameDispatcher = new VisionFrameDispatcher({ socketRef });

    // Screen Streamer State
    this.isScreenStreaming = false;
    this.screenIntervalId = null;
    this.screenFPS = 0.5; // 1 frame every 2 seconds default (energy efficient)
    this.screenRegion = null; // { x_pct, y_pct, w_pct, h_pct }

    // Camera Streamer State
    this.isCameraStreaming = false;
    this.cameraIntervalId = null;
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

    // Speech Protection: Pause image streaming while Cristi is speaking to prevent audio stuttering
    this.isAiSpeaking = false;
    eventBus.on(EVENTS.AUDIO_START, () => {
      this.isAiSpeaking = true;
    });
    eventBus.on(EVENTS.AUDIO_END, () => {
      this.isAiSpeaking = false;
    });
  }

  setSocketRef(socketRef) {
    this.socketRef = socketRef;
  }

  /**
   * Continuous Screen Capture Streamer directly sending frames to Gemini Live
   */
  startScreenMonitoring({ fps = 0.5, region = null } = {}) {
    this.stopScreenMonitoring();

    // Cap screen FPS strictly between 0.2 and 0.5 FPS (1 frame every 2 to 5s)
    this.screenFPS = Math.max(0.2, Math.min(0.5, fps));
    this.screenRegion = region;
    this.isScreenStreaming = true;

    const intervalMs = Math.round(1000 / this.screenFPS);
    logger.info('VISION', `Iniciando monitoreo visual de pantalla (${this.screenFPS} FPS / cada ${intervalMs}ms)...`);

    let inFlight = false;
    const captureAndSend = async () => {
      if (!this.isScreenStreaming) return;
      if (this.isAiSpeaking) {
        // AI is actively speaking: pause video frames to protect incoming audio stream from interruption
        if (this.isScreenStreaming) {
          this.screenIntervalId = setTimeout(captureAndSend, 1000);
        }
        return;
      }
      if (inFlight) {
        if (this.isScreenStreaming) {
          this.screenIntervalId = setTimeout(captureAndSend, 1000);
        }
        return;
      }

      inFlight = true;
      const t0 = performance.now();
      try {
        // Backpressure check: skip if websocket queue is backing up
        const ws = this.socketRef?.current?.websocket;
        if (ws && ws.bufferedAmount > 65536) {
          logger.warn('VISION', 'Omitiendo frame por congestión de red WebSocket.');
        } else {
          const frameBase64 = await this.captureScreenNative(this.screenRegion);
          if (frameBase64 && this.isScreenStreaming && this.socketRef?.current?.isConnected) {
            this.frameDispatcher.enqueue(frameBase64, 'screen');
          }
        }
      } catch (err) {
        logger.warn('VISION', 'Error en frame de pantalla:', err.message);
      } finally {
        inFlight = false;
      }

      if (this.isScreenStreaming) {
        const elapsed = performance.now() - t0;
        const delay = Math.max(1800, intervalMs - elapsed);
        this.screenIntervalId = setTimeout(captureAndSend, delay);
      }
    };

    // Schedule initial capture after brief 300ms pause to allow call connection to settle
    this.screenIntervalId = setTimeout(captureAndSend, 300);
    eventBus.emit(EVENTS.CONFIG_CHANGED, { type: 'screen_monitoring_started', fps: this.screenFPS });
  }

  stopScreenMonitoring() {
    this.isScreenStreaming = false;
    if (this.screenIntervalId) {
      clearTimeout(this.screenIntervalId);
      this.screenIntervalId = null;
    }
    logger.info('VISION', 'Monitoreo visual de pantalla detenido.');
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
    this.stopCameraMonitoring();

    try {
      logger.info('VISION', 'Iniciando captura de cámara web...');
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { width: 640, height: 480 }
      };

      this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.cameraStream;
      this.videoElement.play();

      this.cameraCanvas = document.createElement('canvas');
      this.cameraCanvas.width = 480;
      this.cameraCanvas.height = 360;

      this.cameraFPS = Math.max(0.2, Math.min(3.0, fps));
      this.isCameraStreaming = true;

      const intervalMs = Math.round(1000 / this.cameraFPS);

      let inFlight = false;
      const captureCamFrame = () => {
        if (!this.isCameraStreaming || !this.videoElement || !this.cameraCanvas) return;
        if (this.isAiSpeaking || inFlight) {
          this.cameraIntervalId = setTimeout(captureCamFrame, Math.min(intervalMs, 1000));
          return;
        }

        inFlight = true;
        try {
          if (this.videoElement.readyState < 2) return;
          const ctx = this.cameraCanvas.getContext('2d');
          ctx.drawImage(this.videoElement, 0, 0, this.cameraCanvas.width, this.cameraCanvas.height);
          const dataUrl = this.cameraCanvas.toDataURL('image/jpeg', 0.7);
          const base64Data = dataUrl.split(',')[1];
          if (base64Data) this.frameDispatcher.enqueue(base64Data, 'camera');
        } finally {
          inFlight = false;
          if (this.isCameraStreaming) this.cameraIntervalId = setTimeout(captureCamFrame, intervalMs);
        }
      };

      this.cameraIntervalId = setTimeout(captureCamFrame, 100);
      logger.info('VISION', `✓ Monitoreo de cámara activo (${this.cameraFPS} FPS).`);
      return true;
    } catch (err) {
      logger.error('VISION', 'Error al acceder a la cámara web:', err);
      this.stopCameraMonitoring();
      return false;
    }
  }

  stopCameraMonitoring() {
    this.isCameraStreaming = false;
    if (this.cameraIntervalId) {
      clearTimeout(this.cameraIntervalId);
      this.cameraIntervalId = null;
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    this.cameraCanvas = null;
    logger.info('VISION', 'Monitoreo de cámara detenido.');
  }

  dispose() {
    this.stopScreenMonitoring();
    this.stopCameraMonitoring();
    this.frameDispatcher.destroy();
  }
}

export const visionStreamManager = new VisionStreamManager();
