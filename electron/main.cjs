'use strict';

const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell, clipboard, Notification, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Hardware GPU Acceleration & 120+ FPS Video Decoding Support
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('max-active-webgl-contexts', '32');
app.commandLine.appendSwitch('high-dpi-support', '1');

let mainWindow = null;
let tray = null;
const isDev = !app.isPackaged;
const RENDERER_URL = 'http://localhost:5173';

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const bounds = primaryDisplay.bounds;

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  // Start in click-through mode — forward:true ensures mousemove events still
  // reach the renderer so it can detect hover and re-enable interactivity
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Load app
  if (isDev) {
    mainWindow.loadURL(RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.setIgnoreMouseEvents(ignore, options || {});
});

// ── IPC: Always-On-Top ──────────────────────────────────────────────────────
ipcMain.on('set-always-on-top', (event, value) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (value) {
    win.setAlwaysOnTop(true, 'screen-saver');
  } else {
    win.setAlwaysOnTop(false);
  }
});

ipcMain.handle('get-always-on-top', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.isAlwaysOnTop() : false;
});

// ── IPC: Display Info ───────────────────────────────────────────────────────
ipcMain.handle('get-display-info', () => {
  const primary = screen.getPrimaryDisplay();
  return {
    width: primary.bounds.width,
    height: primary.bounds.height,
    scaleFactor: primary.scaleFactor,
    workArea: primary.workArea,
  };
});

// ── IPC: Window Controls ────────────────────────────────────────────────────
ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('quit-app', () => {
  app.quit();
});

ipcMain.on('show-window', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.on('hide-window', () => {
  if (mainWindow) mainWindow.hide();
});

// ── IPC: Native OS Operations with Safe Timeout (10s) ───────────────────────
ipcMain.handle('exec-command', (event, command, options = {}) => {
  const timeoutMs = options.timeout || 10000;
  return new Promise((resolve) => {
    exec(command, { maxBuffer: 10 * 1024 * 1024, windowsHide: true, timeout: timeoutMs }, (error, stdout, stderr) => {
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
  });
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read file: ${err.message}`);
  }
});

ipcMain.handle('write-file', async (event, filePath, data) => {
  try {
    await fs.promises.writeFile(filePath, data, 'utf8');
    return true;
  } catch (err) {
    throw new Error(`Failed to write file: ${err.message}`);
  }
});

ipcMain.handle('append-file', async (event, filePath, data) => {
  try {
    await fs.promises.appendFile(filePath, data, 'utf8');
    return true;
  } catch (err) {
    throw new Error(`Failed to append file: ${err.message}`);
  }
});

ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
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
    await shell.openExternal(targetUrl);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('open-path', async (event, targetPath) => {
  try {
    const errorMsg = await shell.openPath(targetPath);
    return { success: !errorMsg, error: errorMsg || null };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('show-item-in-folder', async (event, targetPath) => {
  try {
    shell.showItemInFolder(targetPath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('get-clipboard-text', () => {
  return clipboard.readText();
});

ipcMain.handle('set-clipboard-text', (event, text) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
    return true;
  }
  return false;
});

// ── Native Screen Capture for Contextual Vision ──────────────────────────────
ipcMain.handle('capture-screen-native', async (event, region = null) => {
  return new Promise((resolve) => {
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms,System.Drawing;
      $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;
      $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height;
      $graphics = [System.Drawing.Graphics]::FromImage($bmp);
      $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size);
      $ms = New-Object System.IO.MemoryStream;
      $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg);
      $graphics.Dispose();
      $bmp.Dispose();
      [Convert]::ToBase64String($ms.ToArray());
    `.trim();

    exec(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`, { maxBuffer: 15 * 1024 * 1024, timeout: 5000 }, (error, stdout) => {
      if (error || !stdout) {
        resolve(null);
      } else {
        resolve(stdout.trim());
      }
    });
  });
});

// ── Wallpaper Engine Native Auto-Scanner (Zero-Cost Async) ───────────────────
ipcMain.handle('scan-wallpaper-engine', async () => {
  const drives = ['C:', 'D:', 'E:', 'F:', 'G:', 'H:'];
  const possibleRoots = [];

  for (const d of drives) {
    possibleRoots.push(
      path.join(d, 'Program Files (x86)', 'Steam', 'steamapps'),
      path.join(d, 'Program Files', 'Steam', 'steamapps'),
      path.join(d, 'SteamLibrary', 'steamapps'),
      path.join(d, 'Steam', 'steamapps'),
      path.join(d, 'Games', 'SteamLibrary', 'steamapps')
    );
  }

  const results = [];
  const visited = new Set();

  for (const steamRoot of possibleRoots) {
    try {
      if (!fs.existsSync(steamRoot)) continue;

      // 1. Workshop Items (Steam AppID: 431960)
      const workshopDir = path.join(steamRoot, 'workshop', 'content', '431960');
      if (fs.existsSync(workshopDir)) {
        const itemDirs = await fs.promises.readdir(workshopDir, { withFileTypes: true });
        for (const itemDir of itemDirs) {
          if (!itemDir.isDirectory()) continue;
          const fullPath = path.join(workshopDir, itemDir.name);
          if (visited.has(fullPath)) continue;
          visited.add(fullPath);

          const projectJson = path.join(fullPath, 'project.json');
          if (fs.existsSync(projectJson)) {
            try {
              const data = JSON.parse(await fs.promises.readFile(projectJson, 'utf8'));
              let mainFile = data.file ? path.join(fullPath, data.file) : null;
              let previewFile = data.preview ? path.join(fullPath, data.preview) : null;
              let finalType = data.type ? data.type.toLowerCase() : 'video';

              const files = await fs.promises.readdir(fullPath);
              const videoMatch = files.find(f => /\.(mp4|webm|mkv|mov)$/i.test(f));
              const htmlMatch = files.find(f => /\.(html|htm)$/i.test(f));
              const imageMatch = files.find(f => /\.(gif|png|jpg|jpeg|webp)$/i.test(f));

              if (videoMatch) {
                mainFile = path.join(fullPath, videoMatch);
                finalType = 'video';
              } else if (htmlMatch) {
                mainFile = path.join(fullPath, htmlMatch);
                finalType = 'web';
              } else if (!mainFile || mainFile.endsWith('.json') || mainFile.endsWith('.pkg')) {
                if (previewFile && fs.existsSync(previewFile)) {
                  mainFile = previewFile;
                } else if (imageMatch) {
                  mainFile = path.join(fullPath, imageMatch);
                }
                finalType = mainFile && /\.gif$/i.test(mainFile) ? 'animated' : 'image';
              }

              if (previewFile && !fs.existsSync(previewFile) && imageMatch) {
                previewFile = path.join(fullPath, imageMatch);
              }

              results.push({
                id: `wpe_${itemDir.name}`,
                workshopId: itemDir.name,
                name: data.title || `Wallpaper ${itemDir.name}`,
                category: 'wallpaper_engine',
                type: finalType,
                mainPath: mainFile ? `/__wpe_media?path=${encodeURIComponent(mainFile)}` : null,
                previewPath: previewFile ? `/__wpe_media?path=${encodeURIComponent(previewFile)}` : (mainFile ? `/__wpe_media?path=${encodeURIComponent(mainFile)}` : null),
                description: data.description || `Wallpaper Engine Workshop (#${itemDir.name})`
              });
            } catch (_) {}
          }
        }
      }

      // 2. Default Built-in Projects & My Projects
      const localRoots = [
        path.join(steamRoot, 'common', 'wallpaper_engine', 'projects', 'defaultprojects'),
        path.join(steamRoot, 'common', 'wallpaper_engine', 'projects', 'myprojects')
      ];

      for (const locRoot of localRoots) {
        if (fs.existsSync(locRoot)) {
          const itemDirs = await fs.promises.readdir(locRoot, { withFileTypes: true });
          for (const itemDir of itemDirs) {
            if (!itemDir.isDirectory()) continue;
            const fullPath = path.join(locRoot, itemDir.name);
            if (visited.has(fullPath)) continue;
            visited.add(fullPath);

            const projectJson = path.join(fullPath, 'project.json');
            if (fs.existsSync(projectJson)) {
              try {
                const data = JSON.parse(await fs.promises.readFile(projectJson, 'utf8'));
                let mainFile = data.file ? path.join(fullPath, data.file) : null;
                let previewFile = data.preview ? path.join(fullPath, data.preview) : null;
                let finalType = data.type ? data.type.toLowerCase() : 'scene';

                const files = await fs.promises.readdir(fullPath);
                const videoMatch = files.find(f => /\.(mp4|webm|mkv|mov)$/i.test(f));
                const htmlMatch = files.find(f => /\.(html|htm)$/i.test(f));
                const imageMatch = files.find(f => /\.(gif|png|jpg|jpeg|webp)$/i.test(f));

                if (videoMatch) {
                  mainFile = path.join(fullPath, videoMatch);
                  finalType = 'video';
                } else if (htmlMatch) {
                  mainFile = path.join(fullPath, htmlMatch);
                  finalType = 'web';
                } else if (!mainFile || mainFile.endsWith('.json') || mainFile.endsWith('.pkg')) {
                  if (previewFile && fs.existsSync(previewFile)) {
                    mainFile = previewFile;
                  } else if (imageMatch) {
                    mainFile = path.join(fullPath, imageMatch);
                  }
                  finalType = mainFile && /\.gif$/i.test(mainFile) ? 'animated' : 'image';
                }

                results.push({
                  id: `wpe_local_${itemDir.name}`,
                  name: data.title || itemDir.name,
                  category: 'wallpaper_engine',
                  type: finalType,
                  mainPath: mainFile ? `/__wpe_media?path=${encodeURIComponent(mainFile)}` : null,
                  previewPath: previewFile ? `/__wpe_media?path=${encodeURIComponent(previewFile)}` : (mainFile ? `/__wpe_media?path=${encodeURIComponent(mainFile)}` : null),
                  description: data.description || `Wallpaper Engine Oficial (${itemDir.name})`
                });
              } catch (_) {}
            }
          }
        }
      }
    } catch (_) {}
  }

  return results;
});

// ── Global Shortcuts Registration ───────────────────────────────────────────
function registerGlobalShortcuts() {
  try {
    // 1. Boss Key / Toggle Visibility (Ctrl + Shift + C)
    globalShortcut.register('CommandOrControl+Shift+C', () => {
      if (mainWindow) {
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
      if (mainWindow?.webContents) {
        mainWindow.webContents.send('shortcut-toggle-mute');
      }
    });

    // 3. Instant Screen Snapshot & Vision Query (Ctrl + Shift + S)
    globalShortcut.register('CommandOrControl+Shift+S', () => {
      if (mainWindow?.webContents) {
        mainWindow.webContents.send('shortcut-capture-screen');
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
  tray.setToolTip('Cristi Desktop');

  const updateMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: mainWindow?.isVisible() ? 'Ocultar Cristi (Ctrl+Shift+C)' : 'Mostrar Cristi (Ctrl+Shift+C)',
        click: () => {
          if (mainWindow) {
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
        label: 'Salir de Cristi Desktop',
        click: () => app.quit(),
      },
    ]);
    tray.setContextMenu(contextMenu);
  };

  updateMenu();

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

