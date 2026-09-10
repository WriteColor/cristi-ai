import type { IpcChannel } from './contracts';
/**
 * Strongly-Typed IPC Channel definitions between Electron Main and Renderer.
 */

export const IPC_CHANNELS = {
  // Window & Shell
  SET_IGNORE_MOUSE_EVENTS: 'set-ignore-mouse-events',
  SYNC_INTERACTIVE_HITBOXES: 'sync-interactive-hitboxes',
  SET_ALWAYS_ON_TOP: 'set-always-on-top',
  GET_ALWAYS_ON_TOP: 'get-always-on-top',
  MINIMIZE_WINDOW: 'minimize-window',
  QUIT_APP: 'quit-app',
  RELOAD_WINDOW: 'reload-window',
  RELAUNCH_APP: 'relaunch-app',
  GET_DISPLAY_INFO: 'get-display-info',
  GET_PROCESS_MEMORY_INFO: 'get-process-memory-info',
  GET_GPU_FEATURE_STATUS: 'get-gpu-feature-status',
  GET_APP_VERSION: 'get-app-version',

  // System & OS
  READ_FILE: 'read-file',
  WRITE_FILE: 'write-file',
  APPEND_FILE: 'append-file',
  READ_DIRECTORY: 'read-directory',
  OPEN_EXTERNAL: 'open-external',
  OPEN_PATH: 'open-path',
  SHOW_ITEM_IN_FOLDER: 'show-item-in-folder',
  GET_CLIPBOARD_TEXT: 'get-clipboard-text',
  SET_CLIPBOARD_TEXT: 'set-clipboard-text',
  SHOW_NOTIFICATION: 'show-notification',

  // Config & Secrets
  GET_APP_CONFIG: 'get-app-config',
  SAVE_APP_CONFIG: 'save-app-config',
  SECURE_SET_SECRET: 'secure-set-secret',
  SECURE_DELETE_SECRET: 'secure-delete-secret',

  // Audio Loopback & Screen
  DESKTOP_AUDIO_NATIVE_START: 'desktop-audio-native-start',
  DESKTOP_AUDIO_NATIVE_STOP: 'desktop-audio-native-stop',
  DESKTOP_AUDIO_NATIVE_STATUS: 'desktop-audio-native-status',
  CAPTURE_SCREEN_NATIVE: 'capture-screen-native',

  // Memory
  MEMORY_LOAD: 'memory-load',
  MEMORY_SAVE: 'memory-save',

  // Subwindows
  OPEN_SETTINGS_WINDOW: 'open-settings-window',
  CLOSE_SETTINGS_WINDOW: 'close-settings-window',
  OPEN_CAMERA_WINDOW: 'open-camera-window',
  CLOSE_CAMERA_WINDOW: 'close-camera-window',
  IS_CAMERA_WINDOW_OPEN: 'is-camera-window-open',

  // MCP
  MCP_CONNECT: 'mcp-connect',
  MCP_CALL_TOOL: 'mcp-call-tool',
  MCP_DISCONNECT: 'mcp-disconnect',

  // Integrations
  SPOTIFY_CONTROL: 'spotify-control',
  PLAYWRIGHT_EXECUTE: 'playwright-execute',
  MINECRAFT_CONNECT: 'minecraft-connect',
  MINECRAFT_DISCONNECT: 'minecraft-disconnect',
  MINECRAFT_CHAT: 'minecraft-chat',
  MINECRAFT_GET_STATUS: 'minecraft-get-status',
  MINECRAFT_MOVE_TO: 'minecraft-move-to',
  MINECRAFT_FOLLOW: 'minecraft-follow',
  MINECRAFT_STOP: 'minecraft-stop',
  MINECRAFT_MINE_BLOCK: 'minecraft-mine-block',
  MINECRAFT_PLACE_BLOCK: 'minecraft-place-block',
  MINECRAFT_ATTACK: 'minecraft-attack',

  DISCORD_CONNECT: 'discord-connect',
  DISCORD_DISCONNECT: 'discord-disconnect',
  DISCORD_SEND_MESSAGE: 'discord-send-message',
  DISCORD_SET_STATUS: 'discord-set-status',
  DISCORD_GET_MESSAGES: 'discord-get-messages',
  DISCORD_VOICE_JOIN: 'discord-voice-join',
  DISCORD_VOICE_LEAVE: 'discord-voice-leave',
  DISCORD_VOICE_SEND_AUDIO: 'discord-voice-send-audio',

  // Updater
  CHECK_FOR_UPDATES: 'check-for-updates',
  DOWNLOAD_UPDATE: 'download-update',
  INSTALL_UPDATE: 'install-update'
} as const satisfies Record<string, IpcChannel>;

export type IpcChannelName = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
