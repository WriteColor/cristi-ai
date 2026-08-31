/**
 * ElectronBridge — Renderer-side wrapper for window.electronAPI (Electron IPC).
 * 
 * Provides a safe interface that gracefully degrades in browser-only / dev mode.
 * Import this instead of referencing window.electronAPI directly.
 */

const api = typeof window !== 'undefined' ? window.electronAPI : null;

export const electronBridge = {
  /** True when running inside Electron (not a plain browser) */
  isElectron: !!(api?.isElectron),

  /**
   * Toggle window click-through mode.
   * This is called by useClickThrough hook on every mouseenter/mouseleave.
   *
   * @param {boolean} ignore - true = pass clicks to desktop, false = receive clicks
   * @param {{ forward?: boolean }} [options] - forward:true keeps mousemove delivery
   */
  setIgnoreMouseEvents(ignore, options = {}) {
    api?.setIgnoreMouseEvents(ignore, options);
  },

  /**
   * Set the window always-on-top state.
   * @param {boolean} value
   */
  setAlwaysOnTop(value) {
    api?.setAlwaysOnTop(value);
  },

  /**
   * Get the current always-on-top state.
   * @returns {Promise<boolean>}
   */
  async getAlwaysOnTop() {
    return api?.getAlwaysOnTop?.() ?? false;
  },

  /**
   * Get the primary display information.
   * @returns {Promise<{ width: number, height: number, scaleFactor: number, workArea: object }>}
   */
  async getDisplayInfo() {
    if (api?.getDisplayInfo) {
      return api.getDisplayInfo();
    }
    return {
      width: window.screen.width,
      height: window.screen.height,
      scaleFactor: window.devicePixelRatio || 1,
      workArea: { x: 0, y: 0, width: window.screen.width, height: window.screen.height },
    };
  },

  /** Minimize the Electron window */
  minimizeWindow() {
    api?.minimizeWindow();
  },

  /** Quit the entire Electron app */
  quitApp() {
    api?.quitApp();
  },

  /** Show the window */
  showWindow() {
    api?.showWindow();
  },

  /** Hide the window */
  hideWindow() {
    api?.hideWindow();
  },

  /** Execute a shell command with options (e.g. timeout) */
  async execCommand(command, options = {}) {
    if (api?.execCommand) {
      return await api.execCommand(command, options);
    }
    return { stdOut: '', stdErr: 'Electron environment unavailable', exitCode: 1 };
  },

  /** Read file content */
  async readFile(filePath) {
    if (api?.readFile) {
      return await api.readFile(filePath);
    }
    throw new Error('Electron filesystem unavailable in browser');
  },

  /** Write file content */
  async writeFile(filePath, data) {
    if (api?.writeFile) {
      return await api.writeFile(filePath, data);
    }
    throw new Error('Electron filesystem unavailable in browser');
  },

  /** Append file content */
  async appendFile(filePath, data) {
    if (api?.appendFile) {
      return await api.appendFile(filePath, data);
    }
    throw new Error('Electron filesystem unavailable in browser');
  },

  /** Read directory */
  async readDirectory(dirPath) {
    if (api?.readDirectory) {
      return await api.readDirectory(dirPath);
    }
    throw new Error('Electron filesystem unavailable in browser');
  },

  /** Open external URL in user's default browser (e.g. Brave) */
  async openExternal(url) {
    if (api?.openExternal) {
      return await api.openExternal(url);
    }
    window.open(url, '_blank');
    return true;
  },

  /** Open file or folder directly with system default app */
  async openPath(targetPath) {
    if (api?.openPath) {
      return await api.openPath(targetPath);
    }
    return { success: false, error: 'Electron unavailable' };
  },

  /** Reveal file in File Explorer */
  async showItemInFolder(targetPath) {
    if (api?.showItemInFolder) {
      return await api.showItemInFolder(targetPath);
    }
    return false;
  },

  /** Capture native OS desktop frame (JPEG Base64) for instant Gemini vision */
  async captureScreenNative(region = null) {
    if (api?.captureScreenNative) {
      return await api.captureScreenNative(region);
    }
    return null;
  },

  /** Subscribe to global shortcut events (e.g. shortcut-toggle-mute, shortcut-capture-screen) */
  onShortcutEvent(channel, callback) {
    if (api?.onShortcutEvent) {
      return api.onShortcutEvent(channel, callback);
    }
    return () => {};
  },

  /** Read text from clipboard */
  async getClipboardText() {
    if (api?.getClipboardText) {
      return await api.getClipboardText();
    }
    if (navigator.clipboard) {
      return await navigator.clipboard.readText();
    }
    return '';
  },

  /** Write text to clipboard */
  async setClipboardText(text) {
    if (api?.setClipboardText) {
      return await api.setClipboardText(text);
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  },

  /** Show OS notification */
  async showNotification(title, body) {
    if (api?.showNotification) {
      return await api.showNotification({ title, body });
    }
    return false;
  },
};

export const ElectronBridge = electronBridge;
export default electronBridge;

