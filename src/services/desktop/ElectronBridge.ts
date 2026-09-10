import { publicSettings } from '../../../shared/security';
import type {
  ElectronApiBridge,
  DisplayInfo as IpcDisplayInfo,
  ProcessMemoryInfo,
  ScreenRegion,
  MemoryRecord,
  MemoryLoadResult,
  MemorySaveResult,
} from '../../../shared/ipc/contracts';

export type { MemoryRecord, MemoryLoadResult, MemorySaveResult };

/**
 * Cristi AI - Modern Electron Bridge (Strict TypeScript)
 * 
 * Safely wraps window.electron / window.electronBridge / window.electronAPI
 * with complete type definitions, deduplication, zero-crash browser fallback,
 * and strict compile-time types (0 uses of `any`).
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
  error?: string | null;
  [key: string]: unknown;
}

const getApi = (): ElectronApiBridge | null => {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    electronAPI?: ElectronApiBridge;
    electronBridge?: ElectronApiBridge;
    electron?: ElectronApiBridge;
  };
  return win.electronAPI || win.electronBridge || win.electron || null;
};

export class ElectronBridgeService {
  public async requestLiveToken(model: string): Promise<string> {
    const api = getApi();
    if (!api?.requestLiveToken) throw new Error('Live requiere Electron y una credencial configurada.');
    return api.requestLiveToken(model);
  }

  public async credentialStatus(): Promise<{ hasGeminiCredential: boolean; hasDiscordCredential: boolean; hasSpotifyCredential: boolean }> {
    return await getApi()?.credentialStatus?.() ?? { hasGeminiCredential: false, hasDiscordCredential: false, hasSpotifyCredential: false };
  }

  public async geminiGenerate(model: string, body: Record<string, unknown>): Promise<unknown> {
    const api = getApi();
    if (!api?.geminiGenerate) throw new Error('Gemini requiere Electron.');
    return api.geminiGenerate(model, body);
  }

  public async spotifyToken(): Promise<string | null> {
    return (await getApi()?.spotifyToken?.()) ?? null;
  }

  public _interactionLockCount = 0;
  private _lastIgnore: boolean | null = null;
  private _lastForward: boolean | null = null;

  /** True when running inside Electron desktop environment */
  public get isElectron(): boolean {
    return Boolean(getApi()?.isElectron);
  }

  public isElectronAvailable(): boolean {
    return this.isElectron;
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

  public syncInteractiveHitboxes(hitboxes: unknown[]): void {
    getApi()?.syncInteractiveHitboxes?.(hitboxes);
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
      const info: IpcDisplayInfo = await api.getDisplayInfo();
      return {
        width: info.bounds.width,
        height: info.bounds.height,
        scaleFactor: info.scaleFactor,
        workArea: {
          x: info.workArea.x,
          y: info.workArea.y,
          width: info.workArea.width,
          height: info.workArea.height
        }
      };
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

  public async approveWorkspace(): Promise<boolean> {
    const api = getApi();
    if (!api?.approveWorkspace) throw new Error('Selecciona la carpeta desde Ajustes.');
    return api.approveWorkspace();
  }

  public async systemExecute(kind: 'system-info' | 'list-processes'): Promise<ExecCommandResult> {
    const api = getApi();
    if (!api?.systemExecute) throw new Error('Capacidad del sistema no disponible.');
    const result = await api.systemExecute({ kind }) as ExecCommandResult;
    return result;
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
      return await api.readFile({ scope: 'workspaceApproved', path: filePath });
    }
    throw new Error('Electron filesystem unavailable in browser');
  }

  public async writeFile(filePath: string, data: string): Promise<boolean> {
    const api = getApi();
    if (api?.writeFile) {
      return await api.writeFile({ scope: 'workspaceApproved', path: filePath }, data);
    }
    throw new Error('Electron filesystem unavailable in browser');
  }

  public async appendFile(filePath: string, data: string): Promise<boolean> {
    const api = getApi();
    if (api?.appendFile) {
      return await api.appendFile({ scope: 'workspaceApproved', path: filePath }, data);
    }
    throw new Error('Electron filesystem unavailable in browser');
  }

  public async readDirectory(dirPath: string): Promise<{ entry: string; type: 'FILE' | 'DIRECTORY' }[]> {
    const api = getApi();
    if (api?.readDirectory) {
      return await api.readDirectory({ scope: 'workspaceApproved', path: dirPath });
    }
    throw new Error('Electron filesystem unavailable in browser');
  }

  public async memoryLoad(): Promise<MemoryLoadResult> {
    return (await getApi()?.memoryLoad?.()) ?? { success: false, error: 'Memoria no disponible.' };
  }

  public async memorySave(memories: Record<string, unknown>[]): Promise<MemorySaveResult> {
    return (await getApi()?.memorySave?.(memories)) ?? { success: false, error: 'Memoria no disponible.' };
  }

  public async setSecureSecret(key: string, value: string): Promise<StatusResult> {
    const api = getApi();
    if (!api?.setSecureSecret) throw new Error('Abre Ajustes para guardar credenciales.');
    const result = await api.setSecureSecret(key, value);
    if (!result.success) throw new Error(result.error || 'No se pudo guardar la credencial.');
    return result;
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
      return await api.openPath({ scope: 'workspaceApproved', path: targetPath });
    }
    return { success: false, error: 'Electron unavailable' };
  }

  public async showItemInFolder(targetPath: string): Promise<boolean> {
    const api = getApi();
    if (api?.showItemInFolder) {
      return await api.showItemInFolder({ scope: 'workspaceApproved', path: targetPath });
    }
    return false;
  }

  public async captureScreenNative(region: ScreenRegion | null = null): Promise<string | null> {
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

  public async getDesktopAudioCaptureStatus(): Promise<{
    running: boolean;
    sourceId: string | null;
    transport: string | null;
    frameCount: number;
    uptimeMs: number;
  }> {
    const api = getApi();
    if (api?.desktopAudioNativeStatus) {
      return await api.desktopAudioNativeStatus();
    }
    return { running: false, sourceId: null, transport: null, frameCount: 0, uptimeMs: 0 };
  }

  public onDesktopAudioFrame(callback: (data: unknown) => void): () => void {
    const api = getApi();
    return api?.onDesktopAudioNativeFrame?.(callback) || (() => {});
  }

  public onDesktopAudioEvent(callback: (data: unknown) => void): () => void {
    const api = getApi();
    return api?.onDesktopAudioNativeEvent?.(callback) || (() => {});
  }

  public async importCustomSceneFile(): Promise<{
    canceled: boolean;
    filePath?: string;
    fileUrl?: string;
    name?: string;
    type?: 'video' | 'animated' | 'image';
    error?: string;
  }> {
    const api = getApi();
    if (api?.importCustomSceneFile) {
      return await api.importCustomSceneFile();
    }
    return { canceled: true, error: 'Electron unavailable' };
  }

  // ── Minecraft Companion API ────────────────────────────────────────────────
  public async minecraftConnect(opts: Record<string, unknown> = {}): Promise<StatusResult> {
    const api = getApi();
    if (api?.minecraftConnect) {
      return await api.minecraftConnect(opts);
    }
    return { success: false, error: 'Electron bridge unavailable' };
  }

  public async minecraftDisconnect(): Promise<StatusResult> {
    return (await getApi()?.minecraftDisconnect?.()) ?? { success: false };
  }

  public async minecraftChat(msg: string): Promise<StatusResult> {
    return (await getApi()?.minecraftChat?.(msg)) ?? { success: false };
  }

  public async minecraftGetStatus(): Promise<{ connected: boolean; [key: string]: unknown }> {
    return (await getApi()?.minecraftGetStatus?.()) ?? { connected: false };
  }

  public async minecraftMoveTo(coords: { x: number; y: number; z: number }): Promise<StatusResult> {
    return (await getApi()?.minecraftMoveTo?.(coords)) ?? { success: false };
  }

  public async minecraftFollow(player: string): Promise<StatusResult> {
    return (await getApi()?.minecraftFollow?.(player)) ?? { success: false };
  }

  public async minecraftStop(): Promise<StatusResult> {
    return (await getApi()?.minecraftStop?.()) ?? { success: false };
  }

  public async minecraftMineBlock(coords: { x: number; y: number; z: number }): Promise<StatusResult> {
    return (await getApi()?.minecraftMineBlock?.(coords)) ?? { success: false };
  }

  public async minecraftPlaceBlock(payload: { x: number; y: number; z: number; blockName: string }): Promise<StatusResult> {
    return (await getApi()?.minecraftPlaceBlock?.(payload)) ?? { success: false };
  }

  public async minecraftAttack(payload: { entityName?: string } = {}): Promise<StatusResult> {
    return (await getApi()?.minecraftAttack?.(payload)) ?? { success: false };
  }

  public onMinecraftChat(callback: (data: unknown) => void): () => void {
    return getApi()?.onMinecraftChat?.(callback) || (() => {});
  }

  public onMinecraftEvent(callback: (data: unknown) => void): () => void {
    return getApi()?.onMinecraftEvent?.(callback) || (() => {});
  }

  // ── Discord Companion API ──────────────────────────────────────────────────
  public async discordConnect(opts: { statusMessage?: string; activityType?: string } = {}): Promise<StatusResult> {
    const api = getApi();
    if (api?.discordConnect) {
      return await api.discordConnect(opts);
    }
    return { success: false, error: 'Electron bridge unavailable' };
  }

  public async discordDisconnect(): Promise<StatusResult> {
    return (await getApi()?.discordDisconnect?.()) ?? { success: false };
  }

  public async discordSendMessage(payload: { channelId: string; content: string }): Promise<StatusResult> {
    return (await getApi()?.discordSendMessage?.(payload)) ?? { success: false };
  }

  public async discordGetMessages(payload: { channelId: string; limit?: number }): Promise<{ messages: unknown[]; error?: string; success?: boolean }> {
    const res = await getApi()?.discordGetMessages?.(payload);
    return res ?? { success: false, messages: [] };
  }

  public async discordSetStatus(opts: { statusText: string; activityType?: string }): Promise<StatusResult> {
    return (await getApi()?.discordSetStatus?.(opts)) ?? { success: false };
  }

  public async discordVoiceJoin(opts: { guildId: string; channelId: string }): Promise<StatusResult> {
    return (await getApi()?.discordVoiceJoin?.(opts)) ?? { success: false };
  }

  public async discordVoiceLeave(): Promise<StatusResult> {
    return (await getApi()?.discordVoiceLeave?.()) ?? { success: false };
  }

  public async discordVoiceSendAudio(payload: { data: string; frameId?: string }): Promise<StatusResult> {
    return (await getApi()?.discordVoiceSendAudio?.(payload)) ?? { success: false };
  }

  public onDiscordMessage(callback: (data: unknown) => void): () => void {
    return getApi()?.onDiscordMessage?.(callback) || (() => {});
  }

  public onDiscordEvent(callback: (data: unknown) => void): () => void {
    return getApi()?.onDiscordEvent?.(callback) || (() => {});
  }

  public onDiscordVoiceEvent(callback: (data: unknown) => void): () => void {
    return getApi()?.onDiscordVoiceEvent?.(callback) || (() => {});
  }

  public onDiscordVoiceAudio(callback: (data: unknown) => void): () => void {
    return getApi()?.onDiscordVoiceAudio?.(callback) || (() => {});
  }

  // ── System Diagnostics & Native Features ─────────────────────────────────
  public async getProcessMemoryInfo(): Promise<ProcessMemoryInfo | null> {
    return (await getApi()?.getProcessMemoryInfo?.()) ?? null;
  }

  public async getGpuFeatureStatus(): Promise<Record<string, string> | null> {
    return (await getApi()?.getGpuFeatureStatus?.()) ?? null;
  }

  public async getGpuInfo(): Promise<Record<string, unknown> | null> {
    return (await getApi()?.getGpuInfo?.()) ?? null;
  }

  public onShortcutEvent(channel: string, callback: (...args: unknown[]) => void): () => void {
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

  public async installUpdate(): Promise<boolean> {
    const api = getApi();
    if (api?.installUpdate) {
      return await api.installUpdate();
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

  public onUpdateStatus(callback: (data: unknown) => void): () => void {
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

  public async saveAppConfig(config: Record<string, unknown> | object): Promise<StatusResult> {
    const api = getApi();
    if (api?.saveAppConfig) {
      return await api.saveAppConfig(publicSettings(config as Record<string, unknown>));
    }
    // Fallback in web: localStorage
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('cristi_app_config', JSON.stringify(config));
        return { success: true };
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
    return { success: false, error: 'Unavailable' };
  }

  public async sendConfigUpdated(config: Record<string, unknown> | object): Promise<StatusResult> {
    return await this.saveAppConfig(config);
  }

  public async saveConfig(config: Record<string, unknown> | object): Promise<StatusResult> {
    return await this.saveAppConfig(config);
  }

  public async getAppConfig(): Promise<Record<string, unknown> | null> {
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

  public onConfigUpdated<T = unknown>(callback: (config: T) => void): () => void {
    const api = getApi();
    if (api?.onConfigUpdated) {
      return api.onConfigUpdated(callback as (data: unknown) => void);
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

  public onSettingsWindowState(callback: (state: unknown) => void): () => void {
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

  public onCameraWindowState(callback: (state: unknown) => void): () => void {
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
