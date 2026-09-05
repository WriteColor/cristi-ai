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
    this.metrics = { frames: 0, completed: 0, dropped: 0, queued: 0, lastLatencyMs: 0 };
  }

  configure(provider = {}) {
    this.provider = {
      ...this.provider,
      ...provider
    };
  }

  /** Attach a source-aware capture service without coupling it to a provider. */
  attachSource(source, { targetLanguage = 'es', sessionId = null, relevanceGate = true } = {}) {
    if (!source || typeof source.setFrameHandler !== 'function') return false;
    this.detachSource(source);
    const handler = (frame) => {
      if (!frame) return;
      this.enqueueFrame({ ...frame, routed: true, targetLanguage, sessionId, relevanceGate });
    };
    source.setFrameHandler(handler);
    this.sourceSubscriptions.set(source, handler);
    return true;
  }

  detachSource(source) {
    if (!source || !this.sourceSubscriptions.has(source)) return false;
    source.setFrameHandler(null);
    this.sourceSubscriptions.delete(source);
    this.pending.delete(source.sourceId || 'system_loopback');
    return true;
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
}

export const translationService = new TranslationService();
export default translationService;
