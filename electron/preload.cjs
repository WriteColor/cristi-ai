'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // ── Click-Through Control ─────────────────────────────────────────────────
  // Called by useClickThrough hook whenever the cursor enters/leaves
  // an interactive element.
  //
  // ignore=true + forward:true → pass clicks to desktop but still receive mousemove
  // ignore=false              → window receives all mouse events normally
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },

  // ── Window Management ─────────────────────────────────────────────────────
  setAlwaysOnTop: (value) => {
    ipcRenderer.send('set-always-on-top', value);
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
  scanWallpaperEngine: () => ipcRenderer.invoke('scan-wallpaper-engine'),

  // ── Global Shortcut Event Subscriptions ───────────────────────────────────
  onShortcutEvent: (channel, callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});

