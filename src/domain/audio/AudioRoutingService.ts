/**
 * Cristi AI - AudioRoutingService (TypeScript)
 * Source-aware audio router. It deliberately does not mix streams: every
 * frame keeps its origin so generated translation audio cannot re-enter the
 * microphone or loopback recognizer.
 */

import { eventBus } from '../../infrastructure/events/eventBus';

export interface AudioSourceInfo {
  sourceId: string;
  registeredAt: number;
  [key: string]: unknown;
}

export interface AudioRoute {
  sourceId: string;
  targetId: string;
  enabled: boolean;
  purpose: string;
}

export interface AudioEnvelope {
  frameId: string;
  sourceId: string;
  data: unknown;
  sampleRate: number;
  timestamp: number;
}

export class AudioRoutingService {
  private sources = new Map<string, AudioSourceInfo>();
  private routes = new Map<string, AudioRoute>();
  private generatedFrameIds = new Map<string, { sourceId: string; createdAt: number }>();
  private readonly maxGeneratedIds = 512;

  public registerSource(sourceId: string, metadata: Record<string, unknown> = {}): boolean {
    if (!sourceId) return false;
    this.sources.set(sourceId, { sourceId, ...metadata, registeredAt: Date.now() });
    return true;
  }

  public unregisterSource(sourceId: string): boolean {
    this.routes.delete(sourceId);
    return this.sources.delete(sourceId);
  }

  public setRoute(sourceId: string, targetId: string, { enabled = true, purpose = 'analysis' }: { enabled?: boolean; purpose?: string } = {}): boolean {
    if (!sourceId || !targetId) return false;
    const route: AudioRoute = { sourceId, targetId, enabled, purpose };
    this.routes.set(sourceId, route);
    eventBus.emitDomain('audio.route_changed', route, {
      source: 'audio_router', privacy: 'internal'
    });
    return true;
  }

  public getRoute(sourceId: string): AudioRoute | undefined {
    return this.routes.get(sourceId);
  }

  public markGenerated(frameId: string, sourceId = 'cristi_translation'): void {
    if (!frameId) return;
    this.generatedFrameIds.set(frameId, { sourceId, createdAt: Date.now() });
    while (this.generatedFrameIds.size > this.maxGeneratedIds) {
      const firstKey = this.generatedFrameIds.keys().next().value;
      if (firstKey) this.generatedFrameIds.delete(firstKey);
    }
  }

  public isSelfGenerated(frameId: string): boolean {
    return Boolean(frameId && this.generatedFrameIds.has(frameId));
  }

  public isGenerated(frameId: string): boolean {
    return this.isSelfGenerated(frameId);
  }

  public acceptFrame({
    frameId,
    sourceId,
    data,
    sampleRate = 16000,
    timestamp = Date.now()
  }: {
    frameId?: string;
    sourceId: string;
    data: unknown;
    sampleRate?: number;
    timestamp?: number;
  }): AudioEnvelope | false {
    if (!sourceId || !data || (frameId && this.isSelfGenerated(frameId))) return false;
    const route = this.routes.get(sourceId);
    if (route && !route.enabled) return false;
    const envelope: AudioEnvelope = {
      frameId: frameId || `audio_${timestamp}`,
      sourceId,
      data,
      sampleRate,
      timestamp
    };
    eventBus.emitDomain('audio.frame_received', envelope, {
      source: sourceId, privacy: sourceId === 'microphone' ? 'sensitive' : 'external'
    });
    return envelope;
  }
}

export const audioRoutingService = new AudioRoutingService();
export default audioRoutingService;
