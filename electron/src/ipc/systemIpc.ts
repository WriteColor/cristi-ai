import { ipcMain, shell, clipboard, Notification, desktopCapturer, screen, dialog, app } from 'electron';
import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { processManager } from '../core/processManager';
import { windowManager } from '../windows/windowManager';
import { ExecCommandOptions, ExecCommandResult, ScreenRegion, AppConfig } from '../types/electron.types';
import { getAppRootDir } from '../core/paths';

/**
 * Sanitizes and validates a filesystem path against directory traversal and null byte injections.
 */
export function sanitizeAndValidatePath(inputPath: unknown): string {
  if (typeof inputPath !== 'string' || !inputPath.trim()) {
    throw new Error('Ruta de archivo inválida o vacía.');
  }
  if (inputPath.includes('\0')) {
    throw new Error('La ruta contiene caracteres nulos inválidos (Poison NULL byte).');
  }
  return path.normalize(inputPath.trim());
}

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

function getEnvApiKey(rootDir: string): string {
  const candidateEnvPaths = [
    path.join(rootDir, '.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.resourcesPath, '.env'),
    path.join(app.getPath('userData'), '.env'),
  ];
  for (const envPath of candidateEnvPaths) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(/^(?:VITE_)?GEMINI_API_KEY=(.+)$/m);
        if (match && match[1].trim()) {
          return match[1].trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch (_) {}
  }
  return process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
}

/**
 * Registers native system operations, file I/O, screen capture, and app config IPC handlers.
 */
export function registerSystemIpc(rootDir?: string): void {
  const baseDir = rootDir || getAppRootDir();
  const configFilePath = path.join(app.getPath('userData'), 'cristi-config.json');

  // ── Native Command Execution with Safe Timeout ────────────────────────────
  ipcMain.handle('exec-command', async (_event, command: unknown, options: ExecCommandOptions = {}): Promise<ExecCommandResult> => {
    if (typeof command !== 'string' || !command.trim()) {
      return {
        stdOut: '',
        stdErr: 'Comando inválido o vacío.',
        exitCode: 1,
      };
    }

    if (command.includes('\0')) {
      return {
        stdOut: '',
        stdErr: 'Comando contiene caracteres nulos inválidos.',
        exitCode: 1,
      };
    }

    const requestedTimeout = typeof options?.timeout === 'number' ? options.timeout : 10000;
    const timeoutMs = Math.max(500, Math.min(60000, requestedTimeout));

    return new Promise((resolve) => {
      try {
        const cp = exec(
          command,
          { maxBuffer: 10 * 1024 * 1024, windowsHide: true, timeout: timeoutMs },
          (error, stdout, stderr) => {
            processManager.untrack(cp);

            if (error && (error as { killed?: boolean }).killed) {
              resolve({
                stdOut: '',
                stdErr: `El comando fue abortado porque excedió el tiempo límite de seguridad de ${Math.round(timeoutMs / 1000)} segundos.`,
                exitCode: 124,
              });
              return;
            }

            resolve({
              stdOut: stdout || '',
              stdErr: stderr || (error ? error.message : ''),
              exitCode: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
            });
          }
        );

        processManager.track(cp);
      } catch (execErr) {
        resolve({
          stdOut: '',
          stdErr: `Error al iniciar el comando: ${(execErr as Error).message}`,
          exitCode: 1,
        });
      }
    });
  });

  // ── Filesystem Operations ─────────────────────────────────────────────────
  ipcMain.handle('read-file', async (_event, filePath: unknown) => {
    try {
      const safePath = sanitizeAndValidatePath(filePath);
      return await fs.promises.readFile(safePath, 'utf8');
    } catch (err) {
      throw new Error(`Failed to read file: ${(err as Error).message}`, { cause: err });
    }
  });

  ipcMain.handle('write-file', async (_event, filePath: unknown, data: unknown) => {
    try {
      const safePath = sanitizeAndValidatePath(filePath);
      const safeData = typeof data === 'string' ? data : String(data ?? '');
      await fs.promises.mkdir(path.dirname(safePath), { recursive: true });
      await fs.promises.writeFile(safePath, safeData, 'utf8');
      return true;
    } catch (err) {
      throw new Error(`Failed to write file: ${(err as Error).message}`, { cause: err });
    }
  });

  ipcMain.handle('append-file', async (_event, filePath: unknown, data: unknown) => {
    try {
      const safePath = sanitizeAndValidatePath(filePath);
      const safeData = typeof data === 'string' ? data : String(data ?? '');
      await fs.promises.mkdir(path.dirname(safePath), { recursive: true });
      await fs.promises.appendFile(safePath, safeData, 'utf8');
      return true;
    } catch (err) {
      throw new Error(`Failed to append file: ${(err as Error).message}`, { cause: err });
    }
  });

  ipcMain.handle('read-directory', async (_event, dirPath: unknown) => {
    try {
      const safePath = sanitizeAndValidatePath(dirPath);
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
  ipcMain.handle('open-external', async (_event, targetUrl: unknown) => {
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

  ipcMain.handle('open-path', async (_event, targetPath: unknown) => {
    try {
      const safePath = sanitizeAndValidatePath(targetPath);
      const errorMsg = await shell.openPath(safePath);
      return { success: !errorMsg, error: errorMsg || null };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('show-item-in-folder', async (_event, targetPath: unknown) => {
    try {
      const safePath = sanitizeAndValidatePath(targetPath);
      shell.showItemInFolder(safePath);
      return true;
    } catch (err) {
      console.warn('[SystemIpc] Error showing item in folder:', err);
      return false;
    }
  });

  // ── Clipboard & Notifications ─────────────────────────────────────────────
  ipcMain.handle('get-clipboard-text', () => {
    try {
      return clipboard.readText();
    } catch (err) {
      console.warn('[SystemIpc] Error reading clipboard:', err);
      return '';
    }
  });

  ipcMain.handle('set-clipboard-text', (_event, text: unknown) => {
    try {
      clipboard.writeText(typeof text === 'string' ? text : String(text ?? ''));
      return true;
    } catch (err) {
      console.warn('[SystemIpc] Error setting clipboard text:', err);
      return false;
    }
  });

  ipcMain.handle('show-notification', (_event, payload: unknown) => {
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
  ipcMain.handle('capture-screen-native', async (_event, region: ScreenRegion | null = null) => {
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
      return activeScreenCapturePromises.get(regionKey);
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

        // Native region cropping
        if (region && typeof region === 'object') {
          const rawX = typeof region.x_pct === 'number' && !isNaN(region.x_pct) ? region.x_pct : 0;
          const rawY = typeof region.y_pct === 'number' && !isNaN(region.y_pct) ? region.y_pct : 0;
          const rawW = typeof region.w_pct === 'number' && !isNaN(region.w_pct) ? region.w_pct : 100;
          const rawH = typeof region.h_pct === 'number' && !isNaN(region.h_pct) ? region.h_pct : 100;

          const clampedX_pct = Math.max(0, Math.min(99, rawX));
          const clampedY_pct = Math.max(0, Math.min(99, rawY));
          const clampedW_pct = Math.max(1, Math.min(100 - clampedX_pct, rawW));
          const clampedH_pct = Math.max(1, Math.min(100 - clampedY_pct, rawH));

          const cropX = Math.max(0, Math.min(imgSize.width - 1, Math.round((clampedX_pct / 100) * imgSize.width)));
          const cropY = Math.max(0, Math.min(imgSize.height - 1, Math.round((clampedY_pct / 100) * imgSize.height)));

          const maxW = imgSize.width - cropX;
          const maxH = imgSize.height - cropY;

          const cropW = Math.max(1, Math.min(maxW, Math.round((clampedW_pct / 100) * imgSize.width)));
          const cropH = Math.max(1, Math.min(maxH, Math.round((clampedH_pct / 100) * imgSize.height)));

          if (cropW > 0 && cropH > 0 && (cropW < imgSize.width || cropH < imgSize.height || cropX > 0 || cropY > 0)) {
            try {
              image = image.crop({ x: cropX, y: cropY, width: cropW, height: cropH });
            } catch (cropErr) {
              console.warn('[SystemIpc] Region cropping failed, returning full thumbnail:', cropErr);
            }
          }
        }

        // Fast JPEG encode at quality 55 (~25KB payload, sub-3ms)
        const jpegBuffer = image.toJPEG(55);
        const base64Result = jpegBuffer.toString('base64');

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
  ipcMain.handle('import-custom-scene-file', async () => {
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

      const ext = path.extname(sourcePath);
      const baseName = path.basename(sourcePath, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const destName = `${Date.now()}_${baseName}${ext}`;
      const destPath = path.join(customScenesDir, destName);

      await fs.promises.copyFile(sourcePath, destPath);

      const isVideo = /\.(mp4|webm|mkv|mov)$/i.test(destPath);
      const isAnimated = /\.gif$/i.test(destPath);

      return {
        canceled: false,
        filePath: destPath,
        fileUrl: `file:///${destPath.replace(/\\/g, '/')}`,
        name: baseName,
        type: isVideo ? 'video' : isAnimated ? 'animated' : 'image',
      };
    } catch (err) {
      console.error('[SystemIpc] Error importing custom scene file:', err);
      return { canceled: true, error: (err as Error).message };
    }
  });

  // ── Configuration Store ───────────────────────────────────────────────────
  let saveConfigTimer: NodeJS.Timeout | null = null;

  ipcMain.handle('get-app-config', (): AppConfig | null => {
    try {
      let cfg: AppConfig = {};
      if (fs.existsSync(configFilePath)) {
        const raw = fs.readFileSync(configFilePath, 'utf-8');
        cfg = JSON.parse(raw) || {};
      }
      if (!cfg.apiKey || !String(cfg.apiKey).trim()) {
        const envKey = getEnvApiKey(baseDir);
        if (envKey) cfg.apiKey = envKey;
      }
      return cfg;
    } catch (err) {
      console.warn('[SystemIpc] Error reading config file:', err);
    }
    const envKey = getEnvApiKey(baseDir);
    return envKey ? { apiKey: envKey } : null;
  });

  ipcMain.handle('save-app-config', (_event, newConfig: unknown) => {
    const mainWin = windowManager.getMainWindow();
    if (mainWin?.webContents && !mainWin.isDestroyed()) {
      mainWin.webContents.send('config-updated', newConfig);
    }

    if (saveConfigTimer) clearTimeout(saveConfigTimer);
    saveConfigTimer = setTimeout(() => {
      try {
        fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2), 'utf-8');
      } catch (err) {
        console.warn('[SystemIpc] Error writing config file:', err);
      }
    }, 100);

    return { success: true };
  });

  ipcMain.on('companion-pause', () => {
    const mainWin = windowManager.getMainWindow();
    if (mainWin?.webContents && !mainWin.isDestroyed()) {
      mainWin.webContents.send('companion-pause');
    }
  });

  ipcMain.on('companion-resume', () => {
    const mainWin = windowManager.getMainWindow();
    if (mainWin?.webContents && !mainWin.isDestroyed()) {
      mainWin.webContents.send('companion-resume');
    }
  });

  // ── Offline & Local Updater ───────────────────────────────────────────────
  ipcMain.handle('check-for-updates', async () => {
    try {
      const currentVersion = app.getVersion();
      const localRelease = findLocalProjectRelease(baseDir);

      if (localRelease && localRelease.version) {
        const isNewer = localRelease.version !== currentVersion;
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

  ipcMain.handle('download-update', async () => {
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

  ipcMain.handle('install-update', async () => {
    try {
      if (!pendingLocalUpdate || !fs.existsSync(pendingLocalUpdate.filePath)) {
        const local = findLocalProjectRelease(baseDir);
        if (local) pendingLocalUpdate = local;
      }
      if (pendingLocalUpdate && fs.existsSync(pendingLocalUpdate.filePath)) {
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
}
