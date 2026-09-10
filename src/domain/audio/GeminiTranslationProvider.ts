/**
 * Cristi AI - GeminiTranslationProvider (TypeScript)
 * Gemini REST provider for external audio translation.
 * Audio transcription and translation are intentionally separate calls so a
 * future local STT/TTS provider can replace either stage independently.
 */

import { electronBridge } from '../../services/desktop/ElectronBridge';
import { logger } from '../../infrastructure/logging/logger';

const DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function decodeResponse(payload: any): string {
  return payload?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part?.text || '')
    .join('')
    .trim() || '';
}

function normalizeLanguage(value: unknown): string | null {
  const language = String(value || '').trim().toLowerCase().match(/[a-z]{2,8}/)?.[0];
  return language || null;
}

function parseSampleRate(mimeType: string): number | null {
  const match = String(mimeType || '').match(/rate=(\d+)/i);
  return match ? Number(match[1]) : null;
}

function languageToBcp47(language: unknown): string {
  const code = normalizeLanguage(language) || 'es';
  const regions: Record<string, string> = { es: 'es-ES', en: 'en-US', ja: 'ja-JP', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR', ko: 'ko-KR', it: 'it-IT' };
  return regions[code] || `${code}-${code.toUpperCase()}`;
}

export interface TranslationProviderOptions {
  apiKey?: string;
  transcriptionModel?: string;
  translationModel?: string;
  synthesisModel?: string;
  voiceName?: string;
  endpoint?: string;
  fetchImpl?: typeof globalThis.fetch;
  synthesize?: ((params: any) => Promise<any>) | null;
  timeoutMs?: number;
  maxRetries?: number;
}

export class GeminiTranslationProvider {
  public transcriptionModel: string;
  public translationModel: string;
  public synthesisModel: string;
  public voiceName: string;
  public endpoint: string;
  public fetchImpl: typeof globalThis.fetch;
  public synthesizeImpl: ((params: any) => Promise<any>) | null;
  public timeoutMs: number;
  public maxRetries: number;

  constructor({
    transcriptionModel = 'gemini-2.5-flash',
    translationModel = 'gemini-2.5-flash',
    synthesisModel = 'gemini-3.1-flash-tts-preview',
    voiceName = 'Kore',
    endpoint = DEFAULT_ENDPOINT,
    fetchImpl = globalThis.fetch,
    synthesize = null,
    timeoutMs = 12000,
    maxRetries = 1
  }: TranslationProviderOptions = {}) {
    this.transcriptionModel = transcriptionModel;
    this.translationModel = translationModel;
    this.synthesisModel = synthesisModel;
    this.voiceName = voiceName;
    this.endpoint = endpoint.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
    this.synthesizeImpl = typeof synthesize === 'function' ? synthesize : null;
    this.timeoutMs = Math.max(1000, Number(timeoutMs) || 12000);
    this.maxRetries = Math.max(0, Math.min(3, Number(maxRetries) || 1));
  }

  public configure(options: Partial<TranslationProviderOptions> = {}): void {
    if (options.transcriptionModel) this.transcriptionModel = options.transcriptionModel;
    if (options.translationModel) this.translationModel = options.translationModel;
    if (options.synthesisModel) this.synthesisModel = options.synthesisModel;
    if (options.voiceName) this.voiceName = options.voiceName;
    if (typeof options.synthesize === 'function') this.synthesizeImpl = options.synthesize;
  }

  public async request(model: string, parts: any[], { responseMimeType = 'text/plain' }: { responseMimeType?: string } = {}): Promise<string> {
    if (typeof this.fetchImpl !== 'function') throw new Error('fetch no está disponible para traducción.');
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.1, responseMimeType }
    };
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
      try {
        const payload = await electronBridge.geminiGenerate(model, body);
        return decodeResponse(payload);
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    throw lastError || new Error('Respuesta de Gemini vacía.');
  }

  public async requestAudio(model: string, text: string, { language = 'es' }: { language?: string } = {}): Promise<{ data: string; mimeType: string; sampleRate: number }> {
    if (typeof this.fetchImpl !== 'function') throw new Error('fetch no está disponible para síntesis.');
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: String(text || '') }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voiceName } },
          languageCode: languageToBcp47(language)
        }
      }
    };
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
      try {
        const payload = await electronBridge.geminiGenerate(model, body) as any;
        const part = payload?.candidates?.[0]?.content?.parts?.find((item: any) => item?.inlineData?.data);
        if (part?.inlineData?.data) {
          return {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
            sampleRate: parseSampleRate(part.inlineData.mimeType) || 24000
          };
        }
        throw new Error('Gemini TTS no devolvió audio.');
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    throw lastError || new Error('Respuesta de Gemini TTS vacía.');
  }

  public async transcribe({ data, sampleRate = 16000, sourceId = 'external_audio' }: { data?: string; sampleRate?: number; sourceId?: string } = {}): Promise<{ text: string } | null> {
    const rate = Number.isFinite(Number(sampleRate))
      ? Math.max(8000, Math.min(48000, Math.round(Number(sampleRate))))
      : 16000;
    const text = await this.request(this.transcriptionModel, [
      { text: `Transcribe exactamente el audio PCM recibido de ${sourceId}. Devuelve sólo las palabras habladas, sin etiquetas, explicaciones ni traducción. Frecuencia: ${rate} Hz.` },
      { inlineData: { mimeType: `audio/pcm;rate=${rate}`, data: String(data || '') } }
    ]);
    return text ? { text } : null;
  }

  public async detectLanguage({ text }: { text?: string } = {}): Promise<{ language: string | null }> {
    const sample = String(text || '').trim();
    if (!sample) return { language: null };
    if (/[áéíóúñ¿¡]/i.test(sample)) return { language: 'es' };
    const detected = await this.request(this.translationModel, [
      { text: `Identifica el idioma ISO 639-1 de este texto. Responde sólo el código de dos letras:\n${sample}` }
    ]);
    return { language: normalizeLanguage(detected) };
  }

  public async translate({ text, sourceLanguage = null, targetLanguage = 'es' }: { text?: string; sourceLanguage?: string | null; targetLanguage?: string } = {}): Promise<{ text: string } | null> {
    const translated = await this.request(this.translationModel, [
      { text: `Traduce el siguiente texto de ${sourceLanguage || 'su idioma original'} a ${targetLanguage}. Conserva el significado, nombres propios y tono. Devuelve sólo la traducción:\n${String(text || '')}` }
    ]);
    return translated ? { text: translated } : null;
  }

  public async translateAndDetect({ text, targetLanguage = 'es' }: { text?: string; targetLanguage?: string } = {}): Promise<{ text: string; sourceLanguage: string | null } | null> {
    const raw = await this.request(this.translationModel, [
      {
        text: `Detecta el idioma ISO 639-1 y traduce el texto a ${targetLanguage}. ` +
          'Devuelve JSON estricto con las claves "sourceLanguage" y "text", sin markdown:\n' +
          String(text || '')
      }
    ], { responseMimeType: 'application/json' });
    try {
      const parsed = JSON.parse(raw);
      const translated = String(parsed?.text || '').trim();
      if (translated) return { text: translated, sourceLanguage: normalizeLanguage(parsed?.sourceLanguage) };
    } catch (_) {
      // Fallback if model ignored responseMimeType
    }
    return raw ? { text: raw, sourceLanguage: null } : null;
  }

  public async isRelevant({ text }: { text?: string } = {}): Promise<boolean> {
    return Boolean(String(text || '').trim());
  }

  public async synthesize({ text, language = 'es', sourceId = 'external_audio', sessionId = null }: { text?: string; language?: string; sourceId?: string; sessionId?: string | null } = {}): Promise<any> {
    if (!this.synthesizeImpl && !electronBridge.isElectron) return null;
    try {
      if (this.synthesizeImpl) return await this.synthesizeImpl({ text, language, sourceId, sessionId });
      return await this.requestAudio(this.synthesisModel, String(text || ''), { language });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn('TRANSLATION', 'Síntesis externa falló:', msg);
      return null;
    }
  }
}

export default GeminiTranslationProvider;
