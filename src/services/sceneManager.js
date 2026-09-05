/**
 * Cristi AI - Cinematic Background Scene & Atmosphere Manager
 * Manages built-in atmospheric scenes, custom media, and transparent companion mode.
 *
 * Architecture:
 * - selectedSceneId: The configured atmospheric scene (e.g. 'deep_nebula', 'cyber_loft').
 *   Persisted across sessions and never overwritten by transparent mode.
 * - isSceneVisible: Whether the background scene is active (opaque) or transparent.
 *   Toggled via toolbar button without losing the selected scene.
 */

import { BACKGROUND_SCENES, DEFAULT_SCENE_ID } from '../config/scenes.js';
import { eventBus, EVENTS } from './eventBus.js';
import { logger } from './logger.js';

const STORAGE_KEY_SELECTED_SCENE = 'cristi_ai_selected_scene_v3';
const STORAGE_KEY_SCENE_VISIBLE = 'cristi_ai_scene_visible_v3';
const STORAGE_KEY_CUSTOM_URL = 'cristi_ai_custom_scene_url_v2';
const STORAGE_KEY_CUSTOM_LIST = 'cristi_ai_custom_scenes_list_v2';

export class SceneManager {
  constructor() {
    this.selectedSceneId = this.loadSavedSelectedScene();
    this.isSceneVisible = this.loadSavedSceneVisibility();
    this.customSceneUrl = this.loadSavedCustomUrl();
    this.customScenesList = this.loadSavedCustomList();
    this.listeners = new Set();
  }

  loadSavedSelectedScene() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_SELECTED_SCENE) || localStorage.getItem('cristi_ai_scene_v2');
        if (saved && saved !== 'transparent') return saved;
      }
    } catch (_) {}
    return DEFAULT_SCENE_ID;
  }

  loadSavedSceneVisibility() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_SCENE_VISIBLE);
        if (saved !== null) return saved === 'true';
      }
    } catch (_) {}
    return false; // By default on desktop launch: transparent companion mode
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

  saveState() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SELECTED_SCENE, this.selectedSceneId);
        localStorage.setItem(STORAGE_KEY_SCENE_VISIBLE, this.isSceneVisible ? 'true' : 'false');
        localStorage.setItem(STORAGE_KEY_CUSTOM_URL, this.customSceneUrl);
      }
    } catch (_) {}
  }

  getScene() {
    let customUrl = this.customSceneUrl;
    let sceneType = 'procedural';

    if (!this.isSceneVisible) {
      return {
        sceneId: 'transparent',
        selectedSceneId: this.selectedSceneId,
        customUrl: '',
        sceneType: 'transparent',
        isTransparent: true,
        isSceneVisible: false
      };
    }

    if (this.selectedSceneId === 'custom_wallpaper') {
      sceneType = 'custom';
    } else {
      const customItem = this.customScenesList.find((s) => s.id === this.selectedSceneId);
      if (customItem) {
        customUrl = customItem.url || customItem.mainPath;
        sceneType = customItem.type || 'video';
      }
    }

    return {
      sceneId: this.selectedSceneId,
      selectedSceneId: this.selectedSceneId,
      customUrl,
      sceneType,
      isTransparent: false,
      isSceneVisible: true
    };
  }

  getAvailableScenes() {
    const customScenes = this.customScenesList.map((s) => ({
      id: s.id,
      name: s.name,
      category: 'custom',
      type: s.type || 'video',
      mainPath: s.url || s.mainPath,
      previewPath: s.previewPath || s.url || s.mainPath,
      description: s.description || 'Fondo importado por el usuario'
    }));

    // Filter out any legacy 'transparent' from list
    const builtIn = BACKGROUND_SCENES.filter((s) => s.id !== 'transparent');
    return [...builtIn, ...customScenes];
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

    this.customScenesList = [newScene, ...this.customScenesList.filter((s) => s.id !== id)];
    this.saveCustomList();
    this.setScene(id, newScene.url);
  }

  removeCustomScene(id) {
    this.customScenesList = this.customScenesList.filter((s) => s.id !== id);
    this.saveCustomList();
    if (this.selectedSceneId === id) {
      this.setScene(DEFAULT_SCENE_ID);
    } else {
      this.notify();
    }
  }

  /**
   * Set and immediately activate an atmospheric scene.
   * Selecting a scene automatically sets isSceneVisible = true.
   */
  setScene(sceneId, customUrl = '') {
    if (sceneId === 'transparent') {
      this.isSceneVisible = false;
      this.saveState();
      logger.info('SCENE', 'Fondo transparente activado (Desktop Mate)');
      eventBus.emit(EVENTS.SCENE_CHANGED, this.getScene());
      this.notify();
      return;
    }

    const allScenes = this.getAvailableScenes();
    const matched = allScenes.find((s) => s.id === sceneId);

    if (!matched && sceneId !== 'custom_wallpaper') {
      sceneId = DEFAULT_SCENE_ID;
    }

    this.selectedSceneId = sceneId;
    this.isSceneVisible = true;

    if (matched && matched.category === 'custom') {
      this.customSceneUrl = matched.mainPath || customUrl || '';
    } else if (customUrl !== undefined && customUrl !== '') {
      this.customSceneUrl = customUrl;
    } else if (sceneId !== 'custom_wallpaper') {
      this.customSceneUrl = '';
    }

    this.saveState();
    logger.info('SCENE', `Escena seleccionada y activada: ${sceneId} (${this.customSceneUrl})`);
    eventBus.emit(EVENTS.SCENE_CHANGED, this.getScene());
    this.notify();
  }

  /**
   * Toggle between the configured active scene and transparent desktop mate mode.
   * @returns {boolean} New isSceneVisible state
   */
  toggleBackdrop() {
    this.isSceneVisible = !this.isSceneVisible;
    this.saveState();
    logger.info('SCENE', `Alternancia de fondo: ${this.isSceneVisible ? `Escena "${this.selectedSceneId}" visible` : 'Transparente'}`);
    eventBus.emit(EVENTS.SCENE_CHANGED, this.getScene());
    this.notify();
    return this.isSceneVisible;
  }

  setTransparent(enabled) {
    this.isSceneVisible = !enabled;
    this.saveState();
    eventBus.emit(EVENTS.SCENE_CHANGED, this.getScene());
    this.notify();
  }

  onSceneChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    const state = this.getScene();
    this.listeners.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        console.error('[SceneManager] Error en callback de listener:', err);
      }
    });
  }
}

export const sceneManager = new SceneManager();
export default sceneManager;
