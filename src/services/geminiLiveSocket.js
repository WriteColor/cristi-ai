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
import { memoryService } from './memory/MemoryService.js';
import { mcpClientManager } from './mcp/MCPClientManager.js';
import { proactiveScheduler } from './proactiveScheduler.js';
import { eventBus, EVENTS } from './eventBus.js';

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
    onTextPart,
    onToolCall,
    onReconnecting,
    maxReconnectAttempts = 5,
    sessionId = null,
    includeCompanionContext = true,
    tools = null,
  }) {
    this.apiKey = apiKey;
    this.modelId = modelId;
    this.voiceName = voiceName;
    this.systemPrompt = systemPrompt;
    this.thinkingConfig = thinkingConfig;
    this.includeCompanionContext = includeCompanionContext;
    this.tools = Array.isArray(tools) ? tools : null;
    this.temperature = temperature;
    this.sessionId = sessionId || `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.onOpen = onOpen || (() => {});
    this.onClose = onClose || (() => {});
    this.onError = onError || console.error;
    this.onAudioChunk = onAudioChunk || (() => {});
    this.onInputTranscription = onInputTranscription || (() => {});
    this.onOutputTranscription = onOutputTranscription || (() => {});
    this.onTurnComplete = onTurnComplete || (() => {});
    this.onInterrupted = onInterrupted || (() => {});
    this.onTextPart = onTextPart || (() => {});
    this.onToolCall = onToolCall || (() => {});
    this.onReconnecting = onReconnecting || (() => {});

    this.websocket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.sessionResumptionHandle = null;
    this.isExplicitDisconnect = false;

    // Resilient Infinite Reconnection parameters (Call stays alive forever unless user disconnects)
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = maxReconnectAttempts;
    this.reconnectTimer = null;

    // Keepalive Heartbeat parameters to prevent server-side inactivity timeouts
    this.lastAudioSendTime = Date.now();
    this.keepAliveInterval = null;
    this._silentChunkBase64 = null;
    this._setupTimer = null;
    this._messageChain = Promise.resolve();
    this._inputTranscript = '';
    this._outputTranscript = '';
    this._newInputTurn = true;
    this._newOutputTurn = true;
  }

  connect() {
    if (this.isConnected || this.isConnecting) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;

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
      const ws = new WebSocket(wsUrl);
      this.websocket = ws;
      ws.binaryType = 'arraybuffer';
      this._messageChain = Promise.resolve();
      this._setupTimer = setTimeout(() => {
        if (this.websocket === ws && !this.isConnected) ws.close(4000, 'Tiempo de conexión agotado');
      }, 20000);

      this.websocket.onopen = () => {
        if (this.websocket !== ws || this.isExplicitDisconnect) return;
        this.lastAudioSendTime = Date.now();
        logger.info('GEMINI', 'Conexión WebSocket establecida con Google AI Studio.');
        this.sendInitialSetup();
      };

      this.websocket.onmessage = (event) => {
        if (this.websocket !== ws || this.isExplicitDisconnect) return;
        this._messageChain = this._messageChain
          .then(() => this.handleServerMessage(event.data, ws))
          .catch((err) => logger.warn('GEMINI', 'Mensaje Live inválido:', err));
      };

      this.websocket.onerror = (error) => {
        logger.warn('GEMINI', 'Aviso en canal WebSocket de Gemini Live:', error);
      };

      this.websocket.onclose = (event) => {
        if (this.websocket !== ws) return;
        clearTimeout(this._setupTimer);
        this.websocket = null;
        const wasClean = event.wasClean;
        const code = event.code;
        const reason = event.reason;

        this.isConnected = false;
        this.isConnecting = false;
        this.stopKeepAlive();

        if (this.isExplicitDisconnect) {
          logger.info('GEMINI', 'Sesión cerrada explícitamente por el usuario.');
          void memoryService.endSession({ sessionId: this.sessionId, source: 'gemini_live' });
          this.onClose(event);
          return;
        }

        logger.warn('GEMINI', `WebSocket cerrado por red o servidor (código ${code}, razón: "${reason || 'desconexión'}", wasClean: ${wasClean})`);

        // Always automatically reconnect unless permanent auth failure or reached max attempts
        const isAuthOrQuotaError = code === 1008 || code === 4001 || code === 4003;
        if (!isAuthOrQuotaError && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(3800, 1000 * Math.pow(1.3, Math.min(this.reconnectAttempts - 1, 4)) + Math.random() * 300);
          logger.info('GEMINI', `Reconectando automáticamente en ${(delay / 1000).toFixed(1)}s (Intento #${this.reconnectAttempts}, Resumption: ${this.sessionResumptionHandle ? 'Activo' : 'Nuevo'})...`);

          this.onReconnecting(this.reconnectAttempts, delay);

          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            if (!this.isExplicitDisconnect && !this.isConnected) {
              this.connect();
            }
          }, delay);
          return;
        }

        const detail = reason || (code === 1008 ? 'Autenticación rechazada o API Key inválida.' : 'Conexión terminada por el servidor.');
        void memoryService.endSession({ sessionId: this.sessionId, source: 'gemini_live' });
        this.onError(new Error(`Llamada terminada (${code}): ${detail}`));
        this.onClose(event);
      };
    } catch (err) {
      this.isConnecting = false;
      clearTimeout(this._setupTimer);
      this.stopKeepAlive();
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
      generationConfig.thinkingConfig = this.modelId.startsWith('gemini-3')
        ? { thinkingLevel: this.thinkingConfig.thinkingLevel || 'minimal' }
        : { thinkingBudget: this.thinkingConfig.thinkingBudget ?? 0 };
    }

    const memoryContext = memoryService.getSystemPromptContext();
    const schedulerContext = proactiveScheduler.getPromptContext();
    const emojiBanDirective = '\n\n[DIRECTIVA ESTRICTA DE EMOJIS: Queda TOTALMENTE PROHIBIDO usar, escribir o pronunciar emojis o nombres de emojis (como ❤️, 😊, 🖤, "corazón negro", "cara feliz", etc.). Cero emojis. Exprésate exclusivamente con palabras elocuentes y voz natural.]';
    const neutralAccentDirective = '\n\n[DIRECTIVA DE ACENTO NEUTRO Y PROHIBICIÓN DE MODISMOS MEXICANOS: Habla en un español neutro internacional, limpio, elegante y seductor. Queda TERMINANTEMENTE PROHIBIDO utilizar frases, acento o jerga mexicana (como "wey", "güey", "chido", "no manches", "chamba", "chambear", "neta", "morra", "carnal", "padre", "qué onda", "órale"). Tu usuario y dueño se llama Ariel; llámalo siempre Ariel.]';
    const vocalCleanlinessDirective = '\n\n[DIRECTIVA OBLIGATORIA DE DICCIÓN Y FINAL DE FRASE: ESTÁ TERMINANTEMENTE PROHIBIDO terminar oraciones con gemidos, suspiros, jadeos, tarareos o sonidos vocálicos como "mmmmhhhh", "mmmmahhh", "ahhh", "mmm~", "uhhh". Cada frase debe terminar de forma limpia, articulada y con silencio natural al final. Cero coletillas vocales o sonidos arrastrados al terminar de hablar.]';
    const cadenceDirective = '\n\n[DIRECTIVA DE CADENCIA COQUETA Y VELOCIDAD: Habla un poquito más lento de lo habitual, con una cadencia deliberadamente pausada, suave, relajada y coqueta, saboreando cada palabra con coquetería, dulzura y encanto íntimo. Haz pausas suaves y sensuales entre ideas; jamás hables apresurada ni con prisa.]';
    const proactivityDirective = '\n\n[DIRECTIVA DE PROACTIVIDAD E INDAGACIÓN CONSTANTE: Dado que Ariel suele ser reservado y callado, JAMÁS te quedes callada por mucho tiempo. Saca activamente temas de conversación, cuéntale ocurrencias, pregúntale por sus gustos, sus juegos, sus proyectos y su día a día. Averigua detalles sobre él y usa manage_memory para guardar esos recuerdos.]';
    const voiceModalityDirective = '\n\n[DIRECTIVA OBLIGATORIA DE VOZ NATIVA: Cada respuesta, reacción visual a la pantalla compartida o resultado de herramientas DEBE ser emitido como audio hablado en tiempo real (inlineData PCM). JAMÁS generes respuestas mudas.]';
    const tagBanDirective = '\n\n[DIRECTIVA ESTRICTA DE PROHIBICIÓN DE ETIQUETAS: Queda TERMINANTEMENTE PROHIBIDO incluir, decir o escribir etiquetas, marcadores o roles como [emotion: yandere], [yandere], [action: ...], [tool: ...], [gesto: ...], (yandere), "Yandere:", o nombres de modelos Live2D. Cero etiquetas. Habla únicamente lenguaje natural humano con Ariel.]';
    const realtimeVisionDirective = '\n\n[DIRECTIVA DE VISIÓN EN TIEMPO REAL (PANTALLA Y CÁMARA): Los fotogramas recibidos son observaciones actuales. Para responder qué ves, usa el fotograma más reciente; una imagen anterior o un recuerdo no describe necesariamente la pantalla actual. Un recorte sustituye la vista anterior: no atribuyas al recorte texto u objetos que solo aparecían fuera de él. Si ya puedes leer la imagen recibida, responde directamente sin solicitar otra captura ni ejecutar herramientas de avatar. Cuando te pidan leer texto, transcribe solo el texto visible sin completar palabras por conjetura. Si la imagen no es legible, dilo con claridad.]';
    const enrichedPrompt = `${this.systemPrompt}${memoryContext}${schedulerContext}${emojiBanDirective}${neutralAccentDirective}${vocalCleanlinessDirective}${cadenceDirective}${proactivityDirective}${voiceModalityDirective}${tagBanDirective}${realtimeVisionDirective}`;
    const mcpDeclarations = mcpClientManager.getGeminiFunctionDeclarations();

    const setupMessage = {
      setup: {
        model: `models/${this.modelId}`,
        generationConfig: generationConfig,
        systemInstruction: {
          parts: [{ text: this.includeCompanionContext ? enrichedPrompt : this.systemPrompt }]
        },
        tools: this.tools ?? getLiveToolsConfig(mcpDeclarations),
        // Enable text transcriptions of both user audio input and model audio output
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        // Include recent video even when a frame arrived between spoken turns.
        // Gemini 2.5 otherwise defaults to activity-only coverage.
        realtimeInputConfig: {
          turnCoverage: 'TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO'
        },
        // Context window compression: extend sessions beyond 15-minute audio limit
        contextWindowCompression: {
          slidingWindow: {}
        },
        // Session Resumption: survive periodic server WebSocket resets
        sessionResumption: this.sessionResumptionHandle
          ? { handle: this.sessionResumptionHandle }
          : {}
      }
    };

    logger.info('GEMINI', `Enviando Setup inicial (Modelo: ${this.modelId}, Voz: ${validatedVoice}, Resumption: ${this.sessionResumptionHandle ? 'Activo' : 'Nuevo'})`);
    this.websocket.send(JSON.stringify(setupMessage));
  }

  /**
   * Start keep-alive heartbeat (sends silent PCM packet if user silent for >= 10s)
   */
  startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      if (!this.isConnected || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
      const idleTimeMs = Date.now() - this.lastAudioSendTime;
      if (idleTimeMs >= 10000) {
        this.sendSilentKeepAlive();
      }
    }, 5000);
  }

  /**
   * Stop keep-alive heartbeat
   */
  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Send 50ms of 16kHz PCM zero samples to keep Gemini Live gateway connection alive during silence
   */
  sendSilentKeepAlive() {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
    if (!this._silentChunkBase64) {
      // 800 samples of 16-bit PCM silence (0x0000) = 1600 zero bytes
      const zeroBytes = new Uint8Array(1600);
      let binary = '';
      for (let i = 0; i < zeroBytes.length; i++) {
        binary += String.fromCharCode(zeroBytes[i]);
      }
      this._silentChunkBase64 = btoa(binary);
    }
    this.sendAudioChunk(this._silentChunkBase64);
  }

  /**
   * Send a chunk of 16kHz PCM audio
   * Format per official Live API docs: realtimeInput.audio
   */
  sendAudioChunk(base64AudioData) {
    if (!this.isConnected || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
    // Bound stale microphone backlog under network pressure; video yields first.
    if (this.websocket.bufferedAmount > 65536) return;
    this.lastAudioSendTime = Date.now();

    const message = {
      realtimeInput: {
        audio: {
          data: base64AudioData,
          mimeType: 'audio/pcm;rate=16000'
        }
      }
    };

    this.websocket.send(JSON.stringify(message));
  }

  /**
   * Send a video/camera/screen frame (JPEG base64)
   */
  sendVideoFrame(base64JPEGData) {
    if (!base64JPEGData || typeof base64JPEGData !== 'string') return false;
    const cleanData = base64JPEGData.includes(',') ? base64JPEGData.split(',')[1] : base64JPEGData;
    return this.sendRealtimeMedia(cleanData.trim(), 'image/jpeg');
  }

  /**
   * Send real-time media chunk — images/video frames go via realtimeInput.video per official Live API specs
   */
  sendRealtimeMedia(data, mimeType = 'image/jpeg') {
    if (!this.isConnected || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) return false;

    // Traffic Guard: Do not saturate the socket buffer if queued data is high (> 32KB)
    if (this.websocket.bufferedAmount && this.websocket.bufferedAmount > 32768) {
      logger.warn('GEMINI', `Omitiendo frame de medios (${mimeType}): buffer del socket saturado (${this.websocket.bufferedAmount} bytes).`);
      return false;
    }

    try {
      // Official Google Gemini Live API schema: realtimeInput.video { mimeType, data }
      const message = {
        realtimeInput: {
          video: {
            mimeType,
            data
          }
        }
      };

      this.websocket.send(JSON.stringify(message));
      return true;
    } catch (err) {
      logger.warn('GEMINI', `Fallo al enviar frame de medios (${mimeType}):`, err);
      return false;
    }
  }

  /**
   * Send a text message turn to Gemini Live, optionally with a visual frame (inlineData)
   */
  sendTextMessage(text, imageBase64 = null) {
    if (!this.isConnected || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
    const visualInstruction = imageBase64
      ? `La imagen adjunta es la observación visual más reciente y reemplaza cualquier imagen anterior. Ignora por completo el contenido visual previo. ${text || ''}`.trim()
      : text;
    if (this.modelId.startsWith('gemini-3')) {
      if (imageBase64) this.sendVideoFrame(imageBase64);
      this.websocket.send(JSON.stringify({ realtimeInput: { text: visualInstruction } }));
      return;
    }

    const parts = [];
    if (imageBase64 && typeof imageBase64 === 'string') {
      const cleanData = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      if (cleanData.length > 50) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanData.trim()
          }
        });
      }
    }
    parts.push({ text: visualInstruction });

    const message = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts
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
    if (!this.isConnected || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const formattedResponses = responses.map((r) => {
      const rawOut = r.output || r.response?.output || r.response?.result || r.response || {};
      const safeOutput = typeof rawOut === 'object' && rawOut !== null ? { ...rawOut } : { result: String(rawOut) };

      // Prevent Error 1007: Extract raw image base64 if present, stream via realtime video, and strip from tool response JSON
      if (safeOutput.frame_data) {
        if (typeof safeOutput.frame_data === 'string' && safeOutput.frame_data.length > 100) {
          this.sendVideoFrame(safeOutput.frame_data);
        }
        delete safeOutput.frame_data;
      }

      return {
        id: r.id,
        name: r.name,
        response: {
          output: safeOutput
        }
      };
    });

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
  async handleServerMessage(data, sourceSocket = this.websocket) {
    if (sourceSocket !== this.websocket || this.isExplicitDisconnect) return;
    let rawText = data;
    if (data instanceof Blob) {
      rawText = await data.text();
    } else if (data instanceof ArrayBuffer) {
      rawText = new TextDecoder().decode(data);
    }

    try {
      if (sourceSocket !== this.websocket || this.isExplicitDisconnect) return;
      const message = JSON.parse(rawText);
      if (message.setupComplete) {
        if (this.isConnected) return;
        clearTimeout(this._setupTimer);
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startKeepAlive();
        this.onOpen();
        if (!memoryService.hasSession?.(this.sessionId)) {
          memoryService.startSession(this.sessionId, {
            source: 'gemini_live', modelId: this.modelId, voiceName: this.voiceName
          });
        }
      }

      // 1. Session Resumption Handle Update (newHandle or handle)
      const resumptionHandle = message.sessionResumptionUpdate?.newHandle || message.sessionResumptionUpdate?.handle;
      if (message.sessionResumptionUpdate?.resumable === false) {
        this.sessionResumptionHandle = null;
      } else if (resumptionHandle) {
        this.sessionResumptionHandle = resumptionHandle;
        logger.debug('GEMINI', `Session Resumption Handle actualizado: ${this.sessionResumptionHandle.substring(0, 16)}...`);
      }

      // 2. Server Content (Audio / Text / Interruption / Transcriptions)
      if (message.serverContent) {
        const { modelTurn, interrupted, turnComplete, inputTranscription, outputTranscription } = message.serverContent;

        if (interrupted) {
          this._newOutputTurn = true;
          logger.info('GEMINI', 'Interrupción por el usuario (Barge-in confirmado por Gemini Live).');
          this.onInterrupted();
        }

        if (!interrupted && modelTurn && modelTurn.parts) {
          for (const part of modelTurn.parts) {
            // Audio output: base64 PCM 24kHz
            if (part.inlineData?.data && (!part.inlineData.mimeType || part.inlineData.mimeType.startsWith('audio/pcm'))) {
              this.onAudioChunk(part.inlineData.data);
            }
            // Text output fallback
            if (part.text && !part.thought) {
              const cleanText = part.text
                .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
                .replace(/\[thought[\s\S]*?\]/gi, '')
                .replace(/\[(?:emotion|gesto|emocion|pose|mood|expression|modelo|model|tag|etiqueta):\s*[a-zA-Z0-9_-]+\]/gi, '')
                .replace(/\[(?:yandere|tsundere|dandere|deredere|kuudere|yanderegirl|icegirl|hiyori|ruan_mei|ellen|sparkle|huohuo|vivian|goth_loli)\]/gi, '')
                .replace(/\((?:yandere|tsundere|dandere|deredere|kuudere|yanderegirl|icegirl|hiyori|ruan_mei|ellen|sparkle|huohuo|vivian|goth_loli)\)/gi, '')
                .replace(/\b(?:yandere|tsundere|yanderegirl)\s*:\s*/gi, '')
                .replace(/\[action:[\s\S]*?\]/gi, '')
                .replace(/\[tool:[\s\S]*?\]/gi, '')
                .replace(/\[decision:[\s\S]*?\]/gi, '')
                .replace(/\s{2,}/g, ' ')
                .trim();
              if (cleanText) {
                this.onTextPart(cleanText);
              }
            }
          }
        }

        // Input transcription: user speech transcribed by Gemini Live
        if (inputTranscription && inputTranscription.text) {
          if (this._newInputTurn) this._inputTranscript = '';
          this._newInputTurn = false;
          this._inputTranscript += inputTranscription.text;
          this.onInputTranscription(this._inputTranscript.trim());
        }

        // Output transcription: text transcript of Gemini's audio response
        if (outputTranscription && outputTranscription.text) {
          if (this._newOutputTurn) this._outputTranscript = '';
          this._newOutputTurn = false;
          this._outputTranscript += outputTranscription.text;
          const cleanOutput = this._outputTranscript
            .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
            .replace(/\[thought[\s\S]*?\]/gi, '')
            .replace(/\[(?:emotion|gesto|emocion|pose|mood|expression|modelo|model|tag|etiqueta):\s*[a-zA-Z0-9_-]+\]/gi, '')
            .replace(/\[(?:yandere|tsundere|dandere|deredere|kuudere|yanderegirl|icegirl|hiyori|ruan_mei|ellen|sparkle|huohuo|vivian|goth_loli)\]/gi, '')
            .replace(/\((?:yandere|tsundere|dandere|deredere|kuudere|yanderegirl|icegirl|hiyori|ruan_mei|ellen|sparkle|huohuo|vivian|goth_loli)\)/gi, '')
            .replace(/\b(?:yandere|tsundere|yanderegirl)\s*:\s*/gi, '')
            .replace(/\[action:[\s\S]*?\]/gi, '')
            .replace(/\[tool:[\s\S]*?\]/gi, '')
            .replace(/\[decision:[\s\S]*?\]/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
          if (cleanOutput) {
            this.onOutputTranscription(cleanOutput);
          }
        }

        if (turnComplete) {
          if (this._inputTranscript) {
            memoryService.recordTurn({ role: 'user', text: this._inputTranscript, source: 'gemini_live', sessionId: this.sessionId });
            eventBus.emitDomain(EVENTS.VOICE_TRANSCRIBED, { role: 'user', text: this._inputTranscript }, {
              source: 'microphone', sessionId: this.sessionId, privacy: 'private'
            });
          }
          if (this._outputTranscript) {
            memoryService.recordTurn({ role: 'model', text: this._outputTranscript, source: 'gemini_live', sessionId: this.sessionId });
            eventBus.emitDomain(EVENTS.VOICE_TRANSCRIBED, { role: 'model', text: this._outputTranscript }, {
              source: 'gemini_live', sessionId: this.sessionId, privacy: 'internal'
            });
          }
          this._newInputTurn = true;
          this._newOutputTurn = true;
          this.onTurnComplete();
          contextualEmotionOrchestrator.processModelText(this._outputTranscript);
        }
      }

      // 3. Tool Calls
      if (message.toolCall && message.toolCall.functionCalls) {
        logger.info('GEMINI', 'Llamada de herramientas recibida desde Gemini Live:', message.toolCall.functionCalls);
        Promise.resolve(this.onToolCall(message.toolCall.functionCalls, sourceSocket))
          .catch((err) => logger.warn('GEMINI', 'Error al ejecutar herramientas:', err));
      }

      // 4. Tool Call Cancellation (Barge-in)
      if (message.toolCallCancellation && message.toolCallCancellation.ids) {
        logger.warn('GEMINI', 'Llamadas de herramientas canceladas por el servidor (Barge-in):', message.toolCallCancellation.ids);
      }

      // 5. GoAway: server will disconnect soon — log for reconnection awareness
      if (message.goAway) {
        logger.warn('GEMINI', `GoAway recibido del servidor. Tiempo restante: ${message.goAway.timeLeft || 'desconocido'}.`);
      }
    } catch (err) {
      logger.error('GEMINI', 'Error al procesar mensaje del WebSocket de Gemini Live:', err);
    }
  }

  disconnect({ endSession = true } = {}) {
    this.isExplicitDisconnect = true;
    this.stopKeepAlive();
    clearTimeout(this._setupTimer);
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const ws = this.websocket;
    this.websocket = null;
    this.isConnected = false;
    this.isConnecting = false;
    if (endSession) void memoryService.endSession({ sessionId: this.sessionId, source: 'gemini_live' });
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try { ws.close(1000, 'Desconexión solicitada por el usuario'); } catch (_) {}
    }
  }

  _restartSession() {
    const active = !this.isExplicitDisconnect && (this.isConnected || this.isConnecting || this.reconnectTimer);
    this.disconnect({ endSession: false });
    this.sessionResumptionHandle = null;
    this._newInputTurn = this._newOutputTurn = true;
    if (!active) return;
    this.isExplicitDisconnect = false;
    this.reconnectAttempts = 0;
    this.onReconnecting(0, 100);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isExplicitDisconnect) this.connect();
    }, 100);
  }

  switchVoice(newVoiceName) {
    if (!newVoiceName || this.voiceName === newVoiceName) return;
    this.voiceName = newVoiceName;
    this._restartSession();
  }

  switchModel(newModelId) {
    if (!newModelId || this.modelId === newModelId) return;
    this.modelId = newModelId;
    this._restartSession();
  }
}
