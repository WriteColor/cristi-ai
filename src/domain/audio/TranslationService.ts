import { eventBus, EVENTS } from '../../infrastructure/events/eventBus';
import { audioRoutingService } from './AudioRoutingService';

export interface TranslationProvider {
  transcribe?: (params: { data: string; sampleRate?: number; sourceId?: string; sessionId?: string | null }) => Promise<{ text?: string; speakerId?: string | null; success?: boolean; error?: string } | null | undefined>;
  detectLanguage?: (params: { text: string; sourceId?: string }) => Promise<{ language?: string | null; success?: boolean } | null | undefined>;
  translateAndDetect?: (params: { text: string; targetLanguage: string; sourceId?: string; sessionId?: string | null }) => Promise<{ text?: string; sourceLanguage?: string | null; success?: boolean } | null | undefined>;
  translate?: (params: { text: string; sourceLanguage?: string | null; targetLanguage: string; sourceId?: string; sessionId?: string | null }) => Promise<{ text?: string; success?: boolean; error?: string } | null | undefined>;
  synthesize?: (params: { text: string; language: string; sourceId?: string; sessionId?: string | null }) => Promise<{ data?: string; frameId?: string; sampleRate?: number } | null | undefined>;
  isVoiceActivity?: (data?: string, options?: unknown) => boolean;
  isRelevant?: (params: { text: string; sourceId?: string; speakerId?: string | null; sessionId?: string | null }) => Promise<boolean> | boolean;
  detectSpeaker?: (params: { transcript: string; data?: string; sourceId?: string; sessionId?: string | null }) => Promise<string | null>;
}

export interface TranslationMetrics {
  frames: number;
  completed: number;
  textReady: number;
  dropped: number;
  queued: number;
  stale: number;
  superseded: number;
  expired: number;
  failed: number;
  lastLatencyMs: number;
  inFlight?: number;
  enabled?: boolean;
  latencyP50Ms?: number;
  latencyP95Ms?: number;
}

export interface TranslationFrameInput {
  frameId?: string;
  sourceId?: string;
  data?: string;
  sampleRate?: number;
  targetLanguage?: string;
  sessionId?: string | null;
  routed?: boolean;
  relevanceGate?: boolean;
  streamEpoch?: number | null;
  outputRoute?: string;
  guildId?: string | null;
  channelId?: string | null;
  speakerId?: string | null;
  maxResultAgeMs?: number;
  sequence?: number;
  dropSuperseded?: boolean;
  aggregateMs?: number;
  maxUtteranceMs?: number;
  aggregationKey?: string;
  queuedAt?: number;
}

export interface TranslationResult {
  success: boolean;
  disabled?: boolean;
  stale?: boolean;
  dropped?: boolean;
  superseded?: boolean;
  expired?: boolean;
  reason?: string;
  error?: string;
  maxResultAgeMs?: number;
  sourceId?: string;
  transcript?: string;
  speakerId?: string | null;
  sourceLanguage?: string | null;
  translation?: string | null;
  audio?: { data?: string; frameId?: string; sampleRate?: number } | null;
  outputRoute?: string;
  guildId?: string | null;
  channelId?: string | null;
  correlationId?: string;
  timestamp?: number;
  latencyMs?: number;
  phaseLatencyMs?: Record<string, number>;
}

interface AggregatorState {
  frames: TranslationFrameInput[];
  bytes: number;
  timer: NodeJS.Timeout | null;
  startedAt: number;
  lastSpeechAt: number;
  options: TranslationFrameInput;
}

const unsupported = async () => ({ success: false, error: 'Proveedor de traducción no configurado.' });

/** Provider-agnostic streaming translation pipeline. */
export class TranslationService {
  private provider: Required<TranslationProvider>;
  private inFlight: Map<string, boolean> = new Map();
  private pending: Map<string, TranslationFrameInput> = new Map();
  private sourceSubscriptions: Map<{ setFrameHandler: (handler: ((frame: TranslationFrameInput) => void) | null) => void; sourceId?: string }, { handler: (frame: TranslationFrameInput) => void; sourceIds: Set<string> }> = new Map();
  private eventSubscriptions: Map<string, () => void> = new Map();
  private eventSourceIds: Map<string, Set<string>> = new Map();
  private sourceEpochs: Map<string, number> = new Map();
  private inputSequence = 0;
  private latencySamples: number[] = [];
  private maxLatencySamples = 120;
  private enabled = true;
  private aggregators: Map<string, AggregatorState> = new Map();
  private metrics: TranslationMetrics = {
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

  constructor({ provider = {} }: { provider?: TranslationProvider } = {}) {
    this.provider = {
      transcribe: provider.transcribe || unsupported,
      detectLanguage: provider.detectLanguage || (async () => ({ success: false })),
      translateAndDetect: provider.translateAndDetect || (async () => null),
      translate: provider.translate || unsupported,
      synthesize: provider.synthesize || (async () => null),
      isVoiceActivity: provider.isVoiceActivity || (() => true),
      isRelevant: provider.isRelevant || (() => true),
      detectSpeaker: provider.detectSpeaker || (async () => null)
    };
  }

  configure(provider: TranslationProvider = {}): void {
    const methods: (keyof TranslationProvider)[] = [
      'transcribe', 'detectLanguage', 'translateAndDetect', 'translate',
      'synthesize', 'isVoiceActivity', 'isRelevant', 'detectSpeaker'
    ];
    const bound: Partial<TranslationProvider> = {};
    for (const method of methods) {
      const fn = provider[method];
      if (typeof fn === 'function') {
        (bound as Record<string, unknown>)[method] = (fn as (...args: unknown[]) => unknown).bind(provider);
      }
    }
    this.provider = {
      ...this.provider,
      ...bound
    };
  }

  setEnabled(enabled?: boolean): boolean {
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

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Attach a source-aware capture service without coupling it to a provider. */
  attachSource(
    source: { setFrameHandler: (handler: ((frame: TranslationFrameInput) => void) | null) => void; sourceId?: string },
    {
      targetLanguage = 'es',
      sessionId = null,
      relevanceGate = true,
      aggregateMs = 0,
      maxUtteranceMs = 1800,
      maxResultAgeMs = 8000,
      outputRoute = 'local'
    }: {
      targetLanguage?: string;
      sessionId?: string | null;
      relevanceGate?: boolean;
      aggregateMs?: number;
      maxUtteranceMs?: number;
      maxResultAgeMs?: number;
      outputRoute?: string;
    } = {}
  ): boolean {
    if (!this.enabled) return false;
    if (!source || typeof source.setFrameHandler !== 'function') return false;
    this.detachSource(source);
    const sourceIds = new Set<string>();
    const handler = (frame: TranslationFrameInput) => {
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

  detachSource(source: { setFrameHandler: (handler: ((frame: TranslationFrameInput) => void) | null) => void; sourceId?: string }): boolean {
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
  attachEventSource(
    eventName: string,
    {
      targetLanguage = 'es',
      sessionId = null,
      relevanceGate = true,
      aggregateMs = 0,
      maxUtteranceMs = 1800,
      maxResultAgeMs = 8000,
      outputRoute = 'local'
    }: {
      targetLanguage?: string;
      sessionId?: string | null;
      relevanceGate?: boolean;
      aggregateMs?: number;
      maxUtteranceMs?: number;
      maxResultAgeMs?: number;
      outputRoute?: string;
    } = {}
  ): boolean {
    if (!this.enabled) return false;
    if (!eventName || typeof eventBus.on !== 'function') return false;
    this.detachEventSource(eventName);
    const prefix = `event:${eventName}:`;
    const sourceIds = new Set<string>();
    const unsubscribe = eventBus.on(eventName, (envelope: unknown) => {
      const payload = (envelope && typeof envelope === 'object' && 'payload' in envelope)
        ? (envelope as { payload: TranslationFrameInput }).payload
        : (envelope as TranslationFrameInput);
      if (!payload?.data) return;
      const sourceId = payload.sourceId || 'external_audio';
      sourceIds.add(sourceId);
      const streamEpoch = this._activateSource(sourceId);
      const envelopeSessionId = envelope && typeof envelope === 'object' && 'sessionId' in envelope ? (envelope as { sessionId?: string }).sessionId : null;
      this._acceptAttachedFrame(payload, {
        targetLanguage, sessionId: sessionId || envelopeSessionId, relevanceGate,
        aggregateMs, maxUtteranceMs, maxResultAgeMs, dropSuperseded: aggregateMs > 0, outputRoute,
        aggregationKey: `${prefix}${sourceId}`, streamEpoch
      });
    });
    this.eventSubscriptions.set(eventName, unsubscribe);
    this.eventSourceIds.set(eventName, sourceIds);
    return true;
  }

  detachEventSource(eventName: string): boolean {
    const unsubscribe = this.eventSubscriptions.get(eventName);
    if (!unsubscribe) return false;
    unsubscribe();
    this.eventSubscriptions.delete(eventName);
    this._clearAggregatorsMatching(`event:${eventName}:`);
    for (const sourceId of this.eventSourceIds.get(eventName) || []) this._invalidateSource(sourceId);
    this.eventSourceIds.delete(eventName);
    return true;
  }

  private _acceptAttachedFrame(frame: TranslationFrameInput, options: TranslationFrameInput): void {
    if (!frame?.data) return;
    const aggregateMs = Math.max(0, Number(options.aggregateMs) || 0);
    const aggregationKey = options.aggregationKey || frame.sourceId || 'external_audio';
    if (!this._isVoiceActive(frame, options)) {
      if (this.aggregators.has(aggregationKey)) this._flushAggregator(aggregationKey);
      else this.metrics.dropped += 1;
      return;
    }
    if (!aggregateMs) {
      this.enqueueFrame({ ...frame, routed: true, ...options });
      return;
    }
    const now = Date.now();
    const current: AggregatorState = this.aggregators.get(aggregationKey) || {
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

  private _isVoiceActive(frame: TranslationFrameInput, options: unknown = {}): boolean {
    try {
      return this.provider.isVoiceActivity(frame?.data, { frame, ...(options && typeof options === 'object' ? options : {}) }) !== false;
    } catch {
      return true;
    }
  }

  private _flushAggregator(sourceId: string): void {
    const aggregate = this.aggregators.get(sourceId);
    if (!aggregate) return;
    if (aggregate.timer) clearTimeout(aggregate.timer);
    this.aggregators.delete(sourceId);
    const frames = aggregate.frames.filter((frame) => frame?.data);
    if (!frames.length) return;
    const merged = mergeBase64Pcm(frames.map((frame) => frame.data || ''));
    const last = frames[frames.length - 1];
    this.enqueueFrame({
      ...last,
      frameId: `${frames[0].frameId || 'audio'}_${last.frameId || Date.now()}`,
      data: merged,
      routed: true,
      ...aggregate.options
    });
  }

  private _clearAggregator(sourceId: string): void {
    const aggregate = this.aggregators.get(sourceId);
    if (aggregate?.timer) clearTimeout(aggregate.timer);
    this.aggregators.delete(sourceId);
  }

  private _clearAggregatorsMatching(prefix: string): void {
    for (const key of this.aggregators.keys()) {
      if (key.startsWith(prefix)) this._clearAggregator(key);
    }
  }

  private _activateSource(sourceId: string): number {
    if (!this.sourceEpochs.has(sourceId)) this.sourceEpochs.set(sourceId, 1);
    return this.sourceEpochs.get(sourceId)!;
  }

  private _invalidateSource(sourceId: string): number {
    const next = (this.sourceEpochs.get(sourceId) || 0) + 1;
    this.sourceEpochs.set(sourceId, next);
    this.pending.delete(sourceId);
    return next;
  }

  private _isCurrent(input: TranslationFrameInput): boolean {
    return this.sourceEpochs.get(input.sourceId || 'external_audio') === input.streamEpoch;
  }

  enqueueFrame(input: TranslationFrameInput = {}): void {
    if (!this.enabled) return;
    const sourceId = input.sourceId || 'external_audio';
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

  async drainSource(sourceId: string): Promise<void> {
    if (this.inFlight.has(sourceId)) return;
    this.inFlight.set(sourceId, true);
    try {
      while (this.pending.has(sourceId)) {
        const input = this.pending.get(sourceId)!;
        this.pending.delete(sourceId);
        this.metrics.queued = this.pending.size;
        try {
          await this.processFrame(input);
        } catch (err) {
          const error = err as Error;
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
  }: TranslationFrameInput = {}): Promise<TranslationResult> {
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
      : audioRoutingService.acceptFrame({ frameId: frameId || 'audio', sourceId, data: data || '', sampleRate });
    if (!frame || !this._isVoiceActive({ frameId, sourceId, data, sampleRate })) {
      this.metrics.dropped += 1;
      return { success: false, dropped: true };
    }
    const startedAt = Date.now();
    const resultAgeLimitMs = Math.max(1000, Number(maxResultAgeMs) || 8000);
    const isExpired = () => Date.now() - startedAt > resultAgeLimitMs;
    const discardLate = (): TranslationResult | null => {
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
    const phaseLatencyMs: Record<string, number> = {};
    const runPhase = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
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
      const transcript = await runPhase('transcription', () => this.provider.transcribe({ data: data || '', sampleRate, sourceId, sessionId }));
      const discardedAfterTranscription = discardLate();
      if (discardedAfterTranscription) return discardedAfterTranscription;
      if (!transcript?.text) return { success: false, error: 'No se obtuvo transcripción.' };
      const speakerId = suppliedSpeakerId || transcript.speakerId || await runPhase('speaker', () => this.provider.detectSpeaker({ transcript: transcript.text!, data, sourceId, sessionId }));
      const discardedAfterSpeaker = discardLate();
      if (discardedAfterSpeaker) return discardedAfterSpeaker;
      if (relevanceGate && !(await runPhase('relevance', async () => Boolean(await this.provider.isRelevant({ text: transcript.text!, sourceId, speakerId, sessionId }))))) {
        this.metrics.dropped += 1;
        return { success: false, dropped: true, reason: 'not_relevant', transcript: transcript.text, speakerId };
      }
      const discardedAfterRelevance = discardLate();
      if (discardedAfterRelevance) return discardedAfterRelevance;
      let detected: { language?: string | null } | null | undefined;
      let translated: { text?: string; sourceLanguage?: string | null } | null | undefined;
      if (typeof this.provider.translateAndDetect === 'function') {
        const combined = await runPhase('translation', () => this.provider.translateAndDetect({
          text: transcript.text!, targetLanguage, sourceId, sessionId
        }));
        detected = { language: combined?.sourceLanguage || null };
        translated = combined;
      } else {
        detected = await runPhase('language', () => this.provider.detectLanguage({ text: transcript.text!, sourceId }));
        const discardedAfterLanguage = discardLate();
        if (discardedAfterLanguage) return discardedAfterLanguage;
        translated = await runPhase('translation', () => this.provider.translate({
          text: transcript.text!,
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
      let audio: { data?: string; frameId?: string; sampleRate?: number } | null = null;
      if (translated?.text) {
        audio = await runPhase('synthesis', () => this.provider.synthesize({ text: translated!.text!, language: targetLanguage, sourceId, sessionId })) || null;
        const discardedAfterSynthesis = discardLate();
        if (discardedAfterSynthesis) return discardedAfterSynthesis;
        if (audio?.data) {
          const synthFrameId = audio.frameId || `translation_${correlationId}`;
          audio = { ...audio, frameId: synthFrameId };
          audioRoutingService.markGenerated(synthFrameId, 'cristi_translation');
        }
      }
      const result: TranslationResult = {
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
      this.metrics.lastLatencyMs = result.latencyMs!;
      this.latencySamples.push(result.latencyMs!);
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
   * Translates an explicit user utterance for a selected output route.
   */
  async translateText({
    text,
    targetLanguage = 'es',
    sourceId = 'user_translation',
    sessionId = null,
    outputRoute = 'game_voice'
  }: {
    text: string;
    targetLanguage?: string;
    sourceId?: string;
    sessionId?: string | null;
    outputRoute?: string;
  }): Promise<TranslationResult> {
    if (!this.enabled) return { success: false, disabled: true };
    const transcript = String(text || '').trim();
    if (!transcript) return { success: false, error: 'No hay texto para traducir.' };
    const startedAt = Date.now();
    const correlationId = `translation_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
    const phaseLatencyMs: Record<string, number> = {};
    const runPhase = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      const phaseStartedAt = Date.now();
      try { return await fn(); }
      finally { phaseLatencyMs[name] = Date.now() - phaseStartedAt; }
    };
    this.metrics.frames += 1;
    eventBus.emitDomain(EVENTS.TRANSLATION_REQUESTED, { sourceId, targetLanguage, explicitText: true }, {
      source: 'translation', sessionId, correlationId, privacy: 'external'
    });
    try {
      let detected: { language?: string | null } | null | undefined;
      let translated: { text?: string; sourceLanguage?: string | null } | null | undefined;
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
      let audio: { data?: string; frameId?: string; sampleRate?: number } | null = null;
      const synthAudio = await runPhase('synthesis', () => this.provider.synthesize({ text: translated!.text!, language: targetLanguage, sourceId, sessionId }));
      if (synthAudio?.data) {
        const synthFrameId = synthAudio.frameId || `translation_${correlationId}`;
        audio = { ...synthAudio, frameId: synthFrameId };
        audioRoutingService.markGenerated(synthFrameId, 'cristi_translation');
      }
      const result: TranslationResult = {
        success: true,
        ...base,
        audio,
        latencyMs: Date.now() - startedAt,
        phaseLatencyMs
      };
      this.metrics.completed += 1;
      this.metrics.lastLatencyMs = result.latencyMs!;
      this.latencySamples.push(result.latencyMs!);
      if (this.latencySamples.length > this.maxLatencySamples) this.latencySamples.shift();
      eventBus.emitDomain(EVENTS.TRANSLATION_COMPLETED, result, {
        source: 'translation', sessionId, correlationId, privacy: 'external'
      });
      return result;
    } catch (err) {
      const error = err as Error;
      this.metrics.failed += 1;
      eventBus.emitDomain('translation.failed', { sourceId, message: error?.message || String(error) }, {
        source: 'translation', sessionId, correlationId, privacy: 'internal'
      });
      return { success: false, error: error?.message || String(error) };
    }
  }

  getMetrics(): TranslationMetrics {
    const latency = [...this.latencySamples].sort((left, right) => left - right);
    const percentile = (value: number) => {
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

  destroy(): void {
    for (const key of this.aggregators.keys()) this._clearAggregator(key);
    for (const source of this.sourceSubscriptions.keys()) this.detachSource(source);
    for (const eventName of this.eventSubscriptions.keys()) this.detachEventSource(eventName);
    this.pending.clear();
    this.sourceEpochs.clear();
  }
}

function mergeBase64Pcm(chunks: string[]): string {
  if (chunks.length === 1) return String(chunks[0]);
  try {
    const decode = (value: string): Uint8Array => {
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
  } catch {
    // fallback
  }
  return String(chunks.join(''));
}

export const translationService = new TranslationService();
export default translationService;
