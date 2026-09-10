/**
 * Cristi AI - TranslationOutputCoordinator (TypeScript)
 * Delivers completed external translations without coupling capture,
 * transcription, or a particular UI to the translation pipeline.
 */

import { eventBus, EVENTS } from '../../infrastructure/events/eventBus';
import { audioRoutingService, AudioRoutingService } from './AudioRoutingService';

export interface AudioOutputLike {
  isPlaying?: boolean;
  playAudioChunk?: (data: string, options?: any) => Promise<any>;
  getTelemetry?: () => any;
  getStatus?: () => any;
}

export interface CoordinatorOptions {
  bus?: typeof eventBus;
  router?: AudioRoutingService;
  getAudioOutput?: () => AudioOutputLike | null;
  getGameAudioOutput?: () => AudioOutputLike | null;
  dropWhenBusy?: boolean;
}

export interface DeliveryPayload {
  sourceId: string;
  speakerId: string | null;
  sourceLanguage: string | null;
  translation: string;
  frameId: string;
  hasAudio: boolean;
  outputRoute: string;
  stage: string;
}

export class TranslationOutputCoordinator {
  public bus: typeof eventBus;
  public router: AudioRoutingService;
  public getAudioOutput: () => AudioOutputLike | null;
  public getGameAudioOutput: () => AudioOutputLike | null;
  public dropWhenBusy: boolean;

  private unsubscribeCompleted: (() => void) | null = null;
  private unsubscribeTextReady: (() => void) | null = null;
  private textDeliveredIds = new Set<string>();
  private audioDeliveredIds = new Set<string>();
  private readonly maxDeliveredIds = 512;

  constructor({
    bus = eventBus,
    router = audioRoutingService,
    getAudioOutput = () => null,
    getGameAudioOutput = () => null,
    dropWhenBusy = true
  }: CoordinatorOptions = {}) {
    this.bus = bus;
    this.router = router;
    this.getAudioOutput = getAudioOutput;
    this.getGameAudioOutput = getGameAudioOutput;
    this.dropWhenBusy = dropWhenBusy;
  }

  public start(): void {
    if (this.unsubscribeCompleted || !this.bus?.on) return;
    this.unsubscribeTextReady = this.bus.on(EVENTS.TRANSLATION_TEXT_READY, (envelope: any) => {
      void this.handleTextReady(envelope);
    });
    this.unsubscribeCompleted = this.bus.on(EVENTS.TRANSLATION_COMPLETED, (envelope: any) => {
      void this.handleCompleted(envelope);
    });
  }

  public async handleTextReady(envelope: any): Promise<any> {
    const result = envelope?.payload || envelope || {};
    if (!this._isSupportedRoute(result.outputRoute) || !result.translation) return { delivered: false, reason: 'unsupported_route' };
    const correlationId = envelope?.correlationId || result.correlationId || `${result.sourceId || 'translation'}:${result.timestamp || ''}:${result.translation}`;
    if (this.textDeliveredIds.has(correlationId)) return { delivered: false, reason: 'duplicate_text' };
    this._markDelivered(this.textDeliveredIds, correlationId);
    const payload = this._payload(result, correlationId, null, 'text_ready');
    this._emitOutput(payload, envelope, correlationId);
    return { delivered: true, audioPlayed: false, ...payload };
  }

  public async handleCompleted(envelope: any): Promise<any> {
    const result = envelope?.payload || envelope || {};
    if (!this._isSupportedRoute(result.outputRoute) || !result.translation) return { delivered: false, reason: 'unsupported_route' };
    const correlationId = envelope?.correlationId || result.correlationId || `${result.sourceId || 'translation'}:${result.timestamp || ''}:${result.translation}`;
    const audio = result.audio || null;
    const payload = this._payload(result, correlationId, audio, 'completed');
    if (!this.textDeliveredIds.has(correlationId)) {
      this._markDelivered(this.textDeliveredIds, correlationId);
      this._emitOutput(payload, envelope, correlationId);
    }
    if (!audio?.data) return { delivered: true, audioPlayed: false, ...payload };
    if (this.audioDeliveredIds.has(correlationId)) return { delivered: false, reason: 'duplicate_audio' };
    this._markDelivered(this.audioDeliveredIds, correlationId);
    this.router?.markGenerated?.(payload.frameId, 'cristi_translation');

    const isGameVoice = result.outputRoute === 'game_voice';
    const audioOutput = isGameVoice ? this.getGameAudioOutput?.() : this.getAudioOutput?.();
    if (!audioOutput?.playAudioChunk) return { delivered: true, audioPlayed: false, ...payload };

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
      const msg = error instanceof Error ? error.message : String(error);
      this.bus?.emitDomain?.(`${isGameVoice ? 'translation.game_voice_output' : 'translation.local_output'}_failed`, {
        ...payload,
        error: msg
      }, {
        source: 'translation_output',
        sessionId: envelope?.sessionId || result.sessionId || null,
        correlationId,
        privacy: 'internal'
      });
      return { delivered: false, error: msg, ...payload };
    }
  }

  private _payload(result: any, correlationId: string, audio: any, stage: string): DeliveryPayload {
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

  private _emitOutput(payload: DeliveryPayload, envelope: any, correlationId: string): void {
    const eventName = payload.outputRoute === 'game_voice' ? 'translation.game_voice_output' : 'translation.local_output';
    this.bus?.emitDomain?.(eventName, payload, {
      source: 'translation_output',
      sessionId: envelope?.sessionId || null,
      correlationId,
      privacy: 'internal'
    });
  }

  private _isSupportedRoute(route: string): boolean {
    return route === 'local' || route === 'game_voice';
  }

  private _markDelivered(collection: Set<string>, correlationId: string): void {
    collection.add(correlationId);
    while (collection.size > this.maxDeliveredIds) {
      const first = collection.values().next().value;
      if (first) collection.delete(first);
    }
  }

  public destroy(): void {
    this.unsubscribeCompleted?.();
    this.unsubscribeTextReady?.();
    this.unsubscribeCompleted = null;
    this.unsubscribeTextReady = null;
    this.textDeliveredIds.clear();
    this.audioDeliveredIds.clear();
  }
}

export default TranslationOutputCoordinator;
