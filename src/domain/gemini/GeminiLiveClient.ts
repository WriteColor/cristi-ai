/**
 * Cristi AI - Gemini Multimodal Live API Client (Bidirectional WebSocket S2S)
 * 
 * Provides real-time speech-to-speech, vision media streaming, and tool execution
 * over WebSocket with:
 * - Deterministic Finite State Machine (FSM): DISCONNECTED, CONNECTING, READY, TRANSMITTING, RECONNECTING, ERROR
 * - Session Resumption tokens & exponential backoff auto-reconnection
 * - Real-time PCM audio streaming (16kHz in / 24kHz out)
 * - Visual frames streaming with backpressure
 * - Instantaneous Barge-In (<50ms buffer flush notification)
 * - Bidirectional tool invocation and execution lifecycle
 */

import type {
  GeminiLiveConfig,
  GeminiLiveConnectionState,
  GeminiLiveToolCall,
  GeminiLiveToolResponse,
  GeminiFunctionDeclaration
} from '@/types';

export interface GeminiLiveClientOptions extends GeminiLiveConfig {
  apiVersion?: 'v1alpha' | 'v1beta';
  maxReconnectAttempts?: number;
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  keepAliveIntervalMs?: number;
}

export class GeminiLiveClient {
  private config: GeminiLiveConfig;
  private state: GeminiLiveConnectionState = 'DISCONNECTED';
  private websocket: WebSocket | null = null;
  private resumptionHandle: string | null = null;
  private apiVersion: 'v1alpha' | 'v1beta';
  private maxReconnectAttempts: number;
  private initialReconnectDelayMs: number;
  private maxReconnectDelayMs: number;
  private keepAliveIntervalMs: number;

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private transmitIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private setupTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private lastAudioSendTime = 0;
  private isExplicitDisconnect = false;
  private silentChunkBase64: string | null = null;

  constructor(options: GeminiLiveClientOptions) {
    this.config = options;
    this.apiVersion = options.apiVersion || 'v1beta';
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 8;
    this.initialReconnectDelayMs = options.initialReconnectDelayMs ?? 1000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 12000;
    this.keepAliveIntervalMs = options.keepAliveIntervalMs ?? 5000;

    if (options.sessionResumptionHandle) {
      this.resumptionHandle = options.sessionResumptionHandle;
    }
  }

  // ---------------------------------------------------------------------------
  // State Machine Management
  // ---------------------------------------------------------------------------

  public getState(): GeminiLiveConnectionState {
    return this.state;
  }

  public isConnected(): boolean {
    return this.state === 'READY' || this.state === 'TRANSMITTING';
  }

  public getResumptionHandle(): string | null {
    return this.resumptionHandle;
  }

  public getBufferedAmount(): number {
    return this.websocket?.bufferedAmount ?? 0;
  }

  private setState(newState: GeminiLiveConnectionState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.config.onConnectionStateChange?.(newState);
  }

  // ---------------------------------------------------------------------------
  // Connection Lifecycle
  // ---------------------------------------------------------------------------

  public connect(): void {
    if (this.state === 'CONNECTING' || this.state === 'READY' || this.state === 'TRANSMITTING') {
      return;
    }

    if (!this.config.apiKey || !this.config.apiKey.trim()) {
      const err = new Error('Gemini API key is required to establish Live connection');
      this.setState('ERROR');
      this.config.onError?.(err);
      return;
    }

    this.clearReconnectTimer();
    this.isExplicitDisconnect = false;
    this.setState(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

    const trimmedKey = this.config.apiKey.trim();
    const endpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${this.apiVersion}.GenerativeService.BidiGenerateContent?key=${trimmedKey}`;

    try {
      const ws = new WebSocket(endpoint);
      this.websocket = ws;
      ws.binaryType = 'arraybuffer';

      // Watchdog for initial setup handshake
      this.setupTimeoutTimer = setTimeout(() => {
        if (this.websocket === ws && this.state === 'CONNECTING') {
          ws.close(4008, 'Connection handshake timeout');
        }
      }, 15000);

      ws.onopen = () => {
        if (this.websocket !== ws || this.isExplicitDisconnect) return;
        this.lastAudioSendTime = Date.now();
        this.sendInitialSetup();
      };

      ws.onmessage = (event: MessageEvent) => {
        if (this.websocket !== ws || this.isExplicitDisconnect) return;
        void this.handleIncomingMessage(event.data);
      };

      ws.onerror = (error: Event) => {
        if (this.websocket !== ws) return;
        this.config.onError?.(error);
      };

      ws.onclose = (event: CloseEvent) => {
        if (this.websocket !== ws) return;
        this.handleSocketClose(event);
      };
    } catch (error) {
      this.setState('ERROR');
      this.config.onError?.(error);
    }
  }

  public disconnect(reason = 'Client disconnected'): void {
    this.isExplicitDisconnect = true;
    this.clearReconnectTimer();
    this.clearKeepAlive();
    this.clearSetupTimeout();

    const ws = this.websocket;
    this.websocket = null;
    this.setState('DISCONNECTED');

    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close(1000, reason);
      } catch (_) {
        // Ignored
      }
    }
  }

  private handleSocketClose(event: CloseEvent): void {
    this.clearSetupTimeout();
    this.clearKeepAlive();
    this.websocket = null;

    if (this.isExplicitDisconnect) {
      this.setState('DISCONNECTED');
      this.config.onClose?.(event);
      return;
    }

    // Determine if automatic reconnection is viable
    // Codes 1008 (policy violation/bad auth) or 4001/4003 are non-recoverable without new credentials
    const isPermanentAuthError = event.code === 1008 || event.code === 4001 || event.code === 4003;

    if (!isPermanentAuthError && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const jitter = Math.random() * 300;
      const exponentialDelay = this.initialReconnectDelayMs * Math.pow(1.5, Math.min(this.reconnectAttempts - 1, 5));
      const delay = Math.min(this.maxReconnectDelayMs, exponentialDelay + jitter);

      this.setState('RECONNECTING');

      this.reconnectTimer = setTimeout(() => {
        if (!this.isExplicitDisconnect && this.state === 'RECONNECTING') {
          this.connect();
        }
      }, delay);
      return;
    }

    this.setState('ERROR');
    this.config.onClose?.(event);
  }

  // ---------------------------------------------------------------------------
  // Protocol Transmission
  // ---------------------------------------------------------------------------

  private sendInitialSetup(): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const modelId = this.config.modelId || 'gemini-2.0-flash-exp';
    const voiceName = this.config.voiceName || 'Aoede';
    const systemPrompt = this.config.systemPrompt || '';

    // Format tools declaration
    let formattedTools: any[] | undefined = undefined;
    if (this.config.tools && this.config.tools.length > 0) {
      const isAlreadyWrapped = this.config.tools.some((t: any) => 'functionDeclarations' in t);
      formattedTools = isAlreadyWrapped
        ? this.config.tools
        : [{ functionDeclarations: this.config.tools }];
    }

    const setupPayload = {
      setup: {
        model: modelId.startsWith('models/') ? modelId : `models/${modelId}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName
              }
            }
          },
          temperature: this.config.temperature ?? 0.7
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        tools: formattedTools,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        contextWindowCompression: {
          slidingWindow: {}
        },
        sessionResumption: this.resumptionHandle ? { handle: this.resumptionHandle } : {}
      }
    };

    this.websocket.send(JSON.stringify(setupPayload));
  }

  /**
   * Send a chunk of 16kHz mono 16-bit PCM audio (realtimeInput.mediaChunks)
   */
  public sendAudioChunk(pcmData: Int16Array | ArrayBuffer | string): boolean {
    if (!this.isConnected() || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return false;
    }

    // Network backpressure protection (>64KB buffered in socket)
    if (this.websocket.bufferedAmount > 65536) {
      return false;
    }

    let base64Data: string;
    if (typeof pcmData === 'string') {
      base64Data = pcmData;
    } else if (pcmData instanceof Int16Array) {
      base64Data = int16ArrayToBase64(pcmData);
    } else {
      base64Data = arrayBufferToBase64(pcmData);
    }

    this.lastAudioSendTime = Date.now();
    this.markTransmitting();

    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Data
          }
        ]
      }
    };

    try {
      this.websocket.send(JSON.stringify(message));
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Send visual frames (screen capture or webcam) with backpressure protection
   */
  public sendRealtimeMedia(base64Data: string, mimeType = 'image/jpeg'): boolean {
    if (!this.isConnected() || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return false;
    }

    // Traffic Guard: Do not saturate WebSocket buffer if queued data exceeds 32KB
    if (this.websocket.bufferedAmount > 32768) {
      return false;
    }

    const cleanData = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType,
            data: cleanData.trim()
          }
        ]
      }
    };

    try {
      this.websocket.send(JSON.stringify(message));
      return true;
    } catch (_) {
      return false;
    }
  }

  public sendVideoFrame(base64JPEG: string): boolean {
    return this.sendRealtimeMedia(base64JPEG, 'image/jpeg');
  }

  /**
   * Send a user text message turn
   */
  public sendTextMessage(text: string): boolean {
    if (!this.isConnected() || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.markTransmitting();
    const message = {
      realtimeInput: {
        text: text.trim()
      }
    };

    try {
      this.websocket.send(JSON.stringify(message));
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Send tool execution responses back to the server
   */
  public sendToolResponse(responses: GeminiLiveToolResponse[]): void {
    if (!this.isConnected() || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const functionResponses = responses.map((r) => {
      const output = r.response?.output ?? r.response?.result ?? r.response;
      return {
        id: r.id,
        name: r.name,
        response: {
          output: typeof output === 'object' && output !== null ? output : { result: output }
        }
      };
    });

    const payload = {
      toolResponse: {
        functionResponses
      }
    };

    try {
      this.websocket.send(JSON.stringify(payload));
    } catch (_) {
      // Ignored
    }
  }

  // ---------------------------------------------------------------------------
  // Inbound Message Dispatching
  // ---------------------------------------------------------------------------

  private async handleIncomingMessage(data: any): Promise<void> {
    let rawText = '';
    if (typeof data === 'string') {
      rawText = data;
    } else if (data instanceof Blob) {
      rawText = await data.text();
    } else if (data instanceof ArrayBuffer) {
      rawText = new TextDecoder().decode(data);
    }

    try {
      const message = JSON.parse(rawText);

      // 1. Setup Complete
      if (message.setupComplete) {
        this.clearSetupTimeout();
        this.reconnectAttempts = 0;
        this.setState('READY');
        this.startKeepAlive();
        this.config.onOpen?.();
        return;
      }

      // 2. Session Resumption Token
      const resumptionUpdate = message.sessionResumptionUpdate;
      if (resumptionUpdate) {
        if (resumptionUpdate.resumable === false) {
          this.resumptionHandle = null;
        } else if (resumptionUpdate.newHandle || resumptionUpdate.handle) {
          this.resumptionHandle = resumptionUpdate.newHandle || resumptionUpdate.handle;
        }
      }

      // 3. Server Content (Audio / Text / Interruption / Transcriptions)
      if (message.serverContent) {
        const { modelTurn, interrupted, turnComplete, inputTranscription, outputTranscription } = message.serverContent;

        // Instantaneous Barge-In Handling (<50ms buffer flush)
        if (interrupted) {
          this.setState('READY');
          this.config.onInterrupted?.();
        }

        // Output Audio Chunks & Text
        if (!interrupted && modelTurn?.parts) {
          for (const part of modelTurn.parts) {
            // Server output audio: 24kHz 16-bit Little-Endian PCM base64
            if (part.inlineData?.data) {
              const audioBase64 = part.inlineData.data;
              const pcm16 = base64ToInt16Array(audioBase64);
              this.config.onAudioChunk?.(pcm16);
            }

            if (part.text && !part.thought) {
              this.config.onTextPart?.(part.text);
            }
          }
        }

        // Live Transcriptions
        if (inputTranscription?.text) {
          this.config.onInputTranscription?.(inputTranscription.text);
        }

        if (outputTranscription?.text) {
          this.config.onOutputTranscription?.(outputTranscription.text);
        }

        // Turn Completion
        if (turnComplete) {
          this.setState('READY');
          this.config.onTurnComplete?.();
        }
      }

      // 4. Function / Tool Calls
      if (message.toolCall?.functionCalls) {
        const calls: GeminiLiveToolCall[] = message.toolCall.functionCalls.map((fc: any) => ({
          id: fc.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: fc.name,
          args: fc.args || {}
        }));

        if (this.config.onToolCall) {
          const resultPromise = this.config.onToolCall(calls);
          if (resultPromise && typeof resultPromise.then === 'function') {
            resultPromise.then((responses) => {
              if (Array.isArray(responses) && responses.length > 0) {
                this.sendToolResponse(responses);
              }
            }).catch((err) => {
              this.config.onError?.(err);
            });
          }
        }
      }
    } catch (err) {
      this.config.onError?.(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Keep-Alive and Timers
  // ---------------------------------------------------------------------------

  private markTransmitting(): void {
    if (this.state === 'READY') {
      this.setState('TRANSMITTING');
    }

    if (this.transmitIdleTimer) {
      clearTimeout(this.transmitIdleTimer);
    }

    this.transmitIdleTimer = setTimeout(() => {
      if (this.state === 'TRANSMITTING') {
        this.setState('READY');
      }
    }, 400);
  }

  private startKeepAlive(): void {
    this.clearKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (!this.isConnected() || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
        return;
      }

      const idleDuration = Date.now() - this.lastAudioSendTime;
      // Send 50ms of silent PCM if silence exceeds 10 seconds
      if (idleDuration >= 10000) {
        this.sendSilentKeepAlive();
      }
    }, this.keepAliveIntervalMs);
  }

  private sendSilentKeepAlive(): void {
    if (!this.silentChunkBase64) {
      // 800 samples of 16-bit zero PCM (1600 bytes) = 50ms @ 16kHz
      const zeros = new Uint8Array(1600);
      let binary = '';
      for (let i = 0; i < zeros.length; i++) {
        binary += String.fromCharCode(zeros[i]);
      }
      this.silentChunkBase64 = btoa(binary);
    }

    this.sendAudioChunk(this.silentChunkBase64);
  }

  private clearKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearSetupTimeout(): void {
    if (this.setupTimeoutTimer) {
      clearTimeout(this.setupTimeoutTimer);
      this.setupTimeoutTimer = null;
    }
  }

  public updateConfig(partial: Partial<GeminiLiveConfig>): void {
    this.config = { ...this.config, ...partial };
  }
}

// -----------------------------------------------------------------------------
// High-Performance Binary <-> Base64 Utilities
// -----------------------------------------------------------------------------

function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
}

function int16ArrayToBase64(pcm16: Int16Array): string {
  const uint8 = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  let binary = '';
  const chunkSize = 8192;
  const len = uint8.length;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = uint8.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  const len = uint8.length;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = uint8.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}
