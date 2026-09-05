import { eventBus, EVENTS } from '../eventBus.js';
import { audioRoutingService } from './AudioRoutingService.js';

const unsupported = async () => ({ success: false, error: 'Proveedor de traducción no configurado.' });

/** Provider-agnostic streaming translation pipeline. */
export class TranslationService {
  constructor({ provider = {} } = {}) {
    this.provider = {
      transcribe: provider.transcribe || unsupported,
      detectLanguage: provider.detectLanguage || (async () => ({ success: false })),
      translate: provider.translate || unsupported,
      synthesize: provider.synthesize || unsupported,
      isVoiceActivity: provider.isVoiceActivity || (() => true),
      isRelevant: provider.isRelevant || (() => true),
      detectSpeaker: provider.detectSpeaker || (async () => null)
    };
    this.inFlight = new Map();
    this.pending = new Map();
    this.sourceSubscriptions = new Map();
    this.eventSubscriptions = new Map();
    // Optional utterance aggregation keeps REST providers from receiving one
    // request per 20 ms capture frame. Live providers can still use the
    // default (latest-frame) path by leaving aggregateMs at zero.
    this.aggregators = new Map();
    this.metrics = { frames: 0, completed: 0, dropped: 0, queued: 0, lastLatencyMs: 0 };
  }

  configure(provider = {}) {
    const methods = ['transcribe', 'detectLanguage', 'translate', 'synthesize', 'isVoiceActivity', 'isRelevant', 'detectSpeaker'];
    const bound = {};
    for (const method of methods) {
      if (typeof provider?.[method] === 'function') bound[method] = provider[method].bind(provider);
    }
    this.provider = {
      ...this.provider,
      ...bound
    };
  }

  /** Attach a source-aware capture service without coupling it to a provider. */
  attachSource(source, { targetLanguage = 'es', sessionId = null, relevanceGate = true, aggregateMs = 0, maxUtteranceMs = 1800 } = {}) {
    if (!source || typeof source.setFrameHandler !== 'function') return false;
    this.detachSource(source);
    const handler = (frame) => {
      if (!frame) return;
      this._acceptAttachedFrame(frame, { targetLanguage, sessionId, relevanceGate, aggregateMs, maxUtteranceMs, aggregationKey: source.sourceId || 'system_loopback' });
    };
    source.setFrameHandler(handler);
    this.sourceSubscriptions.set(source, handler);
    return true;
  }

  detachSource(source) {
    if (!source || !this.sourceSubscriptions.has(source)) return false;
    source.setFrameHandler(null);
    this.sourceSubscriptions.delete(source);
    const sourceId = source.sourceId || 'system_loopback';
    this.pending.delete(sourceId);
    this._clearAggregator(sourceId);
    return true;
  }

  /** Attach a domain event source such as `discord.voice_audio`. */
  attachEventSource(eventName, { targetLanguage = 'es', sessionId = null, relevanceGate = true, aggregateMs = 0, maxUtteranceMs = 1800 } = {}) {
    if (!eventName || typeof eventBus.on !== 'function') return false;
    this.detachEventSource(eventName);
    const unsubscribe = eventBus.on(eventName, (envelope) => {
      const payload = envelope?.payload || envelope;
      if (!payload?.data) return;
      this._acceptAttachedFrame(payload, { targetLanguage, sessionId: sessionId || envelope?.sessionId, relevanceGate, aggregateMs, maxUtteranceMs, aggregationKey: `event:${eventName}:${payload.sourceId || 'external_audio'}` });
    });
    this.eventSubscriptions.set(eventName, unsubscribe);
    return true;
  }

  detachEventSource(eventName) {
    const unsubscribe = this.eventSubscriptions.get(eventName);
    if (!unsubscribe) return false;
    unsubscribe();
    this.eventSubscriptions.delete(eventName);
    this._clearAggregatorsMatching(`event:${eventName}:`);
    return true;
  }

  _acceptAttachedFrame(frame, options) {
    if (!frame?.data) return;
    const aggregateMs = Math.max(0, Number(options.aggregateMs) || 0);
    if (!aggregateMs) {
      this.enqueueFrame({ ...frame, routed: true, ...options });
      return;
    }
    const sourceId = options.aggregationKey || frame.sourceId || 'external_audio';
    const current = this.aggregators.get(sourceId) || {
      frames: [], bytes: 0, timer: null, startedAt: Date.now(), options
    };
    current.options = options;
    current.frames.push(frame);
    current.bytes += Math.max(0, Math.floor(String(frame.data).length * 0.75));
    const elapsed = Date.now() - current.startedAt;
    if (!current.timer) {
      current.timer = setTimeout(() => this._flushAggregator(sourceId), aggregateMs);
    }
    if (elapsed >= Math.max(aggregateMs, Number(options.maxUtteranceMs) || 1800) || current.bytes >= 128000) {
      this._flushAggregator(sourceId);
    } else {
      this.aggregators.set(sourceId, current);
    }
  }

  _flushAggregator(sourceId) {
    const aggregate = this.aggregators.get(sourceId);
    if (!aggregate) return;
    if (aggregate.timer) clearTimeout(aggregate.timer);
    this.aggregators.delete(sourceId);
    const frames = aggregate.frames.filter((frame) => frame?.data);
    if (!frames.length) return;
    const merged = mergeBase64Pcm(frames.map((frame) => frame.data));
    this.enqueueFrame({
      ...frames.at(-1),
      frameId: `${frames[0].frameId || 'audio'}_${frames.at(-1).frameId || Date.now()}`,
      data: merged,
      routed: true,
      ...aggregate.options
    });
  }

  _clearAggregator(sourceId) {
    const aggregate = this.aggregators.get(sourceId);
    if (aggregate?.timer) clearTimeout(aggregate.timer);
    this.aggregators.delete(sourceId);
  }

  _clearAggregatorsMatching(prefix) {
    for (const key of this.aggregators.keys()) {
      if (key.startsWith(prefix)) this._clearAggregator(key);
    }
  }

  enqueueFrame(input = {}) {
    const sourceId = input.sourceId || 'external_audio';
    // Keep only the newest frame per source. This bounds memory and latency
    // when transcription or translation takes longer than capture cadence.
    this.pending.set(sourceId, input);
    this.metrics.queued = this.pending.size;
    if (this.inFlight.has(sourceId)) return;
    void this.drainSource(sourceId);
  }

  async drainSource(sourceId) {
    if (this.inFlight.has(sourceId)) return;
    this.inFlight.set(sourceId, true);
    try {
      while (this.pending.has(sourceId)) {
        const input = this.pending.get(sourceId);
        this.pending.delete(sourceId);
        this.metrics.queued = this.pending.size;
        await this.processFrame(input);
      }
    } finally {
      this.inFlight.delete(sourceId);
      this.metrics.queued = this.pending.size;
    }
  }

  async processFrame({ frameId, sourceId = 'game_loopback', data, sampleRate = 16000, targetLanguage = 'es', sessionId = null, routed = false, relevanceGate = true } = {}) {
    const frame = routed
      ? { frameId, sourceId, data, sampleRate, timestamp: Date.now() }
      : audioRoutingService.acceptFrame({ frameId, sourceId, data, sampleRate });
    if (!frame || !this.provider.isVoiceActivity(data)) {
      this.metrics.dropped += 1;
      return { success: false, dropped: true };
    }
    const startedAt = Date.now();
    const correlationId = `translation_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
    this.metrics.frames += 1;
    eventBus.emitDomain(EVENTS.TRANSLATION_REQUESTED, { sourceId, targetLanguage }, {
      source: 'translation', sessionId, correlationId, privacy: 'external'
    });
    try {
      const transcript = await this.provider.transcribe({ data, sampleRate, sourceId, sessionId });
      if (!transcript?.text) return { success: false, error: 'No se obtuvo transcripción.' };
      const speakerId = transcript.speakerId || await this.provider.detectSpeaker({ transcript: transcript.text, data, sourceId, sessionId });
      if (relevanceGate && !(await this.provider.isRelevant({ text: transcript.text, sourceId, speakerId, sessionId }))) {
        this.metrics.dropped += 1;
        return { success: false, dropped: true, reason: 'not_relevant', transcript: transcript.text, speakerId };
      }
      const detected = await this.provider.detectLanguage({ text: transcript.text, sourceId });
      const translated = await this.provider.translate({
        text: transcript.text,
        sourceLanguage: detected?.language || null,
        targetLanguage,
        sourceId,
        sessionId
      });
      let audio = null;
      if (translated?.text) {
        audio = await this.provider.synthesize({ text: translated.text, language: targetLanguage, sourceId, sessionId });
        if (audio?.frameId) audioRoutingService.markGenerated(audio.frameId, 'cristi_translation');
      }
      const result = {
        success: true,
        sourceId,
        transcript: transcript.text,
        speakerId: speakerId || null,
        sourceLanguage: detected?.language || null,
        translation: translated?.text || null,
        audio,
        latencyMs: Date.now() - startedAt
      };
      this.metrics.completed += 1;
      this.metrics.lastLatencyMs = result.latencyMs;
      eventBus.emitDomain(EVENTS.TRANSLATION_COMPLETED, result, {
        source: 'translation', sessionId, correlationId, privacy: 'external'
      });
      return result;
    } finally {
      this.metrics.queued = this.pending.size;
    }
  }

  getMetrics() {
    return { ...this.metrics, inFlight: this.inFlight.size };
  }

  destroy() {
    for (const key of this.aggregators.keys()) this._clearAggregator(key);
    for (const source of this.sourceSubscriptions.keys()) this.detachSource(source);
    for (const eventName of this.eventSubscriptions.keys()) this.detachEventSource(eventName);
  }
}

function mergeBase64Pcm(chunks) {
  if (chunks.length === 1) return String(chunks[0]);
  try {
    const decode = (value) => {
      if (typeof globalThis.atob === 'function') {
        const binary = globalThis.atob(String(value));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return bytes;
      }
      if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(String(value), 'base64'));
      return new Uint8Array();
    };
    const decoded = chunks.map(decode);
    const merged = new Uint8Array(decoded.reduce((sum, item) => sum + item.length, 0));
    let offset = 0;
    for (const item of decoded) { merged.set(item, offset); offset += item.length; }
    let binary = '';
    for (let i = 0; i < merged.length; i += 0x8000) {
      binary += String.fromCharCode(...merged.subarray(i, Math.min(i + 0x8000, merged.length)));
    }
    if (typeof globalThis.btoa === 'function') return globalThis.btoa(binary);
    if (typeof Buffer !== 'undefined') return Buffer.from(merged).toString('base64');
  } catch (_) {}
  return String(chunks.join(''));
}

export const translationService = new TranslationService();
export default translationService;
