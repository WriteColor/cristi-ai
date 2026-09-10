import { z } from 'zod';

const text = z.string().max(65536).refine(value => !value.includes('\0'));
const name = z.string().min(1).max(256);
const number = z.number().finite();
const json: z.ZodType<unknown> = z.lazy(() => z.union([z.null(), z.boolean(), number, text,
  z.array(json).max(10000), z.record(json)]));
const record = z.record(json);
const optionalRecord = record.optional();
const coordinates = z.object({ x: number, y: number, z: number }).strict();
const file = z.object({ scope: z.enum(['exports', 'workspaceApproved']), path: z.string().max(4096) }).strict();
const secret = z.enum(['gemini.apiKey', 'discord.botToken', 'spotify.clientSecret']);
const noArgs = z.tuple([]);

export const requestSchemas = {
  'set-ignore-mouse-events': z.tuple([z.boolean(), z.object({ forward: z.boolean().optional() }).strict().optional()]),
  'sync-interactive-hitboxes': z.tuple([z.array(z.object({ x: number, y: number, width: number.nonnegative(), height: number.nonnegative() }).passthrough()).max(256)]),
  'set-always-on-top': z.tuple([z.boolean()]),
  'get-always-on-top': noArgs, 'minimize-window': noArgs, 'show-window': noArgs, 'hide-window': noArgs,
  'quit-app': noArgs, 'relaunch-app': noArgs, 'reload-window': noArgs, 'get-display-info': noArgs,
  'get-process-memory-info': noArgs, 'get-gpu-feature-status': noArgs, 'get-gpu-info': noArgs, 'get-app-version': noArgs,
  'open-settings-window': noArgs, 'close-settings-window': noArgs, 'open-camera-window': noArgs,
  'close-camera-window': noArgs, 'is-camera-window-open': noArgs,
  'read-file': z.tuple([file]), 'write-file': z.tuple([file, text]), 'append-file': z.tuple([file, text]),
  'read-directory': z.tuple([file]), 'open-path': z.tuple([file]), 'show-item-in-folder': z.tuple([file]),
  'approve-workspace': noArgs,
  'system-execute': z.tuple([z.object({ kind: z.enum(['system-info', 'list-processes']) }).strict()]),
  'open-external': z.tuple([z.string().url().max(4096)]),
  'get-clipboard-text': noArgs, 'set-clipboard-text': z.tuple([text]),
  'show-notification': z.tuple([z.object({ title: text.optional(), body: text.optional() }).strict()]),
  'capture-screen-native': z.tuple([z.object({ x_pct: number.min(0).max(100).optional(), y_pct: number.min(0).max(100).optional(),
    w_pct: number.min(1).max(100).optional(), h_pct: number.min(1).max(100).optional() }).strict().nullish()]),
  'import-custom-scene-file': noArgs,
  'get-app-config': noArgs, 'save-app-config': z.tuple([record]),
  'secure-set-secret': z.tuple([secret, z.string().max(8192)]),
  'secure-delete-secret': z.tuple([secret]), 'credential-status': noArgs,
  'live-token': z.tuple([z.string().regex(/^gemini-[a-zA-Z0-9.-]+$/).max(160)]),
  'gemini-generate': z.tuple([z.string().regex(/^gemini-[a-zA-Z0-9.-]+$/).max(160), record]),
  'spotify-token': noArgs,
  'desktop-audio-native-start': z.tuple([optionalRecord]), 'desktop-audio-native-stop': noArgs,
  'desktop-audio-native-status': noArgs, 'memory-load': noArgs, 'memory-save': z.tuple([z.array(record).max(10000)]),
  'companion-pause': noArgs, 'companion-resume': noArgs,
  'check-for-updates': noArgs, 'download-update': noArgs, 'install-update': noArgs,
  'playwright-execute': z.tuple([z.enum(['launch', 'navigate', 'click', 'fill', 'type', 'press', 'screenshot',
    'get_content', 'wait_for_selector', 'hover', 'status', 'close']), z.object({
      url: z.string().url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol)).optional(),
      selector: text.optional(), value: text.optional(), text: text.optional(), key: name.optional(),
      timeout: number.min(0).max(30000).optional(), delay: number.min(0).max(1000).optional(),
      headless: z.boolean().optional(), fullPage: z.boolean().optional(),
      waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
      state: z.enum(['attached', 'detached', 'visible', 'hidden']).optional(),
    }).strict().optional()]),
  'spotify-control': z.tuple([z.enum(['check_desktop_installed', 'play_pause', 'next', 'previous', 'open_uri', 'search_desktop', 'get_status', 'volume_up', 'volume_down']), z.object({ uri: z.string().max(4096).regex(/^spotify:(?:(?:track|album|artist|playlist):[a-zA-Z0-9]+|search:[a-zA-Z0-9%_.~!-]*)?$/).optional(), query: text.optional() }).strict().optional()]),
  'mcp-connect': z.tuple([z.object({ id: name, name: name.optional(), type: z.enum(['stdio', 'sse']).optional(),
    command: text.optional(), args: z.array(text).max(100).optional(), env: z.record(text).optional(),
    url: z.string().url().optional(), headers: z.record(text).optional() }).strict()]),
  'mcp-call-tool': z.tuple([z.object({ serverId: name, name, arguments: record.optional(), timeoutMs: number.min(1000).max(60000).optional() }).strict()]),
  'mcp-disconnect': z.tuple([name]),
  'minecraft-connect': z.tuple([optionalRecord]), 'minecraft-disconnect': noArgs,
  'minecraft-chat': z.tuple([text]), 'minecraft-get-status': noArgs, 'minecraft-stop': noArgs,
  'minecraft-move-to': z.tuple([coordinates]), 'minecraft-mine-block': z.tuple([coordinates]),
  'minecraft-follow': z.tuple([name]),
  'minecraft-place-block': z.tuple([coordinates.extend({ blockName: name })]),
  'minecraft-attack': z.tuple([z.object({ entityName: name.optional() }).strict()]),
  'discord-connect': z.tuple([z.object({ statusMessage: text.optional(), activityType: name.optional() }).strict()]),
  'discord-disconnect': noArgs, 'discord-voice-leave': noArgs,
  'discord-send-message': z.tuple([z.object({ channelId: name, content: z.string().max(2000) }).strict()]),
  'discord-set-status': z.tuple([z.object({ statusText: text, activityType: name.optional() }).strict()]),
  'discord-get-messages': z.tuple([z.object({ channelId: name, limit: z.number().int().min(1).max(100).optional() }).strict()]),
  'discord-voice-join': z.tuple([z.object({ guildId: name, channelId: name }).strict()]),
  'discord-voice-send-audio': z.tuple([z.object({ data: z.string().max(512000) }).strict()]),
} as const;

export type IpcChannel = keyof typeof requestSchemas;
export type IpcRequest<C extends IpcChannel> = z.input<(typeof requestSchemas)[C]>;
export type FileRequest = z.infer<typeof file>;

const cameraChannels = new Set<IpcChannel>(['close-camera-window', 'get-app-config', 'get-app-version']);
const settingsOnly = new Set<IpcChannel>(['secure-set-secret', 'secure-delete-secret', 'approve-workspace', 'install-update']);
const mainOnly = new Set<IpcChannel>(['live-token', 'gemini-generate', 'spotify-token', 'sync-interactive-hitboxes',
  'set-ignore-mouse-events', 'capture-screen-native', 'memory-save', 'discord-voice-send-audio']);
export function channelAllowed(channel: IpcChannel, kind: 'main' | 'settings' | 'camera'): boolean {
  if (kind === 'camera') return cameraChannels.has(channel);
  if (settingsOnly.has(channel)) return kind === 'settings';
  if (mainOnly.has(channel)) return kind === 'main';
  return true;
}

export function validateRequest<C extends IpcChannel>(channel: C, args: unknown[]): IpcRequest<C> {
  // Size/depth before recursive schema evaluation prevents resource exhaustion.
  const visit = (value: unknown, depth: number): void => {
    if (depth > 24) throw new Error('Payload demasiado profundo.');
    if (value && typeof value === 'object') {
      for (const entry of Object.values(value)) visit(entry, depth + 1);
    }
  };
  if (JSON.stringify(args).length > 1_048_576) throw new Error('Payload demasiado grande.');
  visit(args, 0);
  return requestSchemas[channel].parse(args) as IpcRequest<C>;
}

// ── Interfaces auxiliares para respuestas tipadas ─────────────────────────────

/** Información de pantalla devuelta por get-display-info */
export interface DisplayInfo {
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  id: number;
  label?: string;
}

/** Información de memoria del proceso devuelta por get-process-memory-info */
export interface ProcessMemoryInfo {
  residentSet?: number;
  private: number;
  shared?: number;
}

/** Región de pantalla para capture-screen-native (porcentajes 0-100) */
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

// ── Mapa de tipos de respuesta por canal IPC ──────────────────────────────────
// Tipos inferidos en compile-time; NO se validan en runtime (sin Zod).

export interface IpcResponseMap {
  'set-ignore-mouse-events': void;
  'sync-interactive-hitboxes': void;
  'set-always-on-top': void;
  'get-always-on-top': boolean;
  'minimize-window': void;
  'show-window': void;
  'hide-window': void;
  'quit-app': void;
  'relaunch-app': { success: boolean; error?: string };
  'reload-window': { success: boolean; error?: string };
  'get-display-info': DisplayInfo;
  'get-process-memory-info': ProcessMemoryInfo;
  'get-gpu-feature-status': Record<string, string>;
  'get-gpu-info': Record<string, unknown>;
  'get-app-version': string;
  'open-settings-window': { success: boolean };
  'close-settings-window': { success: boolean };
  'open-camera-window': { success: boolean };
  'close-camera-window': { success: boolean };
  'is-camera-window-open': boolean;
  'read-file': string;
  'write-file': boolean;
  'append-file': boolean;
  'read-directory': { entry: string; type: 'FILE' | 'DIRECTORY' }[];
  'open-path': { success: boolean; error: string | null };
  'show-item-in-folder': boolean;
  'approve-workspace': boolean;
  'system-execute': unknown;
  'open-external': boolean;
  'get-clipboard-text': string;
  'set-clipboard-text': boolean;
  'show-notification': boolean;
  'capture-screen-native': string | null;
  'import-custom-scene-file': {
    canceled: boolean;
    filePath?: string;
    fileUrl?: string;
    name?: string;
    type?: 'video' | 'animated' | 'image';
    error?: string;
  };
  'get-app-config': Record<string, unknown>;
  'save-app-config': { success: boolean };
  'secure-set-secret': { success: boolean };
  'secure-delete-secret': { success: boolean };
  'credential-status': {
    hasGeminiCredential: boolean;
    hasDiscordCredential: boolean;
    hasSpotifyCredential: boolean;
  };
  'live-token': string;
  'gemini-generate': unknown;
  'spotify-token': string | null;
  'desktop-audio-native-start': {
    success: boolean;
    available?: boolean;
    alreadyRunning?: boolean;
    transport?: string;
    sourceId?: string;
    error?: string;
  };
  'desktop-audio-native-stop': { success: boolean; sourceId?: string; alreadyStopped?: boolean };
  'desktop-audio-native-status': {
    running: boolean;
    sourceId: string | null;
    transport: string | null;
    frameCount: number;
    uptimeMs: number;
  };
  'memory-load': MemoryLoadResult;
  'memory-save': MemorySaveResult;
  'companion-pause': void;
  'companion-resume': void;
  'check-for-updates': { success: boolean; version?: string; isLocal?: boolean; error?: string };
  'download-update': { success: boolean; error?: string };
  'install-update': boolean;
  'playwright-execute': { success: boolean; [key: string]: unknown };
  'spotify-control': { success: boolean; [key: string]: unknown };
  'mcp-connect': { success: boolean; tools?: unknown[]; version?: string; error?: string };
  'mcp-call-tool': { success: boolean; content?: unknown; error?: string };
  'mcp-disconnect': { success: boolean };
  'minecraft-connect': { success: boolean; error?: string };
  'minecraft-disconnect': { success: boolean };
  'minecraft-chat': { success: boolean };
  'minecraft-get-status': { connected: boolean; [key: string]: unknown };
  'minecraft-stop': { success: boolean };
  'minecraft-move-to': { success: boolean; error?: string };
  'minecraft-mine-block': { success: boolean; error?: string };
  'minecraft-follow': { success: boolean; error?: string };
  'minecraft-place-block': { success: boolean; error?: string };
  'minecraft-attack': { success: boolean; error?: string };
  'discord-connect': { success: boolean; error?: string };
  'discord-disconnect': { success: boolean };
  'discord-send-message': { success: boolean; messageId?: string; error?: string };
  'discord-set-status': { success: boolean };
  'discord-get-messages': { messages: unknown[]; error?: string };
  'discord-voice-join': { success: boolean; error?: string };
  'discord-voice-leave': { success: boolean };
  'discord-voice-send-audio': { success: boolean };
}

/** Tipo helper: obtiene el tipo de respuesta de un canal IPC dado */
export type IpcResponse<C extends IpcChannel> = C extends keyof IpcResponseMap ? IpcResponseMap[C] : unknown;

export interface ElectronApiBridge {
  credentialStatus: () => Promise<{ hasGeminiCredential: boolean; hasDiscordCredential: boolean; hasSpotifyCredential: boolean }>;
  requestLiveToken: (model: string) => Promise<string>;
  geminiGenerate: (model: string, body: Record<string, unknown>) => Promise<unknown>;
  spotifyToken: () => Promise<string | null>;
  systemExecute: (request: { kind: 'system-info' | 'list-processes' }) => Promise<unknown>;
  approveWorkspace: () => Promise<boolean>;
  isElectron: boolean;

  // Window & Hitboxes
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => void;
  syncHitboxes: (hitboxes: unknown[]) => void;
  syncInteractiveHitboxes: (hitboxes: unknown[]) => void;
  setAlwaysOnTop: (value: boolean) => void;
  getAlwaysOnTop: () => Promise<boolean>;
  minimizeWindow: () => void;
  showWindow: () => void;
  hideWindow: () => void;
  quitApp: () => void;
  relaunchApp: () => Promise<{ success: boolean; error?: string }>;
  reloadWindow: () => Promise<{ success: boolean; error?: string }>;
  getDisplayInfo: () => Promise<DisplayInfo>;
  getProcessMemoryInfo: () => Promise<ProcessMemoryInfo>;
  getGpuFeatureStatus: () => Promise<Record<string, string>>;
  getGpuInfo: () => Promise<Record<string, unknown>>;
  getAppVersion: () => Promise<string>;

  // Native OS & System
  readFile: (filePath: FileRequest) => Promise<string>;
  writeFile: (filePath: FileRequest, data: string) => Promise<boolean>;
  appendFile: (filePath: FileRequest, data: string) => Promise<boolean>;
  readDirectory: (dirPath: FileRequest) => Promise<{ entry: string; type: 'FILE' | 'DIRECTORY' }[]>;
  openExternal: (url: string) => Promise<boolean>;
  openPath: (targetPath: FileRequest) => Promise<{ success: boolean; error: string | null }>;
  showItemInFolder: (targetPath: FileRequest) => Promise<boolean>;
  getClipboardText: () => Promise<string>;
  setClipboardText: (text: string) => Promise<boolean>;
  showNotification: (payload: { title?: string; body?: string }) => Promise<boolean>;

  // Security & Secrets
  setSecureSecret: (key: string, value: string) => Promise<{ success: boolean; error?: string }>;
  deleteSecureSecret: (key: string) => Promise<{ success: boolean; error?: string }>;

  // Audio Loopback & Screen
  captureScreenNative: (region?: ScreenRegion | null) => Promise<string | null>;
  importCustomSceneFile: () => Promise<{
    canceled: boolean;
    filePath?: string;
    fileUrl?: string;
    name?: string;
    type?: 'video' | 'animated' | 'image';
    error?: string;
  }>;
  desktopAudioNativeStart: (options?: Record<string, unknown>) => Promise<{
    success: boolean;
    available?: boolean;
    alreadyRunning?: boolean;
    transport?: string;
    sourceId?: string;
    error?: string;
  }>;
  desktopAudioNativeStop: () => Promise<{ success: boolean; sourceId?: string; alreadyStopped?: boolean }>;
  desktopAudioNativeStatus: () => Promise<{
    running: boolean;
    sourceId: string | null;
    transport: string | null;
    frameCount: number;
    uptimeMs: number;
  }>;
  onDesktopAudioNativeFrame: (callback: (data: unknown) => void) => () => void;
  onDesktopAudioNativeEvent: (callback: (data: unknown) => void) => () => void;

  // Memory
  memoryLoad: () => Promise<MemoryLoadResult>;
  memorySave: (memories: Record<string, unknown>[]) => Promise<MemorySaveResult>;

  // Subwindows
  openSettingsWindow: () => Promise<{ success: boolean }>;
  closeSettingsWindow: () => Promise<{ success: boolean }>;
  openCameraWindow: () => Promise<{ success: boolean }>;
  closeCameraWindow: () => Promise<{ success: boolean }>;
  isCameraWindowOpen: () => Promise<boolean>;
  onSettingsWindowState: (callback: (data: unknown) => void) => () => void;
  onCameraWindowState: (callback: (data: unknown) => void) => () => void;

  // MCP
  mcpConnect: (config: Record<string, unknown>) => Promise<{ success: boolean; tools?: unknown[]; version?: string; error?: string }>;
  mcpCallTool: (payload: Record<string, unknown>) => Promise<{ success: boolean; content?: unknown; error?: string }>;
  mcpDisconnect: (serverId: string) => Promise<{ success: boolean }>;

  // Playwright & Spotify
  playwrightExecute: (action: string, params?: Record<string, unknown>) => Promise<{ success: boolean; [key: string]: unknown }>;
  spotifyControl: (action: string, params?: Record<string, unknown>) => Promise<{ success: boolean; [key: string]: unknown }>;

  // Minecraft
  minecraftConnect: (opts?: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  minecraftDisconnect: () => Promise<{ success: boolean }>;
  minecraftChat: (msg: string) => Promise<{ success: boolean }>;
  minecraftGetStatus: () => Promise<{ connected: boolean; [key: string]: unknown }>;
  minecraftMoveTo: (coords: { x: number; y: number; z: number }) => Promise<{ success: boolean; error?: string }>;
  minecraftFollow: (player: string) => Promise<{ success: boolean; error?: string }>;
  minecraftStop: () => Promise<{ success: boolean }>;
  minecraftMineBlock: (coords: { x: number; y: number; z: number }) => Promise<{ success: boolean; error?: string }>;
  minecraftPlaceBlock: (payload: { x: number; y: number; z: number; blockName: string }) => Promise<{ success: boolean; error?: string }>;
  minecraftAttack: (payload: { entityName?: string }) => Promise<{ success: boolean; error?: string }>;
  onMinecraftChat: (callback: (data: unknown) => void) => () => void;
  onMinecraftEvent: (callback: (data: unknown) => void) => () => void;

  // Discord
  discordConnect: (opts: { statusMessage?: string; activityType?: string }) => Promise<{ success: boolean; error?: string }>;
  discordDisconnect: () => Promise<{ success: boolean }>;
  discordSendMessage: (payload: { channelId: string; content: string }) => Promise<{ success: boolean; messageId?: string; error?: string }>;
  discordGetMessages: (payload: { channelId: string; limit?: number }) => Promise<{ messages: unknown[]; error?: string }>;
  discordSetStatus: (opts: { statusText: string; activityType?: string }) => Promise<{ success: boolean }>;
  discordVoiceJoin: (opts: { guildId: string; channelId: string }) => Promise<{ success: boolean; error?: string }>;
  discordVoiceLeave: () => Promise<{ success: boolean }>;
  discordVoiceSendAudio: (payload: { data: string; frameId?: string }) => Promise<{ success: boolean }>;
  onDiscordMessage: (callback: (data: unknown) => void) => () => void;
  onDiscordEvent: (callback: (data: unknown) => void) => () => void;
  onDiscordVoiceEvent: (callback: (data: unknown) => void) => () => void;
  onDiscordVoiceAudio: (callback: (data: unknown) => void) => () => void;

  // Auto-Updater
  checkForUpdates: () => Promise<{ success: boolean; version?: string; isLocal?: boolean; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => Promise<boolean>;
  onUpdateStatus: (callback: (data: unknown) => void) => () => void;

  // Global Shortcuts
  onShortcutEvent: (channel: string, callback: (...args: unknown[]) => void) => () => void;

  // Settings & Config
  saveAppConfig: (config: Record<string, unknown>) => Promise<{ success: boolean }>;
  getAppConfig: () => Promise<Record<string, unknown>>;
  onConfigUpdated: (callback: (data: unknown) => void) => () => void;
  onCompanionPause: (callback: () => void) => () => void;
  onCompanionResume: (callback: () => void) => () => void;
}

