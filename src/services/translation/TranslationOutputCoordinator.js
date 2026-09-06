import { eventBus, EVENTS } from '../eventBus.js';
import { audioRoutingService } from './AudioRoutingService.js';

/**
 * Delivers completed external translations without coupling capture,
 * transcription, or a particular UI to the translation pipeline.
 *
 * Local audio intentionally shares Cristi's ordered PCM output service. That
 * preserves a single playback clock and emits AUDIO_START/AUDIO_END, allowing
 * loopback capture to shield generated translation from re-entering STT.
 */
export class TranslationOutputCoordinator {
  constructor({
    bus = eventBus,
    router = audioRoutingService,
    getAudioOutput = () => null,
    getGameAudioOutput = () => null,
    dropWhenBusy = true
  } = {}) {
    this.bus = bus;
    this.router = router;
    this.getAudioOutput = getAudioOutput;
    this.getGameAudioOutput = getGameAudioOutput;
    this.dropWhenBusy = dropWhenBusy;
    this.unsubscribeCompleted = null;
    this.unsubscribeTextReady = null;
    this.textDeliveredIds = new Set();
    this.audioDeliveredIds = new Set();
    this.maxDeliveredIds = 512;
  }

  start() {
    if (this.unsubscribeCompleted || !this.bus?.on) return;
    this.unsubscribeTextReady = this.bus.on(EVENTS.TRANSLATION_TEXT_READY, (envelope) => {
      void this.handleTextReady(envelope);
    });
    this.unsubscribeCompleted = this.bus.on(EVENTS.TRANSLATION_COMPLETED, (envelope) => {
      void this.handleCompleted(envelope);
    });
  }

  async handleTextReady(envelope) {
    const result = envelope?.payload || envelope || {};
    if (!this._isSupportedRoute(result.outputRoute) || !result.translation) return { delivered: false, reason: 'unsupported_route' };
    const correlationId = envelope?.correlationId || result.correlationId || `${result.sourceId || 'translation'}:${result.timestamp || ''}:${result.translation}`;
    if (this.textDeliveredIds.has(correlationId)) return { delivered: false, reason: 'duplicate_text' };
    this._markDelivered(this.textDeliveredIds, correlationId);
    const payload = this._payload(result, correlationId, null, 'text_ready');
    this._emitOutput(payload, envelope, correlationId, result);
    return { delivered: true, audioPlayed: false, ...payload };
  }

  async handleCompleted(envelope) {
    const result = envelope?.payload || envelope || {};
    if (!this._isSupportedRoute(result.outputRoute) || !result.translation) return { delivered: false, reason: 'unsupported_route' };
    const correlationId = envelope?.correlationId || result.correlationId || `${result.sourceId || 'translation'}:${result.timestamp || ''}:${result.translation}`;
    const audio = result.audio || null;
    const payload = this._payload(result, correlationId, audio, 'completed');
    if (!this.textDeliveredIds.has(correlationId)) {
      this._markDelivered(this.textDeliveredIds, correlationId);
      this._emitOutput(payload, envelope, correlationId, result);
    }
    if (!audio?.data) return { delivered: true, audioPlayed: false, ...payload };
    if (this.audioDeliveredIds.has(correlationId)) return { delivered: false, reason: 'duplicate_audio' };
    this._markDelivered(this.audioDeliveredIds, correlationId);
    this.router?.markGenerated?.(payload.frameId, 'cristi_translation');

    const isGameVoice = result.outputRoute === 'game_voice';
    const audioOutput = isGameVoice ? this.getGameAudioOutput?.() : this.getAudioOutput?.();
    if (!audioOutput?.playAudioChunk) return { delivered: true, audioPlayed: false, ...payload };

    // Live voice has priority. Keeping a second translation queue would make
    // old speech arrive late and sound like a duplicate response. The text is
    // still displayed, while audio degrades explicitly under contention.
    const telemetry = audioOutput.getTelemetry?.() || audioOutput.getStatus?.() || {};
    if (!isGameVoice && this.dropWhenBusy && (audioOutput.isPlaying || telemetry.queueLength > 0 || telemetry.activeSourcesCount > 0)) {
      return { delivered: true, audioPlayed: false, droppedAudio: 'live_audio_active', ...payload };
    }

    const sampleRate = Number(audio.sampleRate) || 24000;
    if (!isGameVoice && sampleRate !== 24000) {
      return { delivered: true, audioPlayed: false, droppedAudio: `unsupported_sample_rate_${sampleRate}`, ...payload };
    }

    try {
      const playback = await audioOutput.playAudioChunk(audio.data, { sampleRate, frameId: payload.frameId, sessionId: envelope?.sessionId || result.sessionId || null });
      if (playback?.success === false) return { delivered: true, audioPlayed: false, outputError: playback.reason || playback.error, ...payload };
      return { delivered: true, audioPlayed: true, ...payload };
    } catch (error) {
      this.bus?.emitDomain?.(`${isGameVoice ? 'translation.game_voice_output' : 'translation.local_output'}_failed`, {
        ...payload,
        error: error?.message || String(error)
      }, {
        source: 'translation_output',
        sessionId: envelope?.sessionId || result.sessionId || null,
        correlationId,
        privacy: 'internal'
      });
      return { delivered: false, error: error?.message || String(error), ...payload };
    }
  }

  _payload(result, correlationId, audio, stage) {
    const frameId = audio?.frameId || `translation_output_${correlationId}`;
    return {
      sourceId: result.sourceId || 'external_audio',
      speakerId: result.speakerId || null,
      sourceLanguage: result.sourceLanguage || null,
      translation: result.translation,
      frameId,
      hasAudio: Boolean(audio?.data),
      outputRoute: result.outputRoute,
      stage
    };
  }

  _emitOutput(payload, envelope, correlationId, result = {}) {
    const eventName = payload.outputRoute === 'game_voice' ? 'translation.game_voice_output' : 'translation.local_output';
    this.bus?.emitDomain?.(eventName, payload, {
      source: 'translation_output',
      sessionId: envelope?.sessionId || result.sessionId || null,
      correlationId,
      privacy: 'internal'
    });
  }

  _isSupportedRoute(route) {
    return route === 'local' || route === 'game_voice';
  }

  _markDelivered(collection, correlationId) {
    collection.add(correlationId);
    while (collection.size > this.maxDeliveredIds) {
      collection.delete(collection.values().next().value);
    }
  }

  destroy() {
    this.unsubscribeCompleted?.();
    this.unsubscribeTextReady?.();
    this.unsubscribeCompleted = null;
    this.unsubscribeTextReady = null;
    this.textDeliveredIds.clear();
    this.audioDeliveredIds.clear();
  }
}

export default TranslationOutputCoordinator;
