/**
 * Cristi AI - DesktopLoopbackCaptureService (TypeScript)
 * System/game audio capture with an AudioWorklet and source labels.
 */

import { eventBus, EVENTS } from '../../infrastructure/events/eventBus';
import { audioRoutingService } from './AudioRoutingService';
import { electronBridge } from '../../services/desktop/ElectronBridge';

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

function floatToPcm16(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i] ?? 0));
    pcm[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }
  return pcm;
}

function pcmToBase64(pcm: Int16Array): string {
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

export interface LoopbackStartOptions {
  sourceId?: string;
  includeVideo?: boolean;
  preferNative?: boolean;
  autoRestart?: boolean;
  maxRestartAttempts?: number;
  restartBaseDelayMs?: number;
  restartMaxDelayMs?: number;
  allowBrowserFallback?: boolean;
  _nativeRestart?: boolean;
}

export interface LoopbackStatus {
  running: boolean;
  transport: 'wasapi' | 'getDisplayMedia' | null;
  speechProtected: boolean;
  sourceId: string;
  frameCount: number;
  sampleRate: number;
  restarting: boolean;
  restartAttempts: number;
  lastError: string | null;
  lastStopReason: string | null;
}

export class DesktopLoopbackCaptureService {
  public stream: MediaStream | null = null;
  public audioContext: AudioContext | null = null;
  public workletNode: AudioWorkletNode | null = null;
  public mediaSourceNode: MediaStreamAudioSourceNode | null = null;
  public sinkNode: GainNode | null = null;
  public audioTrack: MediaStreamTrack | null = null;
  private audioTrackEndedSubscription: { track: MediaStreamTrack; handler: () => void; mode: string; previous?: any } | null = null;
  public sourceId = 'system_loopback';
  public running = false;
  private frameHandler: ((envelope: any) => void) | null = null;
  public frameCount = 0;
  public operationGeneration = 0;
  public nativeMode = false;
  private nativeUnsubscribe: (() => void) | null = null;
  private nativeEventUnsubscribe: (() => void) | null = null;
  public speechProtected = false;
  public mainAudioActive = false;
  public virtualOutputLeases = 0;
  private audioStartUnsubscribe: (() => void) | null = null;
  private audioEndUnsubscribe: (() => void) | null = null;
  private virtualOutputStartUnsubscribe: (() => void) | null = null;
  private virtualOutputEndUnsubscribe: (() => void) | null = null;
  private startPromise: Promise<any> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  public restartAttempts = 0;
  private restartOptions: any = null;
  public restartDesired = false;
  public lastError: string | null = null;
  public lastStopReason: string | null = null;

  public setFrameHandler(handler: ((envelope: any) => void) | null): void {
    this.frameHandler = typeof handler === 'function' ? handler : null;
  }

  public async start(options: LoopbackStartOptions = {}): Promise<any> {
    if (this.running) return { success: true, alreadyRunning: true, transport: this.nativeMode ? 'wasapi' : 'getDisplayMedia' };
    if (this.startPromise) return await this.startPromise;

    const pending = this._start(options);
    this.startPromise = pending;
    try {
      return await pending;
    } finally {
      if (this.startPromise === pending) this.startPromise = null;
    }
  }

  private _normalizeStartOptions(options: LoopbackStartOptions = {}): Required<LoopbackStartOptions> {
    const maxAttempts = Number(options.maxRestartAttempts);
    const baseDelayMs = Number(options.restartBaseDelayMs);
    const maxDelayMs = Number(options.restartMaxDelayMs);
    return {
      sourceId: String(options.sourceId || 'system_loopback'),
      includeVideo: Boolean(options.includeVideo),
      preferNative: options.preferNative !== false,
      autoRestart: options.autoRestart !== false,
      maxRestartAttempts: Number.isFinite(maxAttempts) ? Math.max(0, Math.min(8, Math.floor(maxAttempts))) : 3,
      restartBaseDelayMs: Number.isFinite(baseDelayMs) ? Math.max(100, Math.min(30000, Math.floor(baseDelayMs))) : 750,
      restartMaxDelayMs: Number.isFinite(maxDelayMs) ? Math.max(100, Math.min(60000, Math.floor(maxDelayMs))) : 10000,
      allowBrowserFallback: options.allowBrowserFallback !== false,
      _nativeRestart: options._nativeRestart === true
    };
  }

  private async _start(options: LoopbackStartOptions = {}): Promise<any> {
    const settings = this._normalizeStartOptions(options);
    if (!settings._nativeRestart) {
      this._cancelRestart({ resetAttempts: true });
      this.restartOptions = { ...settings, _nativeRestart: false };
      this.restartDesired = settings.autoRestart && settings.preferNative && !settings.includeVideo;
    }

    this._releaseNativeSubscriptions();
    this._releaseBrowserResources();
    this._releaseSpeechProtection();

    const generation = ++this.operationGeneration;
    this.sourceId = settings.sourceId;
    this.lastStopReason = null;
    this._installSpeechProtection();

    if (settings.preferNative && !settings.includeVideo && electronBridge.isElectron) {
      this.nativeUnsubscribe = electronBridge.onDesktopAudioFrame((frame: any) => {
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
      this.nativeEventUnsubscribe = electronBridge.onDesktopAudioEvent((event: any) => {
        if (generation !== this.operationGeneration || event?.sourceId !== this.sourceId) return;
        if (event?.type === 'error' || event?.type === 'stopped') this._handleNativeFailure(event, generation);
      });
      const nativeResult = await electronBridge.startDesktopAudioCapture({ sourceId: this.sourceId });
      if (generation !== this.operationGeneration) {
        this._releaseNativeSubscriptions();
        return { success: false, error: 'Captura loopback cancelada.' };
      }
      if (nativeResult?.success) {
        this.nativeMode = true;
        this.running = true;
        this.lastError = null;
        this.restartAttempts = 0;
        eventBus.emitDomain('audio.loopback_started', { sourceId: this.sourceId, transport: 'wasapi' }, {
          source: 'system_loopback', privacy: 'external'
        });
        if (settings._nativeRestart) {
          eventBus.emitDomain('audio.loopback_recovered', { sourceId: this.sourceId, transport: 'wasapi' }, {
            source: 'system_loopback', privacy: 'internal'
          });
        }
        return { ...nativeResult, sourceId: this.sourceId, transport: 'wasapi' };
      }
      this._releaseNativeSubscriptions();
      if (settings._nativeRestart || !settings.allowBrowserFallback) {
        this._releaseSpeechProtection();
        this.lastError = nativeResult?.error || 'No se pudo reiniciar WASAPI.';
        return { success: false, error: this.lastError };
      }
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia || typeof AudioWorkletNode === 'undefined') {
      this.restartDesired = false;
      this._releaseSpeechProtection();
      return { success: false, error: 'Captura loopback no disponible en este entorno.' };
    }
    let acquiredStream: MediaStream | null = null;
    try {
      acquiredStream = await navigator.mediaDevices.getDisplayMedia({
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
        this._cleanupCapture({ emitStopped: false, reason: 'missing_audio_track' });
        this.restartDesired = false;
        return { success: false, error: 'La fuente seleccionada no expone una pista de audio.' };
      }
      if (!settings.includeVideo) {
        for (const track of this.stream.getVideoTracks()) track.stop();
      }
      this.audioContext = new AudioContext({ sampleRate: 16000, latencyHint: 'interactive' });
      const moduleUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
      try {
        await this.audioContext.audioWorklet.addModule(moduleUrl);
      } finally {
        URL.revokeObjectURL(moduleUrl);
      }
      const streamForAudio = typeof globalThis.MediaStream === 'function'
        ? new globalThis.MediaStream([audioTrack])
        : this.stream;
      const input = this.audioContext.createMediaStreamSource(streamForAudio);
      this.mediaSourceNode = input;
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
      const sink = this.audioContext.createGain();
      this.sinkNode = sink;
      sink.gain.value = 0;
      this.workletNode.connect(sink).connect(this.audioContext.destination);
      await this.audioContext.resume();
      if (generation !== this.operationGeneration) {
        if (this.stream === acquiredStream) this.stop();
        else acquiredStream?.getTracks?.().forEach((track) => track.stop());
        return { success: false, error: 'Captura loopback cancelada.' };
      }
      this.running = true;
      this.nativeMode = false;
      this.restartDesired = false;
      this.lastError = null;
      this._watchAudioTrack(audioTrack, generation);
      eventBus.emitDomain('audio.loopback_started', { sourceId: this.sourceId }, {
        source: 'system_loopback', privacy: 'external'
      });
      return { success: true, sourceId: this.sourceId, sampleRate: this.audioContext.sampleRate };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (generation === this.operationGeneration) {
        this.lastError = msg;
        this.restartDesired = false;
        this._cleanupCapture({ emitStopped: false, reason: 'browser_start_error' });
      }
      else acquiredStream?.getTracks?.().forEach((track) => track.stop());
      return { success: false, error: msg };
    }
  }

  private _installSpeechProtection(): void {
    if (this.audioStartUnsubscribe || this.audioEndUnsubscribe || this.virtualOutputStartUnsubscribe || this.virtualOutputEndUnsubscribe) return;
    this.audioStartUnsubscribe = eventBus.on(EVENTS.AUDIO_START, () => {
      this.mainAudioActive = true;
      this._updateSpeechProtection();
    });
    this.audioEndUnsubscribe = eventBus.on(EVENTS.AUDIO_END, () => {
      this.mainAudioActive = false;
      this._updateSpeechProtection();
    });
    this.virtualOutputStartUnsubscribe = eventBus.on('translation.virtual_output_started', () => {
      this.virtualOutputLeases += 1;
      this._updateSpeechProtection();
    });
    this.virtualOutputEndUnsubscribe = eventBus.on('translation.virtual_output_ended', () => {
      this.virtualOutputLeases = Math.max(0, this.virtualOutputLeases - 1);
      this._updateSpeechProtection();
    });
  }

  private _updateSpeechProtection(): void {
    this.speechProtected = this.mainAudioActive || this.virtualOutputLeases > 0;
  }

  private _releaseSpeechProtection(): void {
    this.audioStartUnsubscribe?.();
    this.audioEndUnsubscribe?.();
    this.audioStartUnsubscribe = null;
    this.audioEndUnsubscribe = null;
    this.virtualOutputStartUnsubscribe?.();
    this.virtualOutputEndUnsubscribe?.();
    this.virtualOutputStartUnsubscribe = null;
    this.virtualOutputEndUnsubscribe = null;
    this.mainAudioActive = false;
    this.virtualOutputLeases = 0;
    this.speechProtected = false;
  }

  private _releaseNativeSubscriptions(): void {
    this.nativeUnsubscribe?.();
    this.nativeEventUnsubscribe?.();
    this.nativeUnsubscribe = null;
    this.nativeEventUnsubscribe = null;
  }

  private _releaseBrowserResources(): void {
    const trackSubscription = this.audioTrackEndedSubscription;
    if (trackSubscription) {
      if (trackSubscription.mode === 'event') trackSubscription.track?.removeEventListener?.('ended', trackSubscription.handler);
      else if (trackSubscription.track) trackSubscription.track.onended = trackSubscription.previous || null;
    }
    this.audioTrackEndedSubscription = null;
    this.audioTrack = null;

    this.workletNode?.port?.close?.();
    this.workletNode?.disconnect?.();
    this.workletNode = null;
    this.mediaSourceNode?.disconnect?.();
    this.mediaSourceNode = null;
    this.sinkNode?.disconnect?.();
    this.sinkNode = null;
    this.stream?.getTracks?.().forEach((track) => track.stop());
    this.stream = null;
    const context = this.audioContext;
    this.audioContext = null;
    context?.close?.().catch?.(() => {});
  }

  private _cleanupCapture({ stopNative = false, emitStopped = true, reason = 'stopped' }: { stopNative?: boolean; emitStopped?: boolean; reason?: string } = {}): void {
    const wasActive = this.running || this.nativeMode || Boolean(this.stream) || Boolean(this.audioContext);
    this.running = false;
    const wasNative = this.nativeMode;
    this.nativeMode = false;
    this._releaseNativeSubscriptions();
    this._releaseBrowserResources();
    this._releaseSpeechProtection();
    if (stopNative || wasNative) void electronBridge.stopDesktopAudioCapture();
    if (emitStopped && wasActive) {
      eventBus.emitDomain('audio.loopback_stopped', { sourceId: this.sourceId, reason }, {
        source: 'system_loopback', privacy: 'internal'
      });
    }
  }

  private _watchAudioTrack(track: MediaStreamTrack, generation: number): void {
    this.audioTrack = track;
    const onEnded = (): void => {
      if (generation !== this.operationGeneration || this.audioTrack !== track || !this.running || this.nativeMode) return;
      this.operationGeneration += 1;
      this.restartDesired = false;
      this.lastStopReason = 'audio_track_ended';
      this._cleanupCapture({ emitStopped: true, reason: 'audio_track_ended' });
      eventBus.emitDomain('audio.loopback_ended', { sourceId: this.sourceId, reason: 'audio_track_ended' }, {
        source: 'system_loopback', privacy: 'internal'
      });
    };
    if (typeof track?.addEventListener === 'function') {
      track.addEventListener('ended', onEnded, { once: true });
      this.audioTrackEndedSubscription = { track, handler: onEnded, mode: 'event' };
    } else if (track) {
      const previous = track.onended;
      track.onended = (ev: Event) => {
        try { if (typeof previous === 'function') previous.call(track, ev); } finally { onEnded(); }
      };
      this.audioTrackEndedSubscription = { track, handler: onEnded, mode: 'property', previous };
    }
  }

  private _handleNativeFailure(event: any, generation: number): void {
    if (generation !== this.operationGeneration) return;
    const error = event?.error || (event?.type === 'stopped' ? 'WASAPI se detuvo inesperadamente.' : 'WASAPI terminó.');
    this.operationGeneration += 1;
    this.lastError = String(error);
    this.lastStopReason = 'native_error';
    const shouldRestart = this.restartDesired && this.restartOptions && this.restartOptions.autoRestart;
    this._cleanupCapture({ stopNative: true, emitStopped: true, reason: 'native_error' });
    eventBus.emitDomain('audio.loopback_error', { sourceId: this.sourceId, error: this.lastError }, {
      source: 'system_loopback', privacy: 'internal'
    });
    if (shouldRestart) this._scheduleNativeRestart(this.restartOptions, this.lastError);
  }

  private _cancelRestart({ resetAttempts = false }: { resetAttempts?: boolean } = {}): void {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    if (resetAttempts) this.restartAttempts = 0;
  }

  private _scheduleNativeRestart(options: any, error: string): boolean {
    if (!this.restartDesired || this.running || this.restartTimer || !options?.autoRestart) return false;
    if (this.restartAttempts >= options.maxRestartAttempts) {
      this.restartDesired = false;
      eventBus.emitDomain('audio.loopback_restart_failed', {
        sourceId: this.sourceId,
        attempts: this.restartAttempts,
        error
      }, { source: 'system_loopback', privacy: 'internal' });
      return false;
    }
    this.restartAttempts += 1;
    const attempt = this.restartAttempts;
    const delayMs = Math.min(options.restartMaxDelayMs, options.restartBaseDelayMs * (2 ** (attempt - 1)));
    eventBus.emitDomain('audio.loopback_reconnecting', { sourceId: this.sourceId, attempt, delayMs, error }, {
      source: 'system_loopback', privacy: 'internal'
    });
    const scheduledGeneration = this.operationGeneration;
    this.restartTimer = setTimeout(async () => {
      this.restartTimer = null;
      if (!this.restartDesired || this.running || scheduledGeneration !== this.operationGeneration) return;
      const result = await this.start({ ...options, _nativeRestart: true, allowBrowserFallback: false });
      if (!result?.success && this.restartDesired && !this.running) {
        this._scheduleNativeRestart(options, result?.error || 'No se pudo reiniciar WASAPI.');
      }
    }, delayMs);
    return true;
  }

  public stop(): void {
    this.operationGeneration += 1;
    this.restartDesired = false;
    this.lastStopReason = 'manual_stop';
    this._cancelRestart({ resetAttempts: true });
    this._cleanupCapture({ stopNative: true, emitStopped: true, reason: 'manual_stop' });
  }

  public getStatus(): LoopbackStatus {
    return {
      running: this.running,
      transport: this.nativeMode ? 'wasapi' : (this.stream ? 'getDisplayMedia' : null),
      speechProtected: this.speechProtected,
      sourceId: this.sourceId,
      frameCount: this.frameCount,
      sampleRate: this.audioContext?.sampleRate || 16000,
      restarting: Boolean(this.restartTimer),
      restartAttempts: this.restartAttempts,
      lastError: this.lastError,
      lastStopReason: this.lastStopReason
    };
  }
}

export const desktopLoopbackCaptureService = new DesktopLoopbackCaptureService();
export default desktopLoopbackCaptureService;
