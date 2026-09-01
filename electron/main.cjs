'use strict';

const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell, clipboard, Notification, globalShortcut, desktopCapturer, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { pathToFileURL } = require('url');

// ── Register Privileged Custom Protocol for Production Asset Serving ─────────
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

// ── Single Instance Enforcement ──────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Hardware GPU Acceleration & 120-240+ FPS Support (Forcing Dedicated NVIDIA GPU)
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('gpu-preference', 'high-performance');
app.commandLine.appendSwitch('use-angle', 'd3d11');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-gpu-vsync');
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('max-active-webgl-contexts', '32');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization,UseSkiaRenderer,SharedArrayBuffer,RawDraw');

// Essential Desktop Mate Anti-Throttling & Multitasking Flags (Alt+Tab & Virtual Desktops)
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

let mainWindow = null;
let tray = null;
const isDev = !app.isPackaged;
const RENDERER_URL = 'http://localhost:5173';

// ── Auto-Updater Integration ──────────────────────────────────────────────────
let autoUpdater = null;
try {
  const updaterPkg = require('electron-updater');
  autoUpdater = updaterPkg.autoUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = console;
} catch (err) {
  console.warn('[AutoUpdater] electron-updater no disponible:', err.message);
}

// Active child processes tracker to guarantee zero leaked sub-processes on quit
const activeChildProcesses = new Set();

function terminateAllChildProcesses() {
  for (const cp of activeChildProcesses) {
    try {
      if (cp && !cp.killed) {
        cp.kill('SIGTERM');
      }
    } catch (_) {}
  }
  activeChildProcesses.clear();
}

function cleanupResources() {
  try {
    globalShortcut.unregisterAll();
  } catch (_) {}

  try {
    if (tray && !tray.isDestroyed()) {
      tray.destroy();
      tray = null;
    }
  } catch (_) {}

  terminateAllChildProcesses();
}

// ── Path Sanitization & Validation Helper ────────────────────────────────────
function sanitizeAndValidatePath(inputPath) {
  if (typeof inputPath !== 'string' || !inputPath.trim()) {
    throw new Error('Ruta de archivo inválida o vacía.');
  }
  if (inputPath.includes('\0')) {
    throw new Error('La ruta contiene caracteres nulos inválidos (Poison NULL byte).');
  }
  return path.normalize(inputPath.trim());
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const bounds = primaryDisplay ? primaryDisplay.bounds : { x: 0, y: 0, width: 1920, height: 1080 };

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    resizable: false,
    movable: false,
    fullscreen: false,
    icon: path.join(__dirname, '../resources/icons/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false, // Ensure local assets, Live2D textures, and canvas load without restrictive file CORS
      backgroundThrottling: false, // Ensure full 60 FPS even when user interacts with background apps
    },
  });

  // Ensure Chromium does NOT throttle rendering or timers when another window has focus
  if (mainWindow.webContents?.setBackgroundThrottling) {
    mainWindow.webContents.setBackgroundThrottling(false);
  }

  // Windows 11 Virtual Desktop & Workspaces Continuity
  try {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch (_) {}

  // Start in click-through mode — forward:true ensures mousemove events still
  // reach the renderer so it can detect hover and re-enable interactivity
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Load app
  if (isDev) {
    mainWindow.loadURL(RENDERER_URL);
  } else {
    mainWindow.loadURL('app://cristi/index.html');
  }

  // level 'screen-saver' keeps window above ALL other windows on Windows 11
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── IPC: Click-Through Toggle ─────────────────────────────────────────────────
// The renderer sends this IPC message when the cursor enters/leaves an interactive
// element. This is the CORE mechanism that makes click-through selective.
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    win.setIgnoreMouseEvents(Boolean(ignore), (options && typeof options === 'object') ? options : {});
  } catch (err) {
    console.error('[Main] Error setting ignore mouse events:', err);
  }
});

// ── IPC: Always-On-Top ──────────────────────────────────────────────────────
ipcMain.on('set-always-on-top', (event, value) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    if (value) {
      win.setAlwaysOnTop(true, 'screen-saver');
    } else {
      win.setAlwaysOnTop(false);
    }
  } catch (err) {
    console.error('[Main] Error setting always-on-top:', err);
  }
});

ipcMain.handle('get-always-on-top', (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    return (win && !win.isDestroyed()) ? win.isAlwaysOnTop() : false;
  } catch (_) {
    return false;
  }
});

// ── IPC: Display Info ───────────────────────────────────────────────────────
ipcMain.handle('get-display-info', () => {
  try {
    const primary = screen.getPrimaryDisplay();
    if (!primary || !primary.bounds) {
      return {
        width: 1920,
        height: 1080,
        scaleFactor: 1,
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      };
    }
    return {
      width: primary.bounds.width,
      height: primary.bounds.height,
      scaleFactor: primary.scaleFactor || 1,
      workArea: primary.workArea || primary.bounds,
    };
  } catch (err) {
    console.error('[Main] Error getting display info:', err);
    return {
      width: 1920,
      height: 1080,
      scaleFactor: 1,
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    };
  }
});

// ── IPC: Process & GPU Telemetry ───────────────────────────────────────────
ipcMain.handle('get-process-memory-info', async () => {
  try {
    const metrics = (app.getAppMetrics && typeof app.getAppMetrics === 'function') ? app.getAppMetrics() : [];
    let totalWorkingSetKB = 0;
    let totalPeakWorkingSetKB = 0;
    let totalPrivateKB = 0;
    let totalSharedKB = 0;
    let processBreakdown = {
      browser: 0,
      renderer: 0,
      gpu: 0,
      utility: 0
    };

    const processList = [];

    if (Array.isArray(metrics)) {
      metrics.forEach((m) => {
        if (!m) return;
        const ws = m.memory?.workingSetSize || 0;
        const peak = m.memory?.peakWorkingSetSize || 0;
        const priv = m.memory?.privateBytes || 0;
        const shared = m.memory?.sharedBytes || 0;
        totalWorkingSetKB += ws;
        totalPeakWorkingSetKB += peak;
        totalPrivateKB += priv;
        totalSharedKB += shared;

        if (m.type === 'Browser') processBreakdown.browser += Math.round(ws / 1024);
        else if (m.type === 'Tab') processBreakdown.renderer += Math.round(ws / 1024);
        else if (m.type === 'GPU') processBreakdown.gpu += Math.round(ws / 1024);
        else processBreakdown.utility += Math.round(ws / 1024);

        processList.push({
          pid: m.pid,
          type: m.type,
          workingSetMB: parseFloat((ws / 1024).toFixed(1)),
          privateMB: parseFloat((priv / 1024).toFixed(1)),
          sharedMB: parseFloat((shared / 1024).toFixed(1)),
          cpuPercent: m.cpu?.percentCPUUsage || 0,
        });
      });
    }

    let processMem = null;
    if (process.getProcessMemoryInfo && typeof process.getProcessMemoryInfo === 'function') {
      try {
        processMem = await process.getProcessMemoryInfo();
      } catch (_) {}
    }

    return {
      success: true,
      residentSet: totalWorkingSetKB, // Total working set in KB
      peakWorkingSet: totalPeakWorkingSetKB,
      private: totalPrivateKB,
      processBreakdown,
      mainProcessResidentSet: processMem?.residentSet || 0,
      totalWorkingSetMB: parseFloat((totalWorkingSetKB / 1024).toFixed(1)),
      totalPrivateMB: parseFloat((totalPrivateKB / 1024).toFixed(1)),
      totalSharedMB: parseFloat((totalSharedKB / 1024).toFixed(1)),
      processCount: metrics.length,
      processes: processList,
    };
  } catch (err) {
    console.error('[Main] Error in get-process-memory-info:', err);
    return {
      success: false,
      residentSet: 0,
      peakWorkingSet: 0,
      private: 0,
      processBreakdown: { browser: 0, renderer: 0, gpu: 0, utility: 0 },
      mainProcessResidentSet: 0,
      totalWorkingSetMB: 0,
      processes: []
    };
  }
});

ipcMain.handle('get-gpu-feature-status', () => {
  try {
    return (app.getGPUFeatureStatus && typeof app.getGPUFeatureStatus === 'function') ? app.getGPUFeatureStatus() : {};
  } catch (_) {
    return {};
  }
});

ipcMain.handle('get-gpu-info', async () => {
  try {
    let gpuInfo = {};
    let gpuFeatureStatus = {};

    try {
      if (app.getGPUInfo && typeof app.getGPUInfo === 'function') {
        gpuInfo = await app.getGPUInfo('basic');
      }
    } catch (_) {}

    try {
      if (app.getGPUFeatureStatus && typeof app.getGPUFeatureStatus === 'function') {
        gpuFeatureStatus = app.getGPUFeatureStatus();
      }
    } catch (_) {}

    return {
      gpuInfo: gpuInfo || {},
      gpuFeatureStatus: gpuFeatureStatus || {}
    };
  } catch (err) {
    console.error('[Main] Error in get-gpu-info:', err);
    return {
      gpuInfo: {},
      gpuFeatureStatus: {}
    };
  }
});

// ── IPC: Window Controls ────────────────────────────────────────────────────
ipcMain.on('minimize-window', () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  } catch (err) {
    console.error('[Main] Error minimizing window:', err);
  }
});

ipcMain.on('quit-app', () => {
  cleanupResources();
  app.quit();
});

ipcMain.on('show-window', () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  } catch (err) {
    console.error('[Main] Error showing window:', err);
  }
});

ipcMain.on('hide-window', () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  } catch (err) {
    console.error('[Main] Error hiding window:', err);
  }
});

// ── IPC: Native OS Operations with Safe Timeout (10s) ───────────────────────
ipcMain.handle('exec-command', (event, command, options = {}) => {
  if (typeof command !== 'string' || !command.trim()) {
    return Promise.resolve({
      stdOut: '',
      stdErr: 'Comando inválido o vacío.',
      exitCode: 1
    });
  }

  // Security: Prevent Poison NULL byte attacks
  if (command.includes('\0')) {
    return Promise.resolve({
      stdOut: '',
      stdErr: 'Comando contiene caracteres nulos inválidos.',
      exitCode: 1
    });
  }

  const requestedTimeout = (options && typeof options.timeout === 'number') ? options.timeout : 10000;
  // Strictly bound timeout between 500ms and 60000ms
  const timeoutMs = Math.max(500, Math.min(60000, requestedTimeout));

  return new Promise((resolve) => {
    let cp = null;
    try {
      cp = exec(command, { maxBuffer: 10 * 1024 * 1024, windowsHide: true, timeout: timeoutMs }, (error, stdout, stderr) => {
        if (cp) activeChildProcesses.delete(cp);

        if (error && error.killed) {
          resolve({
            stdOut: '',
            stdErr: `El comando fue abortado porque excedió el tiempo límite de seguridad de ${Math.round(timeoutMs / 1000)} segundos.`,
            exitCode: 124
          });
          return;
        }
        resolve({
          stdOut: stdout || '',
          stdErr: stderr || (error ? error.message : ''),
          exitCode: error ? (error.code || 1) : 0
        });
      });

      if (cp) {
        activeChildProcesses.add(cp);
      }
    } catch (execErr) {
      if (cp) activeChildProcesses.delete(cp);
      resolve({
        stdOut: '',
        stdErr: `Error al iniciar el comando: ${execErr.message}`,
        exitCode: 1
      });
    }
  });
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const safePath = sanitizeAndValidatePath(filePath);
    return await fs.promises.readFile(safePath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read file: ${err.message}`);
  }
});

ipcMain.handle('write-file', async (event, filePath, data) => {
  try {
    const safePath = sanitizeAndValidatePath(filePath);
    const safeData = typeof data === 'string' ? data : String(data ?? '');
    await fs.promises.mkdir(path.dirname(safePath), { recursive: true });
    await fs.promises.writeFile(safePath, safeData, 'utf8');
    return true;
  } catch (err) {
    throw new Error(`Failed to write file: ${err.message}`);
  }
});

ipcMain.handle('append-file', async (event, filePath, data) => {
  try {
    const safePath = sanitizeAndValidatePath(filePath);
    const safeData = typeof data === 'string' ? data : String(data ?? '');
    await fs.promises.mkdir(path.dirname(safePath), { recursive: true });
    await fs.promises.appendFile(safePath, safeData, 'utf8');
    return true;
  } catch (err) {
    throw new Error(`Failed to append file: ${err.message}`);
  }
});

ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const safePath = sanitizeAndValidatePath(dirPath);
    const entries = await fs.promises.readdir(safePath, { withFileTypes: true });
    return entries.map(e => ({
      entry: e.name,
      type: e.isDirectory() ? 'DIRECTORY' : 'FILE'
    }));
  } catch (err) {
    throw new Error(`Failed to read directory: ${err.message}`);
  }
});

ipcMain.handle('open-external', async (event, targetUrl) => {
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
    console.warn('[Main] Error opening external URL:', err);
    return false;
  }
});

ipcMain.handle('open-path', async (event, targetPath) => {
  try {
    const safePath = sanitizeAndValidatePath(targetPath);
    const errorMsg = await shell.openPath(safePath);
    return { success: !errorMsg, error: errorMsg || null };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('show-item-in-folder', async (event, targetPath) => {
  try {
    const safePath = sanitizeAndValidatePath(targetPath);
    shell.showItemInFolder(safePath);
    return true;
  } catch (err) {
    console.warn('[Main] Error showing item in folder:', err);
    return false;
  }
});

ipcMain.handle('get-clipboard-text', () => {
  try {
    return clipboard.readText();
  } catch (err) {
    console.warn('[Main] Error reading clipboard:', err);
    return '';
  }
});

ipcMain.handle('set-clipboard-text', (event, text) => {
  try {
    clipboard.writeText(typeof text === 'string' ? text : String(text ?? ''));
    return true;
  } catch (err) {
    console.warn('[Main] Error setting clipboard text:', err);
    return false;
  }
});

ipcMain.handle('show-notification', (event, payload) => {
  try {
    const title = (payload && typeof payload === 'object' && payload.title) ? String(payload.title) : 'Cristi AI Companion';
    const body = (payload && typeof payload === 'object' && payload.body) ? String(payload.body) : '';
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[Main] Error showing notification:', err);
    return false;
  }
});

// ── Native Screen Capture for Contextual Vision (Zero CPU / Native C++) ───────
ipcMain.handle('capture-screen-native', async (event, region = null) => {
  try {
    let targetDisplay = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        const bounds = mainWindow.getBounds();
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

    // Target max dimensions for efficient network & Gemini real-time vision (avoid division by zero)
    const targetW = Math.max(1, Math.min(1280, pixelWidth));
    const targetH = Math.max(1, Math.round((pixelHeight / Math.max(1, pixelWidth)) * targetW));

    let sources = [];
    try {
      sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: targetW,
          height: targetH
        },
        fetchWindowIcons: false
      });
    } catch (capturerErr) {
      console.error('[Main] desktopCapturer error (permissions or unavailable):', capturerErr);
      return null;
    }

    if (!sources || sources.length === 0) return null;

    // Use current screen source if multiple screens exist, falling back to primary or first
    const primarySource = sources.find((s) => s.display_id === String(targetDisplay.id)) ||
                          sources.find((s) => s.display_id === String(screen.getPrimaryDisplay()?.id)) ||
                          sources[0];
    if (!primarySource || !primarySource.thumbnail || primarySource.thumbnail.isEmpty()) return null;

    let image = primarySource.thumbnail;
    const imgSize = image.getSize();
    if (imgSize.width <= 0 || imgSize.height <= 0) return null;

    // If region cropping is requested at native layer ({ x_pct, y_pct, w_pct, h_pct })
    if (region && typeof region === 'object') {
      const rawX = typeof region.x_pct === 'number' && !isNaN(region.x_pct) ? region.x_pct : 0;
      const rawY = typeof region.y_pct === 'number' && !isNaN(region.y_pct) ? region.y_pct : 0;
      const rawW = typeof region.w_pct === 'number' && !isNaN(region.w_pct) ? region.w_pct : 100;
      const rawH = typeof region.h_pct === 'number' && !isNaN(region.h_pct) ? region.h_pct : 100;

      // Clamp percentages safely
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
          console.warn('[Main] Region cropping failed, returning full thumbnail:', cropErr);
        }
      }
    }

    const jpegBuffer = image.toJPEG(75);
    return jpegBuffer.toString('base64');
  } catch (err) {
    console.error('[Main] capture-screen-native error:', err);
    return null;
  }
});

// ── Custom Wallpaper & Scene Native Importer ────────────────────────────────
ipcMain.handle('import-custom-scene-file', async () => {
  try {
    const targetWin = (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : null;
    const result = await dialog.showOpenDialog(targetWin, {
      title: 'Seleccionar Archivo de Escena / Fondo',
      buttonLabel: 'Importar Fondo',
      filters: [
        { name: 'Multimedia (Video / Imagen)', extensions: ['mp4', 'webm', 'mkv', 'mov', 'png', 'jpg', 'jpeg', 'gif', 'webp'] },
        { name: 'Videos', extensions: ['mp4', 'webm', 'mkv', 'mov'] },
        { name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
        { name: 'Todos los Archivos', extensions: ['*'] }
      ],
      properties: ['openFile']
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
      type: isVideo ? 'video' : isAnimated ? 'animated' : 'image'
    };
  } catch (err) {
    console.error('[Main] Error importing custom scene file:', err);
    return { canceled: true, error: err.message };
  }
});

// ── Local Project Release & Offline Update Engine ───────────────────────────
let pendingLocalUpdate = null;

function findLocalProjectRelease() {
  const candidateDirs = [
    path.join(__dirname, '../release'),
    path.join(__dirname, '../../release'),
    path.join(process.cwd(), 'release'),
    'C:\\React-Nextjs-Projects\\Cristi AI\\release'
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
            mtime: stats.mtime
          };
        }
      } catch (_) {}
    }
  }
  return null;
}

ipcMain.handle('check-for-updates', async () => {
  try {
    const currentVersion = app.getVersion();
    const localRelease = findLocalProjectRelease();

    if (localRelease && localRelease.version) {
      const isNewer = localRelease.version !== currentVersion;
      if (isNewer) {
        pendingLocalUpdate = localRelease;
        if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-status', {
            type: 'available',
            version: localRelease.version,
            releaseDate: localRelease.mtime,
            isLocal: true,
            sizeMB: Math.round(localRelease.fileSize / 1024 / 1024)
          });
        }
        return {
          success: true,
          version: localRelease.version,
          isLocal: true
        };
      }
    }

    if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        type: 'not-available',
        version: currentVersion,
        isLocal: true
      });
    }
    return {
      success: true,
      version: currentVersion,
      isLocal: true
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    if (!pendingLocalUpdate || !fs.existsSync(pendingLocalUpdate.filePath)) {
      const local = findLocalProjectRelease();
      if (local) pendingLocalUpdate = local;
    }
    if (!pendingLocalUpdate || !fs.existsSync(pendingLocalUpdate.filePath)) {
      return { success: false, error: 'No se encontró instalador en la carpeta release/ local.' };
    }

    if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        type: 'progress',
        percent: 100,
        transferred: pendingLocalUpdate.fileSize,
        total: pendingLocalUpdate.fileSize
      });
      mainWindow.webContents.send('update-status', {
        type: 'downloaded',
        version: pendingLocalUpdate.version,
        isLocal: true
      });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('install-update', () => {
  try {
    if (!pendingLocalUpdate || !fs.existsSync(pendingLocalUpdate.filePath)) {
      const local = findLocalProjectRelease();
      if (local) pendingLocalUpdate = local;
    }
    if (pendingLocalUpdate && fs.existsSync(pendingLocalUpdate.filePath)) {
      const { spawn } = require('child_process');
      cleanupResources();
      const child = spawn(pendingLocalUpdate.filePath, [], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      app.quit();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[LocalUpdater] Error installing local update:', err);
    return false;
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

function setupAutoUpdater() {
  // Local project updates check on startup
  setTimeout(() => {
    try {
      const localRelease = findLocalProjectRelease();
      if (localRelease && localRelease.version !== app.getVersion()) {
        pendingLocalUpdate = localRelease;
        if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-status', {
            type: 'available',
            version: localRelease.version,
            releaseDate: localRelease.mtime,
            isLocal: true,
            sizeMB: Math.round(localRelease.fileSize / 1024 / 1024)
          });
        }
      }
    } catch (_) {}
  }, 3000);
}

// ── Global Shortcuts Registration ───────────────────────────────────────────
function registerGlobalShortcuts() {
  try {
    // 1. Boss Key / Toggle Visibility (Ctrl + Shift + C)
    globalShortcut.register('CommandOrControl+Shift+C', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    // 2. Toggle Mute (Ctrl + Shift + M)
    globalShortcut.register('CommandOrControl+Shift+M', () => {
      if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shortcut-toggle-mute');
      }
    });

    // 3. Instant Screen Snapshot & Vision Query (Ctrl + Shift + S)
    globalShortcut.register('CommandOrControl+Shift+S', () => {
      if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shortcut-capture-screen');
      }
    });

    // 4. Toggle Zen Mode / Hide UI Globally (Ctrl + Shift + H)
    globalShortcut.register('CommandOrControl+Shift+H', () => {
      if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shortcut-toggle-zen-mode');
      }
    });

    // 5. Toggle Performance Telemetry & Profiler Globally (Ctrl + Shift + P)
    globalShortcut.register('CommandOrControl+Shift+P', () => {
      if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shortcut-toggle-perf-hud');
      }
    });

    // 6. Toggle Always-on-Top / Pin Globally (Ctrl + Shift + A)
    globalShortcut.register('CommandOrControl+Shift+A', () => {
      if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shortcut-toggle-always-on-top');
      }
    });
  } catch (e) {
    console.warn('Could not register global shortcuts:', e);
  }
}

// ── System Tray ─────────────────────────────────────────────────────────────
function createTray() {
  const trayIconCandidates = [
    path.join(__dirname, '../resources/icons/tray-icon.png'),
    path.join(__dirname, '../public/tray-icon.png'),
    path.join(__dirname, '../resources/icons/icon.png')
  ];
  let iconPath = trayIconCandidates.find((p) => fs.existsSync(p)) || '';
  let icon;
  try {
    icon = iconPath
      ? nativeImage.createFromPath(iconPath)
      : nativeImage.createEmpty();
  } catch (e) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('Cristi AI Companion');

  const updateMenu = () => {
    const isVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
    const contextMenu = Menu.buildFromTemplate([
      {
        label: isVisible ? 'Ocultar Cristi (Ctrl+Shift+C)' : 'Mostrar Cristi (Ctrl+Shift+C)',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isVisible()) {
              mainWindow.hide();
            } else {
              mainWindow.show();
              mainWindow.focus();
            }
          }
          updateMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Salir de Cristi AI Companion',
        click: () => {
          cleanupResources();
          app.quit();
        },
      },
    ]);
    if (tray && !tray.isDestroyed()) {
      tray.setContextMenu(contextMenu);
    }
  };

  updateMenu();

  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Production custom protocol handler for fast, reliable zero-CORS asset and Live2D model serving
  protocol.handle('app', async (request) => {
    try {
      const parsedUrl = new URL(request.url);
      let pathname = decodeURIComponent(parsedUrl.pathname);
      if (pathname.startsWith('/')) pathname = pathname.slice(1);
      if (!pathname || pathname === 'index.html') {
        pathname = 'index.html';
      }
      const distPath = path.normalize(path.join(__dirname, '../dist', pathname));
      return await net.fetch(pathToFileURL(distPath).toString());
    } catch (err) {
      console.error('[Protocol] Error handling app:// request:', err);
      return new Response('Asset not found', { status: 404 });
    }
  });

  createWindow();
  createTray();
  registerGlobalShortcuts();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  cleanupResources();
});

app.on('will-quit', () => {
  cleanupResources();
});

app.on('window-all-closed', () => {
  cleanupResources();
  if (process.platform !== 'darwin') app.quit();
});
