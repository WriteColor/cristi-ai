/**
 * Cristi AI - Cinematic Background Scene & Atmosphere Manager
 * Controls persistent background scenes, cinematic loop rendering, and desktop opacity mode.
 */

import { BACKGROUND_SCENES, DEFAULT_SCENE_ID } from '../config/scenes.js';
import { eventBus, EVENTS } from './eventBus.js';
import { logger } from './logger.js';

const STORAGE_KEY_SCENE = 'cristi_ai_scene_v1';
const STORAGE_KEY_CUSTOM_URL = 'cristi_ai_custom_scene_url_v1';

export class SceneManager {
  constructor() {
    this.currentSceneId = this.loadSavedScene();
    this.customSceneUrl = this.loadSavedCustomUrl();
    this.listeners = new Set();
  }

  loadSavedScene() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_SCENE);
        if (saved && BACKGROUND_SCENES.some(s => s.id === saved)) {
          return saved;
        }
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
    return {
      sceneId: this.currentSceneId,
      customUrl: this.customSceneUrl,
      isTransparent: this.currentSceneId === 'transparent'
    };
  }

  getAvailableScenes() {
    return BACKGROUND_SCENES;
  }

  setScene(sceneId, customUrl = '') {
    if (!BACKGROUND_SCENES.some(s => s.id === sceneId)) {
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

    const payload = this.getScene();
    eventBus.emit(EVENTS.SCENE_STATE_CHANGED, payload);

    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch (_) {}
    }

    logger.info('SCENE', `Escena de fondo cambiada a: ${sceneId}`);
    return true;
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
