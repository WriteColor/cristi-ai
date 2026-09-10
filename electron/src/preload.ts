import type { FileRequest, DisplayInfo, ProcessMemoryInfo, ScreenRegion, ElectronApiBridge } from '../../shared/ipc/contracts';
import { ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from './types/ipcChannels';

const ALLOWED_SHORTCUT_CHANNELS = new Set([
  'shortcut-toggle-mute',
  'shortcut-capture-screen',
  'shortcut-toggle-zen-mode',
  'shortcut-toggle-perf-hud',
  'shortcut-toggle-always-on-top',
]);

export type { ElectronApiBridge };

export const electronBridgeApi: ElectronApiBridge = {
  isElectron: true,
  credentialStatus: () => ipcRenderer.invoke('credential-status'),
  requestLiveToken: model => ipcRenderer.invoke('live-token', model),
  geminiGenerate: (model, body) => ipcRenderer.invoke('gemini-generate', model, body),
  spotifyToken: () => ipcRenderer.invoke('spotify-token'),
  systemExecute: request => ipcRenderer.invoke('system-execute', request),
  approveWorkspace: () => ipcRenderer.invoke('approve-workspace'),

  // ── Click-Through & Hitboxes ──────────────────────────────────────────────
  setIgnoreMouseEvents: (ignore: boolean, options: { forward?: boolean } = {}) => {
    ipcRenderer.send(IPC_CHANNELS.SET_IGNORE_MOUSE_EVENTS, Boolean(ignore), options);
  },
  syncHitboxes: (hitboxes: unknown[]) => {
    ipcRenderer.send(IPC_CHANNELS.SYNC_INTERACTIVE_HITBOXES, hitboxes);
  },
  syncInteractiveHitboxes: (hitboxes: unknown[]) => {
    ipcRenderer.send(IPC_CHANNELS.SYNC_INTERACTIVE_HITBOXES, hitboxes);
  },

  // ── Window Management ─────────────────────────────────────────────────────
  setAlwaysOnTop: (value: boolean) => {
    ipcRenderer.send(IPC_CHANNELS.SET_ALWAYS_ON_TOP, Boolean(value));
  },
  getAlwaysOnTop: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ALWAYS_ON_TOP),
  minimizeWindow: () => ipcRenderer.send(IPC_CHANNELS.MINIMIZE_WINDOW),
  showWindow: () => ipcRenderer.send('show-window'),
  hideWindow: () => ipcRenderer.send('hide-window'),
  quitApp: () => ipcRenderer.send(IPC_CHANNELS.QUIT_APP),
  relaunchApp: () => ipcRenderer.invoke(IPC_CHANNELS.RELAUNCH_APP),
  reloadWindow: () => ipcRenderer.invoke(IPC_CHANNELS.RELOAD_WINDOW),

  // ── Display & Telemetry ───────────────────────────────────────────────────
  getDisplayInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DISPLAY_INFO),
  getProcessMemoryInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PROCESS_MEMORY_INFO),
  getGpuFeatureStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_GPU_FEATURE_STATUS),
  getGpuInfo: () => ipcRenderer.invoke('get-gpu-info'),
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION),

  // ── Native OS Operations ──────────────────────────────────────────────────
  readFile: (filePath: FileRequest) => ipcRenderer.invoke(IPC_CHANNELS.READ_FILE, filePath),
  writeFile: (filePath: FileRequest, data: string) => ipcRenderer.invoke(IPC_CHANNELS.WRITE_FILE, filePath, data),
  appendFile: (filePath: FileRequest, data: string) => ipcRenderer.invoke(IPC_CHANNELS.APPEND_FILE, filePath, data),
  readDirectory: (dirPath: FileRequest) => ipcRenderer.invoke(IPC_CHANNELS.READ_DIRECTORY, dirPath),
  openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL, url),
  openPath: (targetPath: FileRequest) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_PATH, targetPath),
  showItemInFolder: (targetPath: FileRequest) => ipcRenderer.invoke(IPC_CHANNELS.SHOW_ITEM_IN_FOLDER, targetPath),
  getClipboardText: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CLIPBOARD_TEXT),
  setClipboardText: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.SET_CLIPBOARD_TEXT, text),
  showNotification: (payload: { title?: string; body?: string }) => ipcRenderer.invoke(IPC_CHANNELS.SHOW_NOTIFICATION, payload),

  // ── Security & Secrets ────────────────────────────────────────────────────
  setSecureSecret: (key: string, value: string) => ipcRenderer.invoke(IPC_CHANNELS.SECURE_SET_SECRET, key, value),
  deleteSecureSecret: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SECURE_DELETE_SECRET, key),

  // ── Audio Loopback & Screen Capture ───────────────────────────────────────
  captureScreenNative: (region?: ScreenRegion | null) => ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_SCREEN_NATIVE, region),
  importCustomSceneFile: () => ipcRenderer.invoke('import-custom-scene-file'),
  desktopAudioNativeStart: (options?: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_AUDIO_NATIVE_START, options),
  desktopAudioNativeStop: () => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_AUDIO_NATIVE_STOP),
  desktopAudioNativeStatus: () => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_AUDIO_NATIVE_STATUS),
  onDesktopAudioNativeFrame: (callback: (data: unknown) => void) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('desktop-audio-native-frame', listener);
    return () => {
      try {
        ipcRenderer.removeListener('desktop-audio-native-frame', listener);
      } catch (_) {}
    };
  },
  onDesktopAudioNativeEvent: (callback: (data: unknown) => void) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('desktop-audio-native-event', listener);
    return () => {
      try {
        ipcRenderer.removeListener('desktop-audio-native-event', listener);
      } catch (_) {}
    };
  },

  // ── Memory ────────────────────────────────────────────────────────────────
  memoryLoad: () => ipcRenderer.invoke(IPC_CHANNELS.MEMORY_LOAD),
  memorySave: (memories: Record<string, unknown>[]) => ipcRenderer.invoke(IPC_CHANNELS.MEMORY_SAVE, memories),

  // ── Subwindows ────────────────────────────────────────────────────────────
  openSettingsWindow: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_SETTINGS_WINDOW),
  closeSettingsWindow: () => ipcRenderer.invoke(IPC_CHANNELS.CLOSE_SETTINGS_WINDOW),
  openCameraWindow: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_CAMERA_WINDOW),
  closeCameraWindow: () => ipcRenderer.invoke(IPC_CHANNELS.CLOSE_CAMERA_WINDOW),
  isCameraWindowOpen: () => ipcRenderer.invoke(IPC_CHANNELS.IS_CAMERA_WINDOW_OPEN),
  onSettingsWindowState: (callback: (data: unknown) => void) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('settings-window-state', listener);
    return () => {
      try {
        ipcRenderer.removeListener('settings-window-state', listener);
      } catch (_) {}
    };
  },
  onCameraWindowState: (callback: (data: unknown) => void) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('camera-window-state', listener);
    return () => {
      try {
        ipcRenderer.removeListener('camera-window-state', listener);
      } catch (_) {}
    };
  },

  // ── MCP ───────────────────────────────────────────────────────────────────
  mcpConnect: (config: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.MCP_CONNECT, config),
  mcpCallTool: (payload: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.MCP_CALL_TOOL, payload),
  mcpDisconnect: (serverId: string) => ipcRenderer.invoke(IPC_CHANNELS.MCP_DISCONNECT, serverId),

  // ── Integrations ──────────────────────────────────────────────────────────
  playwrightExecute: (action: string, params?: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.PLAYWRIGHT_EXECUTE, action, params),
  spotifyControl: (action: string, params?: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SPOTIFY_CONTROL, action, params),

  // Minecraft
  minecraftConnect: (opts?: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_CONNECT, opts),
  minecraftDisconnect: () => ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_DISCONNECT),
  minecraftChat: (msg: string) => ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_CHAT, msg),
  minecraftGetStatus: () => ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_GET_STATUS),
  minecraftMoveTo: (coords: { x: number; y: number; z: number }) => ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_MOVE_TO, coords),
  minecraftFollow: (player: string) => ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_FOLLOW, player),
  minecraftStop: () => ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_STOP),
  minecraftMineBlock: (coords: { x: number; y: number; z: number }) => ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_MINE_BLOCK, coords),
  minecraftPlaceBlock: (payload: { x: number; y: number; z: number; blockName: string }) => ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_PLACE_BLOCK, payload),
  minecraftAttack: (payload: { entityName?: string }) => ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_ATTACK, payload),
  onMinecraftChat: (callback: (data: unknown) => void) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('minecraft-chat', listener);
    return () => {
      try {
        ipcRenderer.removeListener('minecraft-chat', listener);
      } catch (_) {}
    };
  },
  onMinecraftEvent: (callback: (data: unknown) => void) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('minecraft-event', listener);
    return () => {
      try {
        ipcRenderer.removeListener('minecraft-event', listener);
      } catch (_) {}
    };
  },

  // Discord
  discordConnect: (opts: { statusMessage?: string; activityType?: string }) => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_CONNECT, opts),
  discordDisconnect: () => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_DISCONNECT),
  discordSendMessage: (payload: { channelId: string; content: string }) => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SEND_MESSAGE, payload),
  discordGetMessages: (payload: { channelId: string; limit?: number }) => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_GET_MESSAGES, payload),
  discordSetStatus: (opts: { statusText: string; activityType?: string }) => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SET_STATUS, opts),
  discordVoiceJoin: (opts: { guildId: string; channelId: string }) => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_VOICE_JOIN, opts),
  discordVoiceLeave: () => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_VOICE_LEAVE),
  discordVoiceSendAudio: (payload: { data: string }) => ipcRenderer.invoke(IPC_CHANNELS.DISCORD_VOICE_SEND_AUDIO, payload),
  onDiscordMessage: (callback: (data: unknown) => void) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('discord-message', listener);
    return () => {
      try {
        ipcRenderer.removeListener('discord-message', listener);
      } catch (_) {}
    };
  },
  onDiscordEvent: (callback: (data: unknown) => void) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('discord-event', listener);
    return () => {
      try {
        ipcRenderer.removeListener('discord-event', listener);
      } catch (_) {}
    };
  },
  onDiscordVoiceEvent: (callback: (data: unknown) => void) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('discord-voice-event', listener);
    return () => {
      try {
        ipcRenderer.removeListener('discord-voice-event', listener);
      } catch (_) {}
    };
  },
  onDiscordVoiceAudio: (callback: (data: unknown) => void) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('discord-voice-audio', listener);
    return () => {
      try {
        ipcRenderer.removeListener('discord-voice-audio', listener);
      } catch (_) {}
    };
  },

  // ── Updater ───────────────────────────────────────────────────────────────
  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.CHECK_FOR_UPDATES),
  downloadUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_UPDATE),
  installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.INSTALL_UPDATE),
  onUpdateStatus: (callback: (data: unknown) => void) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => {
      try {
        ipcRenderer.removeListener('update-status', listener);
      } catch (_) {}
    };
  },

  // ── Shortcuts ─────────────────────────────────────────────────────────────
  onShortcutEvent: (channel: string, callback: (...args: unknown[]) => void) => {
    if (!ALLOWED_SHORTCUT_CHANNELS.has(channel) || typeof callback !== 'function') {
      return () => {};
    }
    const listener = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => {
      try {
        ipcRenderer.removeListener(channel, listener);
      } catch (_) {}
    };
  },

  // ── Settings & Config ─────────────────────────────────────────────────────
  saveAppConfig: (config: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_APP_CONFIG, config),
  getAppConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_CONFIG),
  onConfigUpdated: (callback: (data: unknown) => void) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('config-updated', listener);
    return () => {
      try {
        ipcRenderer.removeListener('config-updated', listener);
      } catch (_) {}
    };
  },
  onCompanionPause: (callback: () => void) => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('companion-pause', listener);
    return () => {
      try {
        ipcRenderer.removeListener('companion-pause', listener);
      } catch (_) {}
    };
  },
  onCompanionResume: (callback: () => void) => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('companion-resume', listener);
    return () => {
      try {
        ipcRenderer.removeListener('companion-resume', listener);
      } catch (_) {}
    };
  },
};

// Expose on window.electron, window.electronBridge, and window.electronAPI for universal compatibility
