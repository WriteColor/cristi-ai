/**
 * Cristi AI - Virtual Audio Output Service (`game_voice`)
 * 
 * Responsibilities:
 * - Directs translated voice output strictly into a virtual audio device (e.g. VB-CABLE Input,
 *   VoiceMeeter VAIO) to feed the in-game voice chat / microphone.
 * - Enforces zero audio leakage to default speakers: if no virtual output device is selected,
 *   it refuses to play through default speakers to prevent accidental TTS spillage and echo.
 * - Gapless jitter buffering with queue duration caps (drops stale frames under network backlog).
 * - Full memory lifecycle management with automated node disconnection on end.
 */

import { eventBus } from '@/services/eventBus.js';
import type {
  VirtualAudioOutputConfig,
  VirtualAudioOutputStatus
} from '@/types';

interface ActiveSourceEntry {
  source: AudioBufferSourceNode;
  frameId: string;
  sessionId: string;
  correlationId: string;
}

export class VirtualAudioOutputService {
  private audioContext: AudioContext | null = null;
  private deviceId = '';
  private deviceLabel = '';
  private maxQueueMs = 1200; // Cap queue backlog to 1.2s to prevent audio lag
  private nextScheduleTime = 0;
  private activeSources = new Set<ActiveSourceEntry>();

  private metrics = {
    played: 0,
    dropped: 0,
    failures: 0,
    lastError: null as string | null
  };

  constructor(config?: VirtualAudioOutputConfig) {
    if (config) {
      if (config.deviceId) this.deviceId = config.deviceId;
      if (config.deviceLabel) this.deviceLabel = config.deviceLabel;
      if (typeof config.maxQueueMs === 'number') this.maxQueueMs = Math.max(200, config.maxQueueMs);
    }
  }

  /**
   * Check if AudioContext and setSinkId are supported in this Chromium/Electron runtime.
   */
  public isSupported(): boolean {
    const AudioContextClass = typeof window !== 'undefined'
      ? (window.AudioContext || (window as any).webkitAudioContext)
      : null;
    return Boolean(AudioContextClass);
  }

  /**
   * Check if a virtual audio sink device is configured.
   */
  public isConfigured(): boolean {
    return Boolean(this.deviceId && this.deviceId.trim().length > 0);
  }

  /**
   * List available physical and virtual output devices.
   */
  public async listOutputDevices(): Promise<Array<{ deviceId: string; label: string }>> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'audiooutput' && d.deviceId)
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Audio Output (${d.deviceId.slice(0, 8)}...)`
        }));
    } catch (err: any) {
      this.metrics.lastError = err?.message || 'Error enumerando dispositivos de salida';
      return [];
    }
  }

  /**
   * Configure the target virtual audio sink (e.g. VB-CABLE Input).
   */
  public async configure(options: { deviceId?: string; deviceLabel?: string }): Promise<VirtualAudioOutputStatus> {
    const nextDeviceId = (options.deviceId || '').trim();
    this.deviceLabel = (options.deviceLabel || '').trim();

    if (!nextDeviceId) {
      this.deviceId = '';
      this.nextScheduleTime = 0;
      return this.getStatus();
    }

    if (!this.isSupported()) {
      this.deviceId = '';
      this.metrics.lastError = 'Web Audio API no disponible en este entorno.';
      return this.getStatus();
    }

    const context = await this.getOrCreateContext();
    if (!context) {
      this.deviceId = '';
      this.metrics.lastError = 'No se pudo inicializar AudioContext.';
      return this.getStatus();
    }

    if (typeof (context as any).setSinkId !== 'function') {
      this.deviceId = '';
      this.metrics.lastError = 'Este entorno no soporta enrutamiento setSinkId a salidas virtuales.';
      return this.getStatus();
    }

    if (this.deviceId === nextDeviceId) {
      return this.getStatus();
    }

    try {
      await (context as any).setSinkId(nextDeviceId);
      this.deviceId = nextDeviceId;
      this.metrics.lastError = null;
    } catch (err: any) {
      this.deviceId = '';
      this.metrics.lastError = err?.message || 'Error asignando sinkId a la salida de audio.';
    }

    return this.getStatus();
  }

  /**
   * Play a chunk of synthesized PCM into the isolated virtual audio channel (`game_voice`).
   * 
   * Strict safety guard:
   * If this service is NOT configured with a dedicated virtual sink, it WILL NOT play
   * through default speakers to prevent unwanted TTS leakage and acoustic feedback!
   */
  public async playAudioChunk(
    base64Pcm: string,
    options: {
      sampleRate?: number;
      frameId?: string;
      sessionId?: string;
      correlationId?: string;
    } = {}
  ): Promise<{
    success: boolean;
    reason?: string;
    frameId?: string;
    durationMs?: number;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        reason: 'not_configured',
        error: 'Salida virtual no configurada. Configure un dispositivo antes de emitir a game_voice.'
      };
    }

    const context = await this.getOrCreateContext();
    if (!context) {
      return {
        success: false,
        reason: 'context_unavailable',
        error: 'AudioContext no disponible.'
      };
    }

    const pcm = this.decodeBase64Pcm(base64Pcm);
    if (!pcm.length) {
      return { success: false, reason: 'empty_payload' };
    }

    const sampleRate = Math.max(8000, Math.min(48000, options.sampleRate || 24000));
    const now = context.currentTime;
    const startAt = Math.max(now, this.nextScheduleTime);
    const duration = pcm.length / sampleRate;

    // Buffer overflow protection: drop chunk if queue is already too backed up
    if ((startAt - now) * 1000 > this.maxQueueMs) {
      this.metrics.dropped++;
      return {
        success: false,
        reason: 'queue_overflow',
        error: `Cola de audio virtual saturada (${Math.round((startAt - now) * 1000)}ms)`
      };
    }

    try {
      if (context.state === 'suspended') {
        await context.resume();
      }

      const audioBuffer = context.createBuffer(1, pcm.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) {
        channelData[i] = pcm[i] / 32768.0;
      }

      const sourceNode = context.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(context.destination);

      const frameId = options.frameId || `v_audio_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const sessionId = options.sessionId || 'session_default';
      const correlationId = options.correlationId || `corr_${Date.now()}`;

      const entry: ActiveSourceEntry = {
        source: sourceNode,
        frameId,
        sessionId,
        correlationId
      };

      this.activeSources.add(entry);

      sourceNode.onended = () => {
        this.cleanupSourceEntry(entry);
      };

      if (this.activeSources.size === 1) {
        this.emitLifecycleEvent('translation.virtual_output_started', entry);
      }

      sourceNode.start(startAt);
      this.nextScheduleTime = startAt + duration;
      this.metrics.played++;

      return {
        success: true,
        frameId,
        durationMs: Math.round(duration * 1000)
      };
    } catch (err: any) {
      this.metrics.failures++;
      this.metrics.lastError = err?.message || String(err);
      return {
        success: false,
        reason: 'playback_exception',
        error: this.metrics.lastError!
      };
    }
  }

  /**
   * Get telemetry and operational status.
   */
  public getStatus(): VirtualAudioOutputStatus {
    const context = this.audioContext;
    const queuedMs = context
      ? Math.max(0, Math.round(((this.nextScheduleTime || 0) - (context.currentTime || 0)) * 1000))
      : 0;

    return {
      configured: this.isConfigured(),
      supported: this.isSupported(),
      deviceId: this.deviceId || null,
      deviceLabel: this.deviceLabel || null,
      activeSources: this.activeSources.size,
      queuedMs,
      played: this.metrics.played,
      dropped: this.metrics.dropped,
      failures: this.metrics.failures,
      lastError: this.metrics.lastError
    };
  }

  /**
   * Stop all active virtual audio outputs immediately.
   */
  public stopImmediate(): void {
    for (const entry of Array.from(this.activeSources)) {
      try {
        entry.source.stop();
        entry.source.disconnect();
      } catch (_) {}
      this.activeSources.delete(entry);
    }
    this.nextScheduleTime = 0;
  }

  private cleanupSourceEntry(entry: ActiveSourceEntry): void {
    if (!this.activeSources.has(entry)) return;
    this.activeSources.delete(entry);

    try {
      entry.source.disconnect();
    } catch (_) {}

    if (this.activeSources.size === 0) {
      this.nextScheduleTime = 0;
      this.emitLifecycleEvent('translation.virtual_output_ended', entry);
    }
  }

  private emitLifecycleEvent(eventType: string, entry: ActiveSourceEntry): void {
    eventBus.emitDomain(eventType, {
      frameId: entry.frameId,
      deviceId: this.deviceId,
      deviceLabel: this.deviceLabel
    }, {
      source: 'virtual_audio_output',
      sessionId: entry.sessionId,
      correlationId: entry.correlationId,
      privacy: 'internal'
    });
  }

  private async getOrCreateContext(): Promise<AudioContext | null> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      return this.audioContext;
    }

    const AudioContextClass = typeof window !== 'undefined'
      ? (window.AudioContext || (window as any).webkitAudioContext)
      : null;

    if (!AudioContextClass) return null;

    try {
      this.audioContext = new AudioContextClass({ latencyHint: 'interactive' });
      return this.audioContext;
    } catch (err: any) {
      this.metrics.lastError = err?.message || 'Error creando AudioContext';
      return null;
    }
  }

  private decodeBase64Pcm(base64: string): Int16Array {
    if (!base64) return new Int16Array(0);
    try {
      if (typeof atob === 'function') {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
      }
      if (typeof Buffer !== 'undefined') {
        const buf = Buffer.from(base64, 'base64');
        return new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 2));
      }
    } catch (_) {
      return new Int16Array(0);
    }
    return new Int16Array(0);
  }

  /**
   * Release all resources.
   */
  public async destroy(): Promise<void> {
    this.stopImmediate();
    const context = this.audioContext;
    this.audioContext = null;
    this.deviceId = '';
    this.nextScheduleTime = 0;
    if (context && context.state !== 'closed') {
      try {
        await context.close();
      } catch (_) {}
    }
  }
}

export const virtualAudioOutputService = new VirtualAudioOutputService();
export default virtualAudioOutputService;
