import { logger } from '../logger.js';

const DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function decodeResponse(payload) {
  return payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('')
    .trim() || '';
}

function normalizeLanguage(value) {
  const language = String(value || '').trim().toLowerCase().match(/[a-z]{2,8}/)?.[0];
  return language || null;
}

/**
 * Gemini REST provider for external audio translation.
 * Audio transcription and translation are intentionally separate calls so a
 * future local STT/TTS provider can replace either stage independently.
 */
export class GeminiTranslationProvider {
  constructor({
    apiKey = '',
    transcriptionModel = 'gemini-2.5-flash',
    translationModel = 'gemini-2.5-flash',
    synthesisModel = 'gemini-3.1-flash-tts-preview',
    voiceName = 'Kore',
    endpoint = DEFAULT_ENDPOINT,
    fetchImpl = globalThis.fetch,
    synthesize = null,
    timeoutMs = 12000,
    maxRetries = 1
  } = {}) {
    this.apiKey = String(apiKey || '').trim();
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

  configure(options = {}) {
    if (options.apiKey !== undefined) this.apiKey = String(options.apiKey || '').trim();
    if (options.transcriptionModel) this.transcriptionModel = options.transcriptionModel;
    if (options.translationModel) this.translationModel = options.translationModel;
    if (options.synthesisModel) this.synthesisModel = options.synthesisModel;
    if (options.voiceName) this.voiceName = options.voiceName;
    if (typeof options.synthesize === 'function') this.synthesizeImpl = options.synthesize;
  }

  async request(model, parts, { responseMimeType = 'text/plain' } = {}) {
    if (!this.apiKey) throw new Error('No hay API key de Gemini para traducción.');
    if (typeof this.fetchImpl !== 'function') throw new Error('fetch no está disponible para traducción.');
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.1, responseMimeType }
    };
    let lastError = null;
      for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
        const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
        try {
          const response = await this.fetchImpl(`${this.endpoint}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller?.signal
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload?.error?.message || `Gemini HTTP ${response.status}`);
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

  async requestAudio(model, text, { language = 'es' } = {}) {
    if (!this.apiKey) throw new Error('No hay API key de Gemini para síntesis.');
    if (typeof this.fetchImpl !== 'function') throw new Error('fetch no está disponible para síntesis.');
    const body = {
      contents: [{ role: 'user', parts: [{ text: String(text || '') }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voiceName } },
          languageCode: languageToBcp47(language)
        }
      }
    };
    let lastError = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
      try {
          const response = await this.fetchImpl(`${this.endpoint}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller?.signal
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload?.error?.message || `Gemini TTS HTTP ${response.status}`);
          const part = payload?.candidates?.[0]?.content?.parts?.find((item) => item?.inlineData?.data);
          if (part?.inlineData?.data) return { data: part.inlineData.data, mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000', sampleRate: parseSampleRate(part.inlineData.mimeType) || 24000 };
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

  async transcribe({ data, sampleRate = 16000, sourceId = 'external_audio' } = {}) {
    const text = await this.request(this.transcriptionModel, [
      { text: `Transcribe exactamente el audio PCM recibido de ${sourceId}. Devuelve sólo las palabras habladas, sin etiquetas, explicaciones ni traducción. Frecuencia: ${sampleRate} Hz.` },
      { inlineData: { mimeType: 'audio/pcm;rate=16000', data: String(data || '') } }
    ]);
    return text ? { text } : null;
  }

  async detectLanguage({ text } = {}) {
    const sample = String(text || '').trim();
    if (!sample) return { language: null };
    // Cheap offline hints avoid an extra network round trip for common inputs.
    if (/[áéíóúñ¿¡]/i.test(sample)) return { language: 'es' };
    const detected = await this.request(this.translationModel, [
      { text: `Identifica el idioma ISO 639-1 de este texto. Responde sólo el código de dos letras:\n${sample}` }
    ]);
    return { language: normalizeLanguage(detected) };
  }

  async translate({ text, sourceLanguage = null, targetLanguage = 'es' } = {}) {
    const translated = await this.request(this.translationModel, [
      { text: `Traduce el siguiente texto de ${sourceLanguage || 'su idioma original'} a ${targetLanguage}. Conserva el significado, nombres propios y tono. Devuelve sólo la traducción:\n${String(text || '')}` }
    ]);
    return translated ? { text: translated } : null;
  }

  async isRelevant({ text } = {}) {
    return Boolean(String(text || '').trim());
  }

  async synthesize({ text, language = 'es', sourceId = 'external_audio', sessionId = null } = {}) {
    if (!this.synthesizeImpl && !this.apiKey) return null;
    try {
      if (this.synthesizeImpl) return await this.synthesizeImpl({ text, language, sourceId, sessionId });
      return await this.requestAudio(this.synthesisModel, text, { language });
    } catch (error) {
      logger.warn('TRANSLATION', 'Síntesis externa falló:', error?.message || String(error));
      return null;
    }
  }
}

function parseSampleRate(mimeType) {
  const match = String(mimeType || '').match(/rate=(\d+)/i);
  return match ? Number(match[1]) : null;
}

function languageToBcp47(language) {
  const code = normalizeLanguage(language) || 'es';
  const regions = { es: 'es-ES', en: 'en-US', ja: 'ja-JP', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR', ko: 'ko-KR', it: 'it-IT' };
  return regions[code] || `${code}-${code.toUpperCase()}`;
}

export default GeminiTranslationProvider;
