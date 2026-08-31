/**
 * Cristi AI - Cinematic Background Scene & Atmosphere Manager
 * Manages built-in procedural scenes and custom imported media scenes (local videos/images & direct URLs)
 */

import { BACKGROUND_SCENES, DEFAULT_SCENE_ID } from '../config/scenes.js';
import { eventBus, EVENTS } from './eventBus.js';
import { logger } from './logger.js';

const STORAGE_KEY_SCENE = 'cristi_ai_scene_v2';
const STORAGE_KEY_CUSTOM_URL = 'cristi_ai_custom_scene_url_v2';
const STORAGE_KEY_CUSTOM_LIST = 'cristi_ai_custom_scenes_list_v2';

export class SceneManager {
  constructor() {
    this.currentSceneId = this.loadSavedScene();
    this.customSceneUrl = this.loadSavedCustomUrl();
    this.customScenesList = this.loadSavedCustomList();
    this.listeners = new Set();
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

  loadSavedCustomList() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_LIST);
        if (saved) return JSON.parse(saved);
      }
    } catch (_) {}
    return [];
  }

  saveCustomList() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CUSTOM_LIST, JSON.stringify(this.customScenesList));
      }
    } catch (_) {}
  }

  getScene() {
    let customUrl = this.customSceneUrl;
    let sceneType = 'procedural';

    if (this.currentSceneId === 'custom_wallpaper') {
      sceneType = 'custom';
    } else {
      const customItem = this.customScenesList.find(s => s.id === this.currentSceneId);
      if (customItem) {
        customUrl = customItem.url || customItem.mainPath;
        sceneType = customItem.type || 'video';
      }
    }

    return {
      sceneId: this.currentSceneId,
      customUrl,
      sceneType,
      isTransparent: this.currentSceneId === 'transparent'
    };
  }

  getAvailableScenes() {
    const customScenes = this.customScenesList.map(s => ({
      id: s.id,
      name: s.name,
      category: 'custom',
      type: s.type || 'video',
      mainPath: s.url || s.mainPath,
      previewPath: s.previewPath || s.url || s.mainPath,
      description: s.description || 'Fondo importado por el usuario'
    }));

    return [...BACKGROUND_SCENES, ...customScenes];
  }

  addCustomScene(sceneData) {
    const id = sceneData.id || `custom_${Date.now()}`;
    const newScene = {
      id,
      name: sceneData.name || 'Fondo Personalizado',
      url: sceneData.url || sceneData.filePath || sceneData.fileUrl,
      type: sceneData.type || 'video',
      previewPath: sceneData.previewPath || sceneData.url || sceneData.filePath || sceneData.fileUrl,
      description: sceneData.description || 'Fondo importado por el usuario'
    };

    this.customScenesList = [newScene, ...this.customScenesList.filter(s => s.id !== id)];
    this.saveCustomList();
    this.setScene(id, newScene.url);
  }

  removeCustomScene(id) {
    this.customScenesList = this.customScenesList.filter(s => s.id !== id);
    this.saveCustomList();
    if (this.currentSceneId === id) {
      this.setScene(DEFAULT_SCENE_ID);
    } else {
      this.notify();
    }
  }

  setScene(sceneId, customUrl = '') {
    const allScenes = this.getAvailableScenes();
    const matched = allScenes.find(s => s.id === sceneId);

    if (!matched && sceneId !== 'transparent' && sceneId !== 'custom_wallpaper') {
      sceneId = DEFAULT_SCENE_ID;
    }

    this.currentSceneId = sceneId;

    if (matched && matched.category === 'custom') {
      this.customSceneUrl = matched.mainPath || customUrl || '';
    } else if (customUrl !== undefined && customUrl !== '') {
      this.customSceneUrl = customUrl;
    } else if (sceneId !== 'custom_wallpaper') {
      this.customSceneUrl = '';
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SCENE, sceneId);
        localStorage.setItem(STORAGE_KEY_CUSTOM_URL, this.customSceneUrl);
      }
    } catch (_) {}

    logger.info('SCENE', `Escena de fondo cambiada a: ${sceneId} (${this.customSceneUrl})`);
    eventBus.emit(EVENTS.SCENE_CHANGED, this.getScene());
    this.notify();
  }

  setTransparent(enabled) {
    if (enabled) {
      this.setScene('transparent');
    } else {
      const saved = this.loadSavedScene();
      this.setScene(saved === 'transparent' ? DEFAULT_SCENE_ID : saved);
    }
  }

  onSceneChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    const state = this.getScene();
    this.listeners.forEach(cb => {
      try {
        cb(state);
      } catch (err) {
        logger.error('SCENE', 'Error en callback de onSceneChange', { error: err.message });
      }
    });
  }
}

export const sceneManager = new SceneManager();
export default sceneManager;
