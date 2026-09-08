/**
 * Cristi AI - Gemini Multimodal Live API Domain Module
 * 
 * Unified module exporting core components and high-level GeminiLiveSession facade:
 * - GeminiLiveClient: Bidirectional WebSocket S2S client with FSM & Session Resumption
 * - AudioInputProcessor: Web Audio + AudioWorklet 16kHz PCM capture with HPF & VAD
 * - AudioOutputPlayer: 24kHz PCM player with adaptive jitter buffer & Live2D FFT lip-sync
 * - VisionDispatcher: Screen/webcam single-frame buffer with backpressure & speech pause
 * - GeminiLiveSession: High-level unified facade orchestrating real-time audio, vision, and S2S interaction
 */

import { GeminiLiveClient, GeminiLiveClientOptions } from './GeminiLiveClient';
import { AudioInputProcessor, AudioInputProcessorOptions } from './AudioInputProcessor';
import { AudioOutputPlayer, AudioOutputPlayerOptions } from './AudioOutputPlayer';
import { VisionDispatcher, VisionDispatcherOptions } from './VisionDispatcher';

import type {
  GeminiLiveConfig,
  GeminiLiveConnectionState,
  GeminiLiveToolCall,
  GeminiLiveToolResponse,
  LipSyncMetrics,
  GeminiSessionConfig
} from '@/types';

export * from './GeminiLiveClient';
export * from './AudioInputProcessor';
export * from './AudioOutputPlayer';
export * from './VisionDispatcher';

export interface GeminiSessionTelemetry {
  connectionState: GeminiLiveConnectionState;
  input: ReturnType<AudioInputProcessor['getTelemetry']>;
  output: ReturnType<AudioOutputPlayer['getTelemetry']>;
  vision: ReturnType<VisionDispatcher['getTelemetry']>;
  resumptionHandle: string | null;
}

/**
 * High-level unified facade orchestrating full real-time Multimodal Live session:
 * audio capture -> WebSocket transmission -> output playback -> Live2D lip-sync -> vision backpressure
 */
export class GeminiLiveSession {
  private client: GeminiLiveClient;
  private audioInput: AudioInputProcessor;
  private audioOutput: AudioOutputPlayer;
  private visionDispatcher: VisionDispatcher;
  private isRunningState = false;

  constructor(config: GeminiSessionConfig) {
    // 1. Audio Output Player (24kHz PCM + Live2D FFT Analysis)
    this.audioOutput = new AudioOutputPlayer({
      sampleRate: 24000,
      jitterLeadTimeMs: 35,
      prebufferTargetMs: 35,
      onAudioStart: () => {
        this.visionDispatcher.setSpeaking(true);
      },
      onAudioEnd: () => {
        this.visionDispatcher.setSpeaking(false);
      },
      onLipSync: (metrics: LipSyncMetrics) => {
        config.onLipSync?.(metrics);
      },
      onVolumeChange: (vol: number) => {
        config.onOutputVolumeChange?.(vol);
      },
      onInterrupted: () => {
        config.onInterrupted?.();
      },
      onError: (err: Error) => {
        config.onError?.(err);
      }
    });

    // 2. Gemini Live WebSocket Client
    const clientOptions: GeminiLiveClientOptions = {
      ...config,
      onOpen: () => {
        config.onOpen?.();
      },
      onClose: (ev) => {
        config.onClose?.(ev);
      },
      onError: (err) => {
        config.onError?.(err);
      },
      onConnectionStateChange: (state: GeminiLiveConnectionState) => {
        config.onConnectionStateChange?.(state);
      },
      onAudioChunk: (pcm16: Int16Array) => {
        // Forward server audio chunk to output player
        this.audioOutput.playChunk(pcm16);
        config.onAudioChunk?.(pcm16);
      },
      onInterrupted: () => {
        // Instantaneous barge-in: clear audio buffers immediately in <50ms
        this.audioOutput.clearBuffers();
        this.visionDispatcher.setSpeaking(false);
        config.onInterrupted?.();
      },
      onInputTranscription: (text: string) => {
        config.onInputTranscription?.(text);
      },
      onOutputTranscription: (text: string) => {
        config.onOutputTranscription?.(text);
      },
      onTextPart: (text: string) => {
        config.onTextPart?.(text);
      },
      onTurnComplete: () => {
        config.onTurnComplete?.();
      },
      onToolCall: (calls: GeminiLiveToolCall[]) => {
        return config.onToolCall?.(calls);
      }
    };

    this.client = new GeminiLiveClient(clientOptions);

    // 3. Audio Input Processor (16kHz PCM capture + HPF + VAD)
    this.audioInput = new AudioInputProcessor({
      targetSampleRate: 16000,
      onAudioChunk: (pcm16: Int16Array) => {
        if (this.client.isConnected()) {
          this.client.sendAudioChunk(pcm16);
        }
      },
      onVolumeChange: (vol: number) => {
        config.onInputVolumeChange?.(vol);
      },
      onSpeechStateChange: (isSpeaking: boolean) => {
        config.onVADChange?.(isSpeaking);
      },
      onError: (err: Error) => {
        config.onError?.(err);
      }
    });

    // 4. Vision Dispatcher
    this.visionDispatcher = new VisionDispatcher({
      client: this.client,
      minIntervalMs: 1000
    });
  }

  // ---------------------------------------------------------------------------
  // Session Lifecycle
  // ---------------------------------------------------------------------------

  public async start(): Promise<void> {
    if (this.isRunningState) return;
    this.isRunningState = true;

    // Connect WebSocket
    this.client.connect();

    // Start microphone capture
    try {
      await this.audioInput.start();
    } catch (err) {
      // Microphone initialization failed, keep client alive for text/vision
      console.warn('[GeminiLiveSession] Microphone start error:', err);
    }

    // Warm up audio output context
    await this.audioOutput.resumeContext().catch(() => {});
  }

  public async stop(): Promise<void> {
    this.isRunningState = false;

    // Stop microphone
    this.audioInput.stop();

    // Clear and stop audio output
    this.audioOutput.clearBuffers();

    // Clear vision dispatcher
    this.visionDispatcher.clear();

    // Disconnect WebSocket
    this.client.disconnect();
  }

  public isRunning(): boolean {
    return this.isRunningState;
  }

  public getState(): GeminiLiveConnectionState {
    return this.client.getState();
  }

  // ---------------------------------------------------------------------------
  // Real-time Interactions
  // ---------------------------------------------------------------------------

  public sendTextMessage(text: string): boolean {
    return this.client.sendTextMessage(text);
  }

  public sendVisionFrame(
    base64Data: string,
    mimeType = 'image/jpeg',
    options?: { priority?: boolean }
  ): boolean {
    return this.visionDispatcher.enqueueFrame(base64Data, mimeType, options);
  }

  public sendToolResponse(responses: GeminiLiveToolResponse[]): void {
    this.client.sendToolResponse(responses);
  }

  // ---------------------------------------------------------------------------
  // Microphone & Speaker Controls
  // ---------------------------------------------------------------------------

  public muteMicrophone(): void {
    this.audioInput.mute();
  }

  public unmuteMicrophone(): void {
    this.audioInput.unmute();
  }

  public toggleMicrophone(): boolean {
    return this.audioInput.toggleMute();
  }

  public isMicrophoneMuted(): boolean {
    return this.audioInput.isMuted();
  }

  public setSpeakerVolume(volume: number): void {
    this.audioOutput.setVolume(volume);
  }

  // ---------------------------------------------------------------------------
  // Component Accessors & Telemetry
  // ---------------------------------------------------------------------------

  public getClient(): GeminiLiveClient {
    return this.client;
  }

  public getAudioInput(): AudioInputProcessor {
    return this.audioInput;
  }

  public getAudioOutput(): AudioOutputPlayer {
    return this.audioOutput;
  }

  public getVisionDispatcher(): VisionDispatcher {
    return this.visionDispatcher;
  }

  public getTelemetry(): GeminiSessionTelemetry {
    return {
      connectionState: this.client.getState(),
      input: this.audioInput.getTelemetry(),
      output: this.audioOutput.getTelemetry(),
      vision: this.visionDispatcher.getTelemetry(),
      resumptionHandle: this.client.getResumptionHandle()
    };
  }

  public destroy(): void {
    void this.stop();
    this.audioOutput.destroy();
    this.visionDispatcher.destroy();
  }
}
