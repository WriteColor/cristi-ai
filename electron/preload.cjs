'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_SHORTCUT_CHANNELS = new Set([
  'shortcut-toggle-mute',
  'shortcut-capture-screen',
  'shortcut-toggle-zen-mode',
  'shortcut-toggle-perf-hud',
  'shortcut-toggle-always-on-top',
]);

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // ── Click-Through Control ─────────────────────────────────────────────────
  // Called by useClickThrough hook whenever the cursor enters/leaves
  // an interactive element.
  //
  // ignore=true + forward:true → pass clicks to desktop but still receive mousemove
  // ignore=false              → window receives all mouse events normally
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', Boolean(ignore), options || {});
  },
  syncHitboxes: (hitboxes) => {
    ipcRenderer.send('sync-interactive-hitboxes', hitboxes);
  },

  // ── Window Management ─────────────────────────────────────────────────────
  setAlwaysOnTop: (value) => {
    ipcRenderer.send('set-always-on-top', Boolean(value));
  },
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),

  // ── Display Info ──────────────────────────────────────────────────────────
  getDisplayInfo: () => ipcRenderer.invoke('get-display-info'),

  // ── App Controls ──────────────────────────────────────────────────────────
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  showWindow: () => ipcRenderer.send('show-window'),
  hideWindow: () => ipcRenderer.send('hide-window'),
  quitApp: () => ipcRenderer.send('quit-app'),
  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),
  reloadWindow: () => ipcRenderer.invoke('reload-window'),

  // ── Native OS Operations ──────────────────────────────────────────────────
  execCommand: (command, options) => ipcRenderer.invoke('exec-command', command, options),
  mcpConnect: (config) => ipcRenderer.invoke('mcp-connect', config),
  mcpCallTool: (payload) => ipcRenderer.invoke('mcp-call-tool', payload),
  mcpDisconnect: (serverId) => ipcRenderer.invoke('mcp-disconnect', serverId),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
  memoryLoad: () => ipcRenderer.invoke('memory-load'),
  memorySave: (memories) => ipcRenderer.invoke('memory-save', memories),
  setSecureSecret: (key, value) => ipcRenderer.invoke('secure-set-secret', key, value),
  getSecureSecret: (key) => ipcRenderer.invoke('secure-get-secret', key),
  deleteSecureSecret: (key) => ipcRenderer.invoke('secure-delete-secret', key),
  appendFile: (filePath, data) => ipcRenderer.invoke('append-file', filePath, data),
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openPath: (targetPath) => ipcRenderer.invoke('open-path', targetPath),
  showItemInFolder: (targetPath) => ipcRenderer.invoke('show-item-in-folder', targetPath),
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
  setClipboardText: (text) => ipcRenderer.invoke('set-clipboard-text', text),
  showNotification: (payload) => ipcRenderer.invoke('show-notification', payload),
  captureScreenNative: (region) => ipcRenderer.invoke('capture-screen-native', region),
  desktopAudioNativeStart: (options) => ipcRenderer.invoke('desktop-audio-native-start', options),
  desktopAudioNativeStop: () => ipcRenderer.invoke('desktop-audio-native-stop'),
  desktopAudioNativeStatus: () => ipcRenderer.invoke('desktop-audio-native-status'),
  onDesktopAudioNativeFrame: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on('desktop-audio-native-frame', listener);
    return () => {
      try { ipcRenderer.removeListener('desktop-audio-native-frame', listener); } catch (_) {}
    };
  },
  onDesktopAudioNativeEvent: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on('desktop-audio-native-event', listener);
    return () => {
      try { ipcRenderer.removeListener('desktop-audio-native-event', listener); } catch (_) {}
    };
  },
  importCustomSceneFile: () => ipcRenderer.invoke('import-custom-scene-file'),
  getProcessMemoryInfo: () => ipcRenderer.invoke('get-process-memory-info'),
  getGpuInfo: () => ipcRenderer.invoke('get-gpu-info'),

  // ── Playwright Native Automation API ───────────────────────────────────────
  playwrightExecute: (action, params) => ipcRenderer.invoke('playwright-execute', action, params),

  // ── Spotify Native & Media Control API ────────────────────────────────────
  spotifyControl: (action, params) => ipcRenderer.invoke('spotify-control', action, params),

  // ── Minecraft Companion API ────────────────────────────────────────────────
  minecraftConnect: (opts) => ipcRenderer.invoke('minecraft-connect', opts),
  minecraftDisconnect: () => ipcRenderer.invoke('minecraft-disconnect'),
  minecraftChat: (msg) => ipcRenderer.invoke('minecraft-chat', msg),
  minecraftGetStatus: () => ipcRenderer.invoke('minecraft-get-status'),
  minecraftMoveTo: (coords) => ipcRenderer.invoke('minecraft-move-to', coords),
  minecraftFollow: (player) => ipcRenderer.invoke('minecraft-follow', player),
  minecraftStop: () => ipcRenderer.invoke('minecraft-stop'),
  minecraftMineBlock: (coords) => ipcRenderer.invoke('minecraft-mine-block', coords),
  minecraftPlaceBlock: (payload) => ipcRenderer.invoke('minecraft-place-block', payload),
  minecraftAttack: (payload) => ipcRenderer.invoke('minecraft-attack', payload),
  onMinecraftChat: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on('minecraft-chat', listener);
    return () => {
      try { ipcRenderer.removeListener('minecraft-chat', listener); } catch (_) {}
    };
  },
  onMinecraftEvent: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on('minecraft-event', listener);
    return () => {
      try { ipcRenderer.removeListener('minecraft-event', listener); } catch (_) {}
    };
  },

  // ── Discord Companion API ──────────────────────────────────────────────────
  discordConnect: (opts) => ipcRenderer.invoke('discord-connect', opts),
  discordDisconnect: () => ipcRenderer.invoke('discord-disconnect'),
  discordSendMessage: (payload) => ipcRenderer.invoke('discord-send-message', payload),
  discordGetMessages: (payload) => ipcRenderer.invoke('discord-get-messages', payload),
  discordSetStatus: (opts) => ipcRenderer.invoke('discord-set-status', opts),
  discordVoiceJoin: (opts) => ipcRenderer.invoke('discord-voice-join', opts),
  discordVoiceLeave: () => ipcRenderer.invoke('discord-voice-leave'),
  discordVoiceSendAudio: (payload) => ipcRenderer.invoke('discord-voice-send-audio', payload),
  onDiscordMessage: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on('discord-message', listener);
    return () => {
      try { ipcRenderer.removeListener('discord-message', listener); } catch (_) {}
    };
  },
  onDiscordEvent: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on('discord-event', listener);
    return () => {
      try { ipcRenderer.removeListener('discord-event', listener); } catch (_) {}
    };
  },
  onDiscordVoiceEvent: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on('discord-voice-event', listener);
    return () => {
      try { ipcRenderer.removeListener('discord-voice-event', listener); } catch (_) {}
    };
  },
  onDiscordVoiceAudio: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on('discord-voice-audio', listener);
    return () => {
      try { ipcRenderer.removeListener('discord-voice-audio', listener); } catch (_) {}
    };
  },

  // ── Auto-Updater API ───────────────────────────────────────────────────────
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => {
      try {
        ipcRenderer.removeListener('update-status', listener);
      } catch (_) {}
    };
  },

  // ── Global Shortcut Event Subscriptions ───────────────────────────────────
  onShortcutEvent: (channel, callback) => {
    if (!ALLOWED_SHORTCUT_CHANNELS.has(channel) || typeof callback !== 'function') {
      return () => {};
    }
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => {
      try {
        ipcRenderer.removeListener(channel, listener);
      } catch (_) {}
    };
  },

  // ── Settings & Config ─────────────────────────────────────────────────────
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  closeSettingsWindow: () => ipcRenderer.invoke('close-settings-window'),
  saveAppConfig: (config) => ipcRenderer.invoke('save-app-config', config),
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  onConfigUpdated: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on('config-updated', listener);
    return () => {
      try {
        ipcRenderer.removeListener('config-updated', listener);
      } catch (_) {}
    };
  },
  onCompanionPause: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on('companion-pause', listener);
    return () => {
      try {
        ipcRenderer.removeListener('companion-pause', listener);
      } catch (_) {}
    };
  },
  onCompanionResume: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on('companion-resume', listener);
    return () => {
      try {
        ipcRenderer.removeListener('companion-resume', listener);
      } catch (_) {}
    };
  },
  onSettingsWindowState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on('settings-window-state', listener);
    return () => {
      try {
        ipcRenderer.removeListener('settings-window-state', listener);
      } catch (_) {}
    };
  },

  // ── Standalone Camera Window ──────────────────────────────────────────────
  openCameraWindow: () => ipcRenderer.invoke('open-camera-window'),
  closeCameraWindow: () => ipcRenderer.invoke('close-camera-window'),
  isCameraWindowOpen: () => ipcRenderer.invoke('is-camera-window-open'),
  onCameraWindowState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (event, data) => callback(data);
    ipcRenderer.on('camera-window-state', listener);
    return () => {
      try {
        ipcRenderer.removeListener('camera-window-state', listener);
      } catch (_) {}
    };
  },
});
