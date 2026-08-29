/**
 * Cristi AI - Sensory Vision & Camera Service
 * Supports standard webcams, Windows Hello IR (Infrared) cameras, device enumeration,
 * dynamic sensor switching and image preprocessing.
 */

export class CameraService {
  constructor({ onFrameCaptured, onError }) {
    this.onFrameCaptured = onFrameCaptured || (() => {});
    this.onError = onError || console.error;

    this.mediaStream = null;
    this.videoElement = null;
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
    if (this.isStreaming && this.currentDeviceId === preferredDeviceId) return;

    if (this.isStreaming) {
      this.stop();
    }

    try {
      const videoConstraints = {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 24 }
      };

      if (preferredDeviceId) {
        videoConstraints.deviceId = { exact: preferredDeviceId };
      } else {
        videoConstraints.facingMode = 'user';
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });

      this.currentDeviceId = preferredDeviceId;

      if (videoPreviewElement) {
        this.videoElement = videoPreviewElement;
      } else {
        this.videoElement = document.createElement('video');
        this.videoElement.autoplay = true;
        this.videoElement.playsInline = true;
        this.videoElement.muted = true;
      }

      this.videoElement.srcObject = this.mediaStream;
      await this.videoElement.play();

      this.canvasElement = document.createElement('canvas');
      this.canvasElement.width = 640;
      this.canvasElement.height = 480;
      this.canvasCtx = this.canvasElement.getContext('2d');

      this.isStreaming = true;
    } catch (err) {
      this.onError(err);
      this.stop();
      throw err;
    }
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
    if (!this.isStreaming || !this.videoElement || !this.canvasCtx) return null;

    try {
      this.canvasCtx.drawImage(
        this.videoElement,
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
          // Normalize and stretch luminance curve
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
    this.stopPeriodicStreaming();
    this.isStreaming = false;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }
}
