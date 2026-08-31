/**
 * ClickThroughService — Compatibility shim.
 *
 * The Win32 HTTP-based click-through system (Python/C# helper + IPC polling) has been
 * replaced by Electron's native setIgnoreMouseEvents IPC via useClickThrough hook.
 *
 * This file exists only to prevent import errors in legacy code.
 * It is safe to remove once all usages have been updated to use ElectronBridge directly.
 */

export class ClickThroughService {
  registerHitbox() {}
  unregisterHitbox() {}
  syncHitboxes() {}
  async setEnabled() {}
  async init() { return true; }
  destroy() {}
}

export const clickThroughService = new ClickThroughService();
export default clickThroughService;
