/**
 * Cristi AI - Cinematic Background Scene & Atmosphere Manager
 * Controls persistent background scenes, cinematic loop rendering, desktop opacity mode,
 * and extreme Wallpaper Engine scene streaming.
 */

import { BACKGROUND_SCENES, DEFAULT_SCENE_ID } from '../config/scenes.js';
import { wallpaperEngineService } from './wallpaperEngineService.js';
import { eventBus, EVENTS } from './eventBus.js';
import { logger } from './logger.js';

const STORAGE_KEY_SCENE = 'cristi_ai_scene_v1';
const STORAGE_KEY_CUSTOM_URL = 'cristi_ai_custom_scene_url_v1';

export class SceneManager {
  constructor() {
    this.currentSceneId = this.loadSavedScene();
    this.customSceneUrl = this.loadSavedCustomUrl();
    this.listeners = new Set();

    // Auto-scan Wallpaper Engine once in background
    wallpaperEngineService.autoScanOnce().then(() => {
      this.notify();
    });

    wallpaperEngineService.subscribe(() => {
      this.notify();
    });
  }

  loadSavedScene() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_SCENE);
        if (saved) return saved;
      }
    } catch (_) {}
    return DEFAULT_SCENE_ID;
  }

  loadSavedCustomUrl() {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(STORAGE_KEY_CUSTOM_URL) || '';
      }
    } catch (_) {}
    return '';
  }

  getScene() {
    const isWpe = this.currentSceneId.startsWith('wpe_');
    let customUrl = this.customSceneUrl;
    let sceneType = 'procedural';

    if (isWpe) {
      const wpeItem = wallpaperEngineService.getWallpapers().find(w => w.id === this.currentSceneId);
      if (wpeItem && wpeItem.mainPath) {
        customUrl = wpeItem.mainPath;
        sceneType = wpeItem.type || 'video';
      }
    }

    return {
      sceneId: this.currentSceneId,
      customUrl,
      sceneType,
      isWpe,
      isTransparent: this.currentSceneId === 'transparent'
    };
  }

  getAvailableScenes() {
    const wpeScenes = wallpaperEngineService.getWallpapers().map(w => ({
      id: w.id,
      name: `[WPE] ${w.name}`,
      category: 'wallpaper_engine',
      type: w.type || 'video',
      mainPath: w.mainPath,
      previewPath: w.previewPath,
      description: w.description || 'Fondo importado desde Wallpaper Engine'
    }));

    return [...BACKGROUND_SCENES, ...wpeScenes];
  }

  setScene(sceneId, customUrl = '') {
    const allScenes = this.getAvailableScenes();
    const matched = allScenes.find(s => s.id === sceneId);

    if (!matched && sceneId !== 'transparent' && sceneId !== 'custom_wallpaper') {
      sceneId = DEFAULT_SCENE_ID;
    }

    this.currentSceneId = sceneId;
    if (customUrl !== undefined) {
      this.customSceneUrl = customUrl;
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SCENE, sceneId);
        if (customUrl !== undefined) {
          localStorage.setItem(STORAGE_KEY_CUSTOM_URL, this.customSceneUrl);
        }
      }
    } catch (err) {
      logger.warn('SCENE', `Error guardando escena: ${err.message}`);
    }

    this.notify();
    logger.info('SCENE', `Escena de fondo cambiada a: ${sceneId}`);
    return true;
  }

  notify() {
    const payload = this.getScene();
    eventBus.emit(EVENTS.SCENE_STATE_CHANGED, payload);

    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch (_) {}
    }
  }

  onSceneChange(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    listener(this.getScene());
    return () => this.listeners.delete(listener);
  }
}

export const sceneManager = new SceneManager();
export default sceneManager;
