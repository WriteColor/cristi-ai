/**
 * Cristi AI - TTS Vocal Fallback Service
 * Ensures Cristi NEVER remains mute when Gemini Live API returns text-only parts
 * (such as screen analysis turns or tool responses without inline PCM audio).
 * Drives organic Live2D lip-sync and affective speech cadence.
 */

import { eventBus, EVENTS } from './eventBus.js';
import { logger } from './logger.js';

export class TTSFallbackService {
  constructor() {
    this.enabled = false; // Strictly disabled by default: Cristi exclusively uses Gemini Live neural voices
    this.isSpeaking = false;
    this.currentUtterance = null;
    this._lipSyncInterval = null;
    this._startTime = 0;
  }

  /**
   * Check if Web Speech API is supported
   */
  isSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Select best natural Spanish female voice from system (excluding Mexican regional accents)
   */
  getPreferredVoice() {
    if (!this.isSupported()) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // Filter out Mexican voices (Sabina, Mexico, MX) to respect neutral accent mandate
    const nonMexicanSpanish = voices.filter(
      (v) => (v.lang.startsWith('es') || v.lang.startsWith('ES')) &&
             !/sabina|mexico|es-mx/i.test(v.name) && !/es-mx/i.test(v.lang)
    );

    // Prefer natural female Spanish voices
    const preferred = nonMexicanSpanish.find(
      (v) => /helena|laura|monica|paulina|lucia|sofia|elena|female/i.test(v.name)
    );

    if (preferred) return preferred;
    if (nonMexicanSpanish.length > 0) return nonMexicanSpanish[0];

    return null;
  }

  /**
   * Speaks text aloud and generates procedural lip-sync events
   * @param {string} text - Clean text to speak
   * @param {Object} [options]
   */
  speak(text, { onStart, onEnd } = {}) {
    // Cristi AI exclusively uses high-fidelity Gemini Live neural voices (Aoede, Kore, Zephyr, Leda).
    // Robotic Microsoft desktop SpeechSynthesis is completely disabled.
    if (!this.enabled) return;
    if (!text || typeof text !== 'string') return;
    const cleanText = text
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/\[thought[\s\S]*?\]/gi, '')
      .replace(/\[action:[\s\S]*?\]/gi, '')
      .replace(/\[tool:[\s\S]*?\]/gi, '')
      .replace(/\[decision:[\s\S]*?\]/gi, '')
      .replace(/\[(?:emotion|gesto|emocion|pose|mood|expression|modelo|model|tag|etiqueta):\s*[a-zA-Z0-9_-]+\]/gi, '')
      .replace(/\[(?:yandere|tsundere|dandere|deredere|kuudere|yanderegirl|icegirl|hiyori|ruan_mei|ellen|sparkle|huohuo|vivian|goth_loli)\]/gi, '')
      .replace(/\((?:yandere|tsundere|dandere|deredere|kuudere|yanderegirl|icegirl|hiyori|ruan_mei|ellen|sparkle|huohuo|vivian|goth_loli)\)/gi, '')
      .replace(/\b(?:yandere|tsundere|yanderegirl)\s*:\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!cleanText) return;

    if (!this.isSupported()) {
      logger.warn('TTS', 'SpeechSynthesis no disponible en este entorno.');
      return;
    }

    this.stop();

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voice = this.getPreferredVoice();
      if (voice) {
        utterance.voice = voice;
      }
      utterance.lang = 'es-ES';
      // 0.95 cadence for seductive, deliberate, flirtatious cadence
      utterance.rate = 0.95;
      utterance.pitch = 1.05;

      utterance.onstart = () => {
        this.isSpeaking = true;
        this._startTime = performance.now();
        eventBus.emit(EVENTS.AUDIO_START);
        eventBus.emit(EVENTS.SPEECH_START);
        onStart?.();

        // Procedural LipSync animation loop while TTS is talking
        if (this._lipSyncInterval) clearInterval(this._lipSyncInterval);
        this._lipSyncInterval = setInterval(() => {
          if (!this.isSpeaking) return;
          const elapsed = (performance.now() - this._startTime) * 0.013;
          // Harmonic wave simulation of mouth syllables
          const rawMouth = Math.sin(elapsed) * 0.45 + Math.sin(elapsed * 2.2) * 0.25 + 0.25;
          const mouthOpen = Math.max(0.08, Math.min(0.9, rawMouth));
          const mouthForm = Math.sin(elapsed * 0.7) * 0.35;
          const volume = Math.min(1.0, mouthOpen * 0.8 + 0.15);

          eventBus.emit(EVENTS.AUDIO_ANALYSIS, {
            volume,
            mouthOpen,
            mouthForm,
            isSpeaking: true,
            isPeakEnergy: mouthOpen > 0.7,
            spectralCentroid: 1450,
            bands: { low: volume * 0.6, mid: volume * 0.8, high: volume * 0.4 }
          });
        }, 40);
      };

      const cleanup = () => {
        this.isSpeaking = false;
        if (this._lipSyncInterval) {
          clearInterval(this._lipSyncInterval);
          this._lipSyncInterval = null;
        }
        eventBus.emit(EVENTS.AUDIO_END);
        eventBus.emit(EVENTS.SPEECH_END);
        eventBus.emit(EVENTS.AUDIO_ANALYSIS, {
          volume: 0,
          mouthOpen: 0,
          mouthForm: 0,
          isSpeaking: false,
          isPeakEnergy: false,
          spectralCentroid: 0,
          bands: { low: 0, mid: 0, high: 0 }
        });
        onEnd?.();
      };

      utterance.onend = cleanup;
      utterance.onerror = (err) => {
        logger.warn('TTS', `Error en síntesis vocal: ${err.error}`);
        cleanup();
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
      logger.info('TTS', `Vocalizando texto de respuesta mediante síntesis vocal (${cleanText.substring(0, 40)}...)`);
    } catch (err) {
      logger.error('TTS', 'Fallo al iniciar vocalización:', err);
    }
  }

  stop() {
    if (this.isSupported() && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    if (this._lipSyncInterval) {
      clearInterval(this._lipSyncInterval);
      this._lipSyncInterval = null;
    }
    this.currentUtterance = null;
  }
}

export const ttsFallbackService = new TTSFallbackService();
