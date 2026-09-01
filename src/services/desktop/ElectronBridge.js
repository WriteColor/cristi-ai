/**
 * ElectronBridge — Renderer-side wrapper for window.electronAPI (Electron IPC).
 * 
 * Provides a safe interface that gracefully degrades in browser-only / dev mode.
 * Import this instead of referencing window.electronAPI directly.
 */

const getApi = () => (typeof window !== 'undefined' ? window.electronAPI : null);

export const electronBridge = {
  /** True when running inside Electron (not a plain browser) */
  get isElectron() {
    return !!(getApi()?.isElectron);
  },

  _lastIgnore: null,
  _lastForward: null,

  /**
   * Toggle window click-through mode.
   * Deduplicates identical consecutive calls to prevent flooding Electron IPC.
   *
   * @param {boolean} ignore - true = pass clicks to desktop, false = receive clicks
   * @param {{ forward?: boolean }} [options] - forward:true keeps mousemove delivery
   */
  setIgnoreMouseEvents(ignore, options = {}) {
    const forward = Boolean(options?.forward);
    if (this._lastIgnore === ignore && this._lastForward === forward) {
      return; // Skip redundant IPC message
    }
    this._lastIgnore = ignore;
    this._lastForward = forward;
    getApi()?.setIgnoreMouseEvents(ignore, options);
  },

  /**
   * Set the window always-on-top state.
   * @param {boolean} value
   */
  setAlwaysOnTop(value) {
    getApi()?.setAlwaysOnTop(value);
  },

  /**
   * Get the current always-on-top state.
   * @returns {Promise<boolean>}
   */
  async getAlwaysOnTop() {
    return getApi()?.getAlwaysOnTop?.() ?? false;
  },

  /**
   * Get the primary display information.
   * @returns {Promise<{ width: number, height: number, scaleFactor: number, workArea: object }>}
   */
  async getDisplayInfo() {
    const api = getApi();
    if (api?.getDisplayInfo) {
      return await api.getDisplayInfo();
    }
    if (typeof window !== 'undefined' && window.screen) {
      return {
        width: window.screen.width,
        height: window.screen.height,
        scaleFactor: window.devicePixelRatio || 1,
        workArea: { x: 0, y: 0, width: window.screen.width, height: window.screen.height },
      };
    }
    return {
      width: 1920,
      height: 1080,
      scaleFactor: 1,
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    };
  },

  /** Minimize the Electron window */
  minimizeWindow() {
    getApi()?.minimizeWindow?.();
  },

  /** Quit the entire Electron app */
  quitApp() {
    getApi()?.quitApp?.();
  },

  /** Show the window */
  showWindow() {
    getApi()?.showWindow?.();
  },

  /** Hide the window */
  hideWindow() {
    getApi()?.hideWindow?.();
  },

  /** Execute a shell command with options (e.g. timeout) */
  async execCommand(command, options = {}) {
    const api = getApi();
    if (api?.execCommand) {
      return await api.execCommand(command, options);
    }
    return { stdOut: '', stdErr: 'Electron environment unavailable', exitCode: 1 };
  },

  /** Read file content */
  async readFile(filePath) {
    const api = getApi();
    if (api?.readFile) {
      return await api.readFile(filePath);
    }
    throw new Error('Electron filesystem unavailable in browser');
  },

  /** Write file content */
  async writeFile(filePath, data) {
    const api = getApi();
    if (api?.writeFile) {
      return await api.writeFile(filePath, data);
    }
    throw new Error('Electron filesystem unavailable in browser');
  },

  /** Append file content */
  async appendFile(filePath, data) {
    const api = getApi();
    if (api?.appendFile) {
      return await api.appendFile(filePath, data);
    }
    throw new Error('Electron filesystem unavailable in browser');
  },

  /** Read directory */
  async readDirectory(dirPath) {
    const api = getApi();
    if (api?.readDirectory) {
      return await api.readDirectory(dirPath);
    }
    throw new Error('Electron filesystem unavailable in browser');
  },

  /** Open external URL in user's default browser (e.g. Brave) */
  async openExternal(url) {
    const api = getApi();
    if (api?.openExternal) {
      return await api.openExternal(url);
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
      return true;
    }
    return false;
  },

  /** Open file or folder directly with system default app */
  async openPath(targetPath) {
    const api = getApi();
    if (api?.openPath) {
      return await api.openPath(targetPath);
    }
    return { success: false, error: 'Electron unavailable' };
  },

  /** Reveal file in File Explorer */
  async showItemInFolder(targetPath) {
    const api = getApi();
    if (api?.showItemInFolder) {
      return await api.showItemInFolder(targetPath);
    }
    return false;
  },

  /** Capture native OS desktop frame (JPEG Base64) for instant Gemini vision */
  async captureScreenNative(region = null) {
    const api = getApi();
    if (api?.captureScreenNative) {
      return await api.captureScreenNative(region);
    }
    return null;
  },

  /** Import custom scene / wallpaper file through native OS file dialog */
  async importCustomSceneFile() {
    const api = getApi();
    if (api?.importCustomSceneFile) {
      return await api.importCustomSceneFile();
    }
    return { canceled: true, error: 'Electron unavailable' };
  },

  /** Query granular memory telemetry across all Electron processes */
  async getProcessMemoryInfo() {
    const api = getApi();
    if (api?.getProcessMemoryInfo) {
      return await api.getProcessMemoryInfo();
    }
    return null;
  },

  /** Query GPU feature status and hardware acceleration flags */
  async getGpuFeatureStatus() {
    const api = getApi();
    if (api?.getGpuFeatureStatus) {
      return await api.getGpuFeatureStatus();
    }
    return null;
  },

  /** Query detailed hardware GPU adapter metadata */
  async getGpuInfo() {
    const api = getApi();
    if (api?.getGpuInfo) {
      return await api.getGpuInfo();
    }
    return null;
  },

  /** Subscribe to global shortcut events (e.g. shortcut-toggle-mute, shortcut-capture-screen) */
  onShortcutEvent(channel, callback) {
    const api = getApi();
    if (api?.onShortcutEvent) {
      return api.onShortcutEvent(channel, callback);
    }
    return () => {};
  },

  /** Read text from clipboard */
  async getClipboardText() {
    const api = getApi();
    if (api?.getClipboardText) {
      return await api.getClipboardText();
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      return await navigator.clipboard.readText();
    }
    return '';
  },

  /** Write text to clipboard */
  async setClipboardText(text) {
    const api = getApi();
    if (api?.setClipboardText) {
      return await api.setClipboardText(text);
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  },

  /** Show OS notification */
  async showNotification(titleOrPayload, body) {
    const api = getApi();
    if (api?.showNotification) {
      if (typeof titleOrPayload === 'object' && titleOrPayload !== null) {
        return await api.showNotification(titleOrPayload);
      }
      return await api.showNotification({ title: titleOrPayload, body });
    }
    return false;
  },

  // ── Auto-Updater Methods ───────────────────────────────────────────────────
  /** Check for newer versions of Cristi Desktop */
  async checkForUpdates() {
    const api = getApi();
    if (api?.checkForUpdates) {
      return await api.checkForUpdates();
    }
    return { success: false, error: 'Actualizaciones automáticas no disponibles en versión web' };
  },

  /** Download the available update in background */
  async downloadUpdate() {
    const api = getApi();
    if (api?.downloadUpdate) {
      return await api.downloadUpdate();
    }
    return { success: false, error: 'Descarga no disponible en versión web' };
  },

  /** Quit and install the downloaded update */
  installUpdate() {
    const api = getApi();
    if (api?.installUpdate) {
      return api.installUpdate();
    }
    return false;
  },

  /** Get local application semantic version */
  async getAppVersion() {
    const api = getApi();
    if (api?.getAppVersion) {
      return await api.getAppVersion();
    }
    return '1.0.0 (Web)';
  },

  /** Listen for update lifecycle events */
  onUpdateStatus(callback) {
    const api = getApi();
    if (api?.onUpdateStatus) {
      return api.onUpdateStatus(callback);
    }
    return () => {};
  },
};

export const ElectronBridge = electronBridge;
export default electronBridge;
