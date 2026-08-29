/**
 * Cristi AI - Gemini Multimodal Live API WebSocket Client
 * Bi-directional real-time communication for audio, video, text, and tool calls.
 * Includes Session Resumption support (extending sessions beyond 10 mins up to 8h)
 * and instantaneous Barge-in interruption handling.
 */

import { SYSTEM_PERSONA_PROMPT, DEFAULT_MODEL_ID } from '../config/models';
import { getLiveToolsConfig } from '../config/tools';
import { sanitizeVoiceForModel } from '../config/voices';
import { logger } from './logger';

export class GeminiLiveSocket {
  constructor({
    apiKey,
    modelId = DEFAULT_MODEL_ID,
    voiceName = 'Aoede',
    systemPrompt = SYSTEM_PERSONA_PROMPT,
    thinkingConfig = null,
    temperature = 0.75,
    onOpen,
    onClose,
    onError,
    onAudioChunk,
    onInputTranscription,
    onOutputTranscription,
    onInterrupted,
    onTurnComplete,
    onToolCall,
  }) {
    this.apiKey = apiKey;
    this.modelId = modelId;
    this.voiceName = voiceName;
    this.systemPrompt = systemPrompt;
    this.thinkingConfig = thinkingConfig;
    this.temperature = temperature;

    this.onOpen = onOpen || (() => {});
    this.onClose = onClose || (() => {});
    this.onError = onError || console.error;
    this.onAudioChunk = onAudioChunk || (() => {});
    this.onInputTranscription = onInputTranscription || (() => {});
    this.onOutputTranscription = onOutputTranscription || (() => {});
    this.onInterrupted = onInterrupted || (() => {});
    this.onTurnComplete = onTurnComplete || (() => {});
    this.onToolCall = onToolCall || (() => {});

    this.websocket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.sessionResumptionHandle = null;
    this.isExplicitDisconnect = false;
  }

  connect() {
    if (this.isConnected || this.isConnecting) return;

    if (!this.apiKey || !this.apiKey.trim()) {
      const err = new Error('No se ha configurado una API Key de Gemini válida. Por favor configúrala en Ajustes (⚙).');
      logger.error('GEMINI', err.message);
      this.onError(err);
      return;
    }

    this.isConnecting = true;
    this.isExplicitDisconnect = false;
    logger.info('GEMINI', `Iniciando conexión WebSocket Live con modelo: ${this.modelId}...`);

    // Standard Gemini Live Multimodal WebSocket Endpoint
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey.trim()}`;

    try {
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        logger.info('GEMINI', 'Conexión WebSocket establecida con Google AI Studio.');
        this.sendInitialSetup();
        this.onOpen();
      };

      this.websocket.onmessage = (event) => {
        this.handleServerMessage(event.data);
      };

      this.websocket.onerror = (error) => {
        logger.error('GEMINI', 'Error en canal WebSocket de Gemini Live.', error);
        this.onError(new Error('Error de comunicación en WebSocket de Gemini Live.'));
      };

      this.websocket.onclose = (event) => {
        const wasClean = event.wasClean;
        const code = event.code;
        const reason = event.reason;

        this.isConnected = false;
        this.isConnecting = false;

        if (this.isExplicitDisconnect) {
          logger.info('GEMINI', 'Sesión cerrada por el usuario.');
          this.onClose(event);
          return;
        }

        logger.warn('GEMINI', `WebSocket cerrado (código ${code}, razón: "${reason || 'desconexión'}", wasClean: ${wasClean})`);

        // If closed with resumption handle available and not an auth error, trigger seamless reconnect
        if (this.sessionResumptionHandle && code !== 1008 && code !== 4001) {
          logger.info('GEMINI', 'Reanudando sesión automáticamente mediante Session Resumption (contexto intacto)...');
          setTimeout(() => {
            if (!this.isExplicitDisconnect) {
              this.connect();
            }
          }, 600);
          return;
        }

        if (code !== 1000 && code !== 1005) {
          const detail = reason || (code === 1008 ? 'Autenticación rechazada o API Key inválida.' : 'Conexión interrumpida por el servidor.');
          this.onError(new Error(`Llamada terminada (${code}): ${detail}`));
        }

        this.onClose(event);
      };
    } catch (err) {
      this.isConnecting = false;
      logger.error('GEMINI', 'Fallo al instanciar WebSocket:', err);
      this.onError(err);
    }
  }

  /**
   * Send the initial BidiGenerateContentSetup message with Session Resumption support
   */
  sendInitialSetup() {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const validatedVoice = sanitizeVoiceForModel(this.modelId, this.voiceName);

    const generationConfig = {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: validatedVoice
          }
        }
      },
      temperature: this.temperature || 0.75
    };

    // Include Thinking Configuration only if specified and supported
    if (this.thinkingConfig && typeof this.thinkingConfig === 'object') {
      generationConfig.thinkingConfig = this.thinkingConfig;
    }

    const setupMessage = {
      setup: {
        model: `models/${this.modelId}`,
        generationConfig: generationConfig,
        systemInstruction: {
          parts: [{ text: this.systemPrompt }]
        },
        tools: getLiveToolsConfig(),
        // Session Resumption: enables extending session beyond 10 minutes up to 8h
        sessionResumption: this.sessionResumptionHandle
          ? { handle: this.sessionResumptionHandle }
          : {}
      }
    };

    logger.info('GEMINI', `Enviando Setup inicial (Modelo: ${this.modelId}, Voz: ${validatedVoice}, Resumption: ${this.sessionResumptionHandle ? 'Activo' : 'Nuevo'})`);
    this.websocket.send(JSON.stringify(setupMessage));
  }

  /**
   * Send Realtime Audio Chunk (PCM 16kHz Little Endian) via modern non-deprecated schema
   */
  sendAudioChunk(base64Data) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const message = {
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Data
        }
      }
    };

    this.websocket.send(JSON.stringify(message));
  }

  /**
   * Send Realtime Video Frame (JPEG Base64) via modern non-deprecated schema
   */
  sendVideoFrame(base64JpegData) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const message = {
      realtimeInput: {
        video: {
          mimeType: 'image/jpeg',
          data: base64JpegData
        }
      }
    };

    this.websocket.send(JSON.stringify(message));
  }

  /**
   * Send Client Content / User Speech text transcript directly (Google ASR)
   */
  sendClientContent(text) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN || !text || !text.trim()) return;

    logger.info('ASR', `[Transcripción de Usuario enviada a Gemini]: "${text.trim()}"`);

    const message = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: text.trim() }]
          }
        ],
        turnComplete: true
      }
    };

    this.websocket.send(JSON.stringify(message));
  }

  /**
   * Send Text message / prompt directly
   */
  sendTextMessage(text) {
    this.sendClientContent(text);
  }

  /**
   * Send Tool / Function Call Response back to model
   */
  sendToolResponse(functionResponses) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    logger.info('TOOL', `Enviando respuesta de herramientas ejecutadas (${functionResponses.length} resultados)`);

    const message = {
      toolResponse: {
        functionResponses: functionResponses
      }
    };

    this.websocket.send(JSON.stringify(message));
  }

  /**
   * Parse and dispatch incoming server messages
   */
  async handleServerMessage(data) {
    let parsed;
    try {
      if (data instanceof Blob) {
        const text = await data.text();
        parsed = JSON.parse(text);
      } else {
        parsed = JSON.parse(data);
      }
    } catch (e) {
      logger.error('GEMINI', 'Error al parsear mensaje JSON del servidor:', e);
      return;
    }

    // Check for API Error from server
    if (parsed.error) {
      const errMsg = parsed.error.message || `Error ${parsed.error.code || 'desconocido'} de la API de Gemini`;
      logger.error('GEMINI', `Error reportado por servidor: ${errMsg}`);
      this.onError(new Error(errMsg));
      return;
    }

    // Handle Session Resumption updates (Session extension up to 8h)
    if (parsed.sessionResumptionUpdate && parsed.sessionResumptionUpdate.newHandle) {
      this.sessionResumptionHandle = parsed.sessionResumptionUpdate.newHandle;
      logger.info('GEMINI', 'Token de extensión de sesión (Session Resumption) actualizado.');
    }

    // Handle GoAway warning (60s before connection time limit)
    if (parsed.goAway) {
      logger.warn('GEMINI', 'Aviso goAway recibido (límite de conexión alcanzado) — reconectando automáticamente con Session Resumption...');
      if (this.websocket) {
        try { this.websocket.close(1000, 'Session Extension Renewal'); } catch (_) {}
      }
      return;
    }

    // 1. Handle Server Content (Audio parts, Transcripts, Interruptions)
    if (parsed.serverContent) {
      const serverContent = parsed.serverContent;

      // User interrupted the model speaking (Barge-in)
      if (serverContent.interrupted) {
        logger.warn('AUDIO', '⚡ Interrupción detectada (Barge-in): silenciando audio de Cristi al instante.');
        this.onInterrupted();
      }

      // Realtime Audio & Text chunks from Model Turn
      if (serverContent.modelTurn && serverContent.modelTurn.parts) {
        for (const part of serverContent.modelTurn.parts) {
          if (part.inlineData && part.inlineData.data) {
            this.onAudioChunk(part.inlineData.data);
          }
          if (part.text) {
            const cleaned = part.text
              .replace(/\[[a-zA-Z_\s-]+\]/g, '')
              .replace(/\([a-zA-Z_\s-]+\)/g, '');
            if (cleaned.trim()) {
              logger.voice('GEMINI', `[Cristi dice]: "${cleaned.trim()}"`);
              this.onOutputTranscription(cleaned);
            }
          }
        }
      }

      // Input Transcription (User ASR)
      if (serverContent.inputTranscription && serverContent.inputTranscription.text) {
        logger.info('ASR', `[Gemini ASR Nativo]: "${serverContent.inputTranscription.text}"`);
        this.onInputTranscription(serverContent.inputTranscription.text);
      }

      // Output Transcription (Model ASR / Text)
      if (serverContent.outputTranscription && serverContent.outputTranscription.text) {
        const cleaned = serverContent.outputTranscription.text
          .replace(/\[[a-zA-Z_\s-]+\]/g, '')
          .replace(/\([a-zA-Z_\s-]+\)/g, '');
        if (cleaned.trim()) {
          logger.voice('GEMINI', `[Cristi Transcripción]: "${cleaned.trim()}"`);
          this.onOutputTranscription(cleaned);
        }
      }

      // Turn Complete
      if (serverContent.turnComplete) {
        logger.info('GEMINI', 'Turno completado por Cristi.');
        this.onTurnComplete();
      }
    }

    // 2. Handle Tool Calls
    if (parsed.toolCall && parsed.toolCall.functionCalls) {
      parsed.toolCall.functionCalls.forEach((fc) => {
        logger.info('TOOL', `Gemini solicita ejecutar herramienta: "${fc.name}"`, fc.args);
      });
      this.onToolCall(parsed.toolCall.functionCalls);
    }
  }

  disconnect() {
    this.isExplicitDisconnect = true;
    this.isConnected = false;
    this.isConnecting = false;
    this.sessionResumptionHandle = null;
    if (this.websocket) {
      try {
        this.websocket.close(1000, 'User initiated disconnect');
      } catch (e) {}
      this.websocket = null;
    }
    logger.info('GEMINI', 'Llamada finalizada por el usuario.');
  }
}
