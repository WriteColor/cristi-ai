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

  // ── Native OS Operations ──────────────────────────────────────────────────
  execCommand: (command, options) => ipcRenderer.invoke('exec-command', command, options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
  appendFile: (filePath, data) => ipcRenderer.invoke('append-file', filePath, data),
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openPath: (targetPath) => ipcRenderer.invoke('open-path', targetPath),
  showItemInFolder: (targetPath) => ipcRenderer.invoke('show-item-in-folder', targetPath),
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
  setClipboardText: (text) => ipcRenderer.invoke('set-clipboard-text', text),
  showNotification: (payload) => ipcRenderer.invoke('show-notification', payload),
  captureScreenNative: (region) => ipcRenderer.invoke('capture-screen-native', region),
  importCustomSceneFile: () => ipcRenderer.invoke('import-custom-scene-file'),
  getProcessMemoryInfo: () => ipcRenderer.invoke('get-process-memory-info'),
  getGpuFeatureStatus: () => ipcRenderer.invoke('get-gpu-feature-status'),
  getGpuInfo: () => ipcRenderer.invoke('get-gpu-info'),

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
});
