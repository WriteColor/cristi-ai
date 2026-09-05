'use strict';

const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell, clipboard, Notification, globalShortcut, desktopCapturer, dialog, protocol, net, safeStorage } = require('electron');
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

// Hardware GPU Acceleration & High-Refresh Support (Forcing Dedicated NVIDIA GPU)
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('gpu-preference', 'high-performance');
app.commandLine.appendSwitch('use-angle', 'd3d11');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-gpu-compositing');
app.commandLine.appendSwitch('enable-threaded-compositing');
app.commandLine.appendSwitch('enable-smooth-scrolling');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('max-active-webgl-contexts', '32');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,UseSkiaRenderer,SharedArrayBuffer,SmoothScrolling');

// Anti-Occlusion & Video Overlay Protection:
// Prevents Windows DWM and Chromium from marking background video players (YouTube, VLC, Netflix)
// as occluded or revoking hardware video planes when Cristi AI is interacted with.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,DirectCompositionVideoOverlays');

// Essential Desktop Mate Anti-Throttling & Multitasking Flags (Alt+Tab & Virtual Desktops)
app.commandLine.appendSwitch('disable-background-timer-throttling');

// Web Audio Autoplay & Background Voice Persistence:
// Prevents Chromium from suspending AudioContext when transparent window loses focus or during screen share
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// ── CDP Remote Debugging for Agentic Performance Monitoring (APM) ───────────
if (process.env.CRISTI_CDP_PORT || process.env.ELECTRON_CDP_PORT) {
  const CDP_PORT = process.env.CRISTI_CDP_PORT || process.env.ELECTRON_CDP_PORT;
  app.commandLine.appendSwitch('remote-debugging-port', CDP_PORT);
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
}

let mainWindow = null;
let settingsWindow = null;
let cameraWindow = null;
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

  try {
    if (playwrightBrowser) {
      playwrightBrowser.close().catch(() => {});
      playwrightBrowser = null;
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

function getAppIcon() {
  const candidates = [
    path.join(__dirname, '../assets/icons/icon.ico'),
    path.join(__dirname, '../assets/icons/icon.png'),
    path.join(__dirname, '../resources/icons/icon.ico'),
    path.join(__dirname, '../resources/icons/icon.png'),
    path.join(__dirname, '../dist/favicon.ico'),
    path.join(__dirname, '../dist/icon.png'),
    path.join(__dirname, '../public/icon.png'),
    path.join(process.resourcesPath, 'resources/icons/icon.ico'),
    path.join(process.resourcesPath, 'resources/icons/icon.png'),
    path.join(process.resourcesPath, 'icons/icon.ico')
  ];
  return candidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  }) || '';
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const bounds = primaryDisplay ? primaryDisplay.bounds : { x: 0, y: 0, width: 1920, height: 1080 };

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: Math.max(1, bounds.height - 1), // 1px offset prevents Windows DWM DirectFlip / Fullscreen Optimization hijacking
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    resizable: false,
    movable: false,
    fullscreen: false,
    icon: getAppIcon(),
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

  // Start in click-through mode — (setIgnoreMouseEvents(true, { forward: true }))
  // Enforces native WS_EX_TRANSPARENT with forward:false to prevent 3-6s WH_MOUSE_LL hook lag in games
  mainWindow.setIgnoreMouseEvents(true, { forward: false });

  // Load app
  if (isDev) {
    mainWindow.loadURL(RENDERER_URL);
  } else {
    mainWindow.loadURL('app://cristi/index.html');
  }

  // level 'pop-up-menu' keeps window above normal desktop windows without triggering
  // Windows OS screensaver media suspension or DWM DirectComposition overlay demotion
  mainWindow.setAlwaysOnTop(true, 'pop-up-menu');

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

    const ignoreBool = Boolean(ignore);
    // CRITICAL: Prevent WH_MOUSE_LL hook latency in games and screen sharing.
    // forward: false uses native Windows WS_EX_TRANSPARENT without any OS hook.
    const forwardBool = false;

    if (win._lastIgnore === ignoreBool && win._lastForward === forwardBool) {
      return; // Deduplicate call in main process
    }

    win._lastIgnore = ignoreBool;
    win._lastForward = forwardBool;

    win.setIgnoreMouseEvents(ignoreBool, { forward: false });
  } catch (err) {
    console.error('[Main] Error setting ignore mouse events:', err);
  }
});

// ── Native Zero-Lag Interactive Hitbox Tracking ──────────────────────────────
// Polls cursor position in 0.0001ms via Win32 GetCursorPos to activate hover
// without registering ANY low-level Windows hooks, eliminating game mouse delay.
let registeredInteractiveHitboxes = [];
ipcMain.on('sync-interactive-hitboxes', (event, hitboxes) => {
  if (Array.isArray(hitboxes)) {
    registeredInteractiveHitboxes = hitboxes;
  }
});

let lastInteractiveHitState = null;
setInterval(() => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // If an overlay/modal holds an interaction lock, stay interactive
  if (mainWindow._lastIgnore === false) return;

  try {
    const cursor = screen.getCursorScreenPoint();
    const bounds = mainWindow.getBounds();
    const relX = cursor.x - bounds.x;
    const relY = cursor.y - bounds.y;

    const isOver = registeredInteractiveHitboxes.some((b) =>
      b && typeof b.x === 'number' &&
      relX >= b.x && relX <= (b.x + b.width) &&
      relY >= b.y && relY <= (b.y + b.height)
    );

    if (isOver !== lastInteractiveHitState) {
      lastInteractiveHitState = isOver;
      if (isOver) {
        mainWindow.setIgnoreMouseEvents(false);
      } else {
        mainWindow.setIgnoreMouseEvents(true, { forward: false });
      }
    }
  } catch (_) {}
}, 25);

// ── IPC: Always-On-Top ──────────────────────────────────────────────────────
ipcMain.on('set-always-on-top', (event, value) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    if (value) {
      win.setAlwaysOnTop(true, 'pop-up-menu');
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

ipcMain.handle('relaunch-app', () => {
  try {
    cleanupResources();
    app.relaunch();
    app.exit(0);
    return { success: true };
  } catch (err) {
    console.error('[Main] Error relaunching app:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('reload-window', (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (win && !win.isDestroyed()) {
      win.reload();
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  } catch (err) {
    console.error('[Main] Error reloading window:', err);
    return { success: false, error: err.message };
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
    throw new Error(`Failed to read file: ${err.message}`, { cause: err });
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
    throw new Error(`Failed to write file: ${err.message}`, { cause: err });
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
    throw new Error(`Failed to append file: ${err.message}`, { cause: err });
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
    throw new Error(`Failed to read directory: ${err.message}`, { cause: err });
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
let isScreenCaptureInProgress = false;
const activeScreenCapturePromises = new Map();
let lastScreenCaptureCache = {
  timestamp: 0,
  regionKey: '',
  base64: null
};

ipcMain.handle('capture-screen-native', async (event, region = null) => {
  const regionKey = region && typeof region === 'object'
    ? `${Math.round(region.x_pct || 0)}_${Math.round(region.y_pct || 0)}_${Math.round(region.w_pct || 100)}_${Math.round(region.h_pct || 100)}`
    : 'full';

  const now = Date.now();
  // Return recent cached frame if requested within 700ms for identical region (zero GPU/DXGI contention)
  if (lastScreenCaptureCache.base64 && lastScreenCaptureCache.regionKey === regionKey && (now - lastScreenCaptureCache.timestamp) < 700) {
    return lastScreenCaptureCache.base64;
  }

  // Coalesce only the same region. Returning a full-screen promise for a region
  // request made the model receive the wrong image during fast mode switches.
  if (activeScreenCapturePromises.has(regionKey)) {
    return activeScreenCapturePromises.get(regionKey);
  }

  isScreenCaptureInProgress = true;
  const capturePromise = (async () => {
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

      // Ultra-efficient thumbnail size: 768px max width for Gemini Multimodal Live
      // Cuts GPU DXGI copy buffer by 65% and reduces memory transfer latency to sub-millisecond
      const targetW = Math.max(1, Math.min(768, pixelWidth));
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
        return lastScreenCaptureCache.base64 || null;
      }

      if (!sources || sources.length === 0) return lastScreenCaptureCache.base64 || null;

      const primarySource = sources.find((s) => s.display_id === String(targetDisplay.id)) ||
                            sources.find((s) => s.display_id === String(screen.getPrimaryDisplay()?.id)) ||
                            sources[0];
      if (!primarySource || !primarySource.thumbnail || primarySource.thumbnail.isEmpty()) {
        return lastScreenCaptureCache.base64 || null;
      }

      let image = primarySource.thumbnail;
      const imgSize = image.getSize();
      if (imgSize.width <= 0 || imgSize.height <= 0) return lastScreenCaptureCache.base64 || null;

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
            console.warn('[Main] Region cropping failed, returning full thumbnail:', cropErr);
          }
        }
      }

      // Fast JPEG encode at quality 55 (~25KB payload vs ~150KB previously; 3ms encode vs 35ms)
      const jpegBuffer = image.toJPEG(55);
      const base64Result = jpegBuffer.toString('base64');

      lastScreenCaptureCache = {
        timestamp: Date.now(),
        regionKey,
        base64: base64Result
      };

      return base64Result;
    } catch (err) {
      console.error('[Main] capture-screen-native error:', err);
      return lastScreenCaptureCache.base64 || null;
    } finally {
      activeScreenCapturePromises.delete(regionKey);
      isScreenCaptureInProgress = activeScreenCapturePromises.size > 0;
    }
  })();
  activeScreenCapturePromises.set(regionKey, capturePromise);
  return capturePromise;
});

const SECRETS_FILE_PATH = path.join(app.getPath('userData'), 'cristi-secrets.json');
function readSecrets() {
  try { return fs.existsSync(SECRETS_FILE_PATH) ? JSON.parse(fs.readFileSync(SECRETS_FILE_PATH, 'utf8')) || {} : {}; } catch (_) { return {}; }
}
function writeSecrets(secrets) {
  fs.mkdirSync(path.dirname(SECRETS_FILE_PATH), { recursive: true });
  fs.writeFileSync(SECRETS_FILE_PATH, JSON.stringify(secrets, null, 2), 'utf8');
}
ipcMain.handle('secure-set-secret', (event, key, value) => {
  if (!key || typeof value !== 'string') return { success: false, error: 'Secret inválido.' };
  if (!safeStorage.isEncryptionAvailable()) return { success: false, error: 'Cifrado seguro no disponible en este sistema.' };
  const secrets = readSecrets();
  secrets[String(key)] = safeStorage.encryptString(value).toString('base64');
  writeSecrets(secrets);
  return { success: true };
});
ipcMain.handle('secure-get-secret', (event, key) => {
  if (!key || !safeStorage.isEncryptionAvailable()) return null;
  const encoded = readSecrets()[String(key)];
  if (!encoded) return null;
  try { return safeStorage.decryptString(Buffer.from(encoded, 'base64')); } catch (_) { return null; }
});
ipcMain.handle('secure-delete-secret', (event, key) => {
  const secrets = readSecrets();
  delete secrets[String(key)];
  writeSecrets(secrets);
  return { success: true };
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



// ── Playwright Browser Automation Native Controller (Brave Browser Powered) ─
const BRAVE_EXE_CANDIDATES = [
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\chrome_proxy.exe'
];

function getBraveExecutablePath() {
  for (const candidate of BRAVE_EXE_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

let playwrightBrowser = null;
let playwrightContext = null;
let playwrightPage = null;

async function getOrCreatePlaywrightPage(options = {}) {
  const { chromium } = require('playwright');
  if (!playwrightBrowser || !playwrightBrowser.isConnected()) {
    const bravePath = getBraveExecutablePath();
    if (!bravePath) {
      throw new Error('Brave.exe no está instalado en una ruta compatible; se rechazó usar otro navegador.');
    }
    const launchOptions = {
      executablePath: bravePath,
      headless: options.headless !== undefined ? Boolean(options.headless) : false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--no-default-browser-check',
        '--disable-infobars'
      ]
    };
    playwrightBrowser = await chromium.launch(launchOptions);
    playwrightContext = await playwrightBrowser.newContext({
      viewport: null
    });
    playwrightPage = await playwrightContext.newPage();
  } else if (!playwrightPage || playwrightPage.isClosed()) {
    playwrightPage = await playwrightContext.newPage();
  }
  return playwrightPage;
}

ipcMain.handle('playwright-execute', async (event, action, params = {}) => {
  try {
    switch (action) {
      case 'launch': {
        const page = await getOrCreatePlaywrightPage(params);
        if (params.url) {
          await page.goto(params.url, { timeout: 30000, waitUntil: params.waitUntil || 'domcontentloaded' });
        }
        return {
          success: true,
          url: page.url(),
          title: await page.title().catch(() => '')
        };
      }
      case 'navigate': {
        const page = await getOrCreatePlaywrightPage(params);
        await page.goto(params.url, { timeout: 30000, waitUntil: params.waitUntil || 'domcontentloaded' });
        return {
          success: true,
          url: page.url(),
          title: await page.title().catch(() => '')
        };
      }
      case 'click': {
        const page = await getOrCreatePlaywrightPage();
        await page.click(params.selector, { timeout: params.timeout || 10000 });
        return { success: true, message: `Clic ejecutado en selector "${params.selector}".` };
      }
      case 'fill': {
        const page = await getOrCreatePlaywrightPage();
        await page.fill(params.selector, String(params.value ?? ''), { timeout: params.timeout || 10000 });
        return { success: true, message: `Campo "${params.selector}" completado.` };
      }
      case 'type': {
        const page = await getOrCreatePlaywrightPage();
        await page.type(params.selector, String(params.text ?? ''), { delay: params.delay || 30 });
        return { success: true, message: `Texto tecleado en "${params.selector}".` };
      }
      case 'press': {
        const page = await getOrCreatePlaywrightPage();
        await page.press(params.selector || 'body', params.key);
        return { success: true, message: `Tecla "${params.key}" pulsada.` };
      }
      case 'screenshot': {
        const page = await getOrCreatePlaywrightPage();
        const buffer = await page.screenshot({ fullPage: Boolean(params.fullPage) });
        return {
          success: true,
          base64: `data:image/png;base64,${buffer.toString('base64')}`,
          size: buffer.length
        };
      }
      case 'evaluate': {
        const page = await getOrCreatePlaywrightPage();
        const result = await page.evaluate(params.script);
        return { success: true, result };
      }
      case 'get_content': {
        const page = await getOrCreatePlaywrightPage();
        let content = '';
        if (params.selector) {
          content = await page.locator(params.selector).innerText({ timeout: 5000 }).catch(() => '');
        } else {
          content = await page.evaluate(() => document.body?.innerText || document.documentElement?.innerText || '');
        }
        return {
          success: true,
          url: page.url(),
          title: await page.title().catch(() => ''),
          content: content.slice(0, 5000)
        };
      }
      case 'wait_for_selector': {
        const page = await getOrCreatePlaywrightPage();
        await page.waitForSelector(params.selector, {
          state: params.state || 'visible',
          timeout: params.timeout || 15000
        });
        return { success: true, message: `Elemento "${params.selector}" presente en la página.` };
      }
      case 'hover': {
        const page = await getOrCreatePlaywrightPage();
        await page.hover(params.selector, { timeout: 10000 });
        return { success: true, message: `Cursor posicionado sobre "${params.selector}".` };
      }
      case 'status': {
        const isRunning = Boolean(playwrightBrowser && playwrightBrowser.isConnected() && playwrightPage && !playwrightPage.isClosed());
        return {
          success: true,
          isRunning,
          url: isRunning ? playwrightPage.url() : null,
          title: isRunning ? await playwrightPage.title().catch(() => null) : null
        };
      }
      case 'close': {
        if (playwrightBrowser) {
          await playwrightBrowser.close().catch(() => {});
          playwrightBrowser = null;
          playwrightContext = null;
          playwrightPage = null;
        }
        return { success: true, message: 'Sesión de Playwright cerrada exitosamente.' };
      }
      default:
        return { success: false, error: `Acción de Playwright no soportada: "${action}"` };
    }
  } catch (err) {
    console.error('[Playwright Native Error]', err);
    return { success: false, error: err.message };
  }
});

// ── Spotify Native Desktop & Media Controller ────────────────────────────────
function isSpotifyDesktopInstalled() {
  const candidates = [
    path.join(process.env.APPDATA || '', 'Spotify', 'Spotify.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Spotify', 'Spotify.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'Spotify.exe'),
    'C:\\Program Files\\Spotify\\Spotify.exe',
    'C:\\Program Files (x86)\\Spotify\\Spotify.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return true;
  }
  return false;
}

function executePowerShellScript(script) {
  return new Promise((resolve) => {
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`, { windowsHide: true, timeout: 15000 }, (err, stdout, stderr) => {
      resolve({ success: !err, stdout: stdout ? stdout.trim() : '', stderr: stderr ? stderr.trim() : '' });
    });
  });
}

ipcMain.handle('spotify-control', async (event, action, params = {}) => {
  try {
    switch (action) {
      case 'check_desktop_installed': {
        return { success: true, ...getSpotifyInstallInfo() };
      }
      case 'play_pause': {
        // Virtual key 179 (0xB3) = VK_MEDIA_PLAY_PAUSE
        const res = await executePowerShellScript('$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]179)');
        return { success: res.success, message: 'Reproducción conmutada (Play/Pause) en Spotify / reproductor del sistema.' };
      }
      case 'next': {
        // Virtual key 176 (0xB0) = VK_MEDIA_NEXT_TRACK
        const res = await executePowerShellScript('$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]176)');
        return { success: res.success, message: 'Pista siguiente (Next Track).' };
      }
      case 'previous': {
        // Virtual key 177 (0xB1) = VK_MEDIA_PREV_TRACK
        const res = await executePowerShellScript('$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]177)');
        return { success: res.success, message: 'Pista anterior (Previous Track).' };
      }
      case 'open_uri': {
        const uri = params.uri || 'spotify:';
        const desktopInstalled = isSpotifyDesktopInstalled();

        if (!desktopInstalled) {
          // Convert spotify:track:ID to https://open.spotify.com/track/ID for web playback
          let webUrl = 'https://open.spotify.com';
          if (uri.startsWith('spotify:track:')) {
            const trackId = uri.replace('spotify:track:', '');
            webUrl = `https://open.spotify.com/track/${trackId}`;
          } else if (uri.startsWith('spotify:search:')) {
            const query = uri.replace('spotify:search:', '');
            webUrl = `https://open.spotify.com/search/${query}`;
          }
          await shell.openExternal(webUrl).catch(() => {});
          return { success: true, uri: webUrl, isWebFallback: true, message: `Abriendo en Spotify Web (Brave): ${webUrl}` };
        }

        await shell.openExternal(uri).catch(() => {});

        // Autoplay: Activate Spotify Desktop window and press ENTER / Media Play to begin track playback
        const autoPlayScript = `
          $ws = New-Object -ComObject WScript.Shell
          $retries = 0
          while ($retries -lt 6) {
            Start-Sleep -Milliseconds 600
            $proc = Get-Process -Name Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
            if ($proc) {
              $ws.AppActivate($proc.Id)
              Start-Sleep -Milliseconds 300
              $ws.SendKeys('{ENTER}')
              Start-Sleep -Milliseconds 250
              $ws.SendKeys([char]179)
              break
            }
            $retries++
          }
        `;
        executePowerShellScript(autoPlayScript).catch(() => {});

        return { success: true, uri, message: `Reproduciendo en Spotify: ${uri}` };
      }
      case 'search_desktop': {
        const query = encodeURIComponent(params.query || '');
        const desktopInstalled = isSpotifyDesktopInstalled();

        if (!desktopInstalled) {
          const webUrl = `https://open.spotify.com/search/${query}`;
          await shell.openExternal(webUrl).catch(() => {});
          return { success: true, query: params.query, uri: webUrl, isWebFallback: true, message: `Buscando "${params.query}" en Spotify Web.` };
        }

        const uri = `spotify:search:${query}`;
        await shell.openExternal(uri).catch(() => {});

        // Autoplay Top Result: Activate Spotify, focus and select top search result, then play
        const autoPlaySearchScript = `
          $ws = New-Object -ComObject WScript.Shell
          $retries = 0
          while ($retries -lt 8) {
            Start-Sleep -Milliseconds 600
            $proc = Get-Process -Name Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
            if ($proc) {
              $ws.AppActivate($proc.Id)
              Start-Sleep -Milliseconds 400
              $ws.SendKeys('{ENTER}')
              Start-Sleep -Milliseconds 300
              $ws.SendKeys('{DOWN}')
              Start-Sleep -Milliseconds 200
              $ws.SendKeys('{ENTER}')
              Start-Sleep -Milliseconds 250
              $ws.SendKeys([char]179)
              break
            }
            $retries++
          }
        `;
        executePowerShellScript(autoPlaySearchScript).catch(() => {});

        return { success: true, query: params.query, uri, message: `Buscando y reproduciendo "${params.query}" en Spotify.` };
      }
      case 'get_status': {
        // Inspect running Spotify processes and main window title
        const script = '(Get-Process -Name Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1).MainWindowTitle';
        const res = await executePowerShellScript(script);
        const title = res.stdout || '';
        const isRunning = Boolean(title);
        let artist = '';
        let track = '';
        if (title && title.includes(' - ')) {
          const parts = title.split(' - ');
          artist = parts[0].trim();
          track = parts.slice(1).join(' - ').trim();
        }
        return {
          success: true,
          isRunning,
          rawTitle: title,
          isPlaying: Boolean(title && !title.toLowerCase().startsWith('spotify')),
          artist: artist || null,
          track: track || (title && !title.toLowerCase().startsWith('spotify') ? title : null)
        };
      }
      case 'volume_up': {
        await executePowerShellScript('$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]175)'); // VK_VOLUME_UP
        return { success: true, message: 'Volumen aumentado.' };
      }
      case 'volume_down': {
        await executePowerShellScript('$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]174)'); // VK_VOLUME_DOWN
        return { success: true, message: 'Volumen reducido.' };
      }
      default:
        return { success: false, error: `Acción de Spotify no soportada: "${action}"` };
    }
  } catch (err) {
    console.error('[Spotify Native Error]', err);
    return { success: false, error: err.message };
  }
});

// ── Minecraft Companion Native Engine (AIRI Inspired) ────────────────────────
let mcBot = null;

ipcMain.handle('minecraft-connect', async (event, opts = {}) => {
  try {
    if (mcBot) {
      try { mcBot.quit(); } catch (_) {}
      mcBot = null;
    }

    const mineflayer = require('mineflayer');
    const { pathfinder } = require('mineflayer-pathfinder');

    const botOptions = {
      host: opts.host || 'localhost',
      port: opts.port ? Number(opts.port) : 25565,
      username: opts.username || 'Cristi_AI',
      version: opts.version || false
    };

    mcBot = mineflayer.createBot(botOptions);
    mcBot.loadPlugin(pathfinder);

    return new Promise((resolve) => {
      let resolved = false;

      mcBot.once('spawn', () => {
        if (!resolved) {
          resolved = true;
          resolve({ success: true, username: mcBot.username });
        }
        if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('minecraft-event', { type: 'spawn', username: mcBot.username });
        }
      });

      mcBot.on('chat', (username, message) => {
        if (username === mcBot.username) return;
        if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('minecraft-chat', { username, message });
        }
      });

      const notifyMinecraftEvent = (type, payload = {}) => {
        if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('minecraft-event', { type, ...payload });
        }
      };
      mcBot.on('kicked', (reason) => notifyMinecraftEvent('kicked', { reason: String(reason || '') }));
      mcBot.on('end', (reason) => notifyMinecraftEvent('end', { reason: String(reason || '') }));
      mcBot.on('error', (err) => notifyMinecraftEvent('error', { message: err?.message || String(err) }));

      mcBot.once('error', (err) => {
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: err.message });
        }
      });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: 'Tiempo de espera agotado al conectar con el servidor de Minecraft.' });
        }
      }, 15000);
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('minecraft-disconnect', () => {
  if (mcBot) {
    try { mcBot.quit(); } catch (_) {}
    mcBot = null;
  }
  return { success: true };
});

ipcMain.handle('minecraft-chat', (event, message) => {
  if (mcBot) {
    try {
      mcBot.chat(String(message));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, error: 'Bot de Minecraft no conectado.' };
});

ipcMain.handle('minecraft-get-status', () => {
  if (!mcBot) return { status: 'disconnected' };
  try {
    const pos = mcBot.entity?.position || { x: 0, y: 0, z: 0 };
    const players = Object.keys(mcBot.players || {}).filter(p => p !== mcBot.username);
    return {
      status: 'connected',
      health: mcBot.health || 20,
      food: mcBot.food || 20,
      position: { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) },
      dimension: mcBot.game?.dimension || 'overworld',
      nearbyPlayers: players
    };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
});

ipcMain.handle('minecraft-move-to', (event, { x, y, z }) => {
  if (!mcBot || !mcBot.pathfinder) return { success: false, error: 'Bot no conectado.' };
  try {
    const { goals, Movements } = require('mineflayer-pathfinder');
    const defaultMove = new Movements(mcBot);
    mcBot.pathfinder.setMovements(defaultMove);
    mcBot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
    return { success: true, message: `Navegando hacia ${x}, ${y}, ${z}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('minecraft-follow', (event, targetPlayer) => {
  if (!mcBot || !mcBot.pathfinder) return { success: false, error: 'Bot no conectado.' };
  try {
    const player = mcBot.players[targetPlayer];
    if (!player || !player.entity) {
      return { success: false, error: `Jugador "${targetPlayer}" no encontrado cerca.` };
    }
    const { goals, Movements } = require('mineflayer-pathfinder');
    const defaultMove = new Movements(mcBot);
    mcBot.pathfinder.setMovements(defaultMove);
    mcBot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 3), true);
    return { success: true, message: `Siguiendo a ${targetPlayer}.` };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('minecraft-stop', () => {
  if (mcBot && mcBot.pathfinder) {
    try {
      mcBot.pathfinder.setGoal(null);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: true };
});

// ── Discord Companion Native Engine (AIRI Inspired) ───────────────────────────
let discordClient = null;

ipcMain.handle('discord-connect', async (event, { token, statusMessage, activityType }) => {
  try {
    if (discordClient) {
      try { discordClient.destroy(); } catch (_) {}
      discordClient = null;
    }

    const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });

    return new Promise((resolve) => {
      let resolved = false;

      discordClient.once('ready', () => {
        if (!resolved) {
          resolved = true;
          resolve({
            success: true,
            botInfo: {
              id: discordClient.user.id,
              tag: discordClient.user.tag,
              username: discordClient.user.username
            }
          });
        }

        try {
          discordClient.user.setActivity(statusMessage || 'Cristi AI Companion', {
            type: ActivityType[activityType || 'Playing'] || ActivityType.Playing
          });
        } catch (_) {}
      });

      discordClient.on('messageCreate', (message) => {
        if (message.author.bot) return;
        if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('discord-message', {
            channelId: message.channelId,
            channelName: message.channel?.name || 'DM',
            authorId: message.author.id,
            authorName: message.author.username,
            content: message.content,
            guildId: message.guildId,
            guildName: message.guild?.name || 'Direct Message'
          });
        }
      });
      const notifyDiscordEvent = (type, payload = {}) => {
        if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('discord-event', { type, ...payload });
        }
      };
      discordClient.on('error', (err) => notifyDiscordEvent('error', { message: err?.message || String(err) }));
      discordClient.on('shardDisconnect', (closeEvent, shardId) => notifyDiscordEvent('disconnect', { shardId, code: closeEvent?.code }));
      discordClient.on('shardReconnecting', (shardId) => notifyDiscordEvent('reconnecting', { shardId }));
      discordClient.on('shardReady', (shardId) => notifyDiscordEvent('ready', { shardId }));

      discordClient.login(token).catch((err) => {
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: err.message });
        }
      });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: 'Tiempo de espera agotado al conectar a Discord.' });
        }
      }, 15000);
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('discord-disconnect', () => {
  if (discordClient) {
    try { discordClient.destroy(); } catch (_) {}
    discordClient = null;
  }
  return { success: true };
});

ipcMain.handle('discord-send-message', async (event, { channelId, content }) => {
  if (!discordClient) return { success: false, error: 'Bot de Discord no conectado.' };
  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return { success: false, error: 'Canal no encontrado o no admite texto.' };
    }
    await channel.send(String(content));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('minecraft-mine-block', async (event, { x, y, z }) => {
  if (!mcBot) return { success: false, error: 'Bot de Minecraft no conectado.' };
  try {
    const { Vec3 } = require('vec3');
    const blockPos = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));
    const block = mcBot.blockAt(blockPos);
    if (!block || block.name === 'air') {
      return { success: false, error: `No hay bloque minable en [${x}, ${y}, ${z}].` };
    }
    await mcBot.dig(block);
    return { success: true, message: `Bloque ${block.name} minado en [${x}, ${y}, ${z}].` };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('minecraft-place-block', async (event, { x, y, z, blockName }) => {
  if (!mcBot) return { success: false, error: 'Bot de Minecraft no conectado.' };
  try {
    const { Vec3 } = require('vec3');
    const targetPos = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));
    const item = mcBot.inventory.items().find(i => i.name.toLowerCase().includes((blockName || '').toLowerCase()));
    if (!item) {
      return { success: false, error: `No hay bloque "${blockName}" en el inventario.` };
    }
    await mcBot.equip(item, 'hand');
    const referenceBlock = mcBot.blockAt(targetPos.offset(0, -1, 0)) || mcBot.blockAt(targetPos);
    if (!referenceBlock) return { success: false, error: 'No se encontró bloque de referencia para colocar.' };
    await mcBot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
    return { success: true, message: `Bloque ${item.name} colocado en [${x}, ${y}, ${z}].` };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('minecraft-attack', async (event, { entityName }) => {
  if (!mcBot) return { success: false, error: 'Bot de Minecraft no conectado.' };
  try {
    const entity = mcBot.nearestEntity(e => 
      e.type === 'mob' || e.type === 'player' || (entityName && e.name && e.name.toLowerCase().includes(entityName.toLowerCase()))
    );
    if (!entity) return { success: false, error: `No se encontró entidad "${entityName || 'cercana'}" para atacar.` };
    mcBot.attack(entity);
    return { success: true, message: `Atacando a ${entity.name || 'entidad'}.` };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('discord-set-status', (event, { statusText, activityType }) => {
  if (!discordClient || !discordClient.user) return { success: false };
  try {
    const { ActivityType } = require('discord.js');
    discordClient.user.setActivity(statusText, {
      type: ActivityType[activityType || 'Playing'] || ActivityType.Playing
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('discord-get-messages', async (event, { channelId, limit = 20 }) => {
  if (!discordClient) return { success: false, error: 'Bot de Discord no conectado.' };
  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return { success: false, error: 'Canal no encontrado o no admite texto.' };
    }
    const messages = await channel.messages.fetch({ limit: Math.min(50, limit) });
    const list = Array.from(messages.values()).map(m => ({
      id: m.id,
      content: m.content,
      author: m.author.username,
      authorId: m.author.id,
      timestamp: m.createdAt.toISOString()
    })).reverse();
    return { success: true, messages: list };
  } catch (e) {
    return { success: false, error: e.message };
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

// ── Settings Multi-Window Management & Env Resolver ─────────────────────────
function getEnvApiKey() {
  const candidateEnvPaths = [
    path.join(__dirname, '../.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.resourcesPath, '.env'),
    path.join(app.getPath('userData'), '.env')
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

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.maximize();
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  // 1. Hide the entire transparent companion overlay window immediately (zero DWM overlap, zero composite lag)
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.hide();
      mainWindow.webContents.send('companion-pause');
      mainWindow.webContents.send('settings-window-state', { isOpen: true });
    } catch (_) {}
  }

  // Strictly unregister all global shortcuts while settings window is open
  try {
    globalShortcut.unregisterAll();
  } catch (_) {}

  const appIcon = getAppIcon();

  settingsWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 650,
    center: true,
    frame: true,
    transparent: false,
    backgroundColor: '#090d16',
    autoHideMenuBar: true,
    show: false, // Prevent window white/black flash
    title: 'Cristi AI Companion - Panel de Control & Configuración',
    icon: appIcon || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false
    }
  });

  settingsWindow.once('ready-to-show', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.maximize(); // Maximized by default as requested
      settingsWindow.show();
      settingsWindow.focus();
    }
  });

  if (isDev) {
    const devUrl = `${RENDERER_URL}/settings.html`;
    settingsWindow.loadURL(devUrl).catch(() => {
      settingsWindow.loadFile(path.join(__dirname, '../dist/settings.html')).catch(() => {});
    });
  } else {
    settingsWindow.loadURL('app://cristi/settings.html').catch(() => {
      settingsWindow.loadFile(path.join(__dirname, '../dist/settings.html')).catch(() => {});
    });
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null;

    // Re-enable all global shortcuts when settings window is closed
    registerGlobalShortcuts();

    // 2. Restore and show the companion overlay window when Settings window is closed
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('companion-resume');
        mainWindow.webContents.send('settings-window-state', { isOpen: false });
      } catch (_) {}
    }
  });

  return settingsWindow;
}

ipcMain.handle('open-settings-window', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    try {
      globalShortcut.unregisterAll();
    } catch (_) {}
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.show();
    settingsWindow.focus();
    return { success: true };
  }
  createSettingsWindow();
  return { success: true };
});

ipcMain.handle('close-settings-window', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
  return { success: true };
});

// ── Standalone Camera Window Management ─────────────────────────────────────
function createCameraWindow() {
  if (cameraWindow && !cameraWindow.isDestroyed()) {
    if (cameraWindow.isMinimized()) cameraWindow.restore();
    cameraWindow.show();
    cameraWindow.focus();
    return cameraWindow;
  }

  cameraWindow = new BrowserWindow({
    width: 680,
    height: 520,
    minWidth: 440,
    minHeight: 360,
    backgroundColor: '#09090b',
    title: 'Cristi AI • Monitor Óptico de Cámara',
    show: false,
    frame: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
    }
  });

  // Keep cameraWindow on top alongside mainWindow ('pop-up-menu') without triggering DWM screensaver suspension
  cameraWindow.setAlwaysOnTop(true, 'pop-up-menu');

  cameraWindow.once('ready-to-show', () => {
    if (cameraWindow && !cameraWindow.isDestroyed()) {
      cameraWindow.show();
    }
  });

  if (isDev) {
    const devUrl = `${RENDERER_URL}/camera.html`;
    cameraWindow.loadURL(devUrl).catch(() => {
      cameraWindow.loadFile(path.join(__dirname, '../dist/camera.html')).catch(() => {});
    });
  } else {
    cameraWindow.loadURL('app://cristi/camera.html').catch(() => {
      cameraWindow.loadFile(path.join(__dirname, '../dist/camera.html')).catch(() => {});
    });
  }

  cameraWindow.on('closed', () => {
    cameraWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('camera-window-state', { isOpen: false });
    }
  });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('camera-window-state', { isOpen: true });
  }

  return cameraWindow;
}

ipcMain.handle('open-camera-window', () => {
  createCameraWindow();
  return { success: true };
});

ipcMain.handle('close-camera-window', () => {
  if (cameraWindow && !cameraWindow.isDestroyed()) {
    cameraWindow.close();
  }
  return { success: true };
});

ipcMain.handle('is-camera-window-open', () => {
  return !!(cameraWindow && !cameraWindow.isDestroyed() && cameraWindow.isVisible());
});

// ── Spotify Desktop / Windows Store / Native Media Controls ─────────────────
function getSpotifyInstallInfo() {
  const localApp = process.env.LOCALAPPDATA || '';
  const appData = process.env.APPDATA || '';
  const progFiles = process.env['ProgramFiles'] || '';

  const candidates = [
    { path: path.join(appData, 'Spotify/Spotify.exe'), type: 'official_desktop' },
    { path: path.join(progFiles, 'Spotify/Spotify.exe'), type: 'official_desktop' },
    { path: path.join(localApp, 'Microsoft/WindowsApps/Spotify.exe'), type: 'store_app' }
  ];

  for (const c of candidates) {
    if (fs.existsSync(c.path)) {
      return { installed: true, type: c.type, exePath: c.path };
    }
  }
  return { installed: false, type: 'web_only', exePath: null };
}

// App Config Store in main process
const CONFIG_FILE_PATH = path.join(app.getPath('userData'), 'cristi-config.json');

ipcMain.handle('get-app-config', () => {
  try {
    let cfg = {};
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      cfg = JSON.parse(raw) || {};
    }
    if (!cfg.apiKey || !cfg.apiKey.trim()) {
      const envKey = getEnvApiKey();
      if (envKey) cfg.apiKey = envKey;
    }
    return cfg;
  } catch (err) {
    console.warn('Error reading config file:', err);
  }
  const envKey = getEnvApiKey();
  return envKey ? { apiKey: envKey } : null;
});

let saveConfigTimer = null;
ipcMain.handle('save-app-config', (event, newConfig) => {
  // Broadcast to mainWindow in real-time immediately
  if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('config-updated', newConfig);
  }

  // Debounce disk write
  if (saveConfigTimer) clearTimeout(saveConfigTimer);
  saveConfigTimer = setTimeout(() => {
    try {
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Error writing config file:', err);
    }
  }, 100);

  return { success: true };
});

ipcMain.on('companion-pause', () => {
  if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('companion-pause');
  }
});

ipcMain.on('companion-resume', () => {
  if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('companion-resume');
  }
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
            status: 'available',
            version: localRelease.version,
            releaseNotes: localRelease.releaseNotes || 'Actualización lista para instalar'
          });
        }
      }
    } catch (err) {
      console.warn('Error checking local updates:', err);
    }
  }, 3000);
}

// Helper to check if settings window is active / focused
function isSettingsActive() {
  return !!(settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible());
}

// ── Global Shortcuts Registration ───────────────────────────────────────────
function registerGlobalShortcuts() {
  try {
    globalShortcut.unregisterAll();

    // 1. Boss Key / Toggle Visibility (Ctrl + Shift + C)
    globalShortcut.register('CommandOrControl+Shift+C', () => {
      if (isSettingsActive()) return;
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
      if (isSettingsActive()) return;
      if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shortcut-toggle-mute');
      }
    });

    // 3. Instant Screen Snapshot & Vision Query (Ctrl + Shift + S)
    globalShortcut.register('CommandOrControl+Shift+S', () => {
      if (isSettingsActive()) return;
      if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shortcut-capture-screen');
      }
    });

    // 4. Toggle Zen Mode / Hide UI Globally (Ctrl + Shift + H)
    globalShortcut.register('CommandOrControl+Shift+H', () => {
      if (isSettingsActive()) return;
      if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shortcut-toggle-zen-mode');
      }
    });

    // 5. Toggle Performance Telemetry & Profiler Globally (Ctrl + Shift + P)
    globalShortcut.register('CommandOrControl+Shift+P', () => {
      if (isSettingsActive()) return;
      if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shortcut-toggle-perf-hud');
      }
    });

    // 6. Toggle Always-on-Top / Pin Globally (Ctrl + Shift + A)
    globalShortcut.register('CommandOrControl+Shift+A', () => {
      if (isSettingsActive()) return;
      if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shortcut-toggle-always-on-top');
      }
    });
  } catch (e) {
    console.warn('Could not register global shortcuts:', e);
  }
}

// ── System Tray ─────────────────────────────────────────────────────────────
function createProceduralTrayIcon() {
  const width = 24;
  const height = 24;
  const buffer = Buffer.alloc(width * height * 4);
  const purple = [168, 85, 247, 255]; // #a855f7
  const border = [147, 51, 234, 255]; // #9333ea

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - 11.5;
      const dy = y - 11.5;
      const distSq = dx * dx + dy * dy;

      if (distSq <= 100) {
        if (distSq >= 64) {
          buffer[idx] = border[0];
          buffer[idx + 1] = border[1];
          buffer[idx + 2] = border[2];
          buffer[idx + 3] = border[3];
        } else {
          buffer[idx] = purple[0];
          buffer[idx + 1] = purple[1];
          buffer[idx + 2] = purple[2];
          buffer[idx + 3] = purple[3];
        }
      } else {
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width, height });
}

function getTrayIcon() {
  const candidates = [
    path.join(__dirname, '../assets/icons/icon.ico'),
    path.join(__dirname, '../assets/icons/icon.png'),
    path.join(__dirname, '../resources/icons/icon.ico'),
    path.join(__dirname, '../resources/icons/tray-icon.png'),
    path.join(__dirname, '../resources/icons/icon.png'),
    path.join(__dirname, '../dist/tray-icon.png'),
    path.join(__dirname, '../dist/favicon.ico'),
    path.join(__dirname, '../dist/favicon.png'),
    path.join(__dirname, '../dist/icon.png'),
    path.join(__dirname, '../public/tray-icon.png'),
    path.join(__dirname, '../public/icon.png'),
    path.join(process.resourcesPath, 'resources/icons/icon.ico'),
    path.join(process.resourcesPath, 'resources/icons/tray-icon.png'),
    path.join(process.resourcesPath, 'resources/icons/icon.png'),
    path.join(process.resourcesPath, 'icons/icon.ico')
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const img = nativeImage.createFromPath(candidate);
        if (!img.isEmpty()) {
          const size = img.getSize();
          if (size.width > 32 || size.height > 32) {
            return img.resize({ width: 24, height: 24, quality: 'best' });
          }
          return img;
        }
      }
    } catch (e) {
      console.warn(`[Tray] Warning resolving icon candidate ${candidate}:`, e);
    }
  }

  return createProceduralTrayIcon();
}

function createTray() {
  const icon = getTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Cristi AI Companion');

  const updateMenu = () => {
    const isVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
    const contextMenu = Menu.buildFromTemplate([
      {
        label: isVisible ? 'Ocultar' : 'Mostrar',
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
      {
        label: 'Modo Zen',
        click: () => {
          if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('shortcut-toggle-zen-mode');
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Ajustes',
        click: () => {
          createSettingsWindow();
        },
      },
      {
        label: 'Reiniciar',
        click: () => {
          app.relaunch();
          app.exit(0);
        },
      },
      { type: 'separator' },
      {
        label: 'Cerrar',
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

  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
      updateMenu();
    }
  });

  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      updateMenu();
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
      let distPath = path.normalize(path.join(__dirname, '../dist', pathname));
      if (!fs.existsSync(distPath)) {
        const publicPath = path.normalize(path.join(__dirname, '../public', pathname));
        if (fs.existsSync(publicPath)) {
          distPath = publicPath;
        }
      }
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
