/**
 * Cristi AI - Translation Service & Audio Orchestrator
 * 
 * Responsibilities:
 * - Real-time audio translation orchestrator.
 * - Captures desktop/game loopback audio (WASAPI/getDisplayMedia).
 * - Utterance aggregation with energy-based Voice Activity Detection (VAD) gating.
 * - Seamless translation & TTS synthesis via Gemini or pluggable provider.
 * - Retransmits synthesized translation strictly to the virtual audio channel (`game_voice`),
 *   bypassing user's local speakers to avoid loopback and team confusion.
 * - Acoustic Feedback Shield: marks all generated audio using AudioRoutingService.markGenerated.
 * - Memory leak prevention: bounded queues, automatic timers cleanup, and resource disposal.
 */

import { eventBus, EVENTS } from '@/services/eventBus.js';
import { audioRoutingService } from './AudioRoutingService';
import { virtualAudioOutputService } from './VirtualAudioOutputService';
import type { DesktopLoopbackService } from './DesktopLoopbackService';
import type {
  AudioFrameEnvelope,
  TranslationMetrics,
  TranslationOptions,
  TranslationPipelineStatus
} from '@/types';

export interface ITranslationProvider {
  transcribe?(audioPcm: Int16Array | string, options?: { sampleRate?: number }): Promise<{
    success: boolean;
    text?: string;
    language?: string;
    error?: string;
  }>;
  translate?(text: string, options: { from?: string; to: string }): Promise<{
    success: boolean;
    translation?: string;
    sourceLanguage?: string;
    error?: string;
  }>;
  synthesize?(text: string, options?: { voice?: string; language?: string }): Promise<{
    success: boolean;
    audioData?: string; // base64 PCM16
    sampleRate?: number;
    error?: string;
  }>;
}

export interface TranslationServiceConfig {
  provider?: ITranslationProvider;
  targetLanguage?: string;
  sourceLanguage?: string;
  outputRoute?: 'game_voice' | 'local';
  aggregateMs?: number;
  maxUtteranceMs?: number;
  energyThreshold?: number;
  apiKey?: string;
}

export class TranslationService {
  private enabled = true;
  private provider: ITranslationProvider;
  private targetLanguage = 'en';
  private sourceLanguage = 'auto';
  private defaultOutputRoute: 'game_voice' | 'local' = 'game_voice';

  // Utterance aggregation & VAD
  private aggregateMs = 1200; // Utterance chunking window
  private maxUtteranceMs = 3000;
  private energyThreshold = 0.006;
  private pcmAccumulator: Int16Array[] = [];
  private accumulatedSamples = 0;
  private aggregationTimer: any = null;
  private lastSpeechTimestamp = 0;

  // Attached loopback
  private attachedLoopback: DesktopLoopbackService | null = null;
  private loopbackUnsubscribe: (() => void) | null = null;
  private attachedSourceId: string | null = null;

  // Telemetry & Metrics
  private metrics: TranslationMetrics = {
    framesProcessed: 0,
    translationsCompleted: 0,
    transcriptionsCompleted: 0,
    droppedFrames: 0,
    lastLatencyMs: 0,
    lastError: null
  };

  private apiKey = '';

  constructor(config?: TranslationServiceConfig) {
    this.provider = config?.provider || this.createDefaultGeminiProvider();
    if (config?.targetLanguage) this.targetLanguage = config.targetLanguage;
    if (config?.sourceLanguage) this.sourceLanguage = config.sourceLanguage;
    if (config?.outputRoute) this.defaultOutputRoute = config.outputRoute;
    if (typeof config?.aggregateMs === 'number') this.aggregateMs = config.aggregateMs;
    if (typeof config?.maxUtteranceMs === 'number') this.maxUtteranceMs = config.maxUtteranceMs;
    if (typeof config?.energyThreshold === 'number') this.energyThreshold = config.energyThreshold;
    if (config?.apiKey) this.apiKey = config.apiKey;
  }

  public setApiKey(key: string): void {
    this.apiKey = (key || '').trim();
  }

  public setEnabled(enabled: boolean): boolean {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.clearAggregation();
    }
    eventBus.emitDomain('translation.state_changed', { enabled: this.enabled }, {
      source: 'translation_service',
      privacy: 'internal'
    });
    return this.enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setTargetLanguage(lang: string): void {
    if (lang && typeof lang === 'string') {
      this.targetLanguage = lang.trim();
    }
  }

  public setOutputRoute(route: 'game_voice' | 'local'): void {
    if (route === 'game_voice' || route === 'local') {
      this.defaultOutputRoute = route;
    }
  }

  public configureProvider(provider: ITranslationProvider): void {
    this.provider = provider;
  }

  /**
   * Attaches a DesktopLoopbackService instance to continuously ingest
   * and translate game audio.
   */
  public attachLoopback(loopbackService: DesktopLoopbackService, options: TranslationOptions = {}): boolean {
    if (!loopbackService) return false;
    this.detachLoopback();

    this.attachedLoopback = loopbackService;
    this.attachedSourceId = options.sessionId || 'system_loopback';
    if (options.targetLanguage) this.targetLanguage = options.targetLanguage;
    if (options.outputRoute) this.defaultOutputRoute = options.outputRoute;

    this.loopbackUnsubscribe = loopbackService.onFrame((frame) => {
      this.ingestFrame(frame, options);
    });

    return true;
  }

  /**
   * Attaches an audio source (e.g. DesktopLoopbackService) to translation pipeline.
   */
  public attachSource(
    source: any,
    options: TranslationOptions & { aggregateMs?: number; relevanceGate?: boolean } = {}
  ): boolean {
    if (!source) return false;
    if (typeof source.onFrame === 'function') {
      return this.attachLoopback(source as DesktopLoopbackService, options);
    }
    if (typeof source.setFrameHandler === 'function') {
      source.setFrameHandler((frame: any) => this.ingestFrame(frame, options));
      return true;
    }
    return false;
  }

  /**
   * Detaches an audio source.
   */
  public detachSource(source?: any): void {
    this.detachLoopback();
    if (typeof source?.setFrameHandler === 'function') {
      source.setFrameHandler(null);
    }
  }

  /**
   * Detaches loopback capture.
   */
  public detachLoopback(): void {
    if (this.loopbackUnsubscribe) {
      this.loopbackUnsubscribe();
      this.loopbackUnsubscribe = null;
    }
    this.attachedLoopback = null;
    this.attachedSourceId = null;
    this.clearAggregation();
  }

  /**
   * Ingests a single audio frame from loopback or any other audio source.
   */
  public ingestFrame(frame: AudioFrameEnvelope, options: TranslationOptions = {}): void {
    if (!this.enabled || !frame?.data) return;
    this.metrics.framesProcessed++;

    const pcm = this.decodeBase64Pcm(frame.data);
    if (!pcm.length) return;

    const energy = this.calculatePcmEnergy(pcm);

    // Voice Activity Detection Gate: ignore silence or low background hum
    if (energy < this.energyThreshold) {
      // If we already accumulated speech and now encountered silence, trigger aggregation immediately
      if (this.pcmAccumulator.length > 0 && Date.now() - this.lastSpeechTimestamp > 350) {
        this.flushUtterance(options);
      }
      return;
    }

    this.lastSpeechTimestamp = Date.now();
    this.pcmAccumulator.push(pcm);
    this.accumulatedSamples += pcm.length;

    // Utterance length threshold reached
    const accumulatedMs = (this.accumulatedSamples / (frame.sampleRate || 16000)) * 1000;
    if (accumulatedMs >= this.maxUtteranceMs) {
      this.flushUtterance(options);
      return;
    }

    // Schedule aggregation timeout
    if (!this.aggregationTimer) {
      this.aggregationTimer = setTimeout(() => {
        this.flushUtterance(options);
      }, this.aggregateMs);
    }
  }

  /**
   * Flushes and processes accumulated utterance.
   */
  private async flushUtterance(options: TranslationOptions = {}): Promise<void> {
    if (this.aggregationTimer) {
      clearTimeout(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    if (this.pcmAccumulator.length === 0) return;

    const totalSamples = this.accumulatedSamples;
    const combinedPcm = new Int16Array(totalSamples);
    let offset = 0;
    for (const chunk of this.pcmAccumulator) {
      combinedPcm.set(chunk, offset);
      offset += chunk.length;
    }

    this.pcmAccumulator = [];
    this.accumulatedSamples = 0;

    // Process utterance
    await this.processUtterancePcm(combinedPcm, options);
  }

  private async processUtterancePcm(pcm: Int16Array, options: TranslationOptions = {}): Promise<void> {
    const startTime = Date.now();
    const targetLang = options.targetLanguage || this.targetLanguage;
    const outputRoute = options.outputRoute || this.defaultOutputRoute;
    const sessionId = options.sessionId || 'session_translation';
    const correlationId = options.correlationId || `trans_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    try {
      // 1. Transcribe speech
      if (!this.provider.transcribe) {
        throw new Error('Proveedor de transcripción no disponible.');
      }

      const transcribeRes = await this.provider.transcribe(pcm, { sampleRate: 16000 });
      if (!transcribeRes.success || !transcribeRes.text || !transcribeRes.text.trim()) {
        this.metrics.droppedFrames++;
        return;
      }

      const transcript = transcribeRes.text.trim();
      const detectedLang = transcribeRes.language || this.sourceLanguage;
      this.metrics.transcriptionsCompleted++;

      eventBus.emitDomain('translation.text_ready', {
        text: transcript,
        detectedLanguage: detectedLang
      }, {
        source: 'translation_service',
        sessionId,
        correlationId,
        privacy: 'sensitive'
      });

      // If already in target language, skip translation or speak directly
      let translatedText = transcript;
      if (this.provider.translate && detectedLang !== targetLang) {
        const transRes = await this.provider.translate(transcript, {
          from: detectedLang,
          to: targetLang
        });
        if (transRes.success && transRes.translation) {
          translatedText = transRes.translation.trim();
        }
      }

      // 2. Synthesize translation to speech
      let synthesizedBase64: string | null = null;
      let sampleRate = 24000;

      if (this.provider.synthesize) {
        const synthRes = await this.provider.synthesize(translatedText, {
          language: targetLang,
          voice: options.voiceName || 'Kore'
        });
        if (synthRes.success && synthRes.audioData) {
          synthesizedBase64 = synthRes.audioData;
          sampleRate = synthRes.sampleRate || 24000;
        }
      }

      // 3. Mark generated audio to shield against acoustic feedback loop
      let frameId = '';
      if (synthesizedBase64) {
        frameId = audioRoutingService.markGenerated(synthesizedBase64, {
          sourceId: 'cristi_translation',
          sessionId,
          correlationId,
          sampleRate
        });
      }

      // 4. Retransmit to selected route: strictly to game_voice or local
      if (synthesizedBase64) {
        if (outputRoute === 'game_voice') {
          // Play through Virtual Audio Output to in-game mic (isolated from local speakers)
          await virtualAudioOutputService.playAudioChunk(synthesizedBase64, {
            sampleRate,
            frameId,
            sessionId,
            correlationId
          });

          eventBus.emitDomain('translation.game_voice_output', {
            originalText: transcript,
            translatedText,
            targetLanguage: targetLang,
            frameId
          }, {
            source: 'translation_service',
            sessionId,
            correlationId,
            privacy: 'sensitive'
          });
        } else {
          // Play locally
          eventBus.emitDomain('translation.local_output', {
            originalText: transcript,
            translatedText,
            targetLanguage: targetLang,
            audioData: synthesizedBase64,
            frameId
          }, {
            source: 'translation_service',
            sessionId,
            correlationId,
            privacy: 'sensitive'
          });
        }
      }

      this.metrics.translationsCompleted++;
      this.metrics.lastLatencyMs = Date.now() - startTime;
      this.metrics.lastError = null;

      eventBus.emitDomain(EVENTS.TRANSLATION_COMPLETED || 'translation.completed', {
        originalText: transcript,
        translatedText,
        sourceLanguage: detectedLang,
        targetLanguage: targetLang,
        outputRoute,
        latencyMs: this.metrics.lastLatencyMs
      }, {
        source: 'translation_service',
        sessionId,
        correlationId,
        privacy: 'sensitive'
      });
    } catch (err: any) {
      this.metrics.lastError = err?.message || String(err);
      eventBus.emitDomain('translation.failed', {
        error: this.metrics.lastError
      }, {
        source: 'translation_service',
        sessionId,
        correlationId,
        privacy: 'internal'
      });
    }
  }

  /**
   * Direct text translation and synthesis for tool execution (`translate_and_speak_in_game`).
   */
  public async translateText(options: {
    text: string;
    targetLanguage?: string;
    sourceLanguage?: string;
    outputRoute?: 'game_voice' | 'local';
    sourceId?: string;
    sessionId?: string;
    correlationId?: string;
    voiceName?: string;
  }): Promise<{
    success: boolean;
    translation?: string;
    sourceLanguage?: string;
    outputRoute?: string;
    audio?: { data?: string; sampleRate?: number };
    error?: string;
    disabled?: boolean;
  }> {
    if (!this.enabled) {
      return { success: false, disabled: true, error: 'Servicio de traducción deshabilitado.' };
    }

    const text = (options.text || '').trim();
    if (!text) {
      return { success: false, error: 'Texto a traducir vacío.' };
    }

    const targetLang = options.targetLanguage || this.targetLanguage;
    const outputRoute = options.outputRoute || this.defaultOutputRoute;
    const sessionId = options.sessionId || 'session_manual_translation';
    const correlationId = options.correlationId || `trans_txt_${Date.now()}`;

    try {
      // Translate
      let translated = text;
      let detectedSource = options.sourceLanguage || 'es';

      if (this.provider.translate) {
        const transRes = await this.provider.translate(text, {
          from: options.sourceLanguage,
          to: targetLang
        });
        if (transRes.success && transRes.translation) {
          translated = transRes.translation;
          detectedSource = transRes.sourceLanguage || detectedSource;
        }
      }

      // Synthesize
      let synthesizedBase64 = '';
      let sampleRate = 24000;
      if (this.provider.synthesize) {
        const synthRes = await this.provider.synthesize(translated, {
          language: targetLang,
          voice: options.voiceName || 'Kore'
        });
        if (synthRes.success && synthRes.audioData) {
          synthesizedBase64 = synthRes.audioData;
          sampleRate = synthRes.sampleRate || 24000;
        }
      }

      // Mark audio to avoid echo
      let frameId = '';
      if (synthesizedBase64) {
        frameId = audioRoutingService.markGenerated(synthesizedBase64, {
          sourceId: options.sourceId || 'cristi_translation',
          sessionId,
          correlationId,
          sampleRate
        });
      }

      // Retransmit to virtual output if game_voice
      if (synthesizedBase64 && outputRoute === 'game_voice') {
        await virtualAudioOutputService.playAudioChunk(synthesizedBase64, {
          sampleRate,
          frameId,
          sessionId,
          correlationId
        });
      }

      return {
        success: true,
        translation: translated,
        sourceLanguage: detectedSource,
        outputRoute,
        audio: synthesizedBase64 ? { data: synthesizedBase64, sampleRate } : undefined
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Get telemetry and operational status.
   */
  public getStatus(): TranslationPipelineStatus {
    return {
      enabled: this.enabled,
      sourceAttached: Boolean(this.attachedLoopback),
      sourceId: this.attachedSourceId,
      targetLanguage: this.targetLanguage,
      outputRoute: this.defaultOutputRoute,
      metrics: { ...this.metrics }
    };
  }

  private clearAggregation(): void {
    if (this.aggregationTimer) {
      clearTimeout(this.aggregationTimer);
      this.aggregationTimer = null;
    }
    this.pcmAccumulator = [];
    this.accumulatedSamples = 0;
  }

  private calculatePcmEnergy(pcm: Int16Array): number {
    if (!pcm.length) return 0;
    let sumSquares = 0;
    const step = Math.max(1, Math.floor(pcm.length / 50));
    let samples = 0;
    for (let i = 0; i < pcm.length; i += step) {
      const norm = pcm[i] / 32768.0;
      sumSquares += norm * norm;
      samples++;
    }
    return Math.sqrt(sumSquares / Math.max(1, samples));
  }

  private decodeBase64Pcm(base64: string): Int16Array {
    if (!base64) return new Int16Array(0);
    try {
      if (typeof atob === 'function') {
        const bin = atob(base64);
        const len = bin.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
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
   * Default lightweight Gemini API integration for transcription, translation & TTS.
   */
  private createDefaultGeminiProvider(): ITranslationProvider {
    return {
      transcribe: async (audioPcm: Int16Array | string) => {
        // Convert to base64 if not already
        const base64 = typeof audioPcm === 'string'
          ? audioPcm
          : this.pcm16ToBase64(audioPcm);

        if (!this.apiKey) {
          return { success: false, error: 'API key no configurada para transcripción Gemini.' };
        }

        try {
          const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
          const response = await fetch(`${endpoint}?key=${encodeURIComponent(this.apiKey)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [
                  { text: 'Transcribe el siguiente audio exactamente. Devuelve únicamente la transcripción.' },
                  { inlineData: { mimeType: 'audio/pcm;rate=16000', data: base64 } }
                ]
              }],
              generationConfig: { temperature: 0.0 }
            })
          });

          if (!response.ok) {
            return { success: false, error: `Gemini HTTP ${response.status}` };
          }
          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          return { success: Boolean(text), text, language: 'auto' };
        } catch (err: any) {
          return { success: false, error: err?.message || String(err) };
        }
      },

      translate: async (text: string, options: { from?: string; to: string }) => {
        if (!this.apiKey) {
          return { success: false, error: 'API key no configurada para traducción Gemini.' };
        }
        try {
          const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
          const prompt = `Traduce el siguiente texto al idioma "${options.to}". Devuelve exclusivamente el texto traducido, sin explicaciones ni comillas:\n\n${text}`;
          const response = await fetch(`${endpoint}?key=${encodeURIComponent(this.apiKey)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1 }
            })
          });
          if (!response.ok) return { success: false, error: `Gemini HTTP ${response.status}` };
          const data = await response.json();
          const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
          return { success: true, translation: translated, sourceLanguage: options.from || 'auto' };
        } catch (err: any) {
          return { success: false, error: err?.message || String(err) };
        }
      },

      synthesize: async (text: string, options?: { voice?: string; language?: string }) => {
        if (!this.apiKey) {
          return { success: false, error: 'API key no configurada para síntesis de voz.' };
        }
        try {
          const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
          const response = await fetch(`${endpoint}?key=${encodeURIComponent(this.apiKey)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text }] }],
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: options?.voice || 'Kore' }
                  }
                }
              }
            })
          });

          if (!response.ok) return { success: false, error: `Gemini TTS HTTP ${response.status}` };
          const data = await response.json();
          const audioPart = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
          const audioBase64 = audioPart?.inlineData?.data;

          if (audioBase64) {
            return { success: true, audioData: audioBase64, sampleRate: 24000 };
          }
          return { success: false, error: 'No se recibió stream de audio en respuesta.' };
        } catch (err: any) {
          return { success: false, error: err?.message || String(err) };
        }
      }
    };
  }

  private pcm16ToBase64(pcm: Int16Array): string {
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    let binary = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
    }
    return typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  }

  public destroy(): void {
    this.detachLoopback();
    this.clearAggregation();
  }
}

export const translationService = new TranslationService();
export default translationService;
