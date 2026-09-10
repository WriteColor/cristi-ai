import { isNewerVersion, verifyInstaller } from '../security/UpdatePolicy';
import { resolveFile, approveWorkspace, executeSystemCapability } from '../security/SystemCapabilityService';
import { readPublicConfig, writePublicConfig } from '../security/PublicConfig';
import { handleTrusted, onTrusted } from '../security/CapabilityRouter';
import { shell, clipboard, Notification, desktopCapturer, screen, dialog, app } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { processManager } from '../core/processManager';
import { windowManager } from '../windows/windowManager';
import { ExecCommandOptions, ExecCommandResult, ScreenRegion, AppConfig } from '../types/electron.types';
import { getAppRootDir } from '../core/paths';
import { processScreen, disposeScreenWorker } from '../utility/ScreenClient';

/**
 * Sanitizes and validates a filesystem path against directory traversal and null byte injections.
 */
let isScreenCaptureInProgress = false;
const activeScreenCapturePromises = new Map<string, Promise<string | null>>();
let lastScreenCaptureCache: {
  timestamp: number;
  regionKey: string;
  base64: string | null;
} = {
  timestamp: 0,
  regionKey: '',
  base64: null,
};

let pendingLocalUpdate: {
  version: string | null;
  fileName: string;
  filePath: string;
  fileSize: number;
  mtime: Date;
} | null = null;

function findLocalProjectRelease(rootDir: string) {
  const candidateDirs = [
    path.join(rootDir, 'release'),
    path.join(process.cwd(), 'release'),
    path.join(__dirname, '../../../release'),
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        const setupFiles = files.filter((f) => /^Cristi-AI-Companion-Setup-(\d+\.\d+\.\d+)\.exe$/i.test(f));
        if (setupFiles.length > 0) {
          setupFiles.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
          const latestFile = setupFiles[0];
          const match = latestFile.match(/^Cristi-AI-Companion-Setup-(\d+\.\d+\.\d+)\.exe$/i);
          const version = match ? match[1] : null;
          const fullPath = path.join(dir, latestFile);
          const stats = fs.statSync(fullPath);
          return {
            version,
            fileName: latestFile,
            filePath: fullPath,
            fileSize: stats.size,
            mtime: stats.mtime,
          };
        }
      } catch (_) {}
    }
  }
  return null;
}

/**
 * Registers native system operations, file I/O, screen capture, and app config IPC handlers.
 */
export function registerSystemIpc(rootDir?: string): void {
  const baseDir = rootDir || getAppRootDir();
  const configFilePath = path.join(app.getPath('userData'), 'cristi-config.json');

  // ── Native Command Execution with Safe Timeout ────────────────────────────
  handleTrusted('system-execute', (_event, request) => executeSystemCapability(request));
  handleTrusted('approve-workspace', () => approveWorkspace());

  // ── Filesystem Operations ─────────────────────────────────────────────────
  handleTrusted('read-file', async (_event, filePath: import("../../../shared/ipc/contracts").FileRequest) => {
    try {
      const safePath = await resolveFile(filePath);
      return await fs.promises.readFile(safePath, 'utf8');
    } catch (err) {
      throw new Error(`Failed to read file: ${(err as Error).message}`, { cause: err });
    }
  });

  handleTrusted('write-file', async (_event, filePath: import("../../../shared/ipc/contracts").FileRequest, data: unknown) => {
    try {
      const safePath = await resolveFile(filePath);
      const safeData = typeof data === 'string' ? data : String(data ?? '');
      await fs.promises.mkdir(path.dirname(safePath), { recursive: true });
      await fs.promises.writeFile(safePath, safeData, 'utf8');
      return true;
    } catch (err) {
      throw new Error(`Failed to write file: ${(err as Error).message}`, { cause: err });
    }
  });

  handleTrusted('append-file', async (_event, filePath: import("../../../shared/ipc/contracts").FileRequest, data: unknown) => {
    try {
      const safePath = await resolveFile(filePath);
      const safeData = typeof data === 'string' ? data : String(data ?? '');
      await fs.promises.mkdir(path.dirname(safePath), { recursive: true });
      await fs.promises.appendFile(safePath, safeData, 'utf8');
      return true;
    } catch (err) {
      throw new Error(`Failed to append file: ${(err as Error).message}`, { cause: err });
    }
  });

  handleTrusted('read-directory', async (_event, dirPath: import("../../../shared/ipc/contracts").FileRequest) => {
    try {
      const safePath = await resolveFile(dirPath);
      const entries = await fs.promises.readdir(safePath, { withFileTypes: true });
      return entries.map((e) => ({
        entry: e.name,
        type: e.isDirectory() ? 'DIRECTORY' : 'FILE',
      }));
    } catch (err) {
      throw new Error(`Failed to read directory: ${(err as Error).message}`, { cause: err });
    }
  });

  // ── Shell and Desktop Integration ─────────────────────────────────────────
  handleTrusted('open-external', async (_event, targetUrl: unknown) => {
    try {
      if (typeof targetUrl !== 'string' || !targetUrl.trim() || targetUrl.includes('\0')) {
        return false;
      }
      const parsed = new URL(targetUrl.trim());
      const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];
      if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        console.warn(`[Security] Protocolo no permitido bloqueado: ${parsed.protocol}`);
        return false;
      }
      await shell.openExternal(targetUrl.trim());
      return true;
    } catch (err) {
      console.warn('[SystemIpc] Error opening external URL:', err);
      return false;
    }
  });

  handleTrusted('open-path', async (_event, targetPath: import("../../../shared/ipc/contracts").FileRequest) => {
    try {
      const safePath = await resolveFile(targetPath);
      const stat = await fs.promises.stat(safePath);
      if (!stat.isDirectory()) {
        // Reveal files without executing their shell association (scripts, shortcuts, executables).
        shell.showItemInFolder(safePath);
        return { success: true, error: null };
      }
      const errorMsg = await shell.openPath(safePath);
      return { success: !errorMsg, error: errorMsg || null };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  handleTrusted('show-item-in-folder', async (_event, targetPath: import("../../../shared/ipc/contracts").FileRequest) => {
    try {
      const safePath = await resolveFile(targetPath);
      shell.showItemInFolder(safePath);
      return true;
    } catch (err) {
      console.warn('[SystemIpc] Error showing item in folder:', err);
      return false;
    }
  });

  // ── Clipboard & Notifications ─────────────────────────────────────────────
  handleTrusted('get-clipboard-text', () => {
    try {
      return clipboard.readText();
    } catch (err) {
      console.warn('[SystemIpc] Error reading clipboard:', err);
      return '';
    }
  });

  handleTrusted('set-clipboard-text', (_event, text: unknown) => {
    try {
      clipboard.writeText(typeof text === 'string' ? text : String(text ?? ''));
      return true;
    } catch (err) {
      console.warn('[SystemIpc] Error setting clipboard text:', err);
      return false;
    }
  });

  handleTrusted('show-notification', (_event, payload: unknown) => {
    try {
      const title =
        payload && typeof payload === 'object' && 'title' in payload && payload.title
          ? String(payload.title)
          : 'Cristi AI Companion';
      const body =
        payload && typeof payload === 'object' && 'body' in payload && payload.body
          ? String(payload.body)
          : '';
      if (Notification.isSupported()) {
        new Notification({ title, body }).show();
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[SystemIpc] Error showing notification:', err);
      return false;
    }
  });

  // ── High-Performance Native Screen Capture ────────────────────────────────
  handleTrusted('capture-screen-native', async (_event, region: ScreenRegion | null = null) => {
    const regionKey =
      region && typeof region === 'object'
        ? `${Math.round(region.x_pct || 0)}_${Math.round(region.y_pct || 0)}_${Math.round(region.w_pct || 100)}_${Math.round(region.h_pct || 100)}`
        : 'full';

    const now = Date.now();
    // Return cached frame if within 700ms for identical region (zero GPU contention)
    if (
      lastScreenCaptureCache.base64 &&
      lastScreenCaptureCache.regionKey === regionKey &&
      now - lastScreenCaptureCache.timestamp < 700
    ) {
      return lastScreenCaptureCache.base64;
    }

    // Coalesce duplicate ongoing capture requests for the same region
    if (activeScreenCapturePromises.has(regionKey)) {
      return (activeScreenCapturePromises.get(regionKey) ?? null) as Promise<string | null>;
    }

    isScreenCaptureInProgress = true;
    const capturePromise = (async () => {
      try {
        let targetDisplay = null;
        const mainWin = windowManager.getMainWindow();
        if (mainWin && !mainWin.isDestroyed()) {
          try {
            const bounds = mainWin.getBounds();
            targetDisplay = screen.getDisplayMatching(bounds);
          } catch (_) {}
        }
        if (!targetDisplay) {
          targetDisplay = screen.getPrimaryDisplay();
        }
        if (!targetDisplay || !targetDisplay.bounds) {
          return null;
        }

        const { width, height } = targetDisplay.bounds;
        const scale = targetDisplay.scaleFactor || 1;
        const pixelWidth = Math.max(1, Math.round(width * scale));
        const pixelHeight = Math.max(1, Math.round(height * scale));

        // Ultra-efficient thumbnail size: 768px max width for Gemini Multimodal Live
        const targetW = Math.max(1, Math.min(768, pixelWidth));
        const targetH = Math.max(1, Math.round((pixelHeight / Math.max(1, pixelWidth)) * targetW));

        let sources = [];
        try {
          sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: {
              width: targetW,
              height: targetH,
            },
            fetchWindowIcons: false,
          });
        } catch (capturerErr) {
          console.error('[SystemIpc] desktopCapturer error:', capturerErr);
          return null;
        }

        if (!sources || sources.length === 0) return null;

        const primarySource =
          sources.find((s) => s.display_id === String(targetDisplay?.id)) ||
          sources.find((s) => s.display_id === String(screen.getPrimaryDisplay()?.id)) ||
          sources[0];

        if (!primarySource || !primarySource.thumbnail || primarySource.thumbnail.isEmpty()) {
          return null;
        }

        let image = primarySource.thumbnail;
        const imgSize = image.getSize();
        if (imgSize.width <= 0 || imgSize.height <= 0) return null;

        // Preparar descripción de región normalizada para el worker
        let workerRegion: { x_pct: number; y_pct: number; w_pct: number; h_pct: number } | null = null;
        if (region && typeof region === 'object') {
          const rawX = typeof region.x_pct === 'number' && !isNaN(region.x_pct) ? region.x_pct : 0;
          const rawY = typeof region.y_pct === 'number' && !isNaN(region.y_pct) ? region.y_pct : 0;
          const rawW = typeof region.w_pct === 'number' && !isNaN(region.w_pct) ? region.w_pct : 100;
          const rawH = typeof region.h_pct === 'number' && !isNaN(region.h_pct) ? region.h_pct : 100;
          const clampedX = Math.max(0, Math.min(99, rawX));
          const clampedY = Math.max(0, Math.min(99, rawY));
          workerRegion = {
            x_pct: clampedX,
            y_pct: clampedY,
            w_pct: Math.max(1, Math.min(100 - clampedX, rawW)),
            h_pct: Math.max(1, Math.min(100 - clampedY, rawH)),
          };
        }

        // Intentar delegar crop + JPEG encode al worker (CPU-bound off-main)
        // toBitmap() se llama justo antes del postMessage; tras la transferencia
        // bgraBuffer queda vaciado, pero `image` sigue válida para el fallback.
        let base64Result: string;
        const bgraBuffer = image.toBitmap();
        const workerReply = await processScreen(
          bgraBuffer,
          imgSize.width,
          imgSize.height,
          workerRegion,
          55
        );

        if (workerReply.base64) {
          // Worker procesó correctamente (sharp disponible)
          base64Result = workerReply.base64;
        } else {
          // Fallback: sharp no disponible o worker agotó timeout → encode en main
          // Aplicar crop nativo si se especificó región
          if (workerRegion) {
            const cropX = Math.max(0, Math.min(imgSize.width - 1, Math.round((workerRegion.x_pct / 100) * imgSize.width)));
            const cropY = Math.max(0, Math.min(imgSize.height - 1, Math.round((workerRegion.y_pct / 100) * imgSize.height)));
            const maxW = imgSize.width - cropX;
            const maxH = imgSize.height - cropY;
            const cropW = Math.max(1, Math.min(maxW, Math.round((workerRegion.w_pct / 100) * imgSize.width)));
            const cropH = Math.max(1, Math.min(maxH, Math.round((workerRegion.h_pct / 100) * imgSize.height)));
            if (cropW > 0 && cropH > 0 && (cropW < imgSize.width || cropH < imgSize.height || cropX > 0 || cropY > 0)) {
              try {
                image = image.crop({ x: cropX, y: cropY, width: cropW, height: cropH });
              } catch (cropErr) {
                console.warn('[SystemIpc] Region cropping fallback failed, returning full thumbnail:', cropErr);
              }
            }
          }
          // Fast JPEG encode at quality 55 (~25KB payload, sub-3ms)
          const jpegBuffer = image.toJPEG(55);
          base64Result = jpegBuffer.toString('base64');
        }

        lastScreenCaptureCache = {
          timestamp: Date.now(),
          regionKey,
          base64: base64Result,
        };

        return base64Result;
      } catch (err) {
        console.error('[SystemIpc] capture-screen-native error:', err);
        return null;
      } finally {
        activeScreenCapturePromises.delete(regionKey);
        isScreenCaptureInProgress = activeScreenCapturePromises.size > 0;
      }
    })();

    activeScreenCapturePromises.set(regionKey, capturePromise);
    return capturePromise;
  });

  // ── Custom Wallpaper & Scene Native Importer ────────────────────────────────
  handleTrusted('import-custom-scene-file', async () => {
    try {
      const targetWin = windowManager.getMainWindow();
      const result = await dialog.showOpenDialog(targetWin || undefined as unknown as Electron.BrowserWindow, {
        title: 'Seleccionar Archivo de Escena / Fondo',
        buttonLabel: 'Importar Fondo',
        filters: [
          { name: 'Multimedia (Video / Imagen)', extensions: ['mp4', 'webm', 'mkv', 'mov', 'png', 'jpg', 'jpeg', 'gif', 'webp'] },
          { name: 'Videos', extensions: ['mp4', 'webm', 'mkv', 'mov'] },
          { name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
          { name: 'Todos los Archivos', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const sourcePath = result.filePaths[0];
      const customScenesDir = path.join(app.getPath('userData'), 'custom_scenes');
      if (!fs.existsSync(customScenesDir)) {
        fs.mkdirSync(customScenesDir, { recursive: true });
      }

      const ext = path.extname(sourcePath).toLowerCase();
      if (!/^\.(mp4|webm|mkv|mov|png|jpg|jpeg|gif|webp)$/.test(ext)) throw new Error('Tipo de archivo no admitido.');
      const baseName = path.basename(sourcePath, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const destName = `${Date.now()}_${baseName}${ext}`;
      const destPath = path.join(customScenesDir, destName);

      await fs.promises.copyFile(sourcePath, destPath);

      const isVideo = /\.(mp4|webm|mkv|mov)$/i.test(destPath);
      const isAnimated = /\.gif$/i.test(destPath);

      return {
        canceled: false,
        filePath: destPath,
        fileUrl: `app://cristi/custom-scenes/${encodeURIComponent(destName)}`,
        name: baseName,
        type: isVideo ? ('video' as const) : isAnimated ? ('animated' as const) : ('image' as const),
      };
    } catch (err) {
      console.error('[SystemIpc] Error importing custom scene file:', err);
      return { canceled: true, error: (err as Error).message };
    }
  });

  // ── Configuration Store ───────────────────────────────────────────────────
  handleTrusted('get-app-config', () => readPublicConfig());
  handleTrusted('save-app-config', async (_event, config) => {
    const clean = await writePublicConfig(config);
    const main = windowManager.getMainWindow();
    if (main && !main.isDestroyed()) main.webContents.send('config-updated', clean);
    return { success: true };
  });

  onTrusted('companion-pause', () => {
    const mainWin = windowManager.getMainWindow();
    if (mainWin?.webContents && !mainWin.isDestroyed()) {
      mainWin.webContents.send('companion-pause');
    }
  });

  onTrusted('companion-resume', () => {
    const mainWin = windowManager.getMainWindow();
    if (mainWin?.webContents && !mainWin.isDestroyed()) {
      mainWin.webContents.send('companion-resume');
    }
  });

  // ── Offline & Local Updater ───────────────────────────────────────────────
  handleTrusted('check-for-updates', async () => {
    try {
      const currentVersion = app.getVersion();
      const localRelease = findLocalProjectRelease(baseDir);

      if (localRelease && localRelease.version) {
        const isNewer = isNewerVersion(localRelease.version, currentVersion);
        if (isNewer) {
          pendingLocalUpdate = localRelease;
          const mainWin = windowManager.getMainWindow();
          if (mainWin?.webContents && !mainWin.isDestroyed()) {
            mainWin.webContents.send('update-status', {
              type: 'available',
              version: localRelease.version,
              releaseDate: localRelease.mtime,
              isLocal: true,
              sizeMB: Math.round(localRelease.fileSize / 1024 / 1024),
            });
          }
          return { success: true, version: localRelease.version, isLocal: true };
        }
      }

      const mainWin = windowManager.getMainWindow();
      if (mainWin?.webContents && !mainWin.isDestroyed()) {
        mainWin.webContents.send('update-status', {
          type: 'not-available',
          version: currentVersion,
          isLocal: true,
        });
      }
      return { success: true, version: currentVersion, isLocal: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  handleTrusted('download-update', async () => {
    try {
      if (!pendingLocalUpdate || !fs.existsSync(pendingLocalUpdate.filePath)) {
        const local = findLocalProjectRelease(baseDir);
        if (local) pendingLocalUpdate = local;
      }
      if (!pendingLocalUpdate || !fs.existsSync(pendingLocalUpdate.filePath)) {
        return { success: false, error: 'No se encontró instalador en la carpeta release/ local.' };
      }

      const mainWin = windowManager.getMainWindow();
      if (mainWin?.webContents && !mainWin.isDestroyed()) {
        mainWin.webContents.send('update-status', {
          type: 'progress',
          percent: 100,
          transferred: pendingLocalUpdate.fileSize,
          total: pendingLocalUpdate.fileSize,
        });
        mainWin.webContents.send('update-status', {
          type: 'downloaded',
          version: pendingLocalUpdate.version,
          isLocal: true,
        });
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  handleTrusted('install-update', async () => {
    try {
      if (!pendingLocalUpdate || !fs.existsSync(pendingLocalUpdate.filePath)) {
        const local = findLocalProjectRelease(baseDir);
        if (local) pendingLocalUpdate = local;
      }
      if (pendingLocalUpdate && fs.existsSync(pendingLocalUpdate.filePath)) {
        await verifyInstaller(pendingLocalUpdate.filePath, pendingLocalUpdate.version || '', app.getVersion());
        await processManager.cleanupAll();
        const child = spawn(pendingLocalUpdate.filePath, [], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
        app.quit();
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[SystemIpc] Error installing local update:', err);
      return false;
    }
  });

  // Registrar cleanup del worker de captura de pantalla para cierre limpio de la app
  processManager.registerCleanupHook('screen-worker', () => void disposeScreenWorker());
}
