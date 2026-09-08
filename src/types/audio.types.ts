/**
 * Domain types for Audio DSP Subsystem, Echo Shielding & WASAPI Loopback.
 */

export interface AudioFrameEnvelope {
  frameId: string;
  sourceId: string;
  sessionId: string;
  correlationId: string;
  data: string; // Base64-encoded PCM16 Little-Endian
  sampleRate: number;
  channels?: number;
  timestamp: number;
  isGenerated?: boolean;
  fingerprint?: string;
  durationMs?: number;
  energy?: number;
}

export interface AudioSourceMetadata {
  sourceId: string;
  name?: string;
  type?: 'microphone' | 'loopback' | 'virtual' | 'generated' | 'soundfx' | 'system' | 'custom';
  registeredAt: number;
  sampleRate?: number;
  channels?: number;
}

export interface AudioRoute {
  sourceId: string;
  targetId: string;
  enabled: boolean;
  purpose?: 'analysis' | 'translation' | 'game_voice' | 'output' | string;
}

export interface FeedbackShieldConfig {
  maxTrackedSignatures?: number;
  retentionWindowMs?: number;
  energyThreshold?: number;
  similarityThreshold?: number;
  enabled?: boolean;
}

export interface DesktopLoopbackOptions {
  sourceId?: string;
  sessionId?: string;
  correlationId?: string;
  includeVideo?: boolean;
  preferNative?: boolean;
  allowBrowserFallback?: boolean;
  autoRestart?: boolean;
  maxRestartAttempts?: number;
  restartBaseDelayMs?: number;
  restartMaxDelayMs?: number;
  sampleRate?: number;
}

export interface DesktopLoopbackStatus {
  running: boolean;
  transport: 'wasapi' | 'getDisplayMedia' | null;
  sourceId: string | null;
  frameCount: number;
  sampleRate: number;
  uptimeMs: number;
  lastError: string | null;
}

export interface VirtualAudioOutputConfig {
  deviceId?: string;
  deviceLabel?: string;
  maxQueueMs?: number;
}

export interface VirtualAudioOutputStatus {
  configured: boolean;
  supported: boolean;
  deviceId: string | null;
  deviceLabel: string | null;
  activeSources: number;
  queuedMs: number;
  played: number;
  dropped: number;
  failures: number;
  lastError: string | null;
}

export interface TranslationOptions {
  sourceLanguage?: string;
  targetLanguage?: string;
  outputRoute?: 'game_voice' | 'local';
  sessionId?: string;
  correlationId?: string;
  relevanceGate?: boolean;
  voiceName?: string;
}

export interface TranslationMetrics {
  framesProcessed: number;
  translationsCompleted: number;
  transcriptionsCompleted: number;
  droppedFrames: number;
  lastLatencyMs: number;
  lastError: string | null;
}

export interface TranslationPipelineStatus {
  enabled: boolean;
  sourceAttached: boolean;
  sourceId: string | null;
  targetLanguage: string;
  outputRoute: 'game_voice' | 'local';
  metrics: TranslationMetrics;
}

export type SoundFxName =
  | 'click'
  | 'alert'
  | 'open'
  | 'confirm'
  | 'menu_open'
  | 'connect'
  | 'disconnect'
  | 'mute'
  | 'snapshot'
  | 'notification'
  | 'error';

export interface SoundFxConfig {
  enabled?: boolean;
  volume?: number;
}

export interface AudioSubsystemStatus {
  routing: {
    sourcesCount: number;
    routesCount: number;
    shieldedBuffersCount: number;
  };
  loopback: DesktopLoopbackStatus;
  virtualOutput: VirtualAudioOutputStatus;
  translation: TranslationPipelineStatus;
  soundFx: {
    enabled: boolean;
    volume: number;
    contextState: string | null;
  };
}
