import { eventBus, EVENTS } from '../eventBus.js';

/**
 * Source-aware audio router. It deliberately does not mix streams: every
 * frame keeps its origin so generated translation audio cannot re-enter the
 * microphone or loopback recognizer.
 */
export class AudioRoutingService {
  constructor() {
    this.sources = new Map();
    this.routes = new Map();
    this.generatedFrameIds = new Map();
    this.maxGeneratedIds = 512;
  }

  registerSource(sourceId, metadata = {}) {
    if (!sourceId) return false;
    this.sources.set(sourceId, { sourceId, ...metadata, registeredAt: Date.now() });
    return true;
  }

  unregisterSource(sourceId) {
    this.routes.delete(sourceId);
    return this.sources.delete(sourceId);
  }

  setRoute(sourceId, targetId, { enabled = true, purpose = 'analysis' } = {}) {
    if (!sourceId || !targetId) return false;
    this.routes.set(sourceId, { sourceId, targetId, enabled, purpose });
    eventBus.emitDomain('audio.route_changed', this.routes.get(sourceId), {
      source: 'audio_router', privacy: 'internal'
    });
    return true;
  }

  markGenerated(frameId, sourceId = 'cristi_translation') {
    if (!frameId) return;
    this.generatedFrameIds.set(frameId, { sourceId, createdAt: Date.now() });
    while (this.generatedFrameIds.size > this.maxGeneratedIds) {
      this.generatedFrameIds.delete(this.generatedFrameIds.keys().next().value);
    }
  }

  isSelfGenerated(frameId) {
    return Boolean(frameId && this.generatedFrameIds.has(frameId));
  }

  acceptFrame({ frameId, sourceId, data, sampleRate = 16000, timestamp = Date.now() } = {}) {
    if (!sourceId || !data || this.isSelfGenerated(frameId)) return false;
    const route = this.routes.get(sourceId);
    if (route && !route.enabled) return false;
    const envelope = { frameId: frameId || `audio_${timestamp}`, sourceId, data, sampleRate, timestamp };
    eventBus.emitDomain('audio.frame_received', envelope, {
      source: sourceId, privacy: sourceId === 'microphone' ? 'private' : 'external'
    });
    return envelope;
  }
}

export const audioRoutingService = new AudioRoutingService();
export default audioRoutingService;
