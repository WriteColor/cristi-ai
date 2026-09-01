/**
 * Cristi AI - Ultra-Fast Google ASR & Windows Native Speech Engine
 * Powered by Web Speech API (Chromium / Brave / Google ASR Neural Backend)
 * 
 * Features:
 * - Real-time continuous speech transcription (0 latency)
 * - Automatic phrase boundary detection & debouncing
 * - Auto-restart on session interruptions or network hiccups
 * - Direct turn dispatch to Gemini Live API
 */

export class SpeechRecognitionService {
  constructor({
    onInterimText,
    onFinalText,
    onResult,
    onSpeechStart,
    onSpeechEnd,
    onError,
    onStatusChange,
    lang = 'es-ES'
  } = {}) {
    this.onInterimText = onInterimText || (() => {});
    this.onFinalText = onFinalText || (() => {});
    this.onResult = onResult || null;
    this.onSpeechStart = onSpeechStart || (() => {});
    this.onSpeechEnd = onSpeechEnd || (() => {});
    this.onError = onError || (() => {});
    this.onStatusChange = onStatusChange || (() => {});
    this.lang = lang;

    this.recognition = null;
    this.isListening = false;
    this.shouldStayActive = false;
    this.silenceTimer = null;
    this.restartTimer = null;
    this.currentInterim = '';

    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognitionClass = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;

    if (!SpeechRecognitionClass) {
      console.warn('[SpeechRecognition] Web Speech API no disponible en este entorno.');
      return;
    }

    try {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = this.lang;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.onStatusChange(true);
        this.onSpeechStart();
      };

      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        if (interimTranscript) {
          this.currentInterim = interimTranscript;
          this.onInterimText(interimTranscript);
          if (this.onResult) {
            this.onResult(interimTranscript, false);
          }

          // If user pauses after speaking an interim sentence for > 1200ms, finalize it
          clearTimeout(this.silenceTimer);
          this.silenceTimer = setTimeout(() => {
            if (this.currentInterim && this.currentInterim.trim().length > 1) {
              const pendingText = this.currentInterim.trim();
              this.currentInterim = '';
              this.onFinalText(pendingText);
              if (this.onResult) {
                this.onResult(pendingText, true);
              }
            }
          }, 1200);
        }

        if (finalTranscript && finalTranscript.trim().length > 0) {
          clearTimeout(this.silenceTimer);
          this.currentInterim = '';
          const trimmed = finalTranscript.trim();
          this.onFinalText(trimmed);
          if (this.onResult) {
            this.onResult(trimmed, true);
          }
        }
      };

      this.recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // Normal silence / cancel, no action needed
          return;
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          console.warn('[SpeechRecognition] Permiso denegado para reconocimiento de voz.');
          this.shouldStayActive = false;
        } else {
          console.warn('[SpeechRecognition] Notice:', event.error);
        }
        this.onError(event);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.onStatusChange(false);
        this.onSpeechEnd();

        // Auto-restart if session is still active
        if (this.shouldStayActive) {
          if (this.restartTimer) clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            if (this.shouldStayActive && !this.isListening && this.recognition) {
              try {
                this.recognition.start();
              } catch (e) {}
            }
          }, 250);
        }
      };
    } catch (err) {
      console.error('[SpeechRecognition] Error al inicializar:', err);
    }
  }

  setLanguage(newLang) {
    this.lang = newLang;
    if (this.recognition) {
      this.recognition.lang = newLang;
    }
  }

  start() {
    if (!this.isSupported()) return;
    if (!this.recognition) {
      this.initRecognition();
    }
    if (!this.recognition) return;
    this.shouldStayActive = true;
    if (!this.isListening) {
      try {
        this.recognition.start();
      } catch (e) {
        // May already be running
      }
    }
  }

  stop() {
    this.shouldStayActive = false;
    clearTimeout(this.silenceTimer);
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.isListening = false;
    this.onStatusChange(false);
    this.onSpeechEnd();
  }

  destroy() {
    this.stop();
    if (this.recognition) {
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition = null;
    }
  }

  isSupported() {
    return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
}
