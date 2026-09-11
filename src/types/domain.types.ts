/**
 * Domain types and event envelopes for Cristi AI Companion.
 */

export type CompanionViewMode = 'transparent' | 'windowed' | 'pip';

export interface Position2D {
  x: number;
  y: number;
}

import type { ScreenRegion } from './sensory.types';

export interface VisionDetection {
  id?: string;
  class?: string;
  label?: string;
  score?: number;
  bbox?: [number, number, number, number];
  box?: ScreenRegion;
  timestamp?: number;
  [key: string]: unknown;
}

export interface SessionLog {
  id: string;
  tag: string;
  message: string;
  timestamp: number;
}

export interface TelemetryMetrics {
  fps: number;
  tps: number;
  p99: number;
  v8HeapMB: number;
  processRssMB: number;
}

export interface Widget {
  id: string;
  title: string;
  content: string;
  type: string;
  createdAt: number;
  time?: string;
  tag?: string;
  done?: boolean;
  duration?: number;
  description?: string;
  icon?: string;
  badge?: string;
  progress?: number;
}

export interface Alarm {
  id: string;
  time: string;
  label: string;
  title?: string;
  action?: string | null;
  executed?: boolean;
  approachingAlerted?: boolean;
  createdAt: number;
  enabled?: boolean;
}

export interface DomainEventEnvelope<T = unknown> {
  type: string;
  source: string;
  sessionId?: string | null;
  correlationId?: string;
  priority?: number | string; // 0 = normal, 1 = priority, 2 = emergency, or 'normal' | 'high' | 'emergency'
  privacy?: 'local' | 'shared' | 'sensitive' | 'internal' | 'external';
  payload: T;
  timestamp?: number;
}

export interface AppConfig {
  hasGeminiCredential?: boolean;
  hasDiscordCredential?: boolean;
  hasSpotifyCredential?: boolean;
  apiKey: string;
  modelId: string;
  voiceName: string;
  systemPrompt: string;
  temperature: number;
  alwaysOnTop: boolean;
  viewMode: CompanionViewMode;
  activeModelId: string;
  avatarScale: number;
  avatarPosition: Position2D;
  microphoneDeviceId: string;
  speakerDeviceId: string;
  ttsVoice: string;
  visionEnabled: boolean;
  screenWatchIntervalMs: number;
  autoReconnect: boolean;
  breathingRoomCooldownMs: number;
  soundFxEnabled: boolean;
  soundFxVolume: number;
  voiceVolume?: number;
  ttsFallbackVoice?: string;
  ttsFallbackEnabled?: boolean;
  spotifyClientId?: string;
  spotifyClientSecret?: string;
  live2dModelId?: string;
  externalTranslationEnabled?: boolean;
  translationSourceLanguage?: string;
  translationTargetLanguage?: string;
  translationAggregateMs?: number;
  translationGameAudioDeviceId?: string;
  translationGameAudioDeviceLabel?: string;
  wasapiLoopbackEnabled?: boolean;
  discord?: Partial<DiscordConfig> | Record<string, any>;
  updatedAt?: string;
}

export interface Live2DModelConfig {
  id: string;
  name: string;
  path: string;
  scale: number;
  initialScale?: number;
  defaultPosition?: Position2D;
  expressions?: Record<string, string>;
  motions?: Record<string, string[]>;
  description?: string;
  tags?: string[];
}

// ── Memory Domain Types ──────────────────────────────────────────────────────
export type MemoryCategory = 'fact' | 'preference' | 'relationship' | 'task' | 'minecraft' | 'general' | 'conversation';

export interface MemoryItem {
  id: string;
  key?: string;
  category: MemoryCategory;
  content: string;
  confidence: number;
  source: string;
  createdAt: number;
  updatedAt: number;
  sessionId?: string | null;
  supersededBy?: string | null;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MemorySearchResult {
  id: string;
  memory: MemoryItem;
  score: number;
}

export interface MemorySearchOptions {
  limit?: number;
  minScore?: number;
  category?: MemoryCategory;
  includeInactive?: boolean;
}

export interface ContradictionResolution {
  detected: boolean;
  strategy: 'replace' | 'supersede' | 'keep_both' | 'none';
  priorMemoryId?: string | null;
  supersededMemoryId?: string | null;
  explanation?: string;
}

// ── Minecraft Domain Types ───────────────────────────────────────────────────
export interface MinecraftPosition {
  x: number;
  y: number;
  z: number;
}

export interface MinecraftEntity {
  id: number | string;
  name: string;
  type?: string;
  distance: number;
  isHostile: boolean;
}

export interface MinecraftInventoryItem {
  name: string;
  count: number;
  slot?: number;
}

export interface MinecraftBotState {
  health: number;
  food: number;
  position: MinecraftPosition;
  dimension: string;
  timeOfDay?: number;
  isRaining?: boolean;
  inventory: MinecraftInventoryItem[];
  nearbyPlayers: string[];
  nearbyEntities: MinecraftEntity[];
}

export interface MinecraftPerception {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  health: number;
  food: number;
  isLowHealth: boolean;
  position: MinecraftPosition;
  dimension: string;
  threats: MinecraftEntity[];
  nearbyPlayers: string[];
  inventorySummary: string[];
  narrative: string;
}

export interface MinecraftConfig {
  host: string;
  port: number;
  username: string;
  version?: string | false;
  autoConnect?: boolean;
  followDistance?: number;
  defendCreator?: boolean;
}

export interface MinecraftCommandResult {
  success: boolean;
  status?: 'success' | 'error';
  message?: string;
  error?: string;
  sessionId?: string | null;
}

// ── Discord Domain Types ─────────────────────────────────────────────────────
export interface DiscordConfig {
  botToken: string;
  autoReply: boolean;
  monitoredChannels: string[];
  statusMessage: string;
  activityType: 'Playing' | 'Listening' | 'Watching';
  prefix: string;
}

export interface DiscordMessage {
  id: string;
  channelId: string;
  guildId?: string | null;
  content: string;
  author: {
    id: string;
    username: string;
    bot?: boolean;
  };
  isMentioned?: boolean;
  isDirectMessage?: boolean;
  correlationId?: string;
  receivedAt?: number;
}

export interface DiscordVoiceState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  session: {
    guildId: string;
    channelId: string;
    sessionId: string;
  } | null;
}

export interface DiscordVoiceAudioFrame {
  frameId?: string;
  guildId?: string | null;
  channelId?: string | null;
  userId: string;
  speakerId?: string;
  data: string; // Base64 encoded PCM/Opus
  sampleRate: number;
  encoding?: string;
  timestamp?: number;
}

export interface DiscordVoiceResult {
  success: boolean;
  error?: string;
  session?: DiscordVoiceState['session'];
}

export interface DiscordCommandResult {
  success?: boolean;
  status?: 'success' | 'error';
  message?: string;
  error?: string;
  bot?: unknown;
}

// ── Playwright Domain Types ──────────────────────────────────────────────────
export interface PlaywrightLaunchOptions {
  headless?: boolean;
  url?: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface PlaywrightNavigateOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface PlaywrightClickOptions {
  timeout?: number;
}

export interface PlaywrightFillOptions {
  timeout?: number;
}

export interface PlaywrightTypeOptions {
  delay?: number;
}

export interface PlaywrightScreenshotOptions {
  fullPage?: boolean;
}

export interface PlaywrightWaitOptions {
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
  timeout?: number;
}

export interface PlaywrightHoverOptions {
  timeout?: number;
}

export interface PlaywrightResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  url?: string | null;
  title?: string | null;
  result?: T;
}

export interface PlaywrightScreenshotResult extends PlaywrightResult {
  base64?: string;
  size?: number;
}

export interface PlaywrightContentResult extends PlaywrightResult {
  content?: string;
}

export interface PlaywrightStatusResult extends PlaywrightResult {
  isRunning: boolean;
}

// ── Spotify Domain Types ─────────────────────────────────────────────────────
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  albumName: string;
  uri: string;
  durationMs?: number;
  previewUrl?: string | null;
  coverImage?: string | null;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: string[];
  uri: string;
  totalTracks?: number;
  coverImage?: string | null;
}

export interface SpotifySearchResult {
  success: boolean;
  query: string;
  tracks: SpotifyTrack[];
  albums: SpotifyAlbum[];
  error?: string;
}

export interface SpotifyPlaybackState {
  success: boolean;
  isRunning: boolean;
  isPlaying: boolean;
  rawTitle?: string;
  artist?: string | null;
  track?: string | null;
  uri?: string | null;
  error?: string;
}

export interface SpotifyCommandResult {
  success: boolean;
  status?: 'success' | 'error' | 'idle';
  action?: string;
  uri?: string;
  message?: string;
  error?: string;
  isWebFallback?: boolean;
}
