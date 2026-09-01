/**
 * Cristi AI - Sensory Vision & Camera Service
 * Supports standard webcams, Windows Hello IR (Infrared) cameras, device enumeration,
 * dynamic sensor switching and image preprocessing.
 */

export class CameraService {
  constructor({ onFrameCaptured, onFrame, onError } = {}) {
    this.onFrameCaptured = onFrameCaptured || onFrame || (() => {});
    this.onError = onError || console.error;

    this.mediaStream = null;
    this.videoElement = null;
    this.internalVideoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    this.isStreaming = false;
    this.intervalId = null;
    this.streamFps = 1;
    this.currentDeviceId = null;
    this.isIREnhancementEnabled = false;
  }

  /**
   * Enumerate all connected cameras and identify Windows Hello / IR sensors
   */
  static async getAvailableDevices() {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) return [];
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');

      return videoDevices.map((d, index) => {
        const labelLower = (d.label || '').toLowerCase();
        const isIR =
          labelLower.includes('ir') ||
          labelLower.includes('infrared') ||
          labelLower.includes('hello') ||
          labelLower.includes('realsense') ||
          labelLower.includes('depth') ||
          labelLower.includes('sensor');

        return {
          deviceId: d.deviceId,
          label: d.label || `Cámara #${index + 1}`,
          isIR
        };
      });
    } catch (e) {
      console.error('Error al enumerar dispositivos de video:', e);
      return [];
    }
  }

  static async getAvailableVideoDevices() {
    return await this.getAvailableDevices();
  }

  async start(videoPreviewElement = null, preferredDeviceId = null) {
    if (this.isStreaming && this.currentDeviceId === preferredDeviceId && (this.videoElement || this.internalVideoElement)) {
      if (videoPreviewElement && this.videoElement !== videoPreviewElement) {
        this.attachVideoPreview(videoPreviewElement);
      }
      return;
    }

    if (this.isStreaming || this._isStarting) {
      this.stop();
    }

    this._isStarting = true;

    try {
      const videoConstraints = {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 24 }
      };

      if (preferredDeviceId) {
        // Use 'ideal' constraint to avoid OverconstrainedError if device ID format changes
        videoConstraints.deviceId = { ideal: preferredDeviceId };
      } else {
        videoConstraints.facingMode = 'user';
      }

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false
        });
      } catch (constraintErr) {
        console.warn('getUserMedia con constraints específicos falló, reintentando con fallback básico:', constraintErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      // If stop() was called while acquiring the stream, immediately release camera hardware
      if (!this._isStarting) {
        if (stream) {
          stream.getTracks().forEach((track) => {
            try { track.stop(); } catch (_) {}
          });
        }
        return;
      }

      this.mediaStream = stream;
      this.currentDeviceId = preferredDeviceId;

      // Always create and maintain an internal offscreen video element for headless reliability
      if (!this.internalVideoElement) {
        this.internalVideoElement = document.createElement('video');
        this.internalVideoElement.autoplay = true;
        this.internalVideoElement.playsInline = true;
        this.internalVideoElement.muted = true;
      }
      this.internalVideoElement.srcObject = this.mediaStream;
      try {
        await this.internalVideoElement.play();
      } catch (playErr) {
        console.warn('Autoplay aviso elemento offscreen:', playErr);
      }

      if (videoPreviewElement) {
        this.attachVideoPreview(videoPreviewElement);
      } else {
        this.videoElement = this.internalVideoElement;
      }

      if (!this.canvasElement) {
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.width = 640;
        this.canvasElement.height = 480;
        this.canvasCtx = this.canvasElement.getContext('2d');
      }

      this.isStreaming = true;
    } catch (err) {
      this.onError(err);
      this.stop();
      throw err;
    } finally {
      this._isStarting = false;
    }
  }

  attachVideoPreview(videoElement) {
    if (!videoElement) return;
    this.videoElement = videoElement;
    if (this.mediaStream && videoElement.srcObject !== this.mediaStream) {
      videoElement.srcObject = this.mediaStream;
      videoElement.play?.().catch((e) => console.warn('Preview video play notice:', e));
    }
  }

  getVideoElement() {
    return this.videoElement || this.internalVideoElement;
  }

  getMediaStream() {
    return this.mediaStream;
  }

  setIREnhancement(enabled) {
    this.isIREnhancementEnabled = enabled;
  }

  startPeriodicStreaming(fps = 1) {
    this.streamFps = fps;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const intervalMs = Math.round(1000 / fps);
    this.intervalId = setInterval(() => {
      if (!this.isStreaming) return;
      const frameBase64 = this.captureFrameJPEG();
      if (frameBase64) {
        this.onFrameCaptured(frameBase64);
      }
    }, intervalMs);
  }

  stopPeriodicStreaming() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Capture a single frame in JPEG base64 with optional IR histogram optimization
   */
  captureFrameJPEG() {
    const video = this.getVideoElement();
    if (!this.isStreaming || !video || !this.canvasCtx) return null;
    if (video.readyState < 2) return null;

    try {
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      if (this.canvasElement.width !== vw || this.canvasElement.height !== vh) {
        this.canvasElement.width = vw;
        this.canvasElement.height = vh;
      }

      this.canvasCtx.drawImage(
        video,
        0,
        0,
        this.canvasElement.width,
        this.canvasElement.height
      );

      // Optional dynamic contrast boost for low-light IR camera frames
      if (this.isIREnhancementEnabled) {
        const imgData = this.canvasCtx.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] * 1.25);
          data[i + 1] = Math.min(255, data[i + 1] * 1.25);
          data[i + 2] = Math.min(255, data[i + 2] * 1.25);
        }
        this.canvasCtx.putImageData(imgData, 0, 0);
      }

      const dataUrl = this.canvasElement.toDataURL('image/jpeg', 0.65);
      const base64Data = dataUrl.split(',')[1];
      return base64Data;
    } catch (e) {
      console.error('Error al capturar frame JPEG:', e);
      return null;
    }
  }

  stop() {
    this._isStarting = false;
    this.stopPeriodicStreaming();
    this.isStreaming = false;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      this.mediaStream = null;
    }

    if (this.videoElement && this.videoElement !== this.internalVideoElement) {
      this.videoElement.srcObject = null;
    }
    if (this.internalVideoElement) {
      this.internalVideoElement.srcObject = null;
      try {
        this.internalVideoElement.pause();
      } catch (_) {}
    }
    this.videoElement = null;

    if (this.canvasCtx && this.canvasElement) {
      try {
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
      } catch (_) {}
    }
  }
}
