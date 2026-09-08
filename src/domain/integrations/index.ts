/**
 * Cristi AI - External Domain Integrations Hub
 * 
 * Unified export point for all autonomous external domain integrations:
 * - Minecraft Companion (Navigation, mining, building, combat, telemetry)
 * - Discord Companion (Mentions, correlationId-preserved replies, 16kHz voice audio)
 * - Playwright Automation (Brave browser control, clicks, form inputs, full-page screenshots)
 * - Spotify Controller (Desktop native IPC & Web API catalog search and playback)
 * - Persistent Memory (Multi-layer storage, 96-D hash vector indexing, contradiction resolution)
 */

// ── Minecraft Companion ──────────────────────────────────────────────────────
export {
  MinecraftCompanionService,
  minecraftCompanionService,
  type IMinecraftCompanionService,
  type ReconnectPolicy as MinecraftReconnectPolicy
} from './minecraft/MinecraftCompanionService';

// ── Discord Companion & Voice ────────────────────────────────────────────────
export {
  DiscordCompanionService,
  discordCompanionService,
  type IDiscordCompanionService
} from './discord/DiscordCompanionService';

// ── Playwright Browser Automation (Brave) ────────────────────────────────────
export {
  PlaywrightService,
  playwrightService,
  type IPlaywrightService
} from './playwright/PlaywrightService';

// ── Spotify Music & Media Controller ─────────────────────────────────────────
export {
  SpotifyService,
  spotifyService,
  type ISpotifyService
} from './spotify/SpotifyService';

// ── Multi-layer Semantic Memory ──────────────────────────────────────────────
export {
  MemoryService,
  memoryService,
  LocalSemanticHashIndex,
  MemoryPersistenceAdapter,
  type IMemoryService,
  type ConversationTurn,
  type WorkingSession
} from './memory/MemoryService';
