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
      isVoiceActivity: provider.isVoiceActivity || (() => true)
    };
    this.inFlight = new Map();
    this.metrics = { frames: 0, completed: 0, dropped: 0, lastLatencyMs: 0 };
  }

  configure(provider = {}) {
    this.provider = {
      ...this.provider,
      ...provider
    };
  }

  async processFrame({ frameId, sourceId = 'game_loopback', data, sampleRate = 16000, targetLanguage = 'es', sessionId = null } = {}) {
    const frame = audioRoutingService.acceptFrame({ frameId, sourceId, data, sampleRate });
    if (!frame || !this.provider.isVoiceActivity(data)) {
      this.metrics.dropped += 1;
      return { success: false, dropped: true };
    }
    if (this.inFlight.has(sourceId)) return { success: false, dropped: true, reason: 'source_busy' };
    this.inFlight.set(sourceId, true);
    const startedAt = Date.now();
    const correlationId = `translation_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
    this.metrics.frames += 1;
    eventBus.emitDomain(EVENTS.TRANSLATION_REQUESTED, { sourceId, targetLanguage }, {
      source: 'translation', sessionId, correlationId, privacy: 'external'
    });
    try {
      const transcript = await this.provider.transcribe({ data, sampleRate, sourceId, sessionId });
      if (!transcript?.text) return { success: false, error: 'No se obtuvo transcripción.' };
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
      this.inFlight.delete(sourceId);
    }
  }

  getMetrics() {
    return { ...this.metrics, inFlight: this.inFlight.size };
  }
}

export const translationService = new TranslationService();
export default translationService;
