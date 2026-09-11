import { liveServerMessageSchema, type LiveClientOptions, type LiveToolResponse } from './protocol';
import type { LiveSessionPort } from '../../app/ports';
import { TranscriptAssembler } from '../transcription/TranscriptAssembler';
import { LiveSessionSupervisor } from './LiveSessionSupervisor';
import { AudioInputQueue } from './AudioInputQueue';
import { electronBridge } from '../../services/desktop/ElectronBridge';
/**
 * Cristi AI - Gemini Multimodal Live API WebSocket Client
 * Bi-directional real-time communication for audio, video, text, and tool calls.
 * Includes Session Resumption support, Exponential Backoff auto-reconnection,
 * and instantaneous Barge-in interruption handling.
 */

import { SYSTEM_PERSONA_PROMPT, DEFAULT_MODEL_ID, resolveLiveModelId } from '../../config/models.js';
import { getLiveToolsConfig } from '../../config/tools.js';
import { sanitizeVoiceForModel } from '../../config/voices.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { contextualEmotionOrchestrator } from '../live2d/ContextualEmotionOrchestrator.js';
import { memoryService } from '../integrations/memory/MemoryService.js';
import { mcpClientManager } from '../integrations/mcp/MCPClientManager.js';
import { proactiveScheduler } from '../interaction/ProactiveScheduler.js';
import { eventBus, EVENTS } from '../../infrastructure/events/eventBus.js';

export class GeminiLiveSocket implements LiveSessionPort {
  modelId: string;
  voiceName: string;
  systemPrompt: string;
  sessionId: string;
  _inputTranscript: string;
  _outputTranscript: string;
  temperature: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  responseWatchdogMs: number;
  _connectEpoch: number;
  inputInterim: boolean;
  _generationStarted: boolean;
  includeCompanionContext: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isExplicitDisconnect: boolean;
  awaitingTextResponse: boolean;
  _newInputTurn: boolean;
  _newOutputTurn: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  responseWatchdogTimer: ReturnType<typeof setTimeout> | undefined;
  _setupTimer: ReturnType<typeof setTimeout> | undefined;
  _goAwayTimer: ReturnType<typeof setTimeout> | undefined;
  _audioDrainTimer: ReturnType<typeof setTimeout> | undefined;
  websocket: WebSocket | null;
  sessionResumptionHandle: string | null;
  supervisor: LiveSessionSupervisor;
  inputQueue: AudioInputQueue;
  inputAssembler: TranscriptAssembler;
  outputAssembler: TranscriptAssembler;
  cancelledTools: Set<string>;
  completedTools: Set<string>;
  tools: unknown[] | null;
  thinkingConfig: LiveClientOptions['thinkingConfig'];
  tokenProvider: NonNullable<LiveClientOptions['tokenProvider']>;
  _messageChain: Promise<void>;
  onGenerationComplete: NonNullable<LiveClientOptions['onGenerationComplete']>;
  onGenerationStart: NonNullable<LiveClientOptions['onGenerationStart']>;
  onToolCallCancellation: NonNullable<LiveClientOptions['onToolCallCancellation']>;
  onOpen: NonNullable<LiveClientOptions['onOpen']>;
  onSetupComplete: NonNullable<LiveClientOptions['onSetupComplete']>;
  onClose: NonNullable<LiveClientOptions['onClose']>;
  onError: NonNullable<LiveClientOptions['onError']>;
  onAudioChunk: NonNullable<LiveClientOptions['onAudioChunk']>;
  onInputTranscription: NonNullable<LiveClientOptions['onInputTranscription']>;
  onOutputTranscription: NonNullable<LiveClientOptions['onOutputTranscription']>;
  onTurnComplete: NonNullable<LiveClientOptions['onTurnComplete']>;
  onInterrupted: NonNullable<LiveClientOptions['onInterrupted']>;
  onTextPart: NonNullable<LiveClientOptions['onTextPart']>;
  onToolCall: NonNullable<LiveClientOptions['onToolCall']>;
  onReconnecting: NonNullable<LiveClientOptions['onReconnecting']>;

  vadSilenceDurationMs: number;
  vadPrefixPaddingMs: number;
  lastUserAudioTimestamp: number;
  turnEndpointTimestamp: number;
  firstServerContentTimestamp: number;
  firstModelAudioChunkTimestamp: number;
  firstPlayoutTimestamp: number;
  hasRecordedTurnTurnaround: boolean;

  constructor({
    tokenProvider = (model) => electronBridge.requestLiveToken(model),
    onGenerationComplete = () => {},
    onGenerationStart = () => {},
    onToolCallCancellation = () => {},
    modelId = DEFAULT_MODEL_ID,
    voiceName = 'Aoede',
    systemPrompt = SYSTEM_PERSONA_PROMPT,
    thinkingConfig = null,
    temperature = 0.75,
    onOpen,
    onSetupComplete,
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
    responseWatchdogMs = 45000,
    sessionId = null,
    includeCompanionContext = true,
    tools = null,
    vadSilenceDurationMs = 600,
    vadPrefixPaddingMs = 20,
  }: LiveClientOptions = {}) {
    this.tokenProvider = tokenProvider;
    this.onGenerationComplete = onGenerationComplete;
    this.onGenerationStart = onGenerationStart;
    this.onToolCallCancellation = onToolCallCancellation;
    this.supervisor = new LiveSessionSupervisor(maxReconnectAttempts);
    this.inputQueue = new AudioInputQueue();
    this.inputAssembler = new TranscriptAssembler();
    this.outputAssembler = new TranscriptAssembler();
    this.inputInterim = false;
    this.cancelledTools = new Set();
    this.completedTools = new Set();
    this._generationStarted = false;
    this._connectEpoch = 0;
    this._audioDrainTimer = undefined;
    this._goAwayTimer = undefined;
    this.modelId = modelId;
    this.voiceName = voiceName;
    this.systemPrompt = systemPrompt;
    this.thinkingConfig = thinkingConfig;
    this.includeCompanionContext = includeCompanionContext;
    this.tools = Array.isArray(tools) ? tools : null;
    this.temperature = temperature;
    this.sessionId = sessionId || `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.vadSilenceDurationMs = vadSilenceDurationMs;
    this.vadPrefixPaddingMs = vadPrefixPaddingMs;
    this.lastUserAudioTimestamp = 0;
    this.turnEndpointTimestamp = 0;
    this.firstServerContentTimestamp = 0;
    this.firstModelAudioChunkTimestamp = 0;
    this.firstPlayoutTimestamp = 0;
    this.hasRecordedTurnTurnaround = false;

    this.onOpen = onOpen || (() => {});
    this.onSetupComplete = onSetupComplete || (() => {});
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

    // Bounded reconnect budget survives short-lived successful sockets.
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = maxReconnectAttempts;
    this.reconnectTimer = undefined;
    this.responseWatchdogMs = Math.max(1000, Number(responseWatchdogMs) || 45000);
    this.responseWatchdogTimer = undefined;
    this.awaitingTextResponse = false;
    this._setupTimer = undefined;
    this._messageChain = Promise.resolve();
    this._inputTranscript = '';
    this._outputTranscript = '';
    this._newInputTurn = true;
    this._newOutputTurn = true;
  }

  async connect() {
    if (this.isConnected || this.isConnecting) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;

    this.isConnecting = true;
    this.isExplicitDisconnect = false;
    logger.info('GEMINI', `Iniciando conexión WebSocket Live con modelo: ${this.modelId} (Intento #${this.reconnectAttempts + 1})...`);

    const epoch = ++this._connectEpoch;
    try {
      const activeModelId = resolveLiveModelId(this.modelId);
      const token = await this.tokenProvider(activeModelId);
      if (epoch !== this._connectEpoch || this.isExplicitDisconnect) return;
      const wsUrl = token.startsWith('auth_tokens/')
        ? 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?access_token=' + encodeURIComponent(token)
        : 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' + encodeURIComponent(token);
      const ws = new WebSocket(wsUrl);
      this.websocket = ws;
      ws.binaryType = 'arraybuffer';
      this._messageChain = Promise.resolve();
      this._setupTimer = setTimeout(() => {
        if (this.websocket === ws && !this.isConnected) ws.close(4000, 'Tiempo de conexión agotado');
      }, 20000);

      this.websocket.onopen = () => {
        if (this.websocket !== ws || this.isExplicitDisconnect) return;
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
        this.clearInputQueue();


        if (this.isExplicitDisconnect) {
          logger.info('GEMINI', 'Sesión cerrada explícitamente por el usuario.');
          void memoryService.endSession({ sessionId: this.sessionId, source: 'gemini_live' });
          this.onClose(event);
          return;
        }

        logger.warn('GEMINI', `WebSocket cerrado por red o servidor (código ${code}, razón: "${reason || 'desconexión'}", wasClean: ${wasClean})`);

        // Always automatically reconnect unless permanent auth failure or reached max attempts
        const nextDelay = this.supervisor.nextDelay(code, reason);
        if (nextDelay !== null) {
          this.reconnectAttempts++;
          const delay = nextDelay;
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

        const detail = reason || (code === 1008 ? 'Solicitud rechazada por política del proveedor.' : 'Conexión terminada por el servidor.');
        void memoryService.endSession({ sessionId: this.sessionId, source: 'gemini_live' });
        this.onError(new Error(`Llamada terminada (${code}): ${detail}`));
        this.onClose(event);
      };
    } catch (err) {
      this.isConnecting = false;
      clearTimeout(this._setupTimer);
      this.clearInputQueue();
      logger.warn('GEMINI', 'Fallo al instanciar WebSocket:', err);
      this.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Send the initial BidiGenerateContentSetup message with Session Resumption support
   */
  sendInitialSetup() {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const validatedVoice = sanitizeVoiceForModel(this.modelId, this.voiceName);

    const generationConfig: Record<string, unknown> = {
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
    const realtimeVisionDirective = '\n\n[DIRECTIVA DE VISIÓN EN TIEMPO REAL (PANTALLA Y CÁMARA): Los fotogramas recibidos son observaciones actuales. Para responder qué ves, usa el fotograma más reciente; una imagen anterior o un recuerdo no describe necesariamente la pantalla actual. Un recorte sustituye la vista anterior: no atribuyas al recorte texto u objetos que solo aparecían fuera de él. Si ya puedes leer la imagen recibida, responde directamente sin solicitar otra captura ni ejecutar herramientas de avatar. Cuando te pidan leer texto, transcribe solo el texto visible sin completar palabras por conjetura. Si la imagen no es legible, dilo con claridad.]';
    const enrichedPrompt = `${this.systemPrompt}${memoryContext}${schedulerContext}${realtimeVisionDirective}`;
    const mcpDeclarations = mcpClientManager.getGeminiFunctionDeclarations();

    const setupMessage = {
      setup: {
        model: `models/${resolveLiveModelId(this.modelId)}`,
        generationConfig: generationConfig,
        systemInstruction: {
          parts: [{ text: this.includeCompanionContext ? enrichedPrompt : this.systemPrompt }]
        },
        tools: this.tools ?? getLiveToolsConfig(mcpDeclarations),
        // Enable text transcriptions of both user audio input and model audio output
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        // Explicit Voice Activity Detection (VAD) and turn coverage.
        // Avoids relying on high server defaults (~800-1000ms) to ensure responsive turn-taking.
        realtimeInputConfig: {
          turnCoverage: 'TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO',
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
            endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
            prefixPaddingMs: this.vadPrefixPaddingMs,
            silenceDurationMs: this.vadSilenceDurationMs
          }
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

  clearInputQueue() {
    clearInterval(this._audioDrainTimer); this._audioDrainTimer = undefined;
    if (this.inputQueue.size) {
      this.inputQueue.clear(true);
      logger.warn('AUDIO', 'Audio pendiente descartado al cerrar stream', { audio_input_drop_ms: this.inputQueue.droppedMs });
    }
  }

  endAudioStream() {
    this.clearInputQueue();
    if (this.isConnected && this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    }
  }

  sendAudioChunk(data: ArrayBuffer | string) {
    if (!this.isConnected || this.websocket?.readyState !== WebSocket.OPEN) return false;
    this.lastUserAudioTimestamp = performance.now();
    const base64 = data instanceof ArrayBuffer
      ? btoa(String.fromCharCode(...new Uint8Array(data))) : data;
    if (!this.inputQueue.push(base64)) { this.recoverInputLoss(); return false; }
    this.drainInput();
    if (this.inputQueue.size && !this._audioDrainTimer) this._audioDrainTimer = setInterval(() => this.drainInput(), 10);
    return true;
  }

  drainInput() {
    const valid = this.inputQueue.drain(data => {
      if (!this.isConnected || this.websocket?.readyState !== WebSocket.OPEN || this.websocket.bufferedAmount > 8192) return false;
      this.websocket.send(JSON.stringify({ realtimeInput: { audio: { data, mimeType: 'audio/pcm;rate=16000' } } }));
      return true;
    });
    if (!valid) this.recoverInputLoss();
    if (!this.inputQueue.size) { clearInterval(this._audioDrainTimer); this._audioDrainTimer = undefined; }
  }

  recoverInputLoss() {
    logger.warn('AUDIO', 'Discontinuidad de entrada', { audio_input_drop_ms: this.inputQueue.droppedMs });
    this.endAudioStream();
    this.websocket?.close(4000, 'Audio input congestion');
  }


  /**
   * Send a video/camera/screen frame (JPEG base64)
   */
  sendVideoFrame(base64JPEGData: string) {
    if (!base64JPEGData || typeof base64JPEGData !== 'string') return false;
    const cleanData = base64JPEGData.includes(',') ? base64JPEGData.split(',')[1] : base64JPEGData;
    return this.sendRealtimeMedia(cleanData.trim(), 'image/jpeg');
  }

  /**
   * Send real-time media chunk — images/video frames go via realtimeInput.video per official Live API specs
   */
  sendRealtimeMedia(data: string, mimeType = 'image/jpeg') {
    if (!this.isConnected || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) return false;

    // Traffic Guard: Do not saturate the socket buffer if queued data is high (> 32KB)
    if (this.inputQueue.size > 0 || this.websocket.bufferedAmount > 4096) {
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
   * Send a text message turn to Gemini Live, optionally preceded by a visual frame
   */
  sendTextMessage(text: string, imageBase64: string | null = null) {
    if (!this.isConnected || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) return false;
    this.awaitingTextResponse = true;
    this.armResponseWatchdog();
    const visualInstruction = imageBase64
      ? `La imagen adjunta es la observación visual más reciente y reemplaza cualquier imagen anterior. Ignora por completo el contenido visual previo. ${text || ''}`.trim()
      : text;
    // Use one transport for every Live model. The realtime input stream keeps
    // video ordering consistent with the dispatcher and avoids the 2.5-only
    // inlineData clientContent path, which can stall when a frame is large or
    // the provider is under load.
    if (imageBase64) this.sendVideoFrame(imageBase64);
    this.websocket.send(JSON.stringify({
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: visualInstruction }]
          }
        ],
        turnComplete: true
      }
    }));
    return true;
  }

  armResponseWatchdog() {
    clearTimeout(this.responseWatchdogTimer);
    if (!this.awaitingTextResponse || !this.isConnected) return;
    this.responseWatchdogTimer = setTimeout(() => {
      this.responseWatchdogTimer = undefined;
      if (!this.awaitingTextResponse || !this.isConnected || this.isExplicitDisconnect) return;
      logger.warn('GEMINI', `El turno no produjo actividad durante ${this.responseWatchdogMs} ms; se reinicia la sesión para evitar una llamada congelada.`);
      this.awaitingTextResponse = false;
      this._restartSession({ preserveResumption: true });
    }, this.responseWatchdogMs);
    // Do not keep a Node-based diagnostic process alive solely for a browser
    // watchdog. Chromium timers do not expose unref(), so this is conditional.
    this.responseWatchdogTimer?.unref?.();
  }

  clearResponseWatchdog() {
    clearTimeout(this.responseWatchdogTimer);
    this.responseWatchdogTimer = undefined;
    this.awaitingTextResponse = false;
  }

  /**
   * Send tool response back to Gemini Live
   */
  sendToolResponse(responses: LiveToolResponse[]) {
    if (!this.isConnected || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const formattedResponses = responses.filter(r => !this.cancelledTools.has(r.id)).map((r) => {
      const rawOut = r.output || r.response?.output || r.response?.result || r.response || {};
      const safeOutput: Record<string, unknown> = typeof rawOut === 'object' && rawOut !== null ? { ...rawOut } : { result: String(rawOut) };

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
  async handleServerMessage(data: string | ArrayBuffer | Blob, sourceSocket = this.websocket) {
    if (!sourceSocket || sourceSocket !== this.websocket || this.isExplicitDisconnect) return;
    let rawText = data;
    if (data instanceof Blob) {
      rawText = await data.text();
    } else if (data instanceof ArrayBuffer) {
      rawText = new TextDecoder().decode(data);
    }

    try {
      if (sourceSocket !== this.websocket || this.isExplicitDisconnect) return;
      if (typeof rawText !== 'string' || rawText.length > 8_388_608) return;
      const message = liveServerMessageSchema.parse(JSON.parse(rawText));
      if (this.awaitingTextResponse && message.serverContent) this.armResponseWatchdog();
      if (message.setupComplete) {
        if (this.isConnected) return;
        clearTimeout(this._setupTimer);
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        this.onOpen();
        this.onSetupComplete();
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
        if (!this.firstServerContentTimestamp) {
          this.firstServerContentTimestamp = performance.now();
        }
        const { modelTurn, interrupted, turnComplete, generationComplete, interimInputTranscription, inputTranscription, outputTranscription } = message.serverContent;

        if (interrupted) {
          this._generationStarted = false;
          this.outputAssembler.begin();
          this._newOutputTurn = true;
          this.hasRecordedTurnTurnaround = false;
          this.firstServerContentTimestamp = 0;
          this.firstModelAudioChunkTimestamp = 0;
          this.firstPlayoutTimestamp = 0;
          logger.info('GEMINI', 'Interrupción por el usuario (Barge-in confirmado por Gemini Live).');
          this.onInterrupted();
        }

        if (!interrupted && modelTurn && modelTurn.parts) {
          if (!this._generationStarted) { this._generationStarted = true; this.onGenerationStart(); }
          for (const part of modelTurn.parts) {
            // Audio output: base64 PCM 24kHz
            if (part.inlineData?.data && (!part.inlineData.mimeType || part.inlineData.mimeType.startsWith('audio/pcm'))) {
              if (!this.firstModelAudioChunkTimestamp) {
                this.firstModelAudioChunkTimestamp = performance.now();
                if (!this.hasRecordedTurnTurnaround && this.lastUserAudioTimestamp > 0 && this.turnEndpointTimestamp > 0) {
                  this.hasRecordedTurnTurnaround = true;
                  const endpointLatency = Math.round(this.turnEndpointTimestamp - this.lastUserAudioTimestamp);
                  const modelLatency = Math.round(this.firstModelAudioChunkTimestamp - this.turnEndpointTimestamp);
                  const roundtripTimeToFirstAudio = Math.round(this.firstModelAudioChunkTimestamp - this.lastUserAudioTimestamp);
                  logger.info('LATENCY', `[Turnaround] Endpoint VAD: ${endpointLatency}ms | Model TTFT: ${modelLatency}ms | Roundtrip T3-T0: ${roundtripTimeToFirstAudio}ms`);
                }
              }
              const audioData = part.inlineData.data;
              this.onAudioChunk(audioData);
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

        if (interimInputTranscription?.text) {
          if (this._newInputTurn) this.inputAssembler.begin();
          this._newInputTurn = false;
          this.inputInterim = true;
          const snapshot = this.inputAssembler.update(interimInputTranscription.text, { mode: 'snapshot' });
          this._inputTranscript = snapshot.text;
          this.onInputTranscription(snapshot.text, snapshot);
        }
        if (inputTranscription?.text) {
          if (this._newInputTurn) this.inputAssembler.begin();
          this._newInputTurn = false;
          const isFinal = inputTranscription.finished === true;
          if (isFinal) {
            this.turnEndpointTimestamp = performance.now();
            this.firstServerContentTimestamp = 0;
            this.firstModelAudioChunkTimestamp = 0;
            this.firstPlayoutTimestamp = 0;
            this.hasRecordedTurnTurnaround = false;
          }
          const snapshot = this.inputAssembler.update(inputTranscription.text,
            { mode: this.inputInterim ? 'snapshot' : 'delta', isFinal });
          this.inputInterim = false;
          this._inputTranscript = snapshot.text;
          this.onInputTranscription(snapshot.text, snapshot);
        }
        if (outputTranscription?.text) {
          if (this._newOutputTurn) this.outputAssembler.begin();
          this._newOutputTurn = false;
          const snapshot = this.outputAssembler.update(outputTranscription.text, { isFinal: outputTranscription.finished === true });
          this._outputTranscript = snapshot.text;
          this.onOutputTranscription(snapshot.text, snapshot);
        }
        if (generationComplete) {
          this.onGenerationComplete();
          const final = this.outputAssembler.finalize();
          this.onOutputTranscription(final.text, final);
        }
        if (turnComplete) {
          this._generationStarted = false;
          const inputFinal = this.inputAssembler.finalize();
          const outputFinal = this.outputAssembler.finalize();
          this.onInputTranscription(inputFinal.text, inputFinal);
          this.onOutputTranscription(outputFinal.text, outputFinal);
          this.clearResponseWatchdog();
          if (this._inputTranscript) {
            memoryService.recordTurn({ role: 'user', text: this._inputTranscript, source: 'gemini_live', sessionId: this.sessionId });
            eventBus.emitDomain(EVENTS.VOICE_TRANSCRIBED, { role: 'user', text: this._inputTranscript }, {
              source: 'microphone', sessionId: this.sessionId, privacy: 'sensitive'
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
        Promise.resolve(this.onToolCall(message.toolCall.functionCalls.filter(call => { if (this.completedTools.has(call.id)) return false; this.completedTools.add(call.id); return true; }), sourceSocket))
          .catch((err) => logger.warn('GEMINI', 'Error al ejecutar herramientas:', err));
      }

      // 4. Tool Call Cancellation (Barge-in)
      if (message.toolCallCancellation && message.toolCallCancellation.ids) {
        for (const id of message.toolCallCancellation.ids) this.cancelledTools.add(id);
        this.onToolCallCancellation(message.toolCallCancellation.ids);
        logger.warn('GEMINI', 'Llamadas de herramientas canceladas por el servidor (Barge-in):', message.toolCallCancellation.ids);
      }

      // 5. GoAway: server will disconnect soon — log for reconnection awareness
      if (message.goAway) {
        clearTimeout(this._goAwayTimer);
        const remainingMs = Math.max(0, parseFloat(message.goAway.timeLeft || '0') * 1000);
        this._goAwayTimer = setTimeout(() => {
          if (this.websocket === sourceSocket && !this.isExplicitDisconnect) sourceSocket.close(4000, 'Session renewal');
        }, Math.max(0, remainingMs - 1000));
        logger.warn('GEMINI', `GoAway recibido del servidor. Tiempo restante: ${message.goAway.timeLeft || 'desconocido'}.`);
      }
    } catch (err) {
      logger.error('GEMINI', 'Error al procesar mensaje del WebSocket de Gemini Live:', err);
    }
  }

  disconnect({ endSession = true } = {}) {
    this._connectEpoch++;
    this.endAudioStream();
    clearTimeout(this._goAwayTimer);
    this.isExplicitDisconnect = true;
    this.clearResponseWatchdog();
    this.clearInputQueue();
    clearTimeout(this._setupTimer);
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    const ws = this.websocket;
    this.websocket = null;
    this.isConnected = false;
    this.isConnecting = false;
    if (endSession) void memoryService.endSession({ sessionId: this.sessionId, source: 'gemini_live' });
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try { ws.close(1000, 'Desconexión solicitada por el usuario'); } catch {}
    }
  }

  _restartSession({ preserveResumption = false } = {}) {
    const active = !this.isExplicitDisconnect && (this.isConnected || this.isConnecting || this.reconnectTimer);
    this.disconnect({ endSession: false });
    if (!preserveResumption) this.sessionResumptionHandle = null;
    this._newInputTurn = this._newOutputTurn = true;
    if (!active) return;
    this.isExplicitDisconnect = false;
    this.reconnectAttempts = 0;
    this.onReconnecting(0, 100);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (!this.isExplicitDisconnect) this.connect();
    }, 100);
  }

  switchVoice(newVoiceName: string) {
    if (!newVoiceName || this.voiceName === newVoiceName) return;
    this.voiceName = newVoiceName;
    this._restartSession();
  }

  switchModel(newModelId: string) {
    if (!newModelId || this.modelId === newModelId) return;
    this.modelId = newModelId;
    this._restartSession();
  }

  recordPlayoutTimestamp(now = performance.now()): void {
    if (!this.firstPlayoutTimestamp && this.firstModelAudioChunkTimestamp > 0) {
      this.firstPlayoutTimestamp = now;
      const clientPlayoutLatency = Math.round(this.firstPlayoutTimestamp - this.firstModelAudioChunkTimestamp);
      const totalTurnaround = this.lastUserAudioTimestamp > 0 ? Math.round(this.firstPlayoutTimestamp - this.lastUserAudioTimestamp) : 0;
      logger.info('LATENCY', `[Playout Start] Client Buffer Lead: ${clientPlayoutLatency}ms | Total User Turnaround: ${totalTurnaround}ms`);
    }
  }
}

