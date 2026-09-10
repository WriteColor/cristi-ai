import { app, protocol, net, BrowserWindow } from 'electron';
import { registerAppProtocol } from '../protocol/AppProtocol';


import { processManager } from './processManager';
import { loadEnvironment } from './env';

// Initialize environment variables first
loadEnvironment();

/**
 * Configure hardware acceleration and media flags for Electron.
 * Uses Chromium's default GPU policy. Optional profiles exist exclusively for
 * diagnostics and driver compatibility (e.g. software, d3d11, no-overlays).
 */
export function setupCommandLineFlags(): void {
  // Chromium defaults are the baseline. Select only one diagnostic override.
  const profile = process.env.CRISTI_GPU_PROFILE || 'default';
  if (profile === 'software') app.disableHardwareAcceleration();
  else if (profile === 'd3d11') app.commandLine.appendSwitch('use-angle', 'd3d11');
  else if (profile === 'no-overlays') app.commandLine.appendSwitch('disable-features', 'DirectCompositionVideoOverlays');
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  const cdpPort = !app.isPackaged && process.env.CRISTI_CDP_PORT;
  if (cdpPort && /^\d{4,5}$/.test(cdpPort)) {
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
        allowServiceWorkers: false,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        bypassCSP: false,
      },
    },
  ]);
}

export const registerProtocolHandler = registerAppProtocol;

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

  let shutdownComplete = false;
  app.on('before-quit', event => {
    if (shutdownComplete) return;
    event.preventDefault();
    void handleShutdown().finally(() => { shutdownComplete = true; app.quit(); });
  });
  app.on('window-all-closed', async () => {
    await handleShutdown();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
