/**
 * Cristi AI - Wallpaper Engine Extreme Scene Integration Layer
 * Scans, indexes, and streams Wallpaper Engine scene assets (videos, web, shaders, gifs)
 * directly to the Cristi background engine with zero overhead.
 */

import { electronBridge } from './desktop/ElectronBridge.js';
import { logger } from './logger.js';
import { eventBus, EVENTS } from './eventBus.js';

const STORAGE_KEY_WPE_CACHE = 'cristi_ai_wpe_cache_v1';

export class WallpaperEngineService {
  constructor() {
    this.wallpapers = this.loadCachedWallpapers();
    this.isScanning = false;
    this.hasAutoScanned = false;
    this.listeners = new Set();
  }

  loadCachedWallpapers() {
    try {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem(STORAGE_KEY_WPE_CACHE);
        if (cached) {
          return JSON.parse(cached);
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

    // If cache exists and has items, return immediately and do non-blocking background refresh
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
    }, 2000);
  }

  /**
   * Full scan of Wallpaper Engine projects
   */
  async scan() {
    if (this.isScanning) return this.wallpapers;
    this.isScanning = true;

    try {
      if (typeof window !== 'undefined' && window.electronAPI?.scanWallpaperEngine) {
        const results = await window.electronAPI.scanWallpaperEngine();
        if (Array.isArray(results) && results.length > 0) {
          this.wallpapers = results;
          this.saveCachedWallpapers(results);
          logger.info('SCENE', `Wallpaper Engine detectado: ${results.length} fondos importados.`);
          this.notify();
          eventBus.emit(EVENTS.WPE_WALLPAPERS_UPDATED, results);
          return results;
        }
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
