/**
 * Cristi AI - Wallpaper Engine Extreme Scene Integration Layer
 * Scans, indexes, and streams Wallpaper Engine scene assets (videos, web, shaders, gifs)
 * directly to the Cristi background engine with zero overhead.
 */

import { logger } from './logger.js';
import { eventBus, EVENTS } from './eventBus.js';

const STORAGE_KEY_WPE_CACHE = 'cristi_ai_wpe_cache_v2'; // Bump version to clear any stale cache

export class WallpaperEngineService {
  constructor() {
    this.wallpapers = this.loadCachedWallpapers();
    this.isScanning = false;
    this.hasAutoScanned = false;
    this.listeners = new Set();
  }

  normalizeItem(item) {
    if (!item) return null;
    let mainPath = item.mainPath || '';
    let previewPath = item.previewPath || '';

    // Unwrap any double-encoded or file:/// URLs
    if (mainPath) {
      while (mainPath.startsWith('/__wpe_media?path=')) {
        mainPath = decodeURIComponent(mainPath.replace('/__wpe_media?path=', ''));
      }
      mainPath = mainPath.replace(/^file:\/\/\//, '');
      mainPath = `/__wpe_media?path=${encodeURIComponent(mainPath)}`;
    }

    if (previewPath) {
      while (previewPath.startsWith('/__wpe_media?path=')) {
        previewPath = decodeURIComponent(previewPath.replace('/__wpe_media?path=', ''));
      }
      previewPath = previewPath.replace(/^file:\/\/\//, '');
      previewPath = `/__wpe_media?path=${encodeURIComponent(previewPath)}`;
    }

    return {
      ...item,
      mainPath,
      previewPath: previewPath || mainPath
    };
  }

  loadCachedWallpapers() {
    try {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem(STORAGE_KEY_WPE_CACHE);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map(this.normalizeItem.bind(this));
          }
        }
      }
    } catch (_) {}
    return [];
  }

  saveCachedWallpapers(list) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_WPE_CACHE, JSON.stringify(list));
      }
    } catch (_) {}
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    listener(this.wallpapers);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.wallpapers);
      } catch (_) {}
    }
  }

  /**
   * Auto-scan once on boot with zero runtime CPU impact
   */
  async autoScanOnce() {
    if (this.hasAutoScanned) return this.wallpapers;
    this.hasAutoScanned = true;

    if (this.wallpapers.length > 0) {
      this.scanInBackground();
      return this.wallpapers;
    }

    return this.scan();
  }

  async scanInBackground() {
    setTimeout(async () => {
      try {
        await this.scan();
      } catch (_) {}
    }, 1000);
  }

  /**
   * Full scan of Wallpaper Engine projects across Steam libraries
   */
  async scan() {
    if (this.isScanning) return this.wallpapers;
    this.isScanning = true;

    try {
      let results = [];

      // 1. Try Native Electron IPC Scanner
      if (typeof window !== 'undefined' && window.electronAPI?.scanWallpaperEngine) {
        try {
          const rawResults = await window.electronAPI.scanWallpaperEngine();
          if (Array.isArray(rawResults) && rawResults.length > 0) {
            results = rawResults.map(this.normalizeItem.bind(this));
          }
        } catch (_) {}
      }

      // 2. Fallback to Vite Dev Server Scanner
      if (results.length === 0 && typeof window !== 'undefined' && window.fetch) {
        try {
          const response = await fetch('/__wpe_scan');
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              results = data.map(this.normalizeItem.bind(this));
            }
          }
        } catch (_) {}
      }

      if (results.length > 0) {
        this.wallpapers = results;
        this.saveCachedWallpapers(results);
        logger.info('SCENE', `Wallpaper Engine sincronizado: ${results.length} fondos listos.`);
        this.notify();
        eventBus.emit(EVENTS.WPE_WALLPAPERS_UPDATED, results);
        return results;
      }
    } catch (err) {
      logger.warn('SCENE', `Error escaneando Wallpaper Engine: ${err.message}`);
    } finally {
      this.isScanning = false;
    }

    return this.wallpapers;
  }

  getWallpapers() {
    return this.wallpapers;
  }
}

export const wallpaperEngineService = new WallpaperEngineService();
export default wallpaperEngineService;
