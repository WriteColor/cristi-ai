/**
 * ClickThroughService — Compatibility shim.
 *
 * The Win32 HTTP-based click-through system (Python/C# helper + IPC polling) has been
 * replaced by Electron's native setIgnoreMouseEvents IPC via useClickThrough hook.
 *
 * This file exists only to prevent import errors in legacy code.
 * It is safe to remove once all usages have been updated to use ElectronBridge directly.
 */

import { electronBridge } from './ElectronBridge.js';

export class ClickThroughService {
  constructor() {
    this._boxes = new Map();
  }

  registerHitbox(id, box) {
    if (!id || !box) return;
    this._boxes.set(id, box);
    this.syncHitboxes();
  }

  unregisterHitbox(id) {
    if (this._boxes.has(id)) {
      this._boxes.delete(id);
      this.syncHitboxes();
    }
  }

  syncHitboxes() {
    try {
      const hitboxes = Array.from(this._boxes.values());
      electronBridge.syncHitboxes(hitboxes);
    } catch (_) {}
  }

  async setEnabled() {}
  async init() { return true; }
  destroy() {
    this._boxes.clear();
    this.syncHitboxes();
  }
}

export const clickThroughService = new ClickThroughService();
export default clickThroughService;
