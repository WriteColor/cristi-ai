import { eventBus, EVENTS } from '../eventBus.js';
import { audioRoutingService } from './AudioRoutingService.js';
import { electronBridge } from '../desktop/ElectronBridge.js';

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
    this.operationGeneration = 0;
    this.nativeMode = false;
    this.nativeUnsubscribe = null;
    this.nativeEventUnsubscribe = null;
    this.speechProtected = false;
    this.audioStartUnsubscribe = null;
    this.audioEndUnsubscribe = null;
  }

  setFrameHandler(handler) {
    this.frameHandler = typeof handler === 'function' ? handler : null;
  }

  async start({ sourceId = 'system_loopback', includeVideo = false, preferNative = true } = {}) {
    if (this.running) return { success: true, alreadyRunning: true };
    const generation = ++this.operationGeneration;
    this.sourceId = sourceId;
    // Never feed Cristi's own rendered voice back into the external
    // translation pipeline. The output event is emitted by AudioOutputService
    // before the first PCM buffer reaches the system mixer, so this guard also
    // covers the native WASAPI transport's first packet.
    this.audioStartUnsubscribe = eventBus.on(EVENTS.AUDIO_START, () => { this.speechProtected = true; });
    this.audioEndUnsubscribe = eventBus.on(EVENTS.AUDIO_END, () => { this.speechProtected = false; });

    // Prefer the privileged WASAPI transport for audio-only translation in
    // Electron. It avoids the browser picker and captures the default render
    // mix even when the transparent renderer is unfocused. Video requests
    // continue through getDisplayMedia because WASAPI intentionally carries
    // audio only.
    if (preferNative && !includeVideo && electronBridge.isElectron) {
      this.nativeUnsubscribe = electronBridge.onDesktopAudioFrame((frame) => {
        if (!this.running || !this.nativeMode || this.speechProtected || generation !== this.operationGeneration || !frame?.data) return;
        const envelope = audioRoutingService.acceptFrame({
          frameId: frame.frameId,
          sourceId: frame.sourceId || this.sourceId,
          data: frame.data,
          sampleRate: Number(frame.sampleRate) || 16000,
          timestamp: frame.timestamp || Date.now()
        });
        if (envelope) {
          this.frameCount += 1;
          this.frameHandler?.(envelope);
        }
      });
      this.nativeEventUnsubscribe = electronBridge.onDesktopAudioEvent((event) => {
        if (generation !== this.operationGeneration || event?.sourceId !== this.sourceId) return;
        if (event?.type === 'error') {
          this.running = false;
          this.nativeMode = false;
          this.nativeUnsubscribe?.();
          this.nativeEventUnsubscribe?.();
          this.nativeUnsubscribe = null;
          this.nativeEventUnsubscribe = null;
          eventBus.emitDomain('audio.loopback_error', { sourceId: this.sourceId, error: event.error || 'WASAPI terminó.' }, {
            source: 'system_loopback', privacy: 'internal'
          });
        }
      });
      const nativeResult = await electronBridge.startDesktopAudioCapture({ sourceId: this.sourceId });
      if (generation !== this.operationGeneration) {
        this.nativeUnsubscribe?.();
        this.nativeEventUnsubscribe?.();
        this.nativeUnsubscribe = null;
        this.nativeEventUnsubscribe = null;
        return { success: false, error: 'Captura loopback cancelada.' };
      }
      if (nativeResult?.success) {
        this.nativeMode = true;
        this.running = true;
        eventBus.emitDomain('audio.loopback_started', { sourceId: this.sourceId, transport: 'wasapi' }, {
          source: 'system_loopback', privacy: 'external'
        });
        return { ...nativeResult, sourceId: this.sourceId, transport: 'wasapi' };
      }
      this.nativeUnsubscribe?.();
      this.nativeEventUnsubscribe?.();
      this.nativeUnsubscribe = null;
      this.nativeEventUnsubscribe = null;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia || typeof AudioWorkletNode === 'undefined') {
      return { success: false, error: 'Captura loopback no disponible en este entorno.' };
    }
    let acquiredStream = null;
    try {
      acquiredStream = await navigator.mediaDevices.getDisplayMedia({
        // Chromium requires a video track for getDisplayMedia even when only
        // system audio is needed. We stop that track immediately below.
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      if (generation !== this.operationGeneration) {
        acquiredStream.getTracks?.().forEach((track) => track.stop());
        return { success: false, error: 'Captura loopback cancelada.' };
      }
      this.stream = acquiredStream;
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
        if (!this.running || this.speechProtected || generation !== this.operationGeneration || !(event.data instanceof Float32Array)) return;
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
      if (generation !== this.operationGeneration) {
        if (this.stream === acquiredStream) this.stop();
        else acquiredStream?.getTracks?.().forEach((track) => track.stop());
        return { success: false, error: 'Captura loopback cancelada.' };
      }
      this.running = true;
      eventBus.emitDomain('audio.loopback_started', { sourceId: this.sourceId }, {
        source: 'system_loopback', privacy: 'external'
      });
      return { success: true, sourceId: this.sourceId, sampleRate: this.audioContext.sampleRate };
    } catch (error) {
      if (generation === this.operationGeneration) this.stop();
      else acquiredStream?.getTracks?.().forEach((track) => track.stop());
      return { success: false, error: error?.message || String(error) };
    }
  }

  stop() {
    this.operationGeneration += 1;
    this.running = false;
    this.speechProtected = false;
    this.audioStartUnsubscribe?.();
    this.audioEndUnsubscribe?.();
    this.audioStartUnsubscribe = null;
    this.audioEndUnsubscribe = null;
    if (this.nativeMode) {
      this.nativeMode = false;
      void electronBridge.stopDesktopAudioCapture();
    }
    this.nativeUnsubscribe?.();
    this.nativeEventUnsubscribe?.();
    this.nativeUnsubscribe = null;
    this.nativeEventUnsubscribe = null;
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
      transport: this.nativeMode ? 'wasapi' : (this.stream ? 'getDisplayMedia' : null),
      speechProtected: this.speechProtected,
      sourceId: this.sourceId,
      frameCount: this.frameCount,
      sampleRate: this.audioContext?.sampleRate || 16000
    };
  }
}

export const desktopLoopbackCaptureService = new DesktopLoopbackCaptureService();
export default desktopLoopbackCaptureService;
