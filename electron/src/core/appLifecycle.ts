import { app, protocol, net, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { processManager } from './processManager';
import { loadEnvironment } from './env';

// Initialize environment variables first
loadEnvironment();

/**
 * Configure hardware acceleration and anti-throttling switches for Electron.
 * Enforces dedicated GPU rendering and prevents video overlay occlusion or throttling.
 */
export function setupCommandLineFlags(): void {
  // Hardware GPU Acceleration & High-Refresh Support (Forcing Dedicated GPU)
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
  app.commandLine.appendSwitch(
    'enable-features',
    'VaapiVideoDecoder,UseSkiaRenderer,SharedArrayBuffer,SmoothScrolling'
  );

  // Anti-Occlusion & Video Overlay Protection:
  // Prevents Windows DWM and Chromium from marking background video players (YouTube, VLC, Netflix)
  // as occluded or revoking hardware video planes when Cristi AI is interacted with.
  app.commandLine.appendSwitch(
    'disable-features',
    'CalculateNativeWinOcclusion,DirectCompositionVideoOverlays'
  );

  // Essential Desktop Mate Anti-Throttling & Multitasking Flags (Alt+Tab & Virtual Desktops)
  app.commandLine.appendSwitch('disable-background-timer-throttling');

  // Web Audio Autoplay & Background Voice Persistence:
  // Prevents Chromium from suspending AudioContext when transparent window loses focus
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

  // CDP Remote Debugging for Agentic Performance Monitoring (APM)
  const cdpPort = process.env.CRISTI_CDP_PORT || process.env.ELECTRON_CDP_PORT;
  if (cdpPort) {
    app.commandLine.appendSwitch('remote-debugging-port', cdpPort);
    app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
  }
}

/**
 * Registers privileged custom protocol `app://` for production asset and Live2D model serving.
 * Must be executed before `app.whenReady()`.
 */
export function registerPrivilegedSchemes(): void {
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
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': case '.mjs': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    case '.ico': return 'image/x-icon';
    case '.wasm': return 'application/wasm';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.ogg': return 'audio/ogg';
    case '.moc3': return 'application/octet-stream';
    default: return 'application/octet-stream';
  }
}

/**
 * Registers the runtime protocol handler for `app://` URLs.
 * Handles production asset delivery, Live2D model assets, and SPA routing.
 */
export function registerProtocolHandler(rootDir: string): void {
  protocol.handle('app', async (request) => {
    try {
      const parsedUrl = new URL(request.url);
      let pathname = decodeURIComponent(parsedUrl.pathname);
      if (pathname.startsWith('/')) pathname = pathname.slice(1);
      if (!pathname || pathname === 'index.html') {
        pathname = 'index.html';
      }

      const cleanPathname = pathname.replace(/^(?:dist|public)\//, '');
      const appPath = app.isPackaged ? app.getAppPath() : rootDir;

      const candidatePaths = [
        path.normalize(path.join(rootDir, 'dist', pathname)),
        path.normalize(path.join(rootDir, 'dist', cleanPathname)),
        path.normalize(path.join(rootDir, 'public', pathname)),
        path.normalize(path.join(rootDir, 'public', cleanPathname)),
        path.normalize(path.join(rootDir, pathname)),
        path.normalize(path.join(rootDir, cleanPathname)),
      ];

      if (appPath && appPath !== rootDir) {
        candidatePaths.push(
          path.normalize(path.join(appPath, 'dist', pathname)),
          path.normalize(path.join(appPath, 'dist', cleanPathname)),
          path.normalize(path.join(appPath, 'public', pathname)),
          path.normalize(path.join(appPath, 'public', cleanPathname)),
          path.normalize(path.join(appPath, pathname)),
          path.normalize(path.join(appPath, cleanPathname))
        );
      }

      if (!path.extname(pathname)) {
        candidatePaths.push(
          path.normalize(path.join(rootDir, 'dist', `${pathname}.html`)),
          path.normalize(path.join(rootDir, 'dist', `${cleanPathname}.html`)),
          path.normalize(path.join(appPath, 'dist', `${pathname}.html`))
        );
      }

      let resolvedPath: string | null = null;
      for (const candidate of candidatePaths) {
        try {
          if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
            resolvedPath = candidate;
            break;
          }
        } catch (_) {}
      }

      // SPA navigation fallback: if an HTML page was requested and not found, serve index.html
      if (!resolvedPath && (pathname.endsWith('.html') || !path.extname(pathname))) {
        const spaCandidates = [
          path.normalize(path.join(rootDir, 'dist', 'index.html')),
          path.normalize(path.join(appPath, 'dist', 'index.html')),
        ];
        for (const spa of spaCandidates) {
          try {
            if (fs.existsSync(spa)) {
              resolvedPath = spa;
              break;
            }
          } catch (_) {}
        }
      }

      if (!resolvedPath) {
        console.warn(`[Protocol] Asset not found for URL: ${request.url}`);
        return new Response('Asset not found', { status: 404 });
      }

      // Primary: Electron native net.fetch stream
      try {
        return await net.fetch(pathToFileURL(resolvedPath).toString());
      } catch (netErr) {
        // Fail-safe: read directly through Node/Electron patched fs (100% ASAR support)
        const buffer = fs.readFileSync(resolvedPath);
        return new Response(buffer, {
          status: 200,
          headers: {
            'Content-Type': getMimeType(resolvedPath),
            'Cache-Control': 'no-cache',
          },
        });
      }
    } catch (err) {
      console.error('[Protocol] Error handling app:// request:', err);
      return new Response('Asset not found', { status: 404 });
    }
  });
}

/**
 * Enforces single-instance lock for Cristi AI Companion.
 * If another instance is already running, exits immediately.
 */
export function enforceSingleInstanceLock(onSecondInstance?: () => void): boolean {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return false;
  }

  app.on('second-instance', () => {
    if (onSecondInstance) {
      onSecondInstance();
    }
  });

  return true;
}

/**
 * Sets up the full application lifecycle handlers.
 */
export function setupAppLifecycle(options: {
  rootDir: string;
  onReady: () => Promise<void> | void;
  onSecondInstance?: () => void;
  onActivate?: () => void;
}): void {
  // 1. Configure early flags & schemes
  setupCommandLineFlags();
  registerPrivilegedSchemes();

  // 2. Single instance lock
  const hasLock = enforceSingleInstanceLock(options.onSecondInstance);
  if (!hasLock) return;

  // 3. App ready lifecycle
  app.whenReady().then(async () => {
    registerProtocolHandler(options.rootDir);
    await options.onReady();

    app.on('activate', () => {
      if (options.onActivate) {
        options.onActivate();
      } else if (BrowserWindow.getAllWindows().length === 0) {
        // Fallback default
      }
    });
  });

  // 4. Shutdown lifecycle
  const handleShutdown = async () => {
    await processManager.cleanupAll();
  };

  app.on('before-quit', handleShutdown);
  app.on('will-quit', handleShutdown);
  app.on('window-all-closed', async () => {
    await handleShutdown();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
