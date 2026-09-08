/**
 * Cristi AI - Audio DSP, Echo Shielding & WASAPI Loopback Subsystem
 * 
 * Clean exports and unified facade for the entire audio domain.
 */

import { AudioRoutingService, audioRoutingService } from './AudioRoutingService';
import { DesktopLoopbackService, desktopLoopbackService } from './DesktopLoopbackService';
import { VirtualAudioOutputService, virtualAudioOutputService } from './VirtualAudioOutputService';
import { TranslationService, translationService } from './TranslationService';
import { SoundFxService, soundFxService } from './SoundFxService';

import type {
  AudioFrameEnvelope,
  AudioRoute,
  AudioSourceMetadata,
  AudioSubsystemStatus,
  DesktopLoopbackOptions,
  DesktopLoopbackStatus,
  FeedbackShieldConfig,
  SoundFxConfig,
  SoundFxName,
  TranslationOptions,
  TranslationPipelineStatus,
  VirtualAudioOutputConfig,
  VirtualAudioOutputStatus
} from '@/types';

// Export all individual services & instances
export {
  AudioRoutingService,
  audioRoutingService,
  DesktopLoopbackService,
  desktopLoopbackService,
  VirtualAudioOutputService,
  virtualAudioOutputService,
  TranslationService,
  translationService,
  SoundFxService,
  soundFxService
};

// Re-export domain types
export type {
  AudioFrameEnvelope,
  AudioRoute,
  AudioSourceMetadata,
  AudioSubsystemStatus,
  DesktopLoopbackOptions,
  DesktopLoopbackStatus,
  FeedbackShieldConfig,
  SoundFxConfig,
  SoundFxName,
  TranslationOptions,
  TranslationPipelineStatus,
  VirtualAudioOutputConfig,
  VirtualAudioOutputStatus
};

/**
 * Unified Audio Domain Facade
 * 
 * Single cohesive entry point orchestrating DSP, echo shielding, WASAPI loopback,
 * virtual game voice retransmission, translation, and procedural sound FX.
 */
export class AudioDomainFacade {
  public readonly routing: AudioRoutingService;
  public readonly loopback: DesktopLoopbackService;
  public readonly virtualOutput: VirtualAudioOutputService;
  public readonly translation: TranslationService;
  public readonly soundFx: SoundFxService;

  private isInitialized = false;

  constructor(dependencies: {
    routing?: AudioRoutingService;
    loopback?: DesktopLoopbackService;
    virtualOutput?: VirtualAudioOutputService;
    translation?: TranslationService;
    soundFx?: SoundFxService;
  } = {}) {
    this.routing = dependencies.routing || audioRoutingService;
    this.loopback = dependencies.loopback || desktopLoopbackService;
    this.virtualOutput = dependencies.virtualOutput || virtualAudioOutputService;
    this.translation = dependencies.translation || translationService;
    this.soundFx = dependencies.soundFx || soundFxService;
  }

  /**
   * Initializes the audio subsystem and links pipelines.
   */
  public async init(config: {
    apiKey?: string;
    virtualDeviceId?: string;
    virtualDeviceLabel?: string;
    feedbackShield?: FeedbackShieldConfig;
    soundFxVolume?: number;
    targetLanguage?: string;
  } = {}): Promise<void> {
    if (this.isInitialized) return;

    if (config.feedbackShield) {
      this.routing.configureShield(config.feedbackShield);
    }

    if (config.apiKey) {
      this.translation.setApiKey(config.apiKey);
    }

    if (config.targetLanguage) {
      this.translation.setTargetLanguage(config.targetLanguage);
    }

    if (typeof config.soundFxVolume === 'number') {
      this.soundFx.setVolume(config.soundFxVolume);
    }

    if (config.virtualDeviceId) {
      await this.virtualOutput.configure({
        deviceId: config.virtualDeviceId,
        deviceLabel: config.virtualDeviceLabel
      });
    }

    // Attach loopback capture to translation pipeline
    this.translation.attachLoopback(this.loopback);

    this.isInitialized = true;
  }

  /**
   * Start desktop audio loopback (native WASAPI or Chromium fallback).
   */
  public async startDesktopLoopback(options?: DesktopLoopbackOptions) {
    return await this.loopback.start(options);
  }

  /**
   * Stop desktop audio loopback.
   */
  public async stopDesktopLoopback(reason?: string) {
    return await this.loopback.stop(reason);
  }

  /**
   * Configure virtual audio output device for game_voice.
   */
  public async configureVirtualOutput(deviceId?: string, deviceLabel?: string) {
    return await this.virtualOutput.configure({ deviceId, deviceLabel });
  }

  /**
   * Enumerate available output devices.
   */
  public async listOutputDevices() {
    return await this.virtualOutput.listOutputDevices();
  }

  /**
   * Translate message and speak directly into game voice channel without local echo.
   */
  public async translateAndSpeakInGame(
    text: string,
    targetLanguage = 'en',
    options?: { voiceName?: string; sourceId?: string }
  ) {
    return await this.translation.translateText({
      text,
      targetLanguage,
      outputRoute: 'game_voice',
      sourceId: options?.sourceId || 'game_voice_facade',
      voiceName: options?.voiceName
    });
  }

  /**
   * Play procedural sound effect.
   */
  public playSoundFx(name: SoundFxName, options?: { volume?: number }) {
    this.soundFx.play(name, options);
  }

  /**
   * Shield synthesized audio against microphone/loopback feedback.
   */
  public markGeneratedAudio(
    audioBuffer: Parameters<AudioRoutingService['markGenerated']>[0],
    options?: Parameters<AudioRoutingService['markGenerated']>[1]
  ) {
    return this.routing.markGenerated(audioBuffer, options);
  }

  /**
   * Get unified subsystem status and health metrics.
   */
  public getStatus(): AudioSubsystemStatus {
    const routingTele = this.routing.getTelemetry();
    const soundFxStatus = this.soundFx.getStatus();

    return {
      routing: {
        sourcesCount: routingTele.sourcesCount,
        routesCount: routingTele.routesCount,
        shieldedBuffersCount: routingTele.shieldedBuffersCount
      },
      loopback: this.loopback.getStatus(),
      virtualOutput: this.virtualOutput.getStatus(),
      translation: this.translation.getStatus(),
      soundFx: {
        enabled: soundFxStatus.enabled,
        volume: soundFxStatus.volume,
        contextState: soundFxStatus.contextState
      }
    };
  }

  /**
   * Graceful destruction of all audio components and cleanup of memory.
   */
  public async destroy(): Promise<void> {
    this.translation.destroy();
    this.loopback.destroy();
    await this.virtualOutput.destroy();
    this.soundFx.destroy();
    this.routing.destroy();
    this.isInitialized = false;
  }
}

export const audioDomain = new AudioDomainFacade();
export default audioDomain;
