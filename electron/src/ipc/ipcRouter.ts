import { disposeCapabilities } from '../security/CapabilityRouter';
import { registerWindowIpc, stopHitboxTracking } from './windowIpc';
import { registerSystemIpc } from './systemIpc';
import { registerAudioIpc } from './audioIpc';
import { registerMemoryIpc } from './memoryIpc';
import { registerSecurityIpc } from './securityIpc';
import { registerMcpIpc } from './mcpIpc';
import { registerIntegrationsIpc } from './integrationsIpc';

let handlersRegistered = false;

/**
 * Registers all strongly-typed Electron IPC handlers in a modular and centralized architecture.
 */
export function registerAllIpcHandlers(rootDir: string): void {
  if (handlersRegistered) return;

  registerWindowIpc();
  registerSystemIpc(rootDir);
  registerAudioIpc(rootDir);
  registerMemoryIpc();
  registerSecurityIpc();
  registerMcpIpc();
  registerIntegrationsIpc();

  handlersRegistered = true;
  console.log('[IPCRouter] ✓ All modular IPC domain handlers registered successfully.');
}

/**
 * Teardown helper for hot reloads or test environments.
 */
export function unregisterAllIpcHandlers(): void {
  stopHitboxTracking();
  disposeCapabilities();
  handlersRegistered = false;
}
