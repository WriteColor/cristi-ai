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
  constructor({ onInterimText, onFinalText, onError, onStatusChange, lang = 'es-ES' }) {
    this.onInterimText = onInterimText || (() => {});
    this.onFinalText = onFinalText || (() => {});
    this.onError = onError || (() => {});
    this.onStatusChange = onStatusChange || (() => {});
    this.lang = lang;

    this.recognition = null;
    this.isListening = false;
    this.shouldStayActive = false;
    this.silenceTimer = null;
    this.currentInterim = '';

    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.warn('Web Speech API no disponible en este navegador.');
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

          // If user pauses after speaking an interim sentence for > 1200ms, finalize it
          clearTimeout(this.silenceTimer);
          this.silenceTimer = setTimeout(() => {
            if (this.currentInterim && this.currentInterim.trim().length > 1) {
              const pendingText = this.currentInterim.trim();
              this.currentInterim = '';
              this.onFinalText(pendingText);
            }
          }, 1200);
        }

        if (finalTranscript && finalTranscript.trim().length > 0) {
          clearTimeout(this.silenceTimer);
          this.currentInterim = '';
          this.onFinalText(finalTranscript.trim());
        }
      };

      this.recognition.onerror = (event) => {
        if (event.error === 'no-speech') {
          // Normal silence, no action needed
          return;
        }
        if (event.error === 'aborted') {
          return;
        }
        console.warn('Speech Recognition Notice:', event.error);
        this.onError(event);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.onStatusChange(false);

        // Auto-restart if session is still active
        if (this.shouldStayActive) {
          setTimeout(() => {
            if (this.shouldStayActive && !this.isListening) {
              try {
                this.recognition.start();
              } catch (e) {}
            }
          }, 250);
        }
      };
    } catch (err) {
      console.error('Error al inicializar reconocimiento de voz:', err);
    }
  }

  setLanguage(newLang) {
    this.lang = newLang;
    if (this.recognition) {
      this.recognition.lang = newLang;
    }
  }

  start() {
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
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.isListening = false;
    this.onStatusChange(false);
  }

  isSupported() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
}
