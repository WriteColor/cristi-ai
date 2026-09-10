/**
 * Cristi AI - VirtualAudioOutputService (TypeScript)
 * Plays generated PCM into an explicitly selected render endpoint, such as
 * VB-CABLE Input or a VoiceMeeter virtual output.
 */

import { eventBus } from '../../infrastructure/events/eventBus';

function decodeBase64Pcm(value: string): Int16Array {
  const encoded = String(value || '');
  if (!encoded) return new Int16Array();
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  if (typeof Buffer !== 'undefined') {
    const bytes = Buffer.from(encoded, 'base64');
    return new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  throw new Error('No hay decodificador base64 disponible para la salida virtual.');
}

export interface VirtualAudioServiceOptions {
  bus?: typeof eventBus;
  audioContextFactory?: ((options?: any) => AudioContext) | null;
  mediaDevices?: MediaDevices | null;
  maxQueueMs?: number;
}

export interface VirtualOutputMetrics {
  played: number;
  dropped: number;
  failures: number;
  lastError: string | null;
}

export interface VirtualOutputStatus extends VirtualOutputMetrics {
  configured: boolean;
  supported: boolean;
  deviceId: string | null;
  deviceLabel: string | null;
  activeSources: number;
  queuedMs: number;
}

interface ActiveSourceEntry {
  source: AudioBufferSourceNode;
  sourceId: string;
  sessionId: string | null;
}

export class VirtualAudioOutputService {
  public bus: typeof eventBus;
  public audioContextFactory: ((options?: any) => AudioContext) | null;
  public mediaDevices: MediaDevices | null;
  public maxQueueMs: number;
  public audioContext: AudioContext | null = null;
  public deviceId = '';
  public deviceLabel = '';
  public nextScheduleTime = 0;
  private activeSources = new Set<ActiveSourceEntry>();
  public metrics: VirtualOutputMetrics = { played: 0, dropped: 0, failures: 0, lastError: null };

  constructor({
    bus = eventBus,
    audioContextFactory = null,
    mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : null,
    maxQueueMs = 900
  }: VirtualAudioServiceOptions = {}) {
    this.bus = bus;
    this.audioContextFactory = audioContextFactory;
    this.mediaDevices = mediaDevices;
    this.maxQueueMs = Math.max(100, Math.min(5000, Number(maxQueueMs) || 900));
  }

  public isSupported(): boolean {
    return Boolean(
      (typeof this._createContext === 'function' && typeof globalThis.AudioContext !== 'undefined') ||
      typeof this.audioContextFactory === 'function'
    );
  }

  public isConfigured(): boolean {
    return Boolean(this.deviceId);
  }

  public async listOutputDevices(): Promise<Array<{ deviceId: string; label: string }>> {
    if (typeof this.mediaDevices?.enumerateDevices !== 'function') return [];
    const devices = await this.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device?.kind === 'audiooutput' && device.deviceId)
      .map((device) => ({ deviceId: device.deviceId, label: device.label || 'Dispositivo de salida sin nombre' }));
  }

  public async configure({ deviceId = '', deviceLabel = '' }: { deviceId?: string; deviceLabel?: string } = {}): Promise<VirtualOutputStatus> {
    const nextId = String(deviceId || '').trim();
    this.deviceLabel = String(deviceLabel || '').trim();
    if (!nextId) {
      this.deviceId = '';
      this.nextScheduleTime = 0;
      return this.getStatus();
    }
    if (!this.isSupported()) {
      this.deviceId = '';
      this.metrics.lastError = 'AudioContext no está disponible en este entorno.';
      return this.getStatus();
    }
    const context = await this._getContext();
    const setSinkIdFn = (context as any)?.setSinkId;
    if (typeof setSinkIdFn !== 'function') {
      this.deviceId = '';
      this.metrics.lastError = 'Este Chromium no permite seleccionar una salida de audio virtual.';
      return this.getStatus();
    }
    if (this.deviceId === nextId) return this.getStatus();
    try {
      await setSinkIdFn.call(context, nextId);
      this.deviceId = nextId;
      this.metrics.lastError = null;
    } catch (error) {
      this.deviceId = '';
      const msg = error instanceof Error ? error.message : String(error);
      this.metrics.lastError = msg;
    }
    return this.getStatus();
  }

  public async playAudioChunk(data: string, { sampleRate = 24000, frameId = null, sessionId = null }: { sampleRate?: number; frameId?: string | null; sessionId?: string | null } = {}): Promise<any> {
    if (!this.isConfigured()) return { success: false, reason: 'not_configured' };
    const context = await this._getContext();
    if (!context || typeof context.createBuffer !== 'function' || typeof context.createBufferSource !== 'function') {
      return { success: false, reason: 'unsupported' };
    }
    const pcm = decodeBase64Pcm(data);
    if (!pcm.length) return { success: false, reason: 'empty_audio' };
    const rate = Math.max(8000, Math.min(48000, Math.round(Number(sampleRate) || 24000)));
    const now = Number(context.currentTime) || 0;
    const startAt = Math.max(now, this.nextScheduleTime || now);
    const duration = pcm.length / rate;
    if ((startAt - now) * 1000 > this.maxQueueMs) {
      this.metrics.dropped += 1;
      return { success: false, reason: 'queue_full' };
    }
    try {
      if (context.state === 'suspended' && typeof context.resume === 'function') await context.resume();
      const buffer = context.createBuffer(1, pcm.length, rate);
      const channel = buffer.getChannelData(0);
      for (let index = 0; index < pcm.length; index += 1) channel[index] = pcm[index] / 0x8000;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const sourceId = frameId || `virtual_translation_${Date.now()}`;
      const entry: ActiveSourceEntry = { source, sourceId, sessionId };
      this.activeSources.add(entry);
      source.onended = () => this._finishSource(entry);
      if (this.activeSources.size === 1) this._emitLifecycle('translation.virtual_output_started', sourceId, sessionId);
      source.start(startAt);
      this.nextScheduleTime = startAt + duration;
      this.metrics.played += 1;
      return { success: true, frameId: sourceId, startAt, durationMs: Math.round(duration * 1000) };
    } catch (error) {
      this.metrics.failures += 1;
      const msg = error instanceof Error ? error.message : String(error);
      this.metrics.lastError = msg;
      return { success: false, reason: 'playback_error', error: this.metrics.lastError };
    }
  }

  private _finishSource(entry: ActiveSourceEntry): void {
    if (!this.activeSources.delete(entry)) return;
    try { entry.source.disconnect?.(); } catch (_) {}
    if (!this.activeSources.size) {
      this.nextScheduleTime = 0;
      this._emitLifecycle('translation.virtual_output_ended', entry.sourceId, entry.sessionId);
    }
  }

  private _emitLifecycle(type: string, frameId: string, sessionId: string | null): void {
    this.bus?.emitDomain?.(type, { frameId, deviceId: this.deviceId, deviceLabel: this.deviceLabel }, {
      source: 'translation_virtual_output', sessionId, privacy: 'internal'
    });
  }

  private _createContext(): AudioContext | null {
    if (typeof this.audioContextFactory === 'function') return this.audioContextFactory({ latencyHint: 'interactive' });
    if (typeof globalThis.AudioContext === 'function') return new globalThis.AudioContext({ latencyHint: 'interactive' });
    return null;
  }

  private async _getContext(): Promise<AudioContext | null> {
    if (!this.audioContext || this.audioContext.state === 'closed') this.audioContext = this._createContext();
    return this.audioContext;
  }

  public getStatus(): VirtualOutputStatus {
    return {
      configured: this.isConfigured(),
      supported: this.isSupported(),
      deviceId: this.deviceId || null,
      deviceLabel: this.deviceLabel || null,
      activeSources: this.activeSources.size,
      queuedMs: this.audioContext ? Math.max(0, Math.round(((this.nextScheduleTime || 0) - (this.audioContext.currentTime || 0)) * 1000)) : 0,
      ...this.metrics
    };
  }

  public async destroy(): Promise<void> {
    for (const entry of [...this.activeSources]) {
      try { entry.source.stop?.(); } catch (_) {}
      this._finishSource(entry);
    }
    const context = this.audioContext;
    this.audioContext = null;
    this.deviceId = '';
    this.nextScheduleTime = 0;
    try { await context?.close?.(); } catch (_) {}
  }
}

export const virtualAudioOutputService = new VirtualAudioOutputService();
export default virtualAudioOutputService;
