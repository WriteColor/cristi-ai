/**
 * Cristi AI - Sensory Perception & Vision Subsystem
 * Unified entry point and high-level Orchestrator Facade integrating:
 * 1. ScreenCaptureEngine - 60 FPS desktop capture with precision region cropping & JPEG/WebP encoding.
 * 2. LocalVisionService - Local browser edge detection (COCO-SSD, Face-API landmarks, biometrics & pose).
 * 3. VoiceBiometrics - Log-Mel filterbank acoustic fingerprinting and authorized speaker verification.
 */

import { ScreenCaptureEngine } from './ScreenCaptureEngine';
import { LocalVisionService } from './LocalVisionService';
import { VoiceBiometrics } from './VoiceBiometrics';

import type {
  ScreenRegion,
  ScreenImageFormat,
  ScreenCaptureOptions,
  CapturedFrame,
  VisionBoundingBox,
  DetectedObjectInfo,
  FaceExpressions,
  FaceLandmarkPoint,
  FaceDetectionInfo,
  PoseKeypointInfo,
  PoseEstimationResult,
  HumanPresenceVerification,
  LocalVisionAnalysisResult,
  LogMelConfig,
  VoiceprintSample,
  VoiceBiometricsProfile,
  VoiceVerificationResult,
  SensorySubsystemConfig,
  SensoryStatus,
  MultimodalSensorySnapshot
} from '@/types';

// Export all underlying engines
export { ScreenCaptureEngine, LocalVisionService, VoiceBiometrics };

// Re-export sensory domain types
export type {
  ScreenRegion,
  ScreenImageFormat,
  ScreenCaptureOptions,
  CapturedFrame,
  VisionBoundingBox,
  DetectedObjectInfo,
  FaceExpressions,
  FaceLandmarkPoint,
  FaceDetectionInfo,
  PoseKeypointInfo,
  PoseEstimationResult,
  HumanPresenceVerification,
  LocalVisionAnalysisResult,
  LogMelConfig,
  VoiceprintSample,
  VoiceBiometricsProfile,
  VoiceVerificationResult,
  SensorySubsystemConfig,
  SensoryStatus,
  MultimodalSensorySnapshot
};

export type SensoryEventType =
  | 'frame'
  | 'vision'
  | 'presence'
  | 'voice'
  | 'distraction'
  | 'error';

export class SensorySubsystemFacade {
  public readonly screenCapture: ScreenCaptureEngine;
  public readonly localVision: LocalVisionService;
  public readonly voiceBiometrics: VoiceBiometrics;

  private isInitialized: boolean = false;
  private isScreenCapturing: boolean = false;
  private isVisionActive: boolean = false;
  private isVoiceActive: boolean = false;

  private lastCapturedFrame: CapturedFrame | null = null;
  private lastVisionResult: LocalVisionAnalysisResult | null = null;
  private lastVoiceResult: VoiceVerificationResult | null = null;
  private lastPresence: HumanPresenceVerification | null = null;

  private videoElementGetter: (() => HTMLVideoElement | null) | HTMLVideoElement | null = null;
  private voiceStreamUnsubscribe: (() => void) | null = null;

  // Event dispatchers
  private readonly eventListeners: Map<SensoryEventType, Set<(payload: any) => void>> = new Map([
    ['frame', new Set()],
    ['vision', new Set()],
    ['presence', new Set()],
    ['voice', new Set()],
    ['distraction', new Set()],
    ['error', new Set()]
  ]);

  constructor(config: SensorySubsystemConfig = {}) {
    this.screenCapture = new ScreenCaptureEngine(config.screen);
    this.localVision = new LocalVisionService(config.vision);
    this.voiceBiometrics = new VoiceBiometrics(config.voice);

    this.bindEngineEvents();
  }

  /**
   * Subscribes to child engine events and bridges them to unified facade listeners.
   */
  private bindEngineEvents(): void {
    this.screenCapture.onFrame((frame) => {
      this.lastCapturedFrame = frame;
      this.emit('frame', frame);
    });

    this.screenCapture.onError((err) => {
      this.emit('error', err);
    });

    this.localVision.onAnalysis((result) => {
      this.lastVisionResult = result;
      this.lastPresence = result.presence;
      this.emit('vision', result);
    });

    this.localVision.onPresenceChange((presence) => {
      this.lastPresence = presence;
      this.emit('presence', presence);
    });

    this.localVision.onDistraction((alert) => {
      this.emit('distraction', alert);
    });

    this.localVision.onError((err) => {
      this.emit('error', err);
    });
  }

  /**
   * Initializes local AI models and dependencies.
   */
  public async initialize(config?: SensorySubsystemConfig): Promise<void> {
    if (this.isInitialized) return;

    if (config?.screen) {
      this.screenCapture.updateConfig(config.screen);
    }

    // Pre-load vision weights into WebGL
    await this.localVision.initialize();
    this.isInitialized = true;
  }

  /**
   * Starts all sensory sub-engines simultaneously.
   */
  public async startAll(
    videoSource?: HTMLVideoElement | (() => HTMLVideoElement | null),
    config?: SensorySubsystemConfig
  ): Promise<void> {
    await this.initialize(config);

    // 1. Start Screen Capture
    await this.startScreenCapture(config?.screen);

    // 2. Start Vision if video element provided
    if (videoSource) {
      await this.startVision(videoSource, config?.vision?.fps);
    }
  }

  /**
   * Stops all running perception sub-engines.
   */
  public stopAll(): void {
    this.stopScreenCapture();
    this.stopVision();
    this.stopVoiceMonitoring();
  }

  // --- Screen Capture Control ---

  public async startScreenCapture(options?: ScreenCaptureOptions): Promise<void> {
    this.isScreenCapturing = true;
    await this.screenCapture.start(options);
  }

  public stopScreenCapture(): void {
    this.isScreenCapturing = false;
    this.screenCapture.stop();
  }

  public async captureSingleScreenFrame(region?: ScreenRegion | null): Promise<CapturedFrame | null> {
    const frame = await this.screenCapture.captureFrame(region);
    if (frame) {
      this.lastCapturedFrame = frame;
    }
    return frame;
  }

  public setScreenRegion(region: ScreenRegion | null): void {
    this.screenCapture.setRegion(region);
  }

  public clearScreenRegion(): void {
    this.screenCapture.clearRegion();
  }

  public getScreenRegion(): ScreenRegion | null {
    return this.screenCapture.getRegion();
  }

  public setScreenTargetFps(fps: number): void {
    this.screenCapture.setTargetFps(fps);
  }

  // --- Local Vision Control ---

  public async startVision(
    videoSource: HTMLVideoElement | (() => HTMLVideoElement | null),
    fps?: number
  ): Promise<void> {
    this.videoElementGetter = videoSource;
    this.isVisionActive = true;
    await this.localVision.start(videoSource, fps);
  }

  public stopVision(): void {
    this.isVisionActive = false;
    this.localVision.stop();
  }

  public async processSingleVisionFrame(
    source?: HTMLVideoElement | HTMLCanvasElement | ImageData
  ): Promise<LocalVisionAnalysisResult | null> {
    const targetSource = source ?? (typeof this.videoElementGetter === 'function' ? this.videoElementGetter() : this.videoElementGetter);
    if (!targetSource) return null;

    const result = await this.localVision.processFrame(targetSource);
    this.lastVisionResult = result;
    this.lastPresence = result.presence;
    return result;
  }

  // --- Voice Biometrics Control ---

  /**
   * Connects a PCM Float32Array audio stream source to real-time speaker verification.
   */
  public startVoiceMonitoring(
    audioStreamSubscriber?: (callback: (pcmChunk: Float32Array) => void) => () => void
  ): void {
    this.stopVoiceMonitoring();
    this.isVoiceActive = true;

    if (audioStreamSubscriber) {
      this.voiceStreamUnsubscribe = audioStreamSubscriber((pcmChunk) => {
        if (!this.isVoiceActive) return;
        const result = this.verifyVoiceChunk(pcmChunk);
        this.emit('voice', result);
      });
    }
  }

  public stopVoiceMonitoring(): void {
    this.isVoiceActive = false;
    if (this.voiceStreamUnsubscribe) {
      this.voiceStreamUnsubscribe();
      this.voiceStreamUnsubscribe = null;
    }
  }

  /**
   * Verifies an audio PCM Float32Array chunk against authorized speaker profile.
   */
  public verifyVoiceChunk(pcmSamples: Float32Array): VoiceVerificationResult {
    const result = this.voiceBiometrics.verifySpeaker(pcmSamples);
    this.lastVoiceResult = result;
    return result;
  }

  // --- Multimodal Synchronized Snapshot ---

  /**
   * Simultaneously acquires a desktop frame, camera analysis, and voice authentication status.
   */
  public async captureMultimodalSnapshot(): Promise<MultimodalSensorySnapshot> {
    const timestamp = Date.now();

    // Parallel execution for lowest possible latency
    const screenPromise = this.captureSingleScreenFrame();
    const visionPromise = this.processSingleVisionFrame();

    const [screenFrame, visionAnalysis] = await Promise.all([
      screenPromise,
      visionPromise
    ]);

    return {
      timestamp,
      screenFrame,
      visionAnalysis,
      voiceVerification: this.lastVoiceResult,
      presenceSummary: visionAnalysis?.presence ?? this.lastPresence
    };
  }

  // --- State & Status Accessors ---

  public getStatus(): SensoryStatus {
    const screenStatus = this.screenCapture.getStatus();

    return {
      screenActive: this.isScreenCapturing,
      visionActive: this.isVisionActive,
      voiceActive: this.isVoiceActive,
      screenFpsActual: screenStatus.currentFps,
      visionFpsActual: 10,
      isUserPresent: Boolean(this.lastPresence?.isHumanPresent),
      isUserAuthorized: Boolean(this.lastPresence?.isAuthorizedOwner),
      isVoiceVerified: Boolean(this.lastVoiceResult?.isAuthorizedUser),
      lastCaptureTime: this.lastCapturedFrame?.timestamp ?? null,
      lastVisionTime: this.lastVisionResult?.timestamp ?? null,
      lastVoiceTime: this.lastVoiceResult?.timestamp ?? null
    };
  }

  public isUserPresent(): boolean {
    return Boolean(this.lastPresence?.isHumanPresent);
  }

  public isAuthorizedOwnerPresent(): boolean {
    return Boolean(this.lastPresence?.isAuthorizedOwner);
  }

  public getLastVisionSummary(): string {
    return this.lastVisionResult?.summary ?? 'Sin análisis de visión reciente.';
  }

  public getLastCapturedFrame(): CapturedFrame | null {
    return this.lastCapturedFrame;
  }

  // --- Event Handling ---

  public on(event: SensoryEventType, listener: (payload: any) => void): () => void {
    const set = this.eventListeners.get(event);
    if (set) {
      set.add(listener);
    }
    return () => this.off(event, listener);
  }

  public off(event: SensoryEventType, listener: (payload: any) => void): void {
    const set = this.eventListeners.get(event);
    if (set) {
      set.delete(listener);
    }
  }

  private emit(event: SensoryEventType, payload: any): void {
    const set = this.eventListeners.get(event);
    if (set) {
      for (const listener of set) {
        try {
          listener(payload);
        } catch (err) {
          console.error(`[SensorySubsystemFacade] Error in '${event}' listener:`, err);
        }
      }
    }
  }

  public dispose(): void {
    this.stopAll();
    this.screenCapture.dispose();
    this.localVision.dispose();
    for (const set of this.eventListeners.values()) {
      set.clear();
    }
  }
}

// Default singleton instance
export const sensorySubsystem = new SensorySubsystemFacade();
export default sensorySubsystem;
