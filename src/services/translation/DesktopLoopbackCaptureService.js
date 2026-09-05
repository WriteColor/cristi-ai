import { eventBus } from '../eventBus.js';
import { audioRoutingService } from './AudioRoutingService.js';

const WORKLET_SOURCE = `
class CristiLoopbackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.target = Math.max(160, Math.round(sampleRate * 0.02));
    this.buffer = new Float32Array(this.target);
    this.index = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (let i = 0; i < input.length; i += 1) {
      this.buffer[this.index++] = input[i];
      if (this.index >= this.target) {
        this.port.postMessage(this.buffer.slice(0));
        this.index = 0;
      }
    }
    return true;
  }
}
registerProcessor('cristi-loopback-processor', CristiLoopbackProcessor);
`;

function floatToPcm16(samples) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i] || 0));
    pcm[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }
  return pcm;
}

function pcmToBase64(pcm) {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
  }
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(binary);
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  throw new Error('No hay un codificador base64 disponible.');
}

/** System/game audio capture with an AudioWorklet and source labels. */
export class DesktopLoopbackCaptureService {
  constructor() {
    this.stream = null;
    this.audioContext = null;
    this.workletNode = null;
    this.sourceId = 'system_loopback';
    this.running = false;
    this.frameHandler = null;
    this.frameCount = 0;
  }

  setFrameHandler(handler) {
    this.frameHandler = typeof handler === 'function' ? handler : null;
  }

  async start({ sourceId = 'system_loopback', includeVideo = false } = {}) {
    if (this.running) return { success: true, alreadyRunning: true };
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia || typeof AudioWorkletNode === 'undefined') {
      return { success: false, error: 'Captura loopback no disponible en este entorno.' };
    }
    this.sourceId = sourceId;
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        // Chromium requires a video track for getDisplayMedia even when only
        // system audio is needed. We stop that track immediately below.
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      const audioTrack = this.stream.getAudioTracks()[0];
      if (!audioTrack) {
        this.stop();
        return { success: false, error: 'La fuente seleccionada no expone una pista de audio.' };
      }
      if (!includeVideo) {
        for (const track of this.stream.getVideoTracks()) track.stop();
      }
      this.audioContext = new AudioContext({ sampleRate: 16000, latencyHint: 'interactive' });
      const moduleUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
      await this.audioContext.audioWorklet.addModule(moduleUrl);
      URL.revokeObjectURL(moduleUrl);
      const streamForAudio = typeof globalThis.MediaStream === 'function'
        ? new globalThis.MediaStream([audioTrack])
        : this.stream;
      const input = this.audioContext.createMediaStreamSource(streamForAudio);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'cristi-loopback-processor');
      this.workletNode.port.onmessage = (event) => {
        if (!this.running || !(event.data instanceof Float32Array)) return;
        const pcm = floatToPcm16(event.data);
        const frameId = `loopback_${Date.now()}_${this.frameCount++}`;
        const data = pcmToBase64(pcm);
        const frame = audioRoutingService.acceptFrame({ frameId, sourceId: this.sourceId, data, sampleRate: 16000 });
        if (frame) this.frameHandler?.(frame);
      };
      input.connect(this.workletNode);
      // Keep the worklet alive without audible playback.
      const sink = this.audioContext.createGain();
      sink.gain.value = 0;
      this.workletNode.connect(sink).connect(this.audioContext.destination);
      await this.audioContext.resume();
      this.running = true;
      eventBus.emitDomain('audio.loopback_started', { sourceId: this.sourceId }, {
        source: 'system_loopback', privacy: 'external'
      });
      return { success: true, sourceId: this.sourceId, sampleRate: this.audioContext.sampleRate };
    } catch (error) {
      this.stop();
      return { success: false, error: error?.message || String(error) };
    }
  }

  stop() {
    this.running = false;
    this.workletNode?.port.close?.();
    this.workletNode?.disconnect?.();
    this.workletNode = null;
    this.stream?.getTracks?.().forEach((track) => track.stop());
    this.stream = null;
    this.audioContext?.close?.().catch?.(() => {});
    this.audioContext = null;
    eventBus.emitDomain('audio.loopback_stopped', {}, {
      source: 'system_loopback', privacy: 'internal'
    });
  }

  getStatus() {
    return {
      running: this.running,
      sourceId: this.sourceId,
      frameCount: this.frameCount,
      sampleRate: this.audioContext?.sampleRate || 16000
    };
  }
}

export const desktopLoopbackCaptureService = new DesktopLoopbackCaptureService();
export default desktopLoopbackCaptureService;
