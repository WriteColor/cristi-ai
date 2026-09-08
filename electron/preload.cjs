"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/src/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");

// electron/src/types/ipcChannels.ts
var IPC_CHANNELS = {
  // Window & Shell
  SET_IGNORE_MOUSE_EVENTS: "set-ignore-mouse-events",
  SYNC_INTERACTIVE_HITBOXES: "sync-interactive-hitboxes",
  SET_ALWAYS_ON_TOP: "set-always-on-top",
  GET_ALWAYS_ON_TOP: "get-always-on-top",
  MINIMIZE_WINDOW: "minimize-window",
  QUIT_APP: "quit-app",
  RELOAD_WINDOW: "reload-window",
  RELAUNCH_APP: "relaunch-app",
  GET_DISPLAY_INFO: "get-display-info",
  GET_PROCESS_MEMORY_INFO: "get-process-memory-info",
  GET_GPU_FEATURE_STATUS: "get-gpu-feature-status",
  GET_APP_VERSION: "get-app-version",
  // System & OS
  EXEC_COMMAND: "exec-command",
  READ_FILE: "read-file",
  WRITE_FILE: "write-file",
  APPEND_FILE: "append-file",
  READ_DIRECTORY: "read-directory",
  OPEN_EXTERNAL: "open-external",
  OPEN_PATH: "open-path",
  SHOW_ITEM_IN_FOLDER: "show-item-in-folder",
  GET_CLIPBOARD_TEXT: "get-clipboard-text",
  SET_CLIPBOARD_TEXT: "set-clipboard-text",
  SHOW_NOTIFICATION: "show-notification",
  // Config & Secrets
  GET_APP_CONFIG: "get-app-config",
  SAVE_APP_CONFIG: "save-app-config",
  SECURE_SET_SECRET: "secure-set-secret",
  SECURE_GET_SECRET: "secure-get-secret",
  SECURE_DELETE_SECRET: "secure-delete-secret",
  // Audio Loopback & Screen
  DESKTOP_AUDIO_NATIVE_START: "desktop-audio-native-start",
  DESKTOP_AUDIO_NATIVE_STOP: "desktop-audio-native-stop",
  DESKTOP_AUDIO_NATIVE_STATUS: "desktop-audio-native-status",
  CAPTURE_SCREEN_NATIVE: "capture-screen-native",
  // Memory
  MEMORY_LOAD: "memory-load",
  MEMORY_SAVE: "memory-save",
  // Subwindows
  OPEN_SETTINGS_WINDOW: "open-settings-window",
  CLOSE_SETTINGS_WINDOW: "close-settings-window",
  OPEN_CAMERA_WINDOW: "open-camera-window",
  CLOSE_CAMERA_WINDOW: "close-camera-window",
  IS_CAMERA_WINDOW_OPEN: "is-camera-window-open",
  // MCP
  MCP_CONNECT: "mcp-connect",
  MCP_CALL_TOOL: "mcp-call-tool",
  MCP_DISCONNECT: "mcp-disconnect",
  // Integrations
  SPOTIFY_CONTROL: "spotify-control",
  PLAYWRIGHT_EXECUTE: "playwright-execute",
  MINECRAFT_CONNECT: "minecraft-connect",
  MINECRAFT_DISCONNECT: "minecraft-disconnect",
  MINECRAFT_CHAT: "minecraft-chat",
  MINECRAFT_GET_STATUS: "minecraft-get-status",
  MINECRAFT_MOVE_TO: "minecraft-move-to",
  MINECRAFT_FOLLOW: "minecraft-follow",
  MINECRAFT_STOP: "minecraft-stop",
  MINECRAFT_MINE_BLOCK: "minecraft-mine-block",
  MINECRAFT_PLACE_BLOCK: "minecraft-place-block",
  MINECRAFT_ATTACK: "minecraft-attack",
  DISCORD_CONNECT: "discord-connect",
  DISCORD_DISCONNECT: "discord-disconnect",
  DISCORD_SEND_MESSAGE: "discord-send-message",
  DISCORD_SET_STATUS: "discord-set-status",
  DISCORD_GET_MESSAGES: "discord-get-messages",
  DISCORD_VOICE_JOIN: "discord-voice-join",
  DISCORD_VOICE_LEAVE: "discord-voice-leave",
  DISCORD_VOICE_SEND_AUDIO: "discord-voice-send-audio",
  // Updater
  CHECK_FOR_UPDATES: "check-for-updates",
  DOWNLOAD_UPDATE: "download-update",
  INSTALL_UPDATE: "install-update"
};

// electron/src/preload.ts
var ALLOWED_SHORTCUT_CHANNELS = /* @__PURE__ */ new Set([
  "shortcut-toggle-mute",
  "shortcut-capture-screen",
  "shortcut-toggle-zen-mode",
  "shortcut-toggle-perf-hud",
  "shortcut-toggle-always-on-top"
]);
var electronBridgeApi = {
  isElectron: true,
  // ── Click-Through & Hitboxes ──────────────────────────────────────────────
  setIgnoreMouseEvents: (ignore, options = {}) => {
    import_electron.ipcRenderer.send(IPC_CHANNELS.SET_IGNORE_MOUSE_EVENTS, Boolean(ignore), options);
  },
  syncHitboxes: (hitboxes) => {
    import_electron.ipcRenderer.send(IPC_CHANNELS.SYNC_INTERACTIVE_HITBOXES, hitboxes);
  },
  syncInteractiveHitboxes: (hitboxes) => {
    import_electron.ipcRenderer.send(IPC_CHANNELS.SYNC_INTERACTIVE_HITBOXES, hitboxes);
  },
  // ── Window Management ─────────────────────────────────────────────────────
  setAlwaysOnTop: (value) => {
    import_electron.ipcRenderer.send(IPC_CHANNELS.SET_ALWAYS_ON_TOP, Boolean(value));
  },
  getAlwaysOnTop: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.GET_ALWAYS_ON_TOP),
  minimizeWindow: () => import_electron.ipcRenderer.send(IPC_CHANNELS.MINIMIZE_WINDOW),
  showWindow: () => import_electron.ipcRenderer.send("show-window"),
  hideWindow: () => import_electron.ipcRenderer.send("hide-window"),
  quitApp: () => import_electron.ipcRenderer.send(IPC_CHANNELS.QUIT_APP),
  relaunchApp: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.RELAUNCH_APP),
  reloadWindow: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.RELOAD_WINDOW),
  // ── Display & Telemetry ───────────────────────────────────────────────────
  getDisplayInfo: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.GET_DISPLAY_INFO),
  getProcessMemoryInfo: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.GET_PROCESS_MEMORY_INFO),
  getGpuFeatureStatus: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.GET_GPU_FEATURE_STATUS),
  getGpuInfo: () => import_electron.ipcRenderer.invoke("get-gpu-info"),
  getAppVersion: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION),
  // ── Native OS Operations ──────────────────────────────────────────────────
  execCommand: (command, options) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.EXEC_COMMAND, command, options),
  readFile: (filePath) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.READ_FILE, filePath),
  writeFile: (filePath, data) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.WRITE_FILE, filePath, data),
  appendFile: (filePath, data) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.APPEND_FILE, filePath, data),
  readDirectory: (dirPath) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.READ_DIRECTORY, dirPath),
  openExternal: (url) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL, url),
  openPath: (targetPath) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.OPEN_PATH, targetPath),
  showItemInFolder: (targetPath) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.SHOW_ITEM_IN_FOLDER, targetPath),
  getClipboardText: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.GET_CLIPBOARD_TEXT),
  setClipboardText: (text) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.SET_CLIPBOARD_TEXT, text),
  showNotification: (payload) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.SHOW_NOTIFICATION, payload),
  // ── Security & Secrets ────────────────────────────────────────────────────
  setSecureSecret: (key, value) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.SECURE_SET_SECRET, key, value),
  getSecureSecret: (key) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.SECURE_GET_SECRET, key),
  deleteSecureSecret: (key) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.SECURE_DELETE_SECRET, key),
  secureSetSecret: (key, value) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.SECURE_SET_SECRET, key, value),
  secureGetSecret: (key) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.SECURE_GET_SECRET, key),
  secureDeleteSecret: (key) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.SECURE_DELETE_SECRET, key),
  // ── Audio Loopback & Screen Capture ───────────────────────────────────────
  captureScreenNative: (region) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_SCREEN_NATIVE, region),
  importCustomSceneFile: () => import_electron.ipcRenderer.invoke("import-custom-scene-file"),
  desktopAudioNativeStart: (options) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_AUDIO_NATIVE_START, options),
  desktopAudioNativeStop: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_AUDIO_NATIVE_STOP),
  desktopAudioNativeStatus: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_AUDIO_NATIVE_STATUS),
  onDesktopAudioNativeFrame: (callback) => {
    if (typeof callback !== "function") return () => {
    };
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("desktop-audio-native-frame", listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener("desktop-audio-native-frame", listener);
      } catch (_) {
      }
    };
  },
  onDesktopAudioNativeEvent: (callback) => {
    if (typeof callback !== "function") return () => {
    };
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("desktop-audio-native-event", listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener("desktop-audio-native-event", listener);
      } catch (_) {
      }
    };
  },
  // ── Memory ────────────────────────────────────────────────────────────────
  memoryLoad: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MEMORY_LOAD),
  memorySave: (memories) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MEMORY_SAVE, memories),
  // ── Subwindows ────────────────────────────────────────────────────────────
  openSettingsWindow: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.OPEN_SETTINGS_WINDOW),
  closeSettingsWindow: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.CLOSE_SETTINGS_WINDOW),
  openCameraWindow: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.OPEN_CAMERA_WINDOW),
  closeCameraWindow: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.CLOSE_CAMERA_WINDOW),
  isCameraWindowOpen: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.IS_CAMERA_WINDOW_OPEN),
  onSettingsWindowState: (callback) => {
    if (typeof callback !== "function") return () => {
    };
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("settings-window-state", listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener("settings-window-state", listener);
      } catch (_) {
      }
    };
  },
  onCameraWindowState: (callback) => {
    if (typeof callback !== "function") return () => {
    };
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("camera-window-state", listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener("camera-window-state", listener);
      } catch (_) {
      }
    };
  },
  // ── MCP ───────────────────────────────────────────────────────────────────
  mcpConnect: (config) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MCP_CONNECT, config),
  mcpCallTool: (payload) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MCP_CALL_TOOL, payload),
  mcpDisconnect: (serverId) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MCP_DISCONNECT, serverId),
  // ── Integrations ──────────────────────────────────────────────────────────
  playwrightExecute: (action, params) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.PLAYWRIGHT_EXECUTE, action, params),
  spotifyControl: (action, params) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.SPOTIFY_CONTROL, action, params),
  // Minecraft
  minecraftConnect: (opts) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_CONNECT, opts),
  minecraftDisconnect: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_DISCONNECT),
  minecraftChat: (msg) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_CHAT, msg),
  minecraftGetStatus: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_GET_STATUS),
  minecraftMoveTo: (coords) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_MOVE_TO, coords),
  minecraftFollow: (player) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_FOLLOW, player),
  minecraftStop: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_STOP),
  minecraftMineBlock: (coords) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_MINE_BLOCK, coords),
  minecraftPlaceBlock: (payload) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_PLACE_BLOCK, payload),
  minecraftAttack: (payload) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.MINECRAFT_ATTACK, payload),
  onMinecraftChat: (callback) => {
    if (typeof callback !== "function") return () => {
    };
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("minecraft-chat", listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener("minecraft-chat", listener);
      } catch (_) {
      }
    };
  },
  onMinecraftEvent: (callback) => {
    if (typeof callback !== "function") return () => {
    };
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("minecraft-event", listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener("minecraft-event", listener);
      } catch (_) {
      }
    };
  },
  // Discord
  discordConnect: (opts) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.DISCORD_CONNECT, opts),
  discordDisconnect: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.DISCORD_DISCONNECT),
  discordSendMessage: (payload) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SEND_MESSAGE, payload),
  discordGetMessages: (payload) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.DISCORD_GET_MESSAGES, payload),
  discordSetStatus: (opts) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.DISCORD_SET_STATUS, opts),
  discordVoiceJoin: (opts) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.DISCORD_VOICE_JOIN, opts),
  discordVoiceLeave: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.DISCORD_VOICE_LEAVE),
  discordVoiceSendAudio: (payload) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.DISCORD_VOICE_SEND_AUDIO, payload),
  onDiscordMessage: (callback) => {
    if (typeof callback !== "function") return () => {
    };
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("discord-message", listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener("discord-message", listener);
      } catch (_) {
      }
    };
  },
  onDiscordEvent: (callback) => {
    if (typeof callback !== "function") return () => {
    };
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("discord-event", listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener("discord-event", listener);
      } catch (_) {
      }
    };
  },
  onDiscordVoiceEvent: (callback) => {
    if (typeof callback !== "function") return () => {
    };
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("discord-voice-event", listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener("discord-voice-event", listener);
      } catch (_) {
      }
    };
  },
  onDiscordVoiceAudio: (callback) => {
    if (typeof callback !== "function") return () => {
    };
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("discord-voice-audio", listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener("discord-voice-audio", listener);
      } catch (_) {
      }
    };
  },
  // ── Updater ───────────────────────────────────────────────────────────────
  checkForUpdates: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.CHECK_FOR_UPDATES),
  downloadUpdate: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_UPDATE),
  installUpdate: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.INSTALL_UPDATE),
  onUpdateStatus: (callback) => {
    if (typeof callback !== "function") return () => {
    };
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("update-status", listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener("update-status", listener);
      } catch (_) {
      }
    };
  },
  // ── Shortcuts ─────────────────────────────────────────────────────────────
  onShortcutEvent: (channel, callback) => {
    if (!ALLOWED_SHORTCUT_CHANNELS.has(channel) || typeof callback !== "function") {
      return () => {
      };
    }
    const listener = (_event, ...args) => callback(...args);
    import_electron.ipcRenderer.on(channel, listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener(channel, listener);
      } catch (_) {
      }
    };
  },
  // ── Settings & Config ─────────────────────────────────────────────────────
  saveAppConfig: (config) => import_electron.ipcRenderer.invoke(IPC_CHANNELS.SAVE_APP_CONFIG, config),
  getAppConfig: () => import_electron.ipcRenderer.invoke(IPC_CHANNELS.GET_APP_CONFIG),
  onConfigUpdated: (callback) => {
    if (typeof callback !== "function") return () => {
    };
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("config-updated", listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener("config-updated", listener);
      } catch (_) {
      }
    };
  },
  onCompanionPause: (callback) => {
    if (typeof callback !== "function") return () => {
    };
    const listener = () => callback();
    import_electron.ipcRenderer.on("companion-pause", listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener("companion-pause", listener);
      } catch (_) {
      }
    };
  },
  onCompanionResume: (callback) => {
    if (typeof callback !== "function") return () => {
    };
    const listener = () => callback();
    import_electron.ipcRenderer.on("companion-resume", listener);
    return () => {
      try {
        import_electron.ipcRenderer.removeListener("companion-resume", listener);
      } catch (_) {
      }
    };
  }
};
import_electron.contextBridge.exposeInMainWorld("electron", electronBridgeApi);
import_electron.contextBridge.exposeInMainWorld("electronBridge", electronBridgeApi);
import_electron.contextBridge.exposeInMainWorld("electronAPI", electronBridgeApi);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3ByZWxvYWQudHMiLCAiLi4vc3JjL3R5cGVzL2lwY0NoYW5uZWxzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBjb250ZXh0QnJpZGdlLCBpcGNSZW5kZXJlciwgSXBjUmVuZGVyZXJFdmVudCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCB7IElQQ19DSEFOTkVMUyB9IGZyb20gJy4vdHlwZXMvaXBjQ2hhbm5lbHMnO1xuXG5jb25zdCBBTExPV0VEX1NIT1JUQ1VUX0NIQU5ORUxTID0gbmV3IFNldChbXG4gICdzaG9ydGN1dC10b2dnbGUtbXV0ZScsXG4gICdzaG9ydGN1dC1jYXB0dXJlLXNjcmVlbicsXG4gICdzaG9ydGN1dC10b2dnbGUtemVuLW1vZGUnLFxuICAnc2hvcnRjdXQtdG9nZ2xlLXBlcmYtaHVkJyxcbiAgJ3Nob3J0Y3V0LXRvZ2dsZS1hbHdheXMtb24tdG9wJyxcbl0pO1xuXG5leHBvcnQgaW50ZXJmYWNlIEVsZWN0cm9uQXBpQnJpZGdlIHtcbiAgaXNFbGVjdHJvbjogYm9vbGVhbjtcblxuICAvLyBXaW5kb3cgJiBIaXRib3hlc1xuICBzZXRJZ25vcmVNb3VzZUV2ZW50czogKGlnbm9yZTogYm9vbGVhbiwgb3B0aW9ucz86IHsgZm9yd2FyZD86IGJvb2xlYW4gfSkgPT4gdm9pZDtcbiAgc3luY0hpdGJveGVzOiAoaGl0Ym94ZXM6IHVua25vd25bXSkgPT4gdm9pZDtcbiAgc3luY0ludGVyYWN0aXZlSGl0Ym94ZXM6IChoaXRib3hlczogdW5rbm93bltdKSA9PiB2b2lkO1xuICBzZXRBbHdheXNPblRvcDogKHZhbHVlOiBib29sZWFuKSA9PiB2b2lkO1xuICBnZXRBbHdheXNPblRvcDogKCkgPT4gUHJvbWlzZTxib29sZWFuPjtcbiAgbWluaW1pemVXaW5kb3c6ICgpID0+IHZvaWQ7XG4gIHNob3dXaW5kb3c6ICgpID0+IHZvaWQ7XG4gIGhpZGVXaW5kb3c6ICgpID0+IHZvaWQ7XG4gIHF1aXRBcHA6ICgpID0+IHZvaWQ7XG4gIHJlbGF1bmNoQXBwOiAoKSA9PiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgZXJyb3I/OiBzdHJpbmcgfT47XG4gIHJlbG9hZFdpbmRvdzogKCkgPT4gUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IGVycm9yPzogc3RyaW5nIH0+O1xuICBnZXREaXNwbGF5SW5mbzogKCkgPT4gUHJvbWlzZTxhbnk+O1xuICBnZXRQcm9jZXNzTWVtb3J5SW5mbzogKCkgPT4gUHJvbWlzZTxhbnk+O1xuICBnZXRHcHVGZWF0dXJlU3RhdHVzOiAoKSA9PiBQcm9taXNlPGFueT47XG4gIGdldEdwdUluZm86ICgpID0+IFByb21pc2U8YW55PjtcbiAgZ2V0QXBwVmVyc2lvbjogKCkgPT4gUHJvbWlzZTxzdHJpbmc+O1xuXG4gIC8vIE5hdGl2ZSBPUyAmIFN5c3RlbVxuICBleGVjQ29tbWFuZDogKGNvbW1hbmQ6IHN0cmluZywgb3B0aW9ucz86IGFueSkgPT4gUHJvbWlzZTxhbnk+O1xuICByZWFkRmlsZTogKGZpbGVQYXRoOiBzdHJpbmcpID0+IFByb21pc2U8c3RyaW5nPjtcbiAgd3JpdGVGaWxlOiAoZmlsZVBhdGg6IHN0cmluZywgZGF0YTogc3RyaW5nKSA9PiBQcm9taXNlPGJvb2xlYW4+O1xuICBhcHBlbmRGaWxlOiAoZmlsZVBhdGg6IHN0cmluZywgZGF0YTogc3RyaW5nKSA9PiBQcm9taXNlPGJvb2xlYW4+O1xuICByZWFkRGlyZWN0b3J5OiAoZGlyUGF0aDogc3RyaW5nKSA9PiBQcm9taXNlPGFueT47XG4gIG9wZW5FeHRlcm5hbDogKHVybDogc3RyaW5nKSA9PiBQcm9taXNlPGJvb2xlYW4+O1xuICBvcGVuUGF0aDogKHRhcmdldFBhdGg6IHN0cmluZykgPT4gUHJvbWlzZTxhbnk+O1xuICBzaG93SXRlbUluRm9sZGVyOiAodGFyZ2V0UGF0aDogc3RyaW5nKSA9PiBQcm9taXNlPGJvb2xlYW4+O1xuICBnZXRDbGlwYm9hcmRUZXh0OiAoKSA9PiBQcm9taXNlPHN0cmluZz47XG4gIHNldENsaXBib2FyZFRleHQ6ICh0ZXh0OiBzdHJpbmcpID0+IFByb21pc2U8Ym9vbGVhbj47XG4gIHNob3dOb3RpZmljYXRpb246IChwYXlsb2FkOiB7IHRpdGxlPzogc3RyaW5nOyBib2R5Pzogc3RyaW5nIH0pID0+IFByb21pc2U8Ym9vbGVhbj47XG5cbiAgLy8gU2VjdXJpdHkgJiBTZWNyZXRzXG4gIHNldFNlY3VyZVNlY3JldDogKGtleTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKSA9PiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgZXJyb3I/OiBzdHJpbmcgfT47XG4gIGdldFNlY3VyZVNlY3JldDogKGtleTogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZyB8IG51bGw+O1xuICBkZWxldGVTZWN1cmVTZWNyZXQ6IChrZXk6IHN0cmluZykgPT4gUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IGVycm9yPzogc3RyaW5nIH0+O1xuICBzZWN1cmVTZXRTZWNyZXQ6IChrZXk6IHN0cmluZywgdmFsdWU6IHN0cmluZykgPT4gUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IGVycm9yPzogc3RyaW5nIH0+O1xuICBzZWN1cmVHZXRTZWNyZXQ6IChrZXk6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmcgfCBudWxsPjtcbiAgc2VjdXJlRGVsZXRlU2VjcmV0OiAoa2V5OiBzdHJpbmcpID0+IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBlcnJvcj86IHN0cmluZyB9PjtcblxuICAvLyBBdWRpbyBMb29wYmFjayAmIFNjcmVlblxuICBjYXB0dXJlU2NyZWVuTmF0aXZlOiAocmVnaW9uPzogYW55KSA9PiBQcm9taXNlPHN0cmluZyB8IG51bGw+O1xuICBpbXBvcnRDdXN0b21TY2VuZUZpbGU6ICgpID0+IFByb21pc2U8YW55PjtcbiAgZGVza3RvcEF1ZGlvTmF0aXZlU3RhcnQ6IChvcHRpb25zPzogYW55KSA9PiBQcm9taXNlPGFueT47XG4gIGRlc2t0b3BBdWRpb05hdGl2ZVN0b3A6ICgpID0+IFByb21pc2U8YW55PjtcbiAgZGVza3RvcEF1ZGlvTmF0aXZlU3RhdHVzOiAoKSA9PiBQcm9taXNlPGFueT47XG4gIG9uRGVza3RvcEF1ZGlvTmF0aXZlRnJhbWU6IChjYWxsYmFjazogKGRhdGE6IGFueSkgPT4gdm9pZCkgPT4gKCkgPT4gdm9pZDtcbiAgb25EZXNrdG9wQXVkaW9OYXRpdmVFdmVudDogKGNhbGxiYWNrOiAoZGF0YTogYW55KSA9PiB2b2lkKSA9PiAoKSA9PiB2b2lkO1xuXG4gIC8vIE1lbW9yeVxuICBtZW1vcnlMb2FkOiAoKSA9PiBQcm9taXNlPGFueT47XG4gIG1lbW9yeVNhdmU6IChtZW1vcmllczogYW55W10pID0+IFByb21pc2U8YW55PjtcblxuICAvLyBTdWJ3aW5kb3dzXG4gIG9wZW5TZXR0aW5nc1dpbmRvdzogKCkgPT4gUHJvbWlzZTxhbnk+O1xuICBjbG9zZVNldHRpbmdzV2luZG93OiAoKSA9PiBQcm9taXNlPGFueT47XG4gIG9wZW5DYW1lcmFXaW5kb3c6ICgpID0+IFByb21pc2U8YW55PjtcbiAgY2xvc2VDYW1lcmFXaW5kb3c6ICgpID0+IFByb21pc2U8YW55PjtcbiAgaXNDYW1lcmFXaW5kb3dPcGVuOiAoKSA9PiBQcm9taXNlPGJvb2xlYW4+O1xuICBvblNldHRpbmdzV2luZG93U3RhdGU6IChjYWxsYmFjazogKGRhdGE6IGFueSkgPT4gdm9pZCkgPT4gKCkgPT4gdm9pZDtcbiAgb25DYW1lcmFXaW5kb3dTdGF0ZTogKGNhbGxiYWNrOiAoZGF0YTogYW55KSA9PiB2b2lkKSA9PiAoKSA9PiB2b2lkO1xuXG4gIC8vIE1DUFxuICBtY3BDb25uZWN0OiAoY29uZmlnOiBhbnkpID0+IFByb21pc2U8YW55PjtcbiAgbWNwQ2FsbFRvb2w6IChwYXlsb2FkOiBhbnkpID0+IFByb21pc2U8YW55PjtcbiAgbWNwRGlzY29ubmVjdDogKHNlcnZlcklkOiBzdHJpbmcpID0+IFByb21pc2U8YW55PjtcblxuICAvLyBQbGF5d3JpZ2h0ICYgU3BvdGlmeVxuICBwbGF5d3JpZ2h0RXhlY3V0ZTogKGFjdGlvbjogc3RyaW5nLCBwYXJhbXM/OiBhbnkpID0+IFByb21pc2U8YW55PjtcbiAgc3BvdGlmeUNvbnRyb2w6IChhY3Rpb246IHN0cmluZywgcGFyYW1zPzogYW55KSA9PiBQcm9taXNlPGFueT47XG5cbiAgLy8gTWluZWNyYWZ0XG4gIG1pbmVjcmFmdENvbm5lY3Q6IChvcHRzPzogYW55KSA9PiBQcm9taXNlPGFueT47XG4gIG1pbmVjcmFmdERpc2Nvbm5lY3Q6ICgpID0+IFByb21pc2U8YW55PjtcbiAgbWluZWNyYWZ0Q2hhdDogKG1zZzogc3RyaW5nKSA9PiBQcm9taXNlPGFueT47XG4gIG1pbmVjcmFmdEdldFN0YXR1czogKCkgPT4gUHJvbWlzZTxhbnk+O1xuICBtaW5lY3JhZnRNb3ZlVG86IChjb29yZHM6IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHo6IG51bWJlciB9KSA9PiBQcm9taXNlPGFueT47XG4gIG1pbmVjcmFmdEZvbGxvdzogKHBsYXllcjogc3RyaW5nKSA9PiBQcm9taXNlPGFueT47XG4gIG1pbmVjcmFmdFN0b3A6ICgpID0+IFByb21pc2U8YW55PjtcbiAgbWluZWNyYWZ0TWluZUJsb2NrOiAoY29vcmRzOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyB6OiBudW1iZXIgfSkgPT4gUHJvbWlzZTxhbnk+O1xuICBtaW5lY3JhZnRQbGFjZUJsb2NrOiAocGF5bG9hZDogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgejogbnVtYmVyOyBibG9ja05hbWU6IHN0cmluZyB9KSA9PiBQcm9taXNlPGFueT47XG4gIG1pbmVjcmFmdEF0dGFjazogKHBheWxvYWQ6IHsgZW50aXR5TmFtZT86IHN0cmluZyB9KSA9PiBQcm9taXNlPGFueT47XG4gIG9uTWluZWNyYWZ0Q2hhdDogKGNhbGxiYWNrOiAoZGF0YTogYW55KSA9PiB2b2lkKSA9PiAoKSA9PiB2b2lkO1xuICBvbk1pbmVjcmFmdEV2ZW50OiAoY2FsbGJhY2s6IChkYXRhOiBhbnkpID0+IHZvaWQpID0+ICgpID0+IHZvaWQ7XG5cbiAgLy8gRGlzY29yZFxuICBkaXNjb3JkQ29ubmVjdDogKG9wdHM6IGFueSkgPT4gUHJvbWlzZTxhbnk+O1xuICBkaXNjb3JkRGlzY29ubmVjdDogKCkgPT4gUHJvbWlzZTxhbnk+O1xuICBkaXNjb3JkU2VuZE1lc3NhZ2U6IChwYXlsb2FkOiB7IGNoYW5uZWxJZDogc3RyaW5nOyBjb250ZW50OiBzdHJpbmcgfSkgPT4gUHJvbWlzZTxhbnk+O1xuICBkaXNjb3JkR2V0TWVzc2FnZXM6IChwYXlsb2FkOiB7IGNoYW5uZWxJZDogc3RyaW5nOyBsaW1pdD86IG51bWJlciB9KSA9PiBQcm9taXNlPGFueT47XG4gIGRpc2NvcmRTZXRTdGF0dXM6IChvcHRzOiB7IHN0YXR1c1RleHQ6IHN0cmluZzsgYWN0aXZpdHlUeXBlPzogc3RyaW5nIH0pID0+IFByb21pc2U8YW55PjtcbiAgZGlzY29yZFZvaWNlSm9pbjogKG9wdHM6IHsgZ3VpbGRJZDogc3RyaW5nOyBjaGFubmVsSWQ6IHN0cmluZyB9KSA9PiBQcm9taXNlPGFueT47XG4gIGRpc2NvcmRWb2ljZUxlYXZlOiAoKSA9PiBQcm9taXNlPGFueT47XG4gIGRpc2NvcmRWb2ljZVNlbmRBdWRpbzogKHBheWxvYWQ6IHsgZGF0YTogc3RyaW5nIH0pID0+IFByb21pc2U8YW55PjtcbiAgb25EaXNjb3JkTWVzc2FnZTogKGNhbGxiYWNrOiAoZGF0YTogYW55KSA9PiB2b2lkKSA9PiAoKSA9PiB2b2lkO1xuICBvbkRpc2NvcmRFdmVudDogKGNhbGxiYWNrOiAoZGF0YTogYW55KSA9PiB2b2lkKSA9PiAoKSA9PiB2b2lkO1xuICBvbkRpc2NvcmRWb2ljZUV2ZW50OiAoY2FsbGJhY2s6IChkYXRhOiBhbnkpID0+IHZvaWQpID0+ICgpID0+IHZvaWQ7XG4gIG9uRGlzY29yZFZvaWNlQXVkaW86IChjYWxsYmFjazogKGRhdGE6IGFueSkgPT4gdm9pZCkgPT4gKCkgPT4gdm9pZDtcblxuICAvLyBBdXRvLVVwZGF0ZXJcbiAgY2hlY2tGb3JVcGRhdGVzOiAoKSA9PiBQcm9taXNlPGFueT47XG4gIGRvd25sb2FkVXBkYXRlOiAoKSA9PiBQcm9taXNlPGFueT47XG4gIGluc3RhbGxVcGRhdGU6ICgpID0+IFByb21pc2U8YW55PjtcbiAgb25VcGRhdGVTdGF0dXM6IChjYWxsYmFjazogKGRhdGE6IGFueSkgPT4gdm9pZCkgPT4gKCkgPT4gdm9pZDtcblxuICAvLyBHbG9iYWwgU2hvcnRjdXRzXG4gIG9uU2hvcnRjdXRFdmVudDogKGNoYW5uZWw6IHN0cmluZywgY2FsbGJhY2s6ICguLi5hcmdzOiBhbnlbXSkgPT4gdm9pZCkgPT4gKCkgPT4gdm9pZDtcblxuICAvLyBTZXR0aW5ncyAmIENvbmZpZ1xuICBzYXZlQXBwQ29uZmlnOiAoY29uZmlnOiBhbnkpID0+IFByb21pc2U8YW55PjtcbiAgZ2V0QXBwQ29uZmlnOiAoKSA9PiBQcm9taXNlPGFueT47XG4gIG9uQ29uZmlnVXBkYXRlZDogKGNhbGxiYWNrOiAoZGF0YTogYW55KSA9PiB2b2lkKSA9PiAoKSA9PiB2b2lkO1xuICBvbkNvbXBhbmlvblBhdXNlOiAoY2FsbGJhY2s6ICgpID0+IHZvaWQpID0+ICgpID0+IHZvaWQ7XG4gIG9uQ29tcGFuaW9uUmVzdW1lOiAoY2FsbGJhY2s6ICgpID0+IHZvaWQpID0+ICgpID0+IHZvaWQ7XG59XG5cbmNvbnN0IGVsZWN0cm9uQnJpZGdlQXBpOiBFbGVjdHJvbkFwaUJyaWRnZSA9IHtcbiAgaXNFbGVjdHJvbjogdHJ1ZSxcblxuICAvLyBcdTI1MDBcdTI1MDAgQ2xpY2stVGhyb3VnaCAmIEhpdGJveGVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBzZXRJZ25vcmVNb3VzZUV2ZW50czogKGlnbm9yZTogYm9vbGVhbiwgb3B0aW9uczogeyBmb3J3YXJkPzogYm9vbGVhbiB9ID0ge30pID0+IHtcbiAgICBpcGNSZW5kZXJlci5zZW5kKElQQ19DSEFOTkVMUy5TRVRfSUdOT1JFX01PVVNFX0VWRU5UUywgQm9vbGVhbihpZ25vcmUpLCBvcHRpb25zKTtcbiAgfSxcbiAgc3luY0hpdGJveGVzOiAoaGl0Ym94ZXM6IHVua25vd25bXSkgPT4ge1xuICAgIGlwY1JlbmRlcmVyLnNlbmQoSVBDX0NIQU5ORUxTLlNZTkNfSU5URVJBQ1RJVkVfSElUQk9YRVMsIGhpdGJveGVzKTtcbiAgfSxcbiAgc3luY0ludGVyYWN0aXZlSGl0Ym94ZXM6IChoaXRib3hlczogdW5rbm93bltdKSA9PiB7XG4gICAgaXBjUmVuZGVyZXIuc2VuZChJUENfQ0hBTk5FTFMuU1lOQ19JTlRFUkFDVElWRV9ISVRCT1hFUywgaGl0Ym94ZXMpO1xuICB9LFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBXaW5kb3cgTWFuYWdlbWVudCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgc2V0QWx3YXlzT25Ub3A6ICh2YWx1ZTogYm9vbGVhbikgPT4ge1xuICAgIGlwY1JlbmRlcmVyLnNlbmQoSVBDX0NIQU5ORUxTLlNFVF9BTFdBWVNfT05fVE9QLCBCb29sZWFuKHZhbHVlKSk7XG4gIH0sXG4gIGdldEFsd2F5c09uVG9wOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLkdFVF9BTFdBWVNfT05fVE9QKSxcbiAgbWluaW1pemVXaW5kb3c6ICgpID0+IGlwY1JlbmRlcmVyLnNlbmQoSVBDX0NIQU5ORUxTLk1JTklNSVpFX1dJTkRPVyksXG4gIHNob3dXaW5kb3c6ICgpID0+IGlwY1JlbmRlcmVyLnNlbmQoJ3Nob3ctd2luZG93JyksXG4gIGhpZGVXaW5kb3c6ICgpID0+IGlwY1JlbmRlcmVyLnNlbmQoJ2hpZGUtd2luZG93JyksXG4gIHF1aXRBcHA6ICgpID0+IGlwY1JlbmRlcmVyLnNlbmQoSVBDX0NIQU5ORUxTLlFVSVRfQVBQKSxcbiAgcmVsYXVuY2hBcHA6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuUkVMQVVOQ0hfQVBQKSxcbiAgcmVsb2FkV2luZG93OiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLlJFTE9BRF9XSU5ET1cpLFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBEaXNwbGF5ICYgVGVsZW1ldHJ5IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBnZXREaXNwbGF5SW5mbzogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5HRVRfRElTUExBWV9JTkZPKSxcbiAgZ2V0UHJvY2Vzc01lbW9yeUluZm86ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuR0VUX1BST0NFU1NfTUVNT1JZX0lORk8pLFxuICBnZXRHcHVGZWF0dXJlU3RhdHVzOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLkdFVF9HUFVfRkVBVFVSRV9TVEFUVVMpLFxuICBnZXRHcHVJbmZvOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2dldC1ncHUtaW5mbycpLFxuICBnZXRBcHBWZXJzaW9uOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLkdFVF9BUFBfVkVSU0lPTiksXG5cbiAgLy8gXHUyNTAwXHUyNTAwIE5hdGl2ZSBPUyBPcGVyYXRpb25zIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBleGVjQ29tbWFuZDogKGNvbW1hbmQ6IHN0cmluZywgb3B0aW9ucz86IGFueSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5FWEVDX0NPTU1BTkQsIGNvbW1hbmQsIG9wdGlvbnMpLFxuICByZWFkRmlsZTogKGZpbGVQYXRoOiBzdHJpbmcpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuUkVBRF9GSUxFLCBmaWxlUGF0aCksXG4gIHdyaXRlRmlsZTogKGZpbGVQYXRoOiBzdHJpbmcsIGRhdGE6IHN0cmluZykgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5XUklURV9GSUxFLCBmaWxlUGF0aCwgZGF0YSksXG4gIGFwcGVuZEZpbGU6IChmaWxlUGF0aDogc3RyaW5nLCBkYXRhOiBzdHJpbmcpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuQVBQRU5EX0ZJTEUsIGZpbGVQYXRoLCBkYXRhKSxcbiAgcmVhZERpcmVjdG9yeTogKGRpclBhdGg6IHN0cmluZykgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5SRUFEX0RJUkVDVE9SWSwgZGlyUGF0aCksXG4gIG9wZW5FeHRlcm5hbDogKHVybDogc3RyaW5nKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLk9QRU5fRVhURVJOQUwsIHVybCksXG4gIG9wZW5QYXRoOiAodGFyZ2V0UGF0aDogc3RyaW5nKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLk9QRU5fUEFUSCwgdGFyZ2V0UGF0aCksXG4gIHNob3dJdGVtSW5Gb2xkZXI6ICh0YXJnZXRQYXRoOiBzdHJpbmcpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuU0hPV19JVEVNX0lOX0ZPTERFUiwgdGFyZ2V0UGF0aCksXG4gIGdldENsaXBib2FyZFRleHQ6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuR0VUX0NMSVBCT0FSRF9URVhUKSxcbiAgc2V0Q2xpcGJvYXJkVGV4dDogKHRleHQ6IHN0cmluZykgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5TRVRfQ0xJUEJPQVJEX1RFWFQsIHRleHQpLFxuICBzaG93Tm90aWZpY2F0aW9uOiAocGF5bG9hZDogeyB0aXRsZT86IHN0cmluZzsgYm9keT86IHN0cmluZyB9KSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLlNIT1dfTk9USUZJQ0FUSU9OLCBwYXlsb2FkKSxcblxuICAvLyBcdTI1MDBcdTI1MDAgU2VjdXJpdHkgJiBTZWNyZXRzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBzZXRTZWN1cmVTZWNyZXQ6IChrZXk6IHN0cmluZywgdmFsdWU6IHN0cmluZykgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5TRUNVUkVfU0VUX1NFQ1JFVCwga2V5LCB2YWx1ZSksXG4gIGdldFNlY3VyZVNlY3JldDogKGtleTogc3RyaW5nKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLlNFQ1VSRV9HRVRfU0VDUkVULCBrZXkpLFxuICBkZWxldGVTZWN1cmVTZWNyZXQ6IChrZXk6IHN0cmluZykgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5TRUNVUkVfREVMRVRFX1NFQ1JFVCwga2V5KSxcbiAgc2VjdXJlU2V0U2VjcmV0OiAoa2V5OiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuU0VDVVJFX1NFVF9TRUNSRVQsIGtleSwgdmFsdWUpLFxuICBzZWN1cmVHZXRTZWNyZXQ6IChrZXk6IHN0cmluZykgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5TRUNVUkVfR0VUX1NFQ1JFVCwga2V5KSxcbiAgc2VjdXJlRGVsZXRlU2VjcmV0OiAoa2V5OiBzdHJpbmcpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuU0VDVVJFX0RFTEVURV9TRUNSRVQsIGtleSksXG5cbiAgLy8gXHUyNTAwXHUyNTAwIEF1ZGlvIExvb3BiYWNrICYgU2NyZWVuIENhcHR1cmUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNhcHR1cmVTY3JlZW5OYXRpdmU6IChyZWdpb24/OiBhbnkpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuQ0FQVFVSRV9TQ1JFRU5fTkFUSVZFLCByZWdpb24pLFxuICBpbXBvcnRDdXN0b21TY2VuZUZpbGU6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnaW1wb3J0LWN1c3RvbS1zY2VuZS1maWxlJyksXG4gIGRlc2t0b3BBdWRpb05hdGl2ZVN0YXJ0OiAob3B0aW9ucz86IGFueSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5ERVNLVE9QX0FVRElPX05BVElWRV9TVEFSVCwgb3B0aW9ucyksXG4gIGRlc2t0b3BBdWRpb05hdGl2ZVN0b3A6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuREVTS1RPUF9BVURJT19OQVRJVkVfU1RPUCksXG4gIGRlc2t0b3BBdWRpb05hdGl2ZVN0YXR1czogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5ERVNLVE9QX0FVRElPX05BVElWRV9TVEFUVVMpLFxuICBvbkRlc2t0b3BBdWRpb05hdGl2ZUZyYW1lOiAoY2FsbGJhY2s6IChkYXRhOiBhbnkpID0+IHZvaWQpID0+IHtcbiAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSByZXR1cm4gKCkgPT4ge307XG4gICAgY29uc3QgbGlzdGVuZXIgPSAoX2V2ZW50OiBJcGNSZW5kZXJlckV2ZW50LCBkYXRhOiBhbnkpID0+IGNhbGxiYWNrKGRhdGEpO1xuICAgIGlwY1JlbmRlcmVyLm9uKCdkZXNrdG9wLWF1ZGlvLW5hdGl2ZS1mcmFtZScsIGxpc3RlbmVyKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaXBjUmVuZGVyZXIucmVtb3ZlTGlzdGVuZXIoJ2Rlc2t0b3AtYXVkaW8tbmF0aXZlLWZyYW1lJywgbGlzdGVuZXIpO1xuICAgICAgfSBjYXRjaCAoXykge31cbiAgICB9O1xuICB9LFxuICBvbkRlc2t0b3BBdWRpb05hdGl2ZUV2ZW50OiAoY2FsbGJhY2s6IChkYXRhOiBhbnkpID0+IHZvaWQpID0+IHtcbiAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSByZXR1cm4gKCkgPT4ge307XG4gICAgY29uc3QgbGlzdGVuZXIgPSAoX2V2ZW50OiBJcGNSZW5kZXJlckV2ZW50LCBkYXRhOiBhbnkpID0+IGNhbGxiYWNrKGRhdGEpO1xuICAgIGlwY1JlbmRlcmVyLm9uKCdkZXNrdG9wLWF1ZGlvLW5hdGl2ZS1ldmVudCcsIGxpc3RlbmVyKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaXBjUmVuZGVyZXIucmVtb3ZlTGlzdGVuZXIoJ2Rlc2t0b3AtYXVkaW8tbmF0aXZlLWV2ZW50JywgbGlzdGVuZXIpO1xuICAgICAgfSBjYXRjaCAoXykge31cbiAgICB9O1xuICB9LFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBNZW1vcnkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIG1lbW9yeUxvYWQ6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuTUVNT1JZX0xPQUQpLFxuICBtZW1vcnlTYXZlOiAobWVtb3JpZXM6IGFueVtdKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLk1FTU9SWV9TQVZFLCBtZW1vcmllcyksXG5cbiAgLy8gXHUyNTAwXHUyNTAwIFN1YndpbmRvd3MgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIG9wZW5TZXR0aW5nc1dpbmRvdzogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5PUEVOX1NFVFRJTkdTX1dJTkRPVyksXG4gIGNsb3NlU2V0dGluZ3NXaW5kb3c6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuQ0xPU0VfU0VUVElOR1NfV0lORE9XKSxcbiAgb3BlbkNhbWVyYVdpbmRvdzogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5PUEVOX0NBTUVSQV9XSU5ET1cpLFxuICBjbG9zZUNhbWVyYVdpbmRvdzogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5DTE9TRV9DQU1FUkFfV0lORE9XKSxcbiAgaXNDYW1lcmFXaW5kb3dPcGVuOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLklTX0NBTUVSQV9XSU5ET1dfT1BFTiksXG4gIG9uU2V0dGluZ3NXaW5kb3dTdGF0ZTogKGNhbGxiYWNrOiAoZGF0YTogYW55KSA9PiB2b2lkKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykgcmV0dXJuICgpID0+IHt9O1xuICAgIGNvbnN0IGxpc3RlbmVyID0gKF9ldmVudDogSXBjUmVuZGVyZXJFdmVudCwgZGF0YTogYW55KSA9PiBjYWxsYmFjayhkYXRhKTtcbiAgICBpcGNSZW5kZXJlci5vbignc2V0dGluZ3Mtd2luZG93LXN0YXRlJywgbGlzdGVuZXIpO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBpcGNSZW5kZXJlci5yZW1vdmVMaXN0ZW5lcignc2V0dGluZ3Mtd2luZG93LXN0YXRlJywgbGlzdGVuZXIpO1xuICAgICAgfSBjYXRjaCAoXykge31cbiAgICB9O1xuICB9LFxuICBvbkNhbWVyYVdpbmRvd1N0YXRlOiAoY2FsbGJhY2s6IChkYXRhOiBhbnkpID0+IHZvaWQpID0+IHtcbiAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSByZXR1cm4gKCkgPT4ge307XG4gICAgY29uc3QgbGlzdGVuZXIgPSAoX2V2ZW50OiBJcGNSZW5kZXJlckV2ZW50LCBkYXRhOiBhbnkpID0+IGNhbGxiYWNrKGRhdGEpO1xuICAgIGlwY1JlbmRlcmVyLm9uKCdjYW1lcmEtd2luZG93LXN0YXRlJywgbGlzdGVuZXIpO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBpcGNSZW5kZXJlci5yZW1vdmVMaXN0ZW5lcignY2FtZXJhLXdpbmRvdy1zdGF0ZScsIGxpc3RlbmVyKTtcbiAgICAgIH0gY2F0Y2ggKF8pIHt9XG4gICAgfTtcbiAgfSxcblxuICAvLyBcdTI1MDBcdTI1MDAgTUNQIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBtY3BDb25uZWN0OiAoY29uZmlnOiBhbnkpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuTUNQX0NPTk5FQ1QsIGNvbmZpZyksXG4gIG1jcENhbGxUb29sOiAocGF5bG9hZDogYW55KSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLk1DUF9DQUxMX1RPT0wsIHBheWxvYWQpLFxuICBtY3BEaXNjb25uZWN0OiAoc2VydmVySWQ6IHN0cmluZykgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5NQ1BfRElTQ09OTkVDVCwgc2VydmVySWQpLFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBJbnRlZ3JhdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIHBsYXl3cmlnaHRFeGVjdXRlOiAoYWN0aW9uOiBzdHJpbmcsIHBhcmFtcz86IGFueSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5QTEFZV1JJR0hUX0VYRUNVVEUsIGFjdGlvbiwgcGFyYW1zKSxcbiAgc3BvdGlmeUNvbnRyb2w6IChhY3Rpb246IHN0cmluZywgcGFyYW1zPzogYW55KSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLlNQT1RJRllfQ09OVFJPTCwgYWN0aW9uLCBwYXJhbXMpLFxuXG4gIC8vIE1pbmVjcmFmdFxuICBtaW5lY3JhZnRDb25uZWN0OiAob3B0cz86IGFueSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5NSU5FQ1JBRlRfQ09OTkVDVCwgb3B0cyksXG4gIG1pbmVjcmFmdERpc2Nvbm5lY3Q6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuTUlORUNSQUZUX0RJU0NPTk5FQ1QpLFxuICBtaW5lY3JhZnRDaGF0OiAobXNnOiBzdHJpbmcpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuTUlORUNSQUZUX0NIQVQsIG1zZyksXG4gIG1pbmVjcmFmdEdldFN0YXR1czogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5NSU5FQ1JBRlRfR0VUX1NUQVRVUyksXG4gIG1pbmVjcmFmdE1vdmVUbzogKGNvb3JkczogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgejogbnVtYmVyIH0pID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuTUlORUNSQUZUX01PVkVfVE8sIGNvb3JkcyksXG4gIG1pbmVjcmFmdEZvbGxvdzogKHBsYXllcjogc3RyaW5nKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLk1JTkVDUkFGVF9GT0xMT1csIHBsYXllciksXG4gIG1pbmVjcmFmdFN0b3A6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuTUlORUNSQUZUX1NUT1ApLFxuICBtaW5lY3JhZnRNaW5lQmxvY2s6IChjb29yZHM6IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHo6IG51bWJlciB9KSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLk1JTkVDUkFGVF9NSU5FX0JMT0NLLCBjb29yZHMpLFxuICBtaW5lY3JhZnRQbGFjZUJsb2NrOiAocGF5bG9hZDogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgejogbnVtYmVyOyBibG9ja05hbWU6IHN0cmluZyB9KSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLk1JTkVDUkFGVF9QTEFDRV9CTE9DSywgcGF5bG9hZCksXG4gIG1pbmVjcmFmdEF0dGFjazogKHBheWxvYWQ6IHsgZW50aXR5TmFtZT86IHN0cmluZyB9KSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLk1JTkVDUkFGVF9BVFRBQ0ssIHBheWxvYWQpLFxuICBvbk1pbmVjcmFmdENoYXQ6IChjYWxsYmFjazogKGRhdGE6IGFueSkgPT4gdm9pZCkgPT4ge1xuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHJldHVybiAoKSA9PiB7fTtcbiAgICBjb25zdCBsaXN0ZW5lciA9IChfZXZlbnQ6IElwY1JlbmRlcmVyRXZlbnQsIGRhdGE6IGFueSkgPT4gY2FsbGJhY2soZGF0YSk7XG4gICAgaXBjUmVuZGVyZXIub24oJ21pbmVjcmFmdC1jaGF0JywgbGlzdGVuZXIpO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBpcGNSZW5kZXJlci5yZW1vdmVMaXN0ZW5lcignbWluZWNyYWZ0LWNoYXQnLCBsaXN0ZW5lcik7XG4gICAgICB9IGNhdGNoIChfKSB7fVxuICAgIH07XG4gIH0sXG4gIG9uTWluZWNyYWZ0RXZlbnQ6IChjYWxsYmFjazogKGRhdGE6IGFueSkgPT4gdm9pZCkgPT4ge1xuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHJldHVybiAoKSA9PiB7fTtcbiAgICBjb25zdCBsaXN0ZW5lciA9IChfZXZlbnQ6IElwY1JlbmRlcmVyRXZlbnQsIGRhdGE6IGFueSkgPT4gY2FsbGJhY2soZGF0YSk7XG4gICAgaXBjUmVuZGVyZXIub24oJ21pbmVjcmFmdC1ldmVudCcsIGxpc3RlbmVyKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaXBjUmVuZGVyZXIucmVtb3ZlTGlzdGVuZXIoJ21pbmVjcmFmdC1ldmVudCcsIGxpc3RlbmVyKTtcbiAgICAgIH0gY2F0Y2ggKF8pIHt9XG4gICAgfTtcbiAgfSxcblxuICAvLyBEaXNjb3JkXG4gIGRpc2NvcmRDb25uZWN0OiAob3B0czogYW55KSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLkRJU0NPUkRfQ09OTkVDVCwgb3B0cyksXG4gIGRpc2NvcmREaXNjb25uZWN0OiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLkRJU0NPUkRfRElTQ09OTkVDVCksXG4gIGRpc2NvcmRTZW5kTWVzc2FnZTogKHBheWxvYWQ6IHsgY2hhbm5lbElkOiBzdHJpbmc7IGNvbnRlbnQ6IHN0cmluZyB9KSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLkRJU0NPUkRfU0VORF9NRVNTQUdFLCBwYXlsb2FkKSxcbiAgZGlzY29yZEdldE1lc3NhZ2VzOiAocGF5bG9hZDogeyBjaGFubmVsSWQ6IHN0cmluZzsgbGltaXQ/OiBudW1iZXIgfSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5ESVNDT1JEX0dFVF9NRVNTQUdFUywgcGF5bG9hZCksXG4gIGRpc2NvcmRTZXRTdGF0dXM6IChvcHRzOiB7IHN0YXR1c1RleHQ6IHN0cmluZzsgYWN0aXZpdHlUeXBlPzogc3RyaW5nIH0pID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuRElTQ09SRF9TRVRfU1RBVFVTLCBvcHRzKSxcbiAgZGlzY29yZFZvaWNlSm9pbjogKG9wdHM6IHsgZ3VpbGRJZDogc3RyaW5nOyBjaGFubmVsSWQ6IHN0cmluZyB9KSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLkRJU0NPUkRfVk9JQ0VfSk9JTiwgb3B0cyksXG4gIGRpc2NvcmRWb2ljZUxlYXZlOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLkRJU0NPUkRfVk9JQ0VfTEVBVkUpLFxuICBkaXNjb3JkVm9pY2VTZW5kQXVkaW86IChwYXlsb2FkOiB7IGRhdGE6IHN0cmluZyB9KSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLkRJU0NPUkRfVk9JQ0VfU0VORF9BVURJTywgcGF5bG9hZCksXG4gIG9uRGlzY29yZE1lc3NhZ2U6IChjYWxsYmFjazogKGRhdGE6IGFueSkgPT4gdm9pZCkgPT4ge1xuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHJldHVybiAoKSA9PiB7fTtcbiAgICBjb25zdCBsaXN0ZW5lciA9IChfZXZlbnQ6IElwY1JlbmRlcmVyRXZlbnQsIGRhdGE6IGFueSkgPT4gY2FsbGJhY2soZGF0YSk7XG4gICAgaXBjUmVuZGVyZXIub24oJ2Rpc2NvcmQtbWVzc2FnZScsIGxpc3RlbmVyKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaXBjUmVuZGVyZXIucmVtb3ZlTGlzdGVuZXIoJ2Rpc2NvcmQtbWVzc2FnZScsIGxpc3RlbmVyKTtcbiAgICAgIH0gY2F0Y2ggKF8pIHt9XG4gICAgfTtcbiAgfSxcbiAgb25EaXNjb3JkRXZlbnQ6IChjYWxsYmFjazogKGRhdGE6IGFueSkgPT4gdm9pZCkgPT4ge1xuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHJldHVybiAoKSA9PiB7fTtcbiAgICBjb25zdCBsaXN0ZW5lciA9IChfZXZlbnQ6IElwY1JlbmRlcmVyRXZlbnQsIGRhdGE6IGFueSkgPT4gY2FsbGJhY2soZGF0YSk7XG4gICAgaXBjUmVuZGVyZXIub24oJ2Rpc2NvcmQtZXZlbnQnLCBsaXN0ZW5lcik7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGlwY1JlbmRlcmVyLnJlbW92ZUxpc3RlbmVyKCdkaXNjb3JkLWV2ZW50JywgbGlzdGVuZXIpO1xuICAgICAgfSBjYXRjaCAoXykge31cbiAgICB9O1xuICB9LFxuICBvbkRpc2NvcmRWb2ljZUV2ZW50OiAoY2FsbGJhY2s6IChkYXRhOiBhbnkpID0+IHZvaWQpID0+IHtcbiAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSByZXR1cm4gKCkgPT4ge307XG4gICAgY29uc3QgbGlzdGVuZXIgPSAoX2V2ZW50OiBJcGNSZW5kZXJlckV2ZW50LCBkYXRhOiBhbnkpID0+IGNhbGxiYWNrKGRhdGEpO1xuICAgIGlwY1JlbmRlcmVyLm9uKCdkaXNjb3JkLXZvaWNlLWV2ZW50JywgbGlzdGVuZXIpO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBpcGNSZW5kZXJlci5yZW1vdmVMaXN0ZW5lcignZGlzY29yZC12b2ljZS1ldmVudCcsIGxpc3RlbmVyKTtcbiAgICAgIH0gY2F0Y2ggKF8pIHt9XG4gICAgfTtcbiAgfSxcbiAgb25EaXNjb3JkVm9pY2VBdWRpbzogKGNhbGxiYWNrOiAoZGF0YTogYW55KSA9PiB2b2lkKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykgcmV0dXJuICgpID0+IHt9O1xuICAgIGNvbnN0IGxpc3RlbmVyID0gKF9ldmVudDogSXBjUmVuZGVyZXJFdmVudCwgZGF0YTogYW55KSA9PiBjYWxsYmFjayhkYXRhKTtcbiAgICBpcGNSZW5kZXJlci5vbignZGlzY29yZC12b2ljZS1hdWRpbycsIGxpc3RlbmVyKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaXBjUmVuZGVyZXIucmVtb3ZlTGlzdGVuZXIoJ2Rpc2NvcmQtdm9pY2UtYXVkaW8nLCBsaXN0ZW5lcik7XG4gICAgICB9IGNhdGNoIChfKSB7fVxuICAgIH07XG4gIH0sXG5cbiAgLy8gXHUyNTAwXHUyNTAwIFVwZGF0ZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNoZWNrRm9yVXBkYXRlczogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKElQQ19DSEFOTkVMUy5DSEVDS19GT1JfVVBEQVRFUyksXG4gIGRvd25sb2FkVXBkYXRlOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoSVBDX0NIQU5ORUxTLkRPV05MT0FEX1VQREFURSksXG4gIGluc3RhbGxVcGRhdGU6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuSU5TVEFMTF9VUERBVEUpLFxuICBvblVwZGF0ZVN0YXR1czogKGNhbGxiYWNrOiAoZGF0YTogYW55KSA9PiB2b2lkKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykgcmV0dXJuICgpID0+IHt9O1xuICAgIGNvbnN0IGxpc3RlbmVyID0gKF9ldmVudDogSXBjUmVuZGVyZXJFdmVudCwgZGF0YTogYW55KSA9PiBjYWxsYmFjayhkYXRhKTtcbiAgICBpcGNSZW5kZXJlci5vbigndXBkYXRlLXN0YXR1cycsIGxpc3RlbmVyKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaXBjUmVuZGVyZXIucmVtb3ZlTGlzdGVuZXIoJ3VwZGF0ZS1zdGF0dXMnLCBsaXN0ZW5lcik7XG4gICAgICB9IGNhdGNoIChfKSB7fVxuICAgIH07XG4gIH0sXG5cbiAgLy8gXHUyNTAwXHUyNTAwIFNob3J0Y3V0cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgb25TaG9ydGN1dEV2ZW50OiAoY2hhbm5lbDogc3RyaW5nLCBjYWxsYmFjazogKC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkKSA9PiB7XG4gICAgaWYgKCFBTExPV0VEX1NIT1JUQ1VUX0NIQU5ORUxTLmhhcyhjaGFubmVsKSB8fCB0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiAoKSA9PiB7fTtcbiAgICB9XG4gICAgY29uc3QgbGlzdGVuZXIgPSAoX2V2ZW50OiBJcGNSZW5kZXJlckV2ZW50LCAuLi5hcmdzOiBhbnlbXSkgPT4gY2FsbGJhY2soLi4uYXJncyk7XG4gICAgaXBjUmVuZGVyZXIub24oY2hhbm5lbCwgbGlzdGVuZXIpO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBpcGNSZW5kZXJlci5yZW1vdmVMaXN0ZW5lcihjaGFubmVsLCBsaXN0ZW5lcik7XG4gICAgICB9IGNhdGNoIChfKSB7fVxuICAgIH07XG4gIH0sXG5cbiAgLy8gXHUyNTAwXHUyNTAwIFNldHRpbmdzICYgQ29uZmlnIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBzYXZlQXBwQ29uZmlnOiAoY29uZmlnOiBhbnkpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuU0FWRV9BUFBfQ09ORklHLCBjb25maWcpLFxuICBnZXRBcHBDb25maWc6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZShJUENfQ0hBTk5FTFMuR0VUX0FQUF9DT05GSUcpLFxuICBvbkNvbmZpZ1VwZGF0ZWQ6IChjYWxsYmFjazogKGRhdGE6IGFueSkgPT4gdm9pZCkgPT4ge1xuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHJldHVybiAoKSA9PiB7fTtcbiAgICBjb25zdCBsaXN0ZW5lciA9IChfZXZlbnQ6IElwY1JlbmRlcmVyRXZlbnQsIGRhdGE6IGFueSkgPT4gY2FsbGJhY2soZGF0YSk7XG4gICAgaXBjUmVuZGVyZXIub24oJ2NvbmZpZy11cGRhdGVkJywgbGlzdGVuZXIpO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBpcGNSZW5kZXJlci5yZW1vdmVMaXN0ZW5lcignY29uZmlnLXVwZGF0ZWQnLCBsaXN0ZW5lcik7XG4gICAgICB9IGNhdGNoIChfKSB7fVxuICAgIH07XG4gIH0sXG4gIG9uQ29tcGFuaW9uUGF1c2U6IChjYWxsYmFjazogKCkgPT4gdm9pZCkgPT4ge1xuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHJldHVybiAoKSA9PiB7fTtcbiAgICBjb25zdCBsaXN0ZW5lciA9ICgpID0+IGNhbGxiYWNrKCk7XG4gICAgaXBjUmVuZGVyZXIub24oJ2NvbXBhbmlvbi1wYXVzZScsIGxpc3RlbmVyKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaXBjUmVuZGVyZXIucmVtb3ZlTGlzdGVuZXIoJ2NvbXBhbmlvbi1wYXVzZScsIGxpc3RlbmVyKTtcbiAgICAgIH0gY2F0Y2ggKF8pIHt9XG4gICAgfTtcbiAgfSxcbiAgb25Db21wYW5pb25SZXN1bWU6IChjYWxsYmFjazogKCkgPT4gdm9pZCkgPT4ge1xuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHJldHVybiAoKSA9PiB7fTtcbiAgICBjb25zdCBsaXN0ZW5lciA9ICgpID0+IGNhbGxiYWNrKCk7XG4gICAgaXBjUmVuZGVyZXIub24oJ2NvbXBhbmlvbi1yZXN1bWUnLCBsaXN0ZW5lcik7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGlwY1JlbmRlcmVyLnJlbW92ZUxpc3RlbmVyKCdjb21wYW5pb24tcmVzdW1lJywgbGlzdGVuZXIpO1xuICAgICAgfSBjYXRjaCAoXykge31cbiAgICB9O1xuICB9LFxufTtcblxuLy8gRXhwb3NlIG9uIHdpbmRvdy5lbGVjdHJvbiwgd2luZG93LmVsZWN0cm9uQnJpZGdlLCBhbmQgd2luZG93LmVsZWN0cm9uQVBJIGZvciB1bml2ZXJzYWwgY29tcGF0aWJpbGl0eVxuY29udGV4dEJyaWRnZS5leHBvc2VJbk1haW5Xb3JsZCgnZWxlY3Ryb24nLCBlbGVjdHJvbkJyaWRnZUFwaSk7XG5jb250ZXh0QnJpZGdlLmV4cG9zZUluTWFpbldvcmxkKCdlbGVjdHJvbkJyaWRnZScsIGVsZWN0cm9uQnJpZGdlQXBpKTtcbmNvbnRleHRCcmlkZ2UuZXhwb3NlSW5NYWluV29ybGQoJ2VsZWN0cm9uQVBJJywgZWxlY3Ryb25CcmlkZ2VBcGkpO1xuIiwgIi8qKlxuICogU3Ryb25nbHktVHlwZWQgSVBDIENoYW5uZWwgZGVmaW5pdGlvbnMgYmV0d2VlbiBFbGVjdHJvbiBNYWluIGFuZCBSZW5kZXJlci5cbiAqIE1pcnJvcmVkIGluIGVsZWN0cm9uL3NyYyBmb3IgY29tcGxldGUgc2VsZi1jb250YWluZWQgbW9kdWxhciBjb21waWxhdGlvbi5cbiAqL1xuXG5leHBvcnQgY29uc3QgSVBDX0NIQU5ORUxTID0ge1xuICAvLyBXaW5kb3cgJiBTaGVsbFxuICBTRVRfSUdOT1JFX01PVVNFX0VWRU5UUzogJ3NldC1pZ25vcmUtbW91c2UtZXZlbnRzJyxcbiAgU1lOQ19JTlRFUkFDVElWRV9ISVRCT1hFUzogJ3N5bmMtaW50ZXJhY3RpdmUtaGl0Ym94ZXMnLFxuICBTRVRfQUxXQVlTX09OX1RPUDogJ3NldC1hbHdheXMtb24tdG9wJyxcbiAgR0VUX0FMV0FZU19PTl9UT1A6ICdnZXQtYWx3YXlzLW9uLXRvcCcsXG4gIE1JTklNSVpFX1dJTkRPVzogJ21pbmltaXplLXdpbmRvdycsXG4gIFFVSVRfQVBQOiAncXVpdC1hcHAnLFxuICBSRUxPQURfV0lORE9XOiAncmVsb2FkLXdpbmRvdycsXG4gIFJFTEFVTkNIX0FQUDogJ3JlbGF1bmNoLWFwcCcsXG4gIEdFVF9ESVNQTEFZX0lORk86ICdnZXQtZGlzcGxheS1pbmZvJyxcbiAgR0VUX1BST0NFU1NfTUVNT1JZX0lORk86ICdnZXQtcHJvY2Vzcy1tZW1vcnktaW5mbycsXG4gIEdFVF9HUFVfRkVBVFVSRV9TVEFUVVM6ICdnZXQtZ3B1LWZlYXR1cmUtc3RhdHVzJyxcbiAgR0VUX0FQUF9WRVJTSU9OOiAnZ2V0LWFwcC12ZXJzaW9uJyxcblxuICAvLyBTeXN0ZW0gJiBPU1xuICBFWEVDX0NPTU1BTkQ6ICdleGVjLWNvbW1hbmQnLFxuICBSRUFEX0ZJTEU6ICdyZWFkLWZpbGUnLFxuICBXUklURV9GSUxFOiAnd3JpdGUtZmlsZScsXG4gIEFQUEVORF9GSUxFOiAnYXBwZW5kLWZpbGUnLFxuICBSRUFEX0RJUkVDVE9SWTogJ3JlYWQtZGlyZWN0b3J5JyxcbiAgT1BFTl9FWFRFUk5BTDogJ29wZW4tZXh0ZXJuYWwnLFxuICBPUEVOX1BBVEg6ICdvcGVuLXBhdGgnLFxuICBTSE9XX0lURU1fSU5fRk9MREVSOiAnc2hvdy1pdGVtLWluLWZvbGRlcicsXG4gIEdFVF9DTElQQk9BUkRfVEVYVDogJ2dldC1jbGlwYm9hcmQtdGV4dCcsXG4gIFNFVF9DTElQQk9BUkRfVEVYVDogJ3NldC1jbGlwYm9hcmQtdGV4dCcsXG4gIFNIT1dfTk9USUZJQ0FUSU9OOiAnc2hvdy1ub3RpZmljYXRpb24nLFxuXG4gIC8vIENvbmZpZyAmIFNlY3JldHNcbiAgR0VUX0FQUF9DT05GSUc6ICdnZXQtYXBwLWNvbmZpZycsXG4gIFNBVkVfQVBQX0NPTkZJRzogJ3NhdmUtYXBwLWNvbmZpZycsXG4gIFNFQ1VSRV9TRVRfU0VDUkVUOiAnc2VjdXJlLXNldC1zZWNyZXQnLFxuICBTRUNVUkVfR0VUX1NFQ1JFVDogJ3NlY3VyZS1nZXQtc2VjcmV0JyxcbiAgU0VDVVJFX0RFTEVURV9TRUNSRVQ6ICdzZWN1cmUtZGVsZXRlLXNlY3JldCcsXG5cbiAgLy8gQXVkaW8gTG9vcGJhY2sgJiBTY3JlZW5cbiAgREVTS1RPUF9BVURJT19OQVRJVkVfU1RBUlQ6ICdkZXNrdG9wLWF1ZGlvLW5hdGl2ZS1zdGFydCcsXG4gIERFU0tUT1BfQVVESU9fTkFUSVZFX1NUT1A6ICdkZXNrdG9wLWF1ZGlvLW5hdGl2ZS1zdG9wJyxcbiAgREVTS1RPUF9BVURJT19OQVRJVkVfU1RBVFVTOiAnZGVza3RvcC1hdWRpby1uYXRpdmUtc3RhdHVzJyxcbiAgQ0FQVFVSRV9TQ1JFRU5fTkFUSVZFOiAnY2FwdHVyZS1zY3JlZW4tbmF0aXZlJyxcblxuICAvLyBNZW1vcnlcbiAgTUVNT1JZX0xPQUQ6ICdtZW1vcnktbG9hZCcsXG4gIE1FTU9SWV9TQVZFOiAnbWVtb3J5LXNhdmUnLFxuXG4gIC8vIFN1YndpbmRvd3NcbiAgT1BFTl9TRVRUSU5HU19XSU5ET1c6ICdvcGVuLXNldHRpbmdzLXdpbmRvdycsXG4gIENMT1NFX1NFVFRJTkdTX1dJTkRPVzogJ2Nsb3NlLXNldHRpbmdzLXdpbmRvdycsXG4gIE9QRU5fQ0FNRVJBX1dJTkRPVzogJ29wZW4tY2FtZXJhLXdpbmRvdycsXG4gIENMT1NFX0NBTUVSQV9XSU5ET1c6ICdjbG9zZS1jYW1lcmEtd2luZG93JyxcbiAgSVNfQ0FNRVJBX1dJTkRPV19PUEVOOiAnaXMtY2FtZXJhLXdpbmRvdy1vcGVuJyxcblxuICAvLyBNQ1BcbiAgTUNQX0NPTk5FQ1Q6ICdtY3AtY29ubmVjdCcsXG4gIE1DUF9DQUxMX1RPT0w6ICdtY3AtY2FsbC10b29sJyxcbiAgTUNQX0RJU0NPTk5FQ1Q6ICdtY3AtZGlzY29ubmVjdCcsXG5cbiAgLy8gSW50ZWdyYXRpb25zXG4gIFNQT1RJRllfQ09OVFJPTDogJ3Nwb3RpZnktY29udHJvbCcsXG4gIFBMQVlXUklHSFRfRVhFQ1VURTogJ3BsYXl3cmlnaHQtZXhlY3V0ZScsXG4gIE1JTkVDUkFGVF9DT05ORUNUOiAnbWluZWNyYWZ0LWNvbm5lY3QnLFxuICBNSU5FQ1JBRlRfRElTQ09OTkVDVDogJ21pbmVjcmFmdC1kaXNjb25uZWN0JyxcbiAgTUlORUNSQUZUX0NIQVQ6ICdtaW5lY3JhZnQtY2hhdCcsXG4gIE1JTkVDUkFGVF9HRVRfU1RBVFVTOiAnbWluZWNyYWZ0LWdldC1zdGF0dXMnLFxuICBNSU5FQ1JBRlRfTU9WRV9UTzogJ21pbmVjcmFmdC1tb3ZlLXRvJyxcbiAgTUlORUNSQUZUX0ZPTExPVzogJ21pbmVjcmFmdC1mb2xsb3cnLFxuICBNSU5FQ1JBRlRfU1RPUDogJ21pbmVjcmFmdC1zdG9wJyxcbiAgTUlORUNSQUZUX01JTkVfQkxPQ0s6ICdtaW5lY3JhZnQtbWluZS1ibG9jaycsXG4gIE1JTkVDUkFGVF9QTEFDRV9CTE9DSzogJ21pbmVjcmFmdC1wbGFjZS1ibG9jaycsXG4gIE1JTkVDUkFGVF9BVFRBQ0s6ICdtaW5lY3JhZnQtYXR0YWNrJyxcblxuICBESVNDT1JEX0NPTk5FQ1Q6ICdkaXNjb3JkLWNvbm5lY3QnLFxuICBESVNDT1JEX0RJU0NPTk5FQ1Q6ICdkaXNjb3JkLWRpc2Nvbm5lY3QnLFxuICBESVNDT1JEX1NFTkRfTUVTU0FHRTogJ2Rpc2NvcmQtc2VuZC1tZXNzYWdlJyxcbiAgRElTQ09SRF9TRVRfU1RBVFVTOiAnZGlzY29yZC1zZXQtc3RhdHVzJyxcbiAgRElTQ09SRF9HRVRfTUVTU0FHRVM6ICdkaXNjb3JkLWdldC1tZXNzYWdlcycsXG4gIERJU0NPUkRfVk9JQ0VfSk9JTjogJ2Rpc2NvcmQtdm9pY2Utam9pbicsXG4gIERJU0NPUkRfVk9JQ0VfTEVBVkU6ICdkaXNjb3JkLXZvaWNlLWxlYXZlJyxcbiAgRElTQ09SRF9WT0lDRV9TRU5EX0FVRElPOiAnZGlzY29yZC12b2ljZS1zZW5kLWF1ZGlvJyxcblxuICAvLyBVcGRhdGVyXG4gIENIRUNLX0ZPUl9VUERBVEVTOiAnY2hlY2stZm9yLXVwZGF0ZXMnLFxuICBET1dOTE9BRF9VUERBVEU6ICdkb3dubG9hZC11cGRhdGUnLFxuICBJTlNUQUxMX1VQREFURTogJ2luc3RhbGwtdXBkYXRlJyxcbn0gYXMgY29uc3Q7XG5cbmV4cG9ydCB0eXBlIElwY0NoYW5uZWxOYW1lID0gdHlwZW9mIElQQ19DSEFOTkVMU1trZXlvZiB0eXBlb2YgSVBDX0NIQU5ORUxTXTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUEsc0JBQTZEOzs7QUNLdEQsSUFBTSxlQUFlO0FBQUE7QUFBQSxFQUUxQix5QkFBeUI7QUFBQSxFQUN6QiwyQkFBMkI7QUFBQSxFQUMzQixtQkFBbUI7QUFBQSxFQUNuQixtQkFBbUI7QUFBQSxFQUNuQixpQkFBaUI7QUFBQSxFQUNqQixVQUFVO0FBQUEsRUFDVixlQUFlO0FBQUEsRUFDZixjQUFjO0FBQUEsRUFDZCxrQkFBa0I7QUFBQSxFQUNsQix5QkFBeUI7QUFBQSxFQUN6Qix3QkFBd0I7QUFBQSxFQUN4QixpQkFBaUI7QUFBQTtBQUFBLEVBR2pCLGNBQWM7QUFBQSxFQUNkLFdBQVc7QUFBQSxFQUNYLFlBQVk7QUFBQSxFQUNaLGFBQWE7QUFBQSxFQUNiLGdCQUFnQjtBQUFBLEVBQ2hCLGVBQWU7QUFBQSxFQUNmLFdBQVc7QUFBQSxFQUNYLHFCQUFxQjtBQUFBLEVBQ3JCLG9CQUFvQjtBQUFBLEVBQ3BCLG9CQUFvQjtBQUFBLEVBQ3BCLG1CQUFtQjtBQUFBO0FBQUEsRUFHbkIsZ0JBQWdCO0FBQUEsRUFDaEIsaUJBQWlCO0FBQUEsRUFDakIsbUJBQW1CO0FBQUEsRUFDbkIsbUJBQW1CO0FBQUEs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
