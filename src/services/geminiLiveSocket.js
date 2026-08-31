/**
 * Cristi AI - Gemini Multimodal Live API WebSocket Client
 * Bi-directional real-time communication for audio, video, text, and tool calls.
 * Includes Session Resumption support, Exponential Backoff auto-reconnection,
 * and instantaneous Barge-in interruption handling.
 */

import { SYSTEM_PERSONA_PROMPT, DEFAULT_MODEL_ID } from '../config/models.js';
import { getLiveToolsConfig } from '../config/tools.js';
import { sanitizeVoiceForModel } from '../config/voices.js';
import { logger } from './logger.js';
import { contextualEmotionOrchestrator } from './live2d/ContextualEmotionOrchestrator.js';

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

    // Resilient Reconnection parameters
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
  }

  connect() {
    if (this.isConnected || this.isConnecting) return;

    if (!this.apiKey || !this.apiKey.trim()) {
      const err = new Error('No se ha configurado una API Key de Gemini válida. Por favor configúrala en Ajustes (⚙).');
      logger.warn('GEMINI', err.message);
      this.onError(err);
      return;
    }

    this.isConnecting = true;
    this.isExplicitDisconnect = false;
    logger.info('GEMINI', `Iniciando conexión WebSocket Live con modelo: ${this.modelId} (Intento #${this.reconnectAttempts + 1})...`);

    // Standard Gemini Live Multimodal WebSocket Endpoint
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey.trim()}`;

    try {
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        logger.info('GEMINI', 'Conexión WebSocket establecida con Google AI Studio.');
        this.sendInitialSetup();
        this.onOpen();
      };

      this.websocket.onmessage = (event) => {
        this.handleServerMessage(event.data);
      };

      this.websocket.onerror = (error) => {
        logger.warn('GEMINI', 'Aviso en canal WebSocket de Gemini Live:', error);
      };

      this.websocket.onclose = (event) => {
        const wasClean = event.wasClean;
        const code = event.code;
        const reason = event.reason;

        this.isConnected = false;
        this.isConnecting = false;

        if (this.isExplicitDisconnect) {
          logger.info('GEMINI', 'Sesión cerrada explícitamente por el usuario.');
          this.onClose(event);
          return;
        }

        logger.warn('GEMINI', `WebSocket cerrado (código ${code}, razón: "${reason || 'desconexión'}", wasClean: ${wasClean})`);

        // Check if we should attempt Exponential Backoff reconnection
        const isAuthOrQuotaError = code === 1008 || code === 4001 || code === 4003;
        if (!isAuthOrQuotaError && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(10000, 1000 * Math.pow(1.8, this.reconnectAttempts - 1) + Math.random() * 400);
          logger.info('GEMINI', `Reconectando automáticamente en ${(delay / 1000).toFixed(1)}s (Intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            if (!this.isExplicitDisconnect && !this.isConnected) {
              this.connect();
            }
          }, delay);
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
      logger.warn('GEMINI', 'Fallo al instanciar WebSocket:', err);
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
        sessionResumption: this.sessionResumptionHandle
          ? { handle: this.sessionResumptionHandle }
          : {}
      }
    };

    logger.info('GEMINI', `Enviando Setup inicial (Modelo: ${this.modelId}, Voz: ${validatedVoice}, Resumption: ${this.sessionResumptionHandle ? 'Activo' : 'Nuevo'})`);
    this.websocket.send(JSON.stringify(setupMessage));
  }

  /**
   * Send a chunk of 16kHz PCM audio
   */
  sendAudioChunk(base64AudioData) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64AudioData
          }
        ]
      }
    };

    this.websocket.send(JSON.stringify(message));
  }

  /**
   * Send a video/camera/screen frame (JPEG base64)
   */
  sendVideoFrame(base64JPEGData) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'image/jpeg',
            data: base64JPEGData
          }
        ]
      }
    };

    this.websocket.send(JSON.stringify(message));
  }

  /**
   * Send a text message turn to Gemini Live
   */
  sendTextMessage(text) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const message = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text }]
          }
        ],
        turnComplete: true
      }
    };

    this.websocket.send(JSON.stringify(message));
  }

  /**
   * Send tool response back to Gemini Live
   */
  sendToolResponse(responses) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const formattedResponses = responses.map((r) => ({
      id: r.id,
      name: r.name,
      response: {
        output: r.output
      }
    }));

    const message = {
      toolResponse: {
        functionResponses: formattedResponses
      }
    };

    logger.info('GEMINI', 'Enviando respuestas de ejecución de herramientas a Gemini Live:', formattedResponses);
    this.websocket.send(JSON.stringify(message));
  }

  /**
   * Handle incoming WebSocket message payloads from Google AI Studio
   */
  async handleServerMessage(data) {
    let rawText = data;
    if (data instanceof Blob) {
      rawText = await data.text();
    } else if (data instanceof ArrayBuffer) {
      rawText = new TextDecoder().decode(data);
    }

    try {
      const message = JSON.parse(rawText);

      // 1. Session Resumption Handle Update
      if (message.sessionResumptionUpdate && message.sessionResumptionUpdate.handle) {
        this.sessionResumptionHandle = message.sessionResumptionUpdate.handle;
        logger.debug('GEMINI', `Session Resumption Handle actualizado: ${this.sessionResumptionHandle.substring(0, 16)}...`);
      }

      // 2. Server Content (Audio / Text / Interruption)
      if (message.serverContent) {
        const { modelTurn, interrupted, turnComplete } = message.serverContent;

        if (interrupted) {
          logger.info('GEMINI', 'Interrupción por el usuario (Barge-in confirmado por Gemini Live).');
          this.onInterrupted();
        }

        if (modelTurn && modelTurn.parts) {
          for (const part of modelTurn.parts) {
            // Audio output chunk (PCM 24kHz)
            if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
              this.onAudioChunk(part.inlineData.data);
            }

            // Model text transcript
            if (part.text) {
              this.onOutputTranscription(part.text);
              contextualEmotionOrchestrator.analyzeText(part.text);
            }
          }
        }

        if (turnComplete) {
          this.onTurnComplete();
        }
      }

      // 3. User Input Transcription (Speech-to-Text from Gemini)
      if (message.clientContent && message.clientContent.turns) {
        for (const turn of message.clientContent.turns) {
          if (turn.parts) {
            for (const part of turn.parts) {
              if (part.text) {
                this.onInputTranscription(part.text);
              }
            }
          }
        }
      }

      // 4. Tool Calls
      if (message.toolCall && message.toolCall.functionCalls) {
        logger.info('GEMINI', 'Llamada de herramientas recibida desde Gemini Live:', message.toolCall.functionCalls);
        this.onToolCall(message.toolCall.functionCalls);
      }
    } catch (err) {
      logger.error('GEMINI', 'Error al procesar mensaje del WebSocket de Gemini Live:', err);
    }
  }

  disconnect() {
    this.isExplicitDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.websocket) {
      this.websocket.close(1000, 'Desconexión solicitada por el usuario');
      this.websocket = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }
}
