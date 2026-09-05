import { electronBridge } from '../desktop/ElectronBridge.js';

/**
 * Persistence port for memory records. The default adapter keeps the current
 * Electron JSON/localStorage behavior; SQLite/FTS/vector adapters can replace
 * it without changing MemoryService's domain rules.
 */
export class MemoryRepository {
  constructor({ storageKey = 'cristi_ai_memories_v2', filename = 'cristi-memories.json', bridge = electronBridge } = {}) {
    this.storageKey = storageKey;
    this.filename = filename;
    this.bridge = bridge;
  }

  async load() {
    if (this.bridge?.isElectron) {
      try {
        const fileData = await this.bridge.readFile(this.filename);
        const parsed = fileData ? JSON.parse(fileData) : null;
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const local = window.localStorage.getItem(this.storageKey);
        const parsed = local ? JSON.parse(local) : null;
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
    }
    return null;
  }

  async save(memories) {
    const data = JSON.stringify(Array.isArray(memories) ? memories : [], null, 2);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(this.storageKey, data);
    }
    if (this.bridge?.isElectron) await this.bridge.writeFile(this.filename, data);
    return true;
  }
}

export default MemoryRepository;
