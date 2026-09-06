import { eventBus, EVENTS } from '../eventBus.js';
import { audioRoutingService } from './AudioRoutingService.js';

const unsupported = async () => ({ success: false, error: 'Proveedor de traducción no configurado.' });

/** Provider-agnostic streaming translation pipeline. */
export class TranslationService {
  constructor({ provider = {} } = {}) {
    this.provider = {
      transcribe: provider.transcribe || unsupported,
      detectLanguage: provider.detectLanguage || (async () => ({ success: false })),
      translateAndDetect: provider.translateAndDetect || null,
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
    this.eventSourceIds = new Map();
    this.sourceEpochs = new Map();
    this.inputSequence = 0;
    this.latencySamples = [];
    this.maxLatencySamples = 120;
    // The service remains usable as a library by default. The desktop app
    // explicitly disables it until the user enables external translation.
    this.enabled = true;
    // Optional utterance aggregation keeps REST providers from receiving one
    // request per 20 ms capture frame. Live providers can still use the
    // default (latest-frame) path by leaving aggregateMs at zero.
    this.aggregators = new Map();
    this.metrics = {
      frames: 0,
      completed: 0,
      textReady: 0,
      dropped: 0,
      queued: 0,
      stale: 0,
      superseded: 0,
      expired: 0,
      failed: 0,
      lastLatencyMs: 0
    };
  }

  configure(provider = {}) {
    const methods = ['transcribe', 'detectLanguage', 'translateAndDetect', 'translate', 'synthesize', 'isVoiceActivity', 'isRelevant', 'detectSpeaker'];
    const bound = {};
    for (const method of methods) {
      if (typeof provider?.[method] === 'function') bound[method] = provider[method].bind(provider);
    }
    this.provider = {
      ...this.provider,
      ...bound
    };
  }

  setEnabled(enabled) {
    const next = enabled !== false;
    if (this.enabled === next) return this.enabled;
    this.enabled = next;
    if (!next) {
      for (const source of [...this.sourceSubscriptions.keys()]) this.detachSource(source);
      for (const eventName of [...this.eventSubscriptions.keys()]) this.detachEventSource(eventName);
      for (const sourceId of [...this.aggregators.keys()]) this._clearAggregator(sourceId);
      this.pending.clear();
      this.metrics.queued = 0;
    }
    eventBus.emitDomain('translation.state_changed', { enabled: this.enabled }, {
      source: 'translation', privacy: 'internal'
    });
    return this.enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  /** Attach a source-aware capture service without coupling it to a provider. */
  attachSource(source, {
    targetLanguage = 'es',
    sessionId = null,
    relevanceGate = true,
    aggregateMs = 0,
    maxUtteranceMs = 1800,
    maxResultAgeMs = 8000,
    outputRoute = 'local'
  } = {}) {
    if (!this.enabled) return false;
    if (!source || typeof source.setFrameHandler !== 'function') return false;
    this.detachSource(source);
    const sourceIds = new Set();
    const handler = (frame) => {
      if (!frame) return;
      const sourceId = frame.sourceId || source.sourceId || 'system_loopback';
      sourceIds.add(sourceId);
      const streamEpoch = this._activateSource(sourceId);
      this._acceptAttachedFrame({ ...frame, sourceId }, {
        targetLanguage, sessionId, relevanceGate, aggregateMs, maxUtteranceMs,
        maxResultAgeMs, dropSuperseded: aggregateMs > 0,
        outputRoute, aggregationKey: sourceId, streamEpoch
      });
    };
    source.setFrameHandler(handler);
    this.sourceSubscriptions.set(source, { handler, sourceIds });
    return true;
  }

  detachSource(source) {
    if (!source || !this.sourceSubscriptions.has(source)) return false;
    source.setFrameHandler(null);
    const subscription = this.sourceSubscriptions.get(source);
    this.sourceSubscriptions.delete(source);
    const sourceIds = subscription?.sourceIds?.size ? subscription.sourceIds : new Set([source.sourceId || 'system_loopback']);
    for (const sourceId of sourceIds) {
      this._invalidateSource(sourceId);
      this._clearAggregator(sourceId);
    }
    return true;
  }

  /** Attach a domain event source such as `discord.voice_audio`. */
  attachEventSource(eventName, {
    targetLanguage = 'es',
    sessionId = null,
    relevanceGate = true,
    aggregateMs = 0,
    maxUtteranceMs = 1800,
    maxResultAgeMs = 8000,
    outputRoute = 'local'
  } = {}) {
    if (!this.enabled) return false;
    if (!eventName || typeof eventBus.on !== 'function') return false;
    this.detachEventSource(eventName);
    const prefix = `event:${eventName}:`;
    const sourceIds = new Set();
    const unsubscribe = eventBus.on(eventName, (envelope) => {
      const payload = envelope?.payload || envelope;
      if (!payload?.data) return;
      const sourceId = payload.sourceId || 'external_audio';
      sourceIds.add(sourceId);
      const streamEpoch = this._activateSource(sourceId);
      this._acceptAttachedFrame(payload, {
        targetLanguage, sessionId: sessionId || envelope?.sessionId, relevanceGate,
        aggregateMs, maxUtteranceMs, maxResultAgeMs, dropSuperseded: aggregateMs > 0, outputRoute,
        aggregationKey: `${prefix}${sourceId}`, streamEpoch
      });
    });
    this.eventSubscriptions.set(eventName, unsubscribe);
    this.eventSourceIds.set(eventName, sourceIds);
    return true;
  }

  detachEventSource(eventName) {
    const unsubscribe = this.eventSubscriptions.get(eventName);
    if (!unsubscribe) return false;
    unsubscribe();
    this.eventSubscriptions.delete(eventName);
    this._clearAggregatorsMatching(`event:${eventName}:`);
    for (const sourceId of this.eventSourceIds.get(eventName) || []) this._invalidateSource(sourceId);
    this.eventSourceIds.delete(eventName);
    return true;
  }

  _acceptAttachedFrame(frame, options) {
    if (!frame?.data) return;
    const aggregateMs = Math.max(0, Number(options.aggregateMs) || 0);
    const aggregationKey = options.aggregationKey || frame.sourceId || 'external_audio';
    if (!this._isVoiceActive(frame, options)) {
      // `aggregateMs` is a silence debounce, not a fixed slicing cadence.
      // A silence frame closes the utterance immediately; without VAD the
      // timeout below still gives a bounded, low-latency fallback.
      if (this.aggregators.has(aggregationKey)) this._flushAggregator(aggregationKey);
      else this.metrics.dropped += 1;
      return;
    }
    if (!aggregateMs) {
      this.enqueueFrame({ ...frame, routed: true, ...options });
      return;
    }
    const now = Date.now();
    const current = this.aggregators.get(aggregationKey) || {
      frames: [], bytes: 0, timer: null, startedAt: now, lastSpeechAt: now, options
    };
    current.options = options;
    current.lastSpeechAt = now;
    current.frames.push(frame);
    current.bytes += Math.max(0, Math.floor(String(frame.data).length * 0.75));
    const elapsed = now - current.startedAt;
    this.aggregators.set(aggregationKey, current);
    if (current.timer) clearTimeout(current.timer);
    current.timer = setTimeout(() => this._flushAggregator(aggregationKey), aggregateMs);
    if (elapsed >= Math.max(aggregateMs, Number(options.maxUtteranceMs) || 1800) || current.bytes >= 128000) {
      this._flushAggregator(aggregationKey);
    }
  }

  _isVoiceActive(frame, options = {}) {
    try {
      // Provider implementations may add VAD without forcing a browser/audio
      // dependency on the core pipeline. Only an explicit `false` closes an
      // utterance, preserving compatibility with providers that cannot VAD.
      return this.provider.isVoiceActivity(frame?.data, { frame, ...options }) !== false;
    } catch (_) {
      return true;
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

  _activateSource(sourceId) {
    if (!this.sourceEpochs.has(sourceId)) this.sourceEpochs.set(sourceId, 1);
    return this.sourceEpochs.get(sourceId);
  }

  _invalidateSource(sourceId) {
    const next = (this.sourceEpochs.get(sourceId) || 0) + 1;
    this.sourceEpochs.set(sourceId, next);
    this.pending.delete(sourceId);
    return next;
  }

  _isCurrent(input) {
    return this.sourceEpochs.get(input.sourceId || 'external_audio') === input.streamEpoch;
  }

  enqueueFrame(input = {}) {
    if (!this.enabled) return;
    const sourceId = input.sourceId || 'external_audio';
    // Keep only the newest frame per source. This bounds memory and latency
    // when transcription or translation takes longer than capture cadence.
    if (!this._isCurrent({ ...input, streamEpoch: input.streamEpoch ?? this._activateSource(sourceId) })) return;
    const sequence = Number(input.sequence) || ++this.inputSequence;
    this.pending.set(sourceId, {
      ...input,
      sequence,
      queuedAt: Number(input.queuedAt) || Date.now(),
      streamEpoch: input.streamEpoch ?? this._activateSource(sourceId)
    });
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
        try {
          await this.processFrame(input);
        } catch (error) {
          this.metrics.failed += 1;
          eventBus.emitDomain('translation.failed', { sourceId, message: error.message }, {
            source: 'translation', sessionId: input.sessionId || null, privacy: 'internal'
          });
        }
      }
    } finally {
      this.inFlight.delete(sourceId);
      this.metrics.queued = this.pending.size;
    }
  }

  async processFrame({
    frameId,
    sourceId = 'game_loopback',
    data,
    sampleRate = 16000,
    targetLanguage = 'es',
    sessionId = null,
    routed = false,
    relevanceGate = true,
    streamEpoch = null,
    outputRoute = 'local',
    guildId = null,
    channelId = null,
    speakerId: suppliedSpeakerId = null,
    maxResultAgeMs = 8000,
    sequence = 0,
    dropSuperseded = false
  } = {}) {
    if (!this.enabled) return { success: false, disabled: true };
    const stale = () => streamEpoch !== null && this.sourceEpochs.get(sourceId) !== streamEpoch;
    const superseded = () => {
      const newest = this.pending.get(sourceId);
      return Boolean(dropSuperseded && newest && Number(newest.sequence) > Number(sequence));
    };
    if (stale()) {
      this.metrics.stale += 1;
      return { success: false, stale: true };
    }
    const frame = routed
      ? { frameId, sourceId, data, sampleRate, timestamp: Date.now() }
      : audioRoutingService.acceptFrame({ frameId, sourceId, data, sampleRate });
    if (!frame || !this._isVoiceActive({ frameId, sourceId, data, sampleRate })) {
      this.metrics.dropped += 1;
      return { success: false, dropped: true };
    }
    const startedAt = Date.now();
    const resultAgeLimitMs = Math.max(1000, Number(maxResultAgeMs) || 8000);
    const isExpired = () => Date.now() - startedAt > resultAgeLimitMs;
    const discardLate = () => {
      if (stale()) {
        this.metrics.stale += 1;
        return { success: false, stale: true };
      }
      if (superseded()) {
        this.metrics.superseded += 1;
        return { success: false, superseded: true };
      }
      if (isExpired()) {
        this.metrics.expired += 1;
        return { success: false, expired: true, maxResultAgeMs: resultAgeLimitMs };
      }
      return null;
    };
    const phaseLatencyMs = {};
    const runPhase = async (name, fn) => {
      const phaseStartedAt = Date.now();
      try {
        return await fn();
      } finally {
        phaseLatencyMs[name] = Date.now() - phaseStartedAt;
      }
    };
    const correlationId = `translation_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
    this.metrics.frames += 1;
    eventBus.emitDomain(EVENTS.TRANSLATION_REQUESTED, { sourceId, targetLanguage }, {
      source: 'translation', sessionId, correlationId, privacy: 'external'
    });
    try {
      const transcript = await runPhase('transcription', () => this.provider.transcribe({ data, sampleRate, sourceId, sessionId }));
      const discardedAfterTranscription = discardLate();
      if (discardedAfterTranscription) return discardedAfterTranscription;
      if (!transcript?.text) return { success: false, error: 'No se obtuvo transcripción.' };
      const speakerId = suppliedSpeakerId || transcript.speakerId || await runPhase('speaker', () => this.provider.detectSpeaker({ transcript: transcript.text, data, sourceId, sessionId }));
      const discardedAfterSpeaker = discardLate();
      if (discardedAfterSpeaker) return discardedAfterSpeaker;
      if (relevanceGate && !(await runPhase('relevance', () => this.provider.isRelevant({ text: transcript.text, sourceId, speakerId, sessionId })))) {
        this.metrics.dropped += 1;
        return { success: false, dropped: true, reason: 'not_relevant', transcript: transcript.text, speakerId };
      }
      const discardedAfterRelevance = discardLate();
      if (discardedAfterRelevance) return discardedAfterRelevance;
      let detected;
      let translated;
      if (typeof this.provider.translateAndDetect === 'function') {
        const combined = await runPhase('translation', () => this.provider.translateAndDetect({
          text: transcript.text, targetLanguage, sourceId, sessionId
        }));
        detected = { language: combined?.sourceLanguage || null };
        translated = combined;
      } else {
        detected = await runPhase('language', () => this.provider.detectLanguage({ text: transcript.text, sourceId }));
        const discardedAfterLanguage = discardLate();
        if (discardedAfterLanguage) return discardedAfterLanguage;
        translated = await runPhase('translation', () => this.provider.translate({
          text: transcript.text,
          sourceLanguage: detected?.language || null,
          targetLanguage,
          sourceId,
          sessionId
        }));
      }
      const discardedAfterTranslation = discardLate();
      if (discardedAfterTranslation) return discardedAfterTranslation;
      const textReady = {
        sourceId,
        transcript: transcript.text,
        speakerId: speakerId || null,
        sourceLanguage: detected?.language || null,
        translation: translated?.text || null,
        outputRoute,
        guildId,
        channelId,
        correlationId,
        timestamp: Date.now(),
        latencyMs: Date.now() - startedAt,
        phaseLatencyMs: { ...phaseLatencyMs }
      };
      if (textReady.translation) {
        this.metrics.textReady += 1;
        eventBus.emitDomain(EVENTS.TRANSLATION_TEXT_READY, textReady, {
          source: 'translation', sessionId, correlationId, privacy: 'external'
        });
      }
      let audio = null;
      if (translated?.text) {
        audio = await runPhase('synthesis', () => this.provider.synthesize({ text: translated.text, language: targetLanguage, sourceId, sessionId }));
        const discardedAfterSynthesis = discardLate();
        if (discardedAfterSynthesis) return discardedAfterSynthesis;
        if (audio?.data) {
          audio = { ...audio, frameId: audio.frameId || `translation_${correlationId}` };
          audioRoutingService.markGenerated(audio.frameId, 'cristi_translation');
        }
      }
      const result = {
        success: true,
        sourceId,
        transcript: transcript.text,
        speakerId: speakerId || null,
        sourceLanguage: detected?.language || null,
        translation: translated?.text || null,
        audio,
        outputRoute,
        guildId,
        channelId,
        correlationId,
        timestamp: Date.now(),
        latencyMs: Date.now() - startedAt,
        phaseLatencyMs
      };
      this.metrics.completed += 1;
      this.metrics.lastLatencyMs = result.latencyMs;
      this.latencySamples.push(result.latencyMs);
      if (this.latencySamples.length > this.maxLatencySamples) this.latencySamples.shift();
      eventBus.emitDomain(EVENTS.TRANSLATION_COMPLETED, result, {
        source: 'translation', sessionId, correlationId, privacy: 'external'
      });
      return result;
    } finally {
      this.metrics.queued = this.pending.size;
    }
  }

  /**
   * Translates an explicit user utterance for a selected output route. This is
   * used when Cristi is asked to say something into a game voice channel; it
   * deliberately shares the same subtitle-first events as captured speech.
   */
  async translateText({
    text,
    targetLanguage = 'es',
    sourceId = 'user_translation',
    sessionId = null,
    outputRoute = 'game_voice'
  } = {}) {
    if (!this.enabled) return { success: false, disabled: true };
    const transcript = String(text || '').trim();
    if (!transcript) return { success: false, error: 'No hay texto para traducir.' };
    const startedAt = Date.now();
    const correlationId = `translation_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
    const phaseLatencyMs = {};
    const runPhase = async (name, fn) => {
      const phaseStartedAt = Date.now();
      try { return await fn(); }
      finally { phaseLatencyMs[name] = Date.now() - phaseStartedAt; }
    };
    this.metrics.frames += 1;
    eventBus.emitDomain(EVENTS.TRANSLATION_REQUESTED, { sourceId, targetLanguage, explicitText: true }, {
      source: 'translation', sessionId, correlationId, privacy: 'external'
    });
    try {
      let detected;
      let translated;
      if (typeof this.provider.translateAndDetect === 'function') {
        translated = await runPhase('translation', () => this.provider.translateAndDetect({ text: transcript, targetLanguage, sourceId, sessionId }));
        detected = { language: translated?.sourceLanguage || null };
      } else {
        detected = await runPhase('language', () => this.provider.detectLanguage({ text: transcript, sourceId }));
        translated = await runPhase('translation', () => this.provider.translate({
          text: transcript, sourceLanguage: detected?.language || null, targetLanguage, sourceId, sessionId
        }));
      }
      if (!translated?.text) return { success: false, error: 'No se obtuvo traducción.' };
      const base = {
        sourceId,
        transcript,
        speakerId: null,
        sourceLanguage: detected?.language || null,
        translation: translated.text,
        outputRoute,
        correlationId,
        timestamp: Date.now(),
        latencyMs: Date.now() - startedAt,
        phaseLatencyMs: { ...phaseLatencyMs }
      };
      this.metrics.textReady += 1;
      eventBus.emitDomain(EVENTS.TRANSLATION_TEXT_READY, base, {
        source: 'translation', sessionId, correlationId, privacy: 'external'
      });
      let audio = await runPhase('synthesis', () => this.provider.synthesize({ text: translated.text, language: targetLanguage, sourceId, sessionId }));
      if (audio?.data) {
        audio = { ...audio, frameId: audio.frameId || `translation_${correlationId}` };
        audioRoutingService.markGenerated(audio.frameId, 'cristi_translation');
      }
      const result = {
        success: true,
        ...base,
        audio,
        latencyMs: Date.now() - startedAt,
        phaseLatencyMs
      };
      this.metrics.completed += 1;
      this.metrics.lastLatencyMs = result.latencyMs;
      this.latencySamples.push(result.latencyMs);
      if (this.latencySamples.length > this.maxLatencySamples) this.latencySamples.shift();
      eventBus.emitDomain(EVENTS.TRANSLATION_COMPLETED, result, {
        source: 'translation', sessionId, correlationId, privacy: 'external'
      });
      return result;
    } catch (error) {
      this.metrics.failed += 1;
      eventBus.emitDomain('translation.failed', { sourceId, message: error?.message || String(error) }, {
        source: 'translation', sessionId, correlationId, privacy: 'internal'
      });
      return { success: false, error: error?.message || String(error) };
    }
  }

  getMetrics() {
    const latency = [...this.latencySamples].sort((left, right) => left - right);
    const percentile = (value) => {
      if (!latency.length) return 0;
      return latency[Math.min(latency.length - 1, Math.max(0, Math.ceil(latency.length * value) - 1))];
    };
    return {
      ...this.metrics,
      inFlight: this.inFlight.size,
      enabled: this.enabled,
      latencyP50Ms: percentile(0.5),
      latencyP95Ms: percentile(0.95)
    };
  }

  destroy() {
    for (const key of this.aggregators.keys()) this._clearAggregator(key);
    for (const source of this.sourceSubscriptions.keys()) this.detachSource(source);
    for (const eventName of this.eventSubscriptions.keys()) this.detachEventSource(eventName);
    this.pending.clear();
    this.sourceEpochs.clear();
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
