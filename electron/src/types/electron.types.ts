/**
 * Core type definitions for Electron Main Process & IPC Communication
 */

export interface DisplayInfo {
  id: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  width: number;
  height: number;
  scaleFactor: number;
  workArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  label?: string;
}

export interface ProcessMetricInfo {
  pid: number;
  type: string;
  workingSetMB: number;
  privateMB: number;
  sharedMB: number;
  cpuPercent: number;
}

export interface ProcessMemoryResult {
  success: boolean;
  residentSet: number;
  peakWorkingSet: number;
  private: number;
  processBreakdown: {
    browser: number;
    renderer: number;
    gpu: number;
    utility: number;
  };
  mainProcessResidentSet: number;
  totalWorkingSetMB: number;
  totalPrivateMB: number;
  totalSharedMB: number;
  processCount: number;
  processes: ProcessMetricInfo[];
  [key: string]: unknown;
}

export interface InteractiveHitbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExecCommandOptions {
  timeout?: number;
}

export interface ExecCommandResult {
  stdOut: string;
  stdErr: string;
  exitCode: number;
}

export interface McpStdioConfig {
  id: string;
  type?: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

export interface McpToolCallPayload {
  serverId: string;
  name: string;
  arguments?: Record<string, unknown>;
}

export interface DesktopAudioStartOptions {
  sourceId?: string;
}

export interface DesktopAudioStatus {
  running: boolean;
  sourceId: string | null;
  transport: string | null;
  frameCount: number;
  uptimeMs: number;
}

export interface ScreenRegion {
  x_pct?: number;
  y_pct?: number;
  w_pct?: number;
  h_pct?: number;
}

export interface MemoryRecord {
  id: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export type MemoryLoadResult = {
  success: true;
  backend: 'sqlite' | 'json';
  memories: MemoryRecord[] | null;
} | { success: false; error: string };

export interface MemorySaveResult {
  success: boolean;
  backend?: 'sqlite' | 'json';
  count?: number;
  error?: string;
}

export interface MinecraftConnectOptions {
  host?: string;
  port?: number | string;
  username?: string;
  version?: string | false;
}

export interface MinecraftStatus {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'error';
  connectionId: string | null;
  health?: number;
  food?: number;
  position?: { x: number; y: number; z: number };
  dimension?: string;
  timeOfDay?: number;
  isRaining?: boolean;
  nearbyPlayers?: string[];
  nearbyEntities?: Array<{
    id: number;
    name: string;
    type: string;
    distance: number;
    isHostile: boolean;
  }>;
  inventory?: Array<{
    name: string;
    count: number;
    slot: number;
  }>;
  error?: string;
  [key: string]: unknown;
}

export interface DiscordConnectOptions {
  token: string;
  statusMessage?: string;
  activityType?: string;
}

export interface DiscordVoiceJoinOptions {
  guildId: string;
  channelId: string;
}

export interface PlaywrightExecuteParams {
  url?: string;
  selector?: string;
  value?: string | number;
  text?: string;
  delay?: number;
  key?: string;
  fullPage?: boolean;
  script?: string;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
  timeout?: number;
  headless?: boolean;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
}

export interface SpotifyControlParams {
  uri?: string;
  query?: string;
}

export interface AppConfig {
  apiKey?: string;
  [key: string]: unknown;
}
