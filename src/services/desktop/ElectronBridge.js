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

  _interactionLockCount: 0,
  _lastIgnore: null,
  _lastForward: null,

  acquireInteractionLock() {
    this._interactionLockCount++;
    if (this._interactionLockCount > 0) {
      this.setIgnoreMouseEvents(false);
    }
  },

  releaseInteractionLock() {
    if (this._interactionLockCount > 0) {
      this._interactionLockCount--;
      if (this._interactionLockCount === 0) {
        // Restore click-through passthrough when no more overlays hold the lock
        this.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  },

  resetInteractionLock() {
    this._interactionLockCount = 0;
    this._lastIgnore = null;
    this._lastForward = null;
    this.setIgnoreMouseEvents(true, { forward: true });
  },

  /**
   * Toggle window click-through mode.
   * Deduplicates identical consecutive calls to prevent flooding Electron IPC.
   *
   * @param {boolean} ignore - true = pass clicks to desktop, false = receive clicks
   * @param {{ forward?: boolean }} [options] - forward:true keeps mousemove delivery
   */
  setIgnoreMouseEvents(ignore, options = {}) {
    if (ignore === true && this._interactionLockCount > 0) {
      return; // Blocked by InteractionLock
    }
    const forward = Boolean(options?.forward);
    if (this._lastIgnore === ignore && this._lastForward === forward) {
      return; // Skip redundant IPC message
    }
    this._lastIgnore = ignore;
    this._lastForward = forward;
    // On Windows, passing forward: true installs a global low-level WH_MOUSE_LL hook.
    // Under GPU or screen capture load, that hook stalls the OS mouse queue by 3-6 seconds.
    // We enforce forward: false at IPC level to use native WS_EX_TRANSPARENT without OS hooks,
    // while registered hitboxes provide 0ms instant hover detection.
    getApi()?.setIgnoreMouseEvents(ignore, { ...options, forward: false });
  },

  syncHitboxes(hitboxes) {
    getApi()?.syncHitboxes?.(hitboxes);
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

  /** Relaunch / Restart the entire Electron app process */
  async relaunchApp() {
    const api = getApi();
    if (api?.relaunchApp) {
      return await api.relaunchApp();
    }
    window.location.reload();
  },

  /** Reload the current window / webContents */
  async reloadWindow() {
    const api = getApi();
    if (api?.reloadWindow) {
      return await api.reloadWindow();
    }
    window.location.reload();
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

  async setSecureSecret(key, value) {
    return await getApi()?.setSecureSecret?.(key, value);
  },

  async getSecureSecret(key) {
    return await getApi()?.getSecureSecret?.(key);
  },

  async deleteSecureSecret(key) {
    return await getApi()?.deleteSecureSecret?.(key);
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



  // ── Minecraft Companion API ────────────────────────────────────────────────
  async minecraftConnect(opts) {
    const api = getApi();
    if (api?.minecraftConnect) {
      return await api.minecraftConnect(opts);
    }
    return { success: false, error: 'Electron bridge unavailable' };
  },
  async minecraftDisconnect() {
    return await getApi()?.minecraftDisconnect?.();
  },
  async minecraftChat(msg) {
    return await getApi()?.minecraftChat?.(msg);
  },
  async minecraftGetStatus() {
    return await getApi()?.minecraftGetStatus?.();
  },
  async minecraftMoveTo(coords) {
    return await getApi()?.minecraftMoveTo?.(coords);
  },
  async minecraftFollow(player) {
    return await getApi()?.minecraftFollow?.(player);
  },
  async minecraftStop() {
    return await getApi()?.minecraftStop?.();
  },
  async minecraftMineBlock(coords) {
    return await getApi()?.minecraftMineBlock?.(coords);
  },
  async minecraftPlaceBlock(payload) {
    return await getApi()?.minecraftPlaceBlock?.(payload);
  },
  async minecraftAttack(payload) {
    return await getApi()?.minecraftAttack?.(payload);
  },
  onMinecraftChat(callback) {
    return getApi()?.onMinecraftChat?.(callback) || (() => {});
  },
  onMinecraftEvent(callback) {
    return getApi()?.onMinecraftEvent?.(callback) || (() => {});
  },

  // ── Discord Companion API ──────────────────────────────────────────────────
  async discordConnect(opts) {
    const api = getApi();
    if (api?.discordConnect) {
      return await api.discordConnect(opts);
    }
    return { success: false, error: 'Electron bridge unavailable' };
  },
  async discordDisconnect() {
    return await getApi()?.discordDisconnect?.();
  },
  async discordSendMessage(payload) {
    return await getApi()?.discordSendMessage?.(payload);
  },
  async discordGetMessages(payload) {
    return await getApi()?.discordGetMessages?.(payload);
  },
  async discordSetStatus(opts) {
    return await getApi()?.discordSetStatus?.(opts);
  },
  onDiscordMessage(callback) {
    return getApi()?.onDiscordMessage?.(callback) || (() => {});
  },
  onDiscordEvent(callback) {
    return getApi()?.onDiscordEvent?.(callback) || (() => {});
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

  // ── Settings & Config ─────────────────────────────────────────────────────
  openSettingsWindow() {
    return getApi()?.openSettingsWindow?.();
  },
  closeSettingsWindow() {
    return getApi()?.closeSettingsWindow?.();
  },
  async saveAppConfig(config) {
    const api = getApi();
    if (api?.saveAppConfig) {
      return await api.saveAppConfig(config);
    }
    // Fallback in web: localStorage
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('cristi_app_config', JSON.stringify(config));
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'Unavailable' };
  },
  async sendConfigUpdated(config) {
    return await this.saveAppConfig(config);
  },
  async saveConfig(config) {
    return await this.saveAppConfig(config);
  },
  async getAppConfig() {
    const api = getApi();
    if (api?.getAppConfig) {
      return await api.getAppConfig();
    }
    // Fallback in web: localStorage
    if (typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem('cristi_app_config');
        return item ? JSON.parse(item) : null;
      } catch (err) {
        console.error(err);
      }
    }
    return null;
  },
  onConfigUpdated(callback) {
    const api = getApi();
    if (api?.onConfigUpdated) {
      return api.onConfigUpdated(callback);
    }
    return () => {};
  },
  onCompanionPause(callback) {
    const api = getApi();
    if (api?.onCompanionPause) {
      return api.onCompanionPause(callback);
    }
    return () => {};
  },
  onCompanionResume(callback) {
    const api = getApi();
    if (api?.onCompanionResume) {
      return api.onCompanionResume(callback);
    }
    return () => {};
  },
  onSettingsWindowState(callback) {
    const api = getApi();
    if (api?.onSettingsWindowState) {
      return api.onSettingsWindowState(callback);
    }
    return () => {};
  },
  async openCameraWindow() {
    const api = getApi();
    if (api?.openCameraWindow) {
      return await api.openCameraWindow();
    }
    return { success: false, error: 'Unavailable' };
  },
  async closeCameraWindow() {
    const api = getApi();
    if (api?.closeCameraWindow) {
      return await api.closeCameraWindow();
    }
    return { success: false, error: 'Unavailable' };
  },
  async isCameraWindowOpen() {
    const api = getApi();
    if (api?.isCameraWindowOpen) {
      return await api.isCameraWindowOpen();
    }
    return false;
  },
  onCameraWindowState(callback) {
    const api = getApi();
    if (api?.onCameraWindowState) {
      return api.onCameraWindowState(callback);
    }
    return () => {};
  },

  // ── Playwright Native Automation Bridge ───────────────────────────────────
  async playwrightExecute(action, params = {}) {
    const api = getApi();
    if (api?.playwrightExecute) {
      return await api.playwrightExecute(action, params);
    }
    return { success: false, error: 'Playwright no disponible fuera de Electron desktop.' };
  },

  // ── Spotify Native & Media Control Bridge ─────────────────────────────────
  async spotifyControl(action, params = {}) {
    const api = getApi();
    if (api?.spotifyControl) {
      return await api.spotifyControl(action, params);
    }
    // Node.js direct environment fallback
    if (typeof process !== 'undefined' && process.versions?.node) {
      try {
        const { execSync } = await import(/* @vite-ignore */ 'child_process');
        if (action === 'check_desktop_installed') {
          const fs = await import(/* @vite-ignore */ 'fs');
          const path = await import(/* @vite-ignore */ 'path');
          const appData = process.env.APPDATA || '';
          const progFiles = process.env['ProgramFiles'] || '';
          const candidates = [
            path.join(appData, 'Spotify/Spotify.exe'),
            path.join(progFiles, 'Spotify/Spotify.exe')
          ];
          const found = candidates.find((p) => fs.existsSync(p));
          return { installed: Boolean(found), exePath: found || null };
        }
        if (action === 'open_uri' && params.uri) {
          execSync(`powershell.exe -Command "Start-Process '${params.uri}'"`, { timeout: 4000 });
          return { status: 'success', action: 'open_uri', uri: params.uri };
        }
        if (action === 'play_pause') {
          execSync('powershell.exe -Command "(New-Object -ComObject Wscript.Shell).SendKeys([char]179)"', { timeout: 3000 });
          return { status: 'success', action: 'play_pause' };
        }
        if (action === 'next') {
          execSync('powershell.exe -Command "(New-Object -ComObject Wscript.Shell).SendKeys([char]176)"', { timeout: 3000 });
          return { status: 'success', action: 'next' };
        }
        if (action === 'previous') {
          execSync('powershell.exe -Command "(New-Object -ComObject Wscript.Shell).SendKeys([char]177)"', { timeout: 3000 });
          return { status: 'success', action: 'previous' };
        }
        if (action === 'volume_up') {
          execSync('powershell.exe -Command "(New-Object -ComObject Wscript.Shell).SendKeys([char]175)"', { timeout: 3000 });
          return { status: 'success', action: 'volume_up' };
        }
        if (action === 'volume_down') {
          execSync('powershell.exe -Command "(New-Object -ComObject Wscript.Shell).SendKeys([char]174)"', { timeout: 3000 });
          return { status: 'success', action: 'volume_down' };
        }
        if (action === 'get_status') {
          try {
            const out = execSync('powershell.exe -Command "Get-Process -Name Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -ExpandProperty MainWindowTitle -First 1"', { timeout: 3000, encoding: 'utf-8' }).trim();
            if (out) {
              return { status: 'success', isPlaying: true, title: out };
            }
            return { status: 'success', isPlaying: false, title: 'Spotify en segundo plano' };
          } catch (_) {
            return { status: 'idle', isPlaying: false };
          }
        }
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'Control nativo de Spotify no disponible fuera de Electron desktop.' };
  },
};

export const ElectronBridge = electronBridge;
export default electronBridge;
