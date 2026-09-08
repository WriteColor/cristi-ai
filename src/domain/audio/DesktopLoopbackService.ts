/**
 * Cristi AI - Desktop Loopback Service (WASAPI Native & Chromium Fallback)
 * 
 * Responsibilities:
 * - Controls the native Windows Core Audio WASAPI loopback capture helper (CristiWasapiLoopback.exe via IPC).
 * - Captures the default audio output render mix in structured PCM16 Little-Endian.
 * - Graceful fallback to Chromium `navigator.mediaDevices.getDisplayMedia` when the native helper is unavailable.
 * - Enforces speech protection to prevent Cristi's own local speech from feeding back into recognizers.
 * - Integrates with AudioRoutingService for strict source isolation and frame validation.
 * - Zero-leak memory lifecycle with automatic reconnection and exponential backoff.
 */

import { eventBus, EVENTS } from '@/services/eventBus.js';
import { electronBridge } from '@/services/desktop/ElectronBridge.js';
import { audioRoutingService } from './AudioRoutingService';
import type {
  AudioFrameEnvelope,
  DesktopLoopbackOptions,
  DesktopLoopbackStatus
} from '@/types';

const WORKLET_CODE = `
class CristiLoopbackWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSamples = Math.max(160, Math.round(sampleRate * 0.02)); // 20ms chunks
    this.buffer = new Float32Array(this.targetSamples);
    this.index = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (let i = 0; i < input.length; i++) {
      this.buffer[this.index++] = input[i];
      if (this.index >= this.targetSamples) {
        this.port.postMessage(this.buffer.slice(0));
        this.index = 0;
      }
    }
    return true;
  }
}
registerProcessor('cristi-loopback-worklet', CristiLoopbackWorkletProcessor);
`;

export class DesktopLoopbackService {
  private sourceId = 'system_loopback';
  private sessionId = 'session_default';
  private correlationId = '';
  private running = false;
  private nativeMode = false;
  private frameCount = 0;
  private sampleRate = 16000;
  private startedAt = 0;
  private lastError: string | null = null;
  private operationGeneration = 0;

  // Event handlers & subscriptions
  private frameHandlers: Set<(frame: AudioFrameEnvelope) => void> = new Set();
  private nativeFrameUnsubscribe: (() => void) | null = null;
  private nativeEventUnsubscribe: (() => void) | null = null;
  private audioStartUnsubscribe: (() => void) | null = null;
  private audioEndUnsubscribe: (() => void) | null = null;
  private speechProtected = false;

  // Browser getDisplayMedia fallback resources
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private mediaSourceNode: MediaStreamAudioSourceNode | null = null;
  private sinkGainNode: GainNode | null = null;

  // Reconnection & backoff
  private restartTimer: any = null;
  private restartAttempts = 0;
  private restartDesired = false;
  private currentOptions: DesktopLoopbackOptions = {};
  private startPromise: Promise<{ success: boolean; transport?: string; error?: string }> | null = null;

  constructor() {
    this.setupSpeechProtection();
  }

  /**
   * Register a subscriber for captured loopback frames.
   */
  public onFrame(handler: (frame: AudioFrameEnvelope) => void): () => void {
    this.frameHandlers.add(handler);
    return () => {
      this.frameHandlers.delete(handler);
    };
  }

  /**
   * Start desktop audio loopback capture.
   */
  public async start(options: DesktopLoopbackOptions = {}): Promise<{
    success: boolean;
    transport?: 'wasapi' | 'getDisplayMedia';
    sourceId?: string;
    error?: string;
  }> {
    if (this.running) {
      return {
        success: true,
        transport: this.nativeMode ? 'wasapi' : 'getDisplayMedia',
        sourceId: this.sourceId
      };
    }

    if (this.startPromise) {
      const res = await this.startPromise;
      return {
        ...res,
        transport: res.transport as 'wasapi' | 'getDisplayMedia' | undefined
      };
    }

    const pending = this.executeStart(options);
    this.startPromise = pending;
    try {
      return await pending;
    } finally {
      if (this.startPromise === pending) {
        this.startPromise = null;
      }
    }
  }

  private async executeStart(options: DesktopLoopbackOptions): Promise<{
    success: boolean;
    transport?: 'wasapi' | 'getDisplayMedia';
    sourceId?: string;
    error?: string;
  }> {
    this.currentOptions = {
      sourceId: options.sourceId || 'system_loopback',
      sessionId: options.sessionId || 'session_default',
      correlationId: options.correlationId || `loopback_${Date.now()}`,
      includeVideo: Boolean(options.includeVideo),
      preferNative: options.preferNative !== false,
      allowBrowserFallback: options.allowBrowserFallback !== false,
      autoRestart: options.autoRestart !== false,
      maxRestartAttempts: typeof options.maxRestartAttempts === 'number' ? options.maxRestartAttempts : 3,
      restartBaseDelayMs: typeof options.restartBaseDelayMs === 'number' ? options.restartBaseDelayMs : 750,
      restartMaxDelayMs: typeof options.restartMaxDelayMs === 'number' ? options.restartMaxDelayMs : 8000,
      sampleRate: options.sampleRate || 16000
    };

    this.sourceId = this.currentOptions.sourceId!;
    this.sessionId = this.currentOptions.sessionId!;
    this.correlationId = this.currentOptions.correlationId!;
    this.sampleRate = this.currentOptions.sampleRate || 16000;
    this.lastError = null;

    const generation = ++this.operationGeneration;
    this.cleanupNative();
    this.cleanupBrowser();

    // 1. Attempt Native Windows WASAPI Loopback via Electron IPC
    if (this.currentOptions.preferNative && !this.currentOptions.includeVideo && electronBridge.isElectron) {
      try {
        const nativeSuccess = await this.startNativeTransport(generation);
        if (nativeSuccess) {
          return {
            success: true,
            transport: 'wasapi',
            sourceId: this.sourceId
          };
        }
      } catch (err: any) {
        this.lastError = err?.message || String(err);
      }

      // If native failed and browser fallback is disabled, exit early
      if (!this.currentOptions.allowBrowserFallback) {
        return {
          success: false,
          error: this.lastError || 'Fallo al iniciar el capturador WASAPI nativo.'
        };
      }
    }

    // 2. Fallback to Chromium getDisplayMedia
    try {
      const browserSuccess = await this.startBrowserTransport(generation);
      if (browserSuccess) {
        return {
          success: true,
          transport: 'getDisplayMedia',
          sourceId: this.sourceId
        };
      }
    } catch (err: any) {
      this.lastError = err?.message || String(err);
    }

    return {
      success: false,
      error: this.lastError || 'No se pudo iniciar la captura de audio loopback en ningún transporte.'
    };
  }

  /**
   * Start native WASAPI helper via IPC.
   */
  private async startNativeTransport(generation: number): Promise<boolean> {
    this.nativeFrameUnsubscribe = electronBridge.onDesktopAudioFrame((frame: any) => {
      if (
        !this.running ||
        !this.nativeMode ||
        this.speechProtected ||
        generation !== this.operationGeneration ||
        !frame?.data
      ) {
        return;
      }

      const envelope = audioRoutingService.acceptFrame({
        frameId: frame.frameId,
        sourceId: frame.sourceId || this.sourceId,
        sessionId: this.sessionId,
        correlationId: this.correlationId,
        data: frame.data,
        sampleRate: Number(frame.sampleRate) || this.sampleRate,
        timestamp: frame.timestamp || Date.now()
      });

      if (envelope) {
        this.frameCount++;
        this.dispatchFrame(envelope);
      }
    });

    this.nativeEventUnsubscribe = electronBridge.onDesktopAudioEvent((event: any) => {
      if (generation !== this.operationGeneration || event?.sourceId !== this.sourceId) return;
      if (event?.type === 'error' || event?.type === 'stopped') {
        this.handleNativeFailure(event, generation);
      }
    });

    const result = await electronBridge.startDesktopAudioCapture({ sourceId: this.sourceId });
    if (generation !== this.operationGeneration) {
      this.cleanupNative();
      return false;
    }

    if (result && result.success) {
      this.nativeMode = true;
      this.running = true;
      this.startedAt = Date.now();
      this.restartAttempts = 0;
      this.restartDesired = Boolean(this.currentOptions.autoRestart);

      audioRoutingService.registerSource({
        sourceId: this.sourceId,
        name: 'WASAPI Default Output Loopback',
        type: 'loopback',
        sampleRate: this.sampleRate
      });

      eventBus.emitDomain('audio.loopback_started', {
        sourceId: this.sourceId,
        transport: 'wasapi'
      }, {
        source: this.sourceId,
        sessionId: this.sessionId,
        correlationId: this.correlationId,
        privacy: 'local'
      });

      return true;
    }

    this.cleanupNative();
    this.lastError = result?.error || 'WASAPI capture helper reportó error.';
    return false;
  }

  /**
   * Start Chromium getDisplayMedia loopback capture.
   */
  private async startBrowserTransport(generation: number): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('getDisplayMedia no está disponible en este entorno.');
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true, // Required by Chromium to trigger capture dialog
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    if (generation !== this.operationGeneration) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }

    this.mediaStream = stream;
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks || audioTracks.length === 0) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('La fuente de pantalla seleccionada no transmitió canal de audio.');
    }

    // Stop video track if video not requested
    if (!this.currentOptions.includeVideo) {
      stream.getVideoTracks().forEach((track) => track.stop());
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass({
      sampleRate: this.sampleRate,
      latencyHint: 'interactive'
    });

    // Create Worklet blob
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    try {
      await this.audioContext.audioWorklet.addModule(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    const audioTrack = audioTracks[0];
    const singleAudioStream = new MediaStream([audioTrack]);
    this.mediaSourceNode = this.audioContext.createMediaStreamSource(singleAudioStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'cristi-loopback-worklet');

    this.workletNode.port.onmessage = (event: MessageEvent) => {
      if (
        !this.running ||
        this.speechProtected ||
        generation !== this.operationGeneration ||
        !(event.data instanceof Float32Array)
      ) {
        return;
      }

      const pcm16 = this.float32ToPcm16(event.data);
      const base64Data = this.pcm16ToBase64(pcm16);
      const frameId = `loopback_chrom_${Date.now()}_${this.frameCount++}`;

      const envelope = audioRoutingService.acceptFrame({
        frameId,
        sourceId: this.sourceId,
        sessionId: this.sessionId,
        correlationId: this.correlationId,
        data: base64Data,
        sampleRate: this.sampleRate,
        timestamp: Date.now()
      });

      if (envelope) {
        this.dispatchFrame(envelope);
      }
    };

    // Sink gain to keep node alive without producing sound locally
    this.sinkGainNode = this.audioContext.createGain();
    this.sinkGainNode.gain.value = 0;

    this.mediaSourceNode.connect(this.workletNode);
    this.workletNode.connect(this.sinkGainNode);
    this.sinkGainNode.connect(this.audioContext.destination);

    await this.audioContext.resume();

    // Listen for track ending
    audioTrack.onended = () => {
      if (generation === this.operationGeneration && this.running) {
        this.stop('audio_track_ended');
      }
    };

    this.running = true;
    this.nativeMode = false;
    this.startedAt = Date.now();
    this.restartDesired = false; // Do not auto-restart browser dialog without user prompt

    audioRoutingService.registerSource({
      sourceId: this.sourceId,
      name: 'Chromium DisplayMedia Loopback',
      type: 'loopback',
      sampleRate: this.sampleRate
    });

    eventBus.emitDomain('audio.loopback_started', {
      sourceId: this.sourceId,
      transport: 'getDisplayMedia'
    }, {
      source: this.sourceId,
      sessionId: this.sessionId,
      correlationId: this.correlationId,
      privacy: 'local'
    });

    return true;
  }

  /**
   * Stop loopback audio capture.
   */
  public async stop(reason = 'stopped_by_user'): Promise<boolean> {
    this.restartDesired = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (!this.running && !this.nativeMode && !this.mediaStream) {
      return true;
    }

    this.running = false;
    this.operationGeneration++;

    if (this.nativeMode) {
      try {
        await electronBridge.stopDesktopAudioCapture();
      } catch (_) {}
    }

    this.cleanupNative();
    this.cleanupBrowser();

    eventBus.emitDomain('audio.loopback_stopped', {
      sourceId: this.sourceId,
      reason
    }, {
      source: this.sourceId,
      sessionId: this.sessionId,
      correlationId: this.correlationId,
      privacy: 'local'
    });

    return true;
  }

  /**
   * Get current loopback capture status and telemetry.
   */
  public getStatus(): DesktopLoopbackStatus {
    return {
      running: this.running,
      transport: this.running ? (this.nativeMode ? 'wasapi' : 'getDisplayMedia') : null,
      sourceId: this.running ? this.sourceId : null,
      frameCount: this.frameCount,
      sampleRate: this.sampleRate,
      uptimeMs: this.running ? Math.max(0, Date.now() - this.startedAt) : 0,
      lastError: this.lastError
    };
  }

  /**
   * Speech protection to suppress loopback when Cristi is speaking over local speakers.
   */
  private setupSpeechProtection(): void {
    this.audioStartUnsubscribe = eventBus.on(EVENTS.AUDIO_START, () => {
      this.speechProtected = true;
    }) as () => void;

    this.audioEndUnsubscribe = eventBus.on(EVENTS.AUDIO_END, () => {
      this.speechProtected = false;
    }) as () => void;
  }

  private handleNativeFailure(event: any, generation: number): void {
    if (generation !== this.operationGeneration) return;
    this.cleanupNative();
    this.running = false;
    this.nativeMode = false;
    this.lastError = event?.error || 'WASAPI helper desconectado inesperadamente.';

    eventBus.emitDomain('audio.loopback_error', {
      sourceId: this.sourceId,
      error: this.lastError
    }, {
      source: this.sourceId,
      sessionId: this.sessionId,
      correlationId: this.correlationId,
      privacy: 'local'
    });

    // Auto-reconnect with exponential backoff if desired
    if (this.restartDesired && this.restartAttempts < (this.currentOptions.maxRestartAttempts || 3)) {
      this.restartAttempts++;
      const baseDelay = this.currentOptions.restartBaseDelayMs || 750;
      const maxDelay = this.currentOptions.restartMaxDelayMs || 8000;
      const delay = Math.min(maxDelay, baseDelay * Math.pow(1.5, this.restartAttempts - 1));

      this.restartTimer = setTimeout(() => {
        if (this.restartDesired && !this.running) {
          this.executeStart({ ...this.currentOptions });
        }
      }, delay);
    }
  }

  private dispatchFrame(envelope: AudioFrameEnvelope): void {
    for (const handler of this.frameHandlers) {
      try {
        handler(envelope);
      } catch (err) {
        console.error('[DesktopLoopbackService] Error in frame subscriber:', err);
      }
    }
  }

  private float32ToPcm16(floatSamples: Float32Array): Int16Array {
    const pcm = new Int16Array(floatSamples.length);
    for (let i = 0; i < floatSamples.length; i++) {
      const s = Math.max(-1, Math.min(1, floatSamples[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm;
  }

  private pcm16ToBase64(pcm: Int16Array): string {
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    let binary = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
    }
    return typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  }

  private cleanupNative(): void {
    if (this.nativeFrameUnsubscribe) {
      this.nativeFrameUnsubscribe();
      this.nativeFrameUnsubscribe = null;
    }
    if (this.nativeEventUnsubscribe) {
      this.nativeEventUnsubscribe();
      this.nativeEventUnsubscribe = null;
    }
  }

  private cleanupBrowser(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.workletNode) {
      try {
        this.workletNode.port.onmessage = null;
        this.workletNode.disconnect();
      } catch (_) {}
      this.workletNode = null;
    }
    if (this.mediaSourceNode) {
      try {
        this.mediaSourceNode.disconnect();
      } catch (_) {}
      this.mediaSourceNode = null;
    }
    if (this.sinkGainNode) {
      try {
        this.sinkGainNode.disconnect();
      } catch (_) {}
      this.sinkGainNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (_) {}
      this.audioContext = null;
    }
  }

  /**
   * Complete teardown of all resources.
   */
  public destroy(): void {
    this.stop('destroyed');
    if (this.audioStartUnsubscribe) {
      this.audioStartUnsubscribe();
      this.audioStartUnsubscribe = null;
    }
    if (this.audioEndUnsubscribe) {
      this.audioEndUnsubscribe();
      this.audioEndUnsubscribe = null;
    }
    this.frameHandlers.clear();
  }
}

export const desktopLoopbackService = new DesktopLoopbackService();
export default desktopLoopbackService;
