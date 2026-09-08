/**
 * Cristi AI - Modern Electron Bridge (Strict TypeScript)
 * 
 * Safely wraps window.electron / window.electronBridge / window.electronAPI / ipcRenderer
 * with complete type definitions, deduplication, and zero-crash browser fallback.
 */

export interface DisplayInfo {
  width: number;
  height: number;
  scaleFactor: number;
  workArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ExecCommandResult {
  stdOut: string;
  stdErr: string;
  exitCode: number;
}

export interface StatusResult {
  success: boolean;
  error?: string;
  [key: string]: any;
}

const getApi = (): any => {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  return win.electronAPI || win.electronBridge || win.electron || win.ipcRenderer || null;
};

export class ElectronBridgeService {
  public _interactionLockCount = 0;
  private _lastIgnore: boolean | null = null;
  private _lastForward: boolean | null = null;

  /** True when running inside Electron desktop environment */
  public get isElectron(): boolean {
    return Boolean(getApi()?.isElectron);
  }

  public acquireInteractionLock(): void {
    this._interactionLockCount++;
    if (this._interactionLockCount > 0) {
      this.setIgnoreMouseEvents(false);
    }
  }

  public releaseInteractionLock(): void {
    if (this._interactionLockCount > 0) {
      this._interactionLockCount--;
      if (this._interactionLockCount === 0) {
        this.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  }

  public resetInteractionLock(): void {
    this._interactionLockCount = 0;
    this._lastIgnore = null;
    this._lastForward = null;
    this.setIgnoreMouseEvents(true, { forward: true });
  }

  /**
   * Toggle window click-through mode.
   * Deduplicates identical consecutive calls to prevent flooding Electron IPC.
   */
  public setIgnoreMouseEvents(ignore: boolean, options: { forward?: boolean } = {}): void {
    if (ignore === true && this._interactionLockCount > 0) {
      return; // Blocked by InteractionLock
    }
    const forward = Boolean(options?.forward);
    if (this._lastIgnore === ignore && this._lastForward === forward) {
      return; // Skip redundant IPC message
    }
    this._lastIgnore = ignore;
    this._lastForward = forward;
    getApi()?.setIgnoreMouseEvents?.(ignore, { ...options, forward: false });
  }

  public syncHitboxes(hitboxes: unknown[]): void {
    getApi()?.syncHitboxes?.(hitboxes);
  }

  public setAlwaysOnTop(value: boolean): void {
    getApi()?.setAlwaysOnTop?.(value);
  }

  public async getAlwaysOnTop(): Promise<boolean> {
    return (await getApi()?.getAlwaysOnTop?.()) ?? false;
  }

  public async getDisplayInfo(): Promise<DisplayInfo> {
    const api = getApi();
    if (api?.getDisplayInfo) {
      return await api.getDisplayInfo();
    }
    if (typeof window !== 'undefined' && window.screen) {
      return {
        width: window.screen.width,
        height: window.screen.height,
        scaleFactor: window.devicePixelRatio || 1,
        workArea: { x: 0, y: 0, width: window.screen.width, height: window.screen.height }
      };
    }
    return {
      width: 1920,
      height: 1080,
      scaleFactor: 1,
      workArea: { x: 0, y: 0, width: 1920, height: 1080 }
    };
  }

  public minimizeWindow(): void {
    getApi()?.minimizeWindow?.();
  }

  public quitApp(): void {
    getApi()?.quitApp?.();
  }

  public async relaunchApp(): Promise<StatusResult> {
    const api = getApi();
    if (api?.relaunchApp) {
      return await api.relaunchApp();
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
    return { success: true };
  }

  public async reloadWindow(): Promise<StatusResult> {
    const api = getApi();
    if (api?.reloadWindow) {
      return await api.reloadWindow();
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
    return { success: true };
  }

  public showWindow(): void {
    getApi()?.showWindow?.();
  }

  public hideWindow(): void {
    getApi()?.hideWindow?.();
  }

  public async execCommand(command: string, options: Record<string, unknown> = {}): Promise<ExecCommandResult> {
    const api = getApi();
    if (api?.execCommand) {
      return await api.execCommand(command, options);
    }
    return { stdOut: '', stdErr: 'Electron environment unavailable', exitCode: 1 };
  }

  public async mcpConnect(config: Record<string, unknown> = {}): Promise<StatusResult> {
    return (await getApi()?.mcpConnect?.(config)) || { success: false, error: 'Transporte MCP no disponible.' };
  }

  public async mcpCallTool(payload: Record<string, unknown> = {}): Promise<StatusResult> {
    return (await getApi()?.mcpCallTool?.(payload)) || { success: false, error: 'Transporte MCP no disponible.' };
  }

  public async mcpDisconnect(serverId: string): Promise<StatusResult> {
    return (await getApi()?.mcpDisconnect?.(serverId)) || { success: false, error: 'Transporte MCP no disponible.' };
  }

  public async readFile(filePath: string): Promise<string> {
    const api = getApi();
    if (api?.readFile) {
      return await api.readFile(filePath);
    }
    throw new Error('Electron filesystem unavailable in browser');
  }

  public async writeFile(filePath: string, data: string): Promise<boolean> {
    const api = getApi();
    if (api?.writeFile) {
      return await api.writeFile(filePath, data);
    }
    throw new Error('Electron filesystem unavailable in browser');
  }

  public async appendFile(filePath: string, data: string): Promise<boolean> {
    const api = getApi();
    if (api?.appendFile) {
      return await api.appendFile(filePath, data);
    }
    throw new Error('Electron filesystem unavailable in browser');
  }

  public async readDirectory(dirPath: string): Promise<any> {
    const api = getApi();
    if (api?.readDirectory) {
      return await api.readDirectory(dirPath);
    }
    throw new Error('Electron filesystem unavailable in browser');
  }

  public async memoryLoad(): Promise<any> {
    return await getApi()?.memoryLoad?.();
  }

  public async memorySave(memories: unknown): Promise<any> {
    return await getApi()?.memorySave?.(memories);
  }

  public async setSecureSecret(key: string, value: string): Promise<StatusResult> {
    return (await getApi()?.setSecureSecret?.(key, value)) || { success: false, error: 'Unavailable' };
  }

  public async getSecureSecret(key: string): Promise<string | null> {
    return (await getApi()?.getSecureSecret?.(key)) ?? null;
  }

  public async deleteSecureSecret(key: string): Promise<StatusResult> {
    return (await getApi()?.deleteSecureSecret?.(key)) || { success: false, error: 'Unavailable' };
  }

  public async openExternal(url: string): Promise<boolean> {
    const api = getApi();
    if (api?.openExternal) {
      return await api.openExternal(url);
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
      return true;
    }
    return false;
  }

  public async openPath(targetPath: string): Promise<StatusResult> {
    const api = getApi();
    if (api?.openPath) {
      return await api.openPath(targetPath);
    }
    return { success: false, error: 'Electron unavailable' };
  }

  public async showItemInFolder(targetPath: string): Promise<boolean> {
    const api = getApi();
    if (api?.showItemInFolder) {
      return await api.showItemInFolder(targetPath);
    }
    return false;
  }

  public async captureScreenNative(region: unknown = null): Promise<string | null> {
    const api = getApi();
    if (api?.captureScreenNative) {
      return await api.captureScreenNative(region);
    }
    return null;
  }

  public async startDesktopAudioCapture(options: Record<string, unknown> = {}): Promise<StatusResult> {
    const api = getApi();
    if (api?.desktopAudioNativeStart) {
      return await api.desktopAudioNativeStart(options);
    }
    return { success: false, available: false, error: 'Captura WASAPI no disponible fuera de Electron.' };
  }

  public async stopDesktopAudioCapture(): Promise<StatusResult> {
    const api = getApi();
    if (api?.desktopAudioNativeStop) {
      return await api.desktopAudioNativeStop();
    }
    return { success: true, alreadyStopped: true };
  }

  public async getDesktopAudioCaptureStatus(): Promise<any> {
    const api = getApi();
    if (api?.desktopAudioNativeStatus) {
      return await api.desktopAudioNativeStatus();
    }
    return { running: false, transport: null, frameCount: 0 };
  }

  public onDesktopAudioFrame(callback: (data: any) => void): () => void {
    const api = getApi();
    return api?.onDesktopAudioNativeFrame?.(callback) || (() => {});
  }

  public onDesktopAudioEvent(callback: (data: any) => void): () => void {
    const api = getApi();
    return api?.onDesktopAudioNativeEvent?.(callback) || (() => {});
  }

  public async importCustomSceneFile(): Promise<any> {
    const api = getApi();
    if (api?.importCustomSceneFile) {
      return await api.importCustomSceneFile();
    }
    return { canceled: true, error: 'Electron unavailable' };
  }

  // ── Minecraft Companion API ────────────────────────────────────────────────
  public async minecraftConnect(opts: any): Promise<StatusResult> {
    const api = getApi();
    if (api?.minecraftConnect) {
      return await api.minecraftConnect(opts);
    }
    return { success: false, error: 'Electron bridge unavailable' };
  }

  public async minecraftDisconnect(): Promise<any> {
    return await getApi()?.minecraftDisconnect?.();
  }

  public async minecraftChat(msg: string): Promise<any> {
    return await getApi()?.minecraftChat?.(msg);
  }

  public async minecraftGetStatus(): Promise<any> {
    return await getApi()?.minecraftGetStatus?.();
  }

  public async minecraftMoveTo(coords: any): Promise<any> {
    return await getApi()?.minecraftMoveTo?.(coords);
  }

  public async minecraftFollow(player: any): Promise<any> {
    return await getApi()?.minecraftFollow?.(player);
  }

  public async minecraftStop(): Promise<any> {
    return await getApi()?.minecraftStop?.();
  }

  public async minecraftMineBlock(coords: any): Promise<any> {
    return await getApi()?.minecraftMineBlock?.(coords);
  }

  public async minecraftPlaceBlock(payload: any): Promise<any> {
    return await getApi()?.minecraftPlaceBlock?.(payload);
  }

  public async minecraftAttack(payload: any): Promise<any> {
    return await getApi()?.minecraftAttack?.(payload);
  }

  public onMinecraftChat(callback: (data: any) => void): () => void {
    return getApi()?.onMinecraftChat?.(callback) || (() => {});
  }

  public onMinecraftEvent(callback: (data: any) => void): () => void {
    return getApi()?.onMinecraftEvent?.(callback) || (() => {});
  }

  // ── Discord Companion API ──────────────────────────────────────────────────
  public async discordConnect(opts: any): Promise<StatusResult> {
    const api = getApi();
    if (api?.discordConnect) {
      return await api.discordConnect(opts);
    }
    return { success: false, error: 'Electron bridge unavailable' };
  }

  public async discordDisconnect(): Promise<any> {
    return await getApi()?.discordDisconnect?.();
  }

  public async discordSendMessage(payload: any): Promise<any> {
    return await getApi()?.discordSendMessage?.(payload);
  }

  public async discordGetMessages(payload: any): Promise<any> {
    return await getApi()?.discordGetMessages?.(payload);
  }

  public async discordSetStatus(opts: any): Promise<any> {
    return await getApi()?.discordSetStatus?.(opts);
  }

  public async discordVoiceJoin(opts: any): Promise<any> {
    return await getApi()?.discordVoiceJoin?.(opts);
  }

  public async discordVoiceLeave(): Promise<any> {
    return await getApi()?.discordVoiceLeave?.();
  }

  public async discordVoiceSendAudio(payload: any): Promise<any> {
    return await getApi()?.discordVoiceSendAudio?.(payload);
  }

  public onDiscordMessage(callback: (data: any) => void): () => void {
    return getApi()?.onDiscordMessage?.(callback) || (() => {});
  }

  public onDiscordEvent(callback: (data: any) => void): () => void {
    return getApi()?.onDiscordEvent?.(callback) || (() => {});
  }

  public onDiscordVoiceEvent(callback: (data: any) => void): () => void {
    return getApi()?.onDiscordVoiceEvent?.(callback) || (() => {});
  }

  public onDiscordVoiceAudio(callback: (data: any) => void): () => void {
    return getApi()?.onDiscordVoiceAudio?.(callback) || (() => {});
  }

  // ── System Diagnostics & Native Features ─────────────────────────────────
  public async getProcessMemoryInfo(): Promise<any> {
    return await getApi()?.getProcessMemoryInfo?.();
  }

  public async getGpuFeatureStatus(): Promise<any> {
    return await getApi()?.getGpuFeatureStatus?.();
  }

  public async getGpuInfo(): Promise<any> {
    return await getApi()?.getGpuInfo?.();
  }

  public onShortcutEvent(channel: string, callback: (...args: any[]) => void): () => void {
    const api = getApi();
    if (api?.onShortcutEvent) {
      return api.onShortcutEvent(channel, callback);
    }
    return () => {};
  }

  public async getClipboardText(): Promise<string> {
    const api = getApi();
    if (api?.getClipboardText) {
      return await api.getClipboardText();
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      return await navigator.clipboard.readText();
    }
    return '';
  }

  public async setClipboardText(text: string): Promise<boolean> {
    const api = getApi();
    if (api?.setClipboardText) {
      return await api.setClipboardText(text);
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  }

  public async showNotification(titleOrPayload: string | { title?: string; body?: string }, body?: string): Promise<boolean> {
    const api = getApi();
    if (api?.showNotification) {
      if (typeof titleOrPayload === 'object' && titleOrPayload !== null) {
        return await api.showNotification(titleOrPayload);
      }
      return await api.showNotification({ title: titleOrPayload, body });
    }
    return false;
  }

  // ── Auto-Updater Methods ───────────────────────────────────────────────────
  public async checkForUpdates(): Promise<StatusResult> {
    const api = getApi();
    if (api?.checkForUpdates) {
      return await api.checkForUpdates();
    }
    return { success: false, error: 'Actualizaciones automáticas no disponibles en versión web' };
  }

  public async downloadUpdate(): Promise<StatusResult> {
    const api = getApi();
    if (api?.downloadUpdate) {
      return await api.downloadUpdate();
    }
    return { success: false, error: 'Descarga no disponible en versión web' };
  }

  public installUpdate(): any {
    const api = getApi();
    if (api?.installUpdate) {
      return api.installUpdate();
    }
    return false;
  }

  public async getAppVersion(): Promise<string> {
    const api = getApi();
    if (api?.getAppVersion) {
      return await api.getAppVersion();
    }
    return '1.0.0 (Web)';
  }

  public onUpdateStatus(callback: (data: any) => void): () => void {
    const api = getApi();
    if (api?.onUpdateStatus) {
      return api.onUpdateStatus(callback);
    }
    return () => {};
  }

  // ── Settings & Config ─────────────────────────────────────────────────────
  public openSettingsWindow(): void {
    getApi()?.openSettingsWindow?.();
  }

  public closeSettingsWindow(): void {
    getApi()?.closeSettingsWindow?.();
  }

  public async saveAppConfig(config: any): Promise<StatusResult> {
    const api = getApi();
    if (api?.saveAppConfig) {
      return await api.saveAppConfig(config);
    }
    // Fallback in web: localStorage
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('cristi_app_config', JSON.stringify(config));
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message };
      }
    }
    return { success: false, error: 'Unavailable' };
  }

  public async sendConfigUpdated(config: any): Promise<StatusResult> {
    return await this.saveAppConfig(config);
  }

  public async saveConfig(config: any): Promise<StatusResult> {
    return await this.saveAppConfig(config);
  }

  public async getAppConfig(): Promise<any> {
    const api = getApi();
    if (api?.getAppConfig) {
      return await api.getAppConfig();
    }
    if (typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem('cristi_app_config');
        return item ? JSON.parse(item) : null;
      } catch (err) {
        console.error(err);
      }
    }
    return null;
  }

  public onConfigUpdated(callback: (config: any) => void): () => void {
    const api = getApi();
    if (api?.onConfigUpdated) {
      return api.onConfigUpdated(callback);
    }
    return () => {};
  }

  public onCompanionPause(callback: () => void): () => void {
    const api = getApi();
    if (api?.onCompanionPause) {
      return api.onCompanionPause(callback);
    }
    return () => {};
  }

  public onCompanionResume(callback: () => void): () => void {
    const api = getApi();
    if (api?.onCompanionResume) {
      return api.onCompanionResume(callback);
    }
    return () => {};
  }

  public onSettingsWindowState(callback: (state: any) => void): () => void {
    const api = getApi();
    if (api?.onSettingsWindowState) {
      return api.onSettingsWindowState(callback);
    }
    return () => {};
  }

  public async openCameraWindow(): Promise<StatusResult> {
    const api = getApi();
    if (api?.openCameraWindow) {
      return await api.openCameraWindow();
    }
    return { success: false, error: 'Unavailable' };
  }

  public async closeCameraWindow(): Promise<StatusResult> {
    const api = getApi();
    if (api?.closeCameraWindow) {
      return await api.closeCameraWindow();
    }
    return { success: false, error: 'Unavailable' };
  }

  public async isCameraWindowOpen(): Promise<boolean> {
    const api = getApi();
    if (api?.isCameraWindowOpen) {
      return await api.isCameraWindowOpen();
    }
    return false;
  }

  public onCameraWindowState(callback: (state: any) => void): () => void {
    const api = getApi();
    if (api?.onCameraWindowState) {
      return api.onCameraWindowState(callback);
    }
    return () => {};
  }

  // ── Playwright Native Automation Bridge ───────────────────────────────────
  public async playwrightExecute(action: string, params: Record<string, unknown> = {}): Promise<StatusResult> {
    const api = getApi();
    if (api?.playwrightExecute) {
      return await api.playwrightExecute(action, params);
    }
    return { success: false, error: 'Playwright no disponible fuera de Electron desktop.' };
  }

  // ── Spotify Native & Media Control Bridge ─────────────────────────────────
  public async spotifyControl(action: string, params: Record<string, unknown> = {}): Promise<StatusResult> {
    const api = getApi();
    if (api?.spotifyControl) {
      return await api.spotifyControl(action, params);
    }
    return { success: false, error: 'Control nativo de Spotify no disponible fuera de Electron desktop.' };
  }
}

export const electronBridge = new ElectronBridgeService();
export const ElectronBridge = electronBridge;
export default electronBridge;
