/**
 * Cristi AI - Cinematic Background Scene & Atmosphere Manager (TypeScript)
 * Manages built-in atmospheric scenes, custom media, and transparent companion mode.
 *
 * Architecture:
 * - selectedSceneId: The configured atmospheric scene (e.g. 'deep_nebula', 'cyber_loft').
 *   Persisted across sessions and never overwritten by transparent mode.
 * - isSceneVisible: Whether the background scene is active (opaque) or transparent.
 *   Toggled via toolbar button without losing the selected scene.
 */

import { BACKGROUND_SCENES, DEFAULT_SCENE_ID } from '../../config/scenes';
import { eventBus, EVENTS } from '../../infrastructure/events/eventBus';
import { logger } from '../../infrastructure/logging/logger';

export type SceneCategory = 'cyberpunk' | 'anime_lofi' | 'nature_ambient' | 'custom';
export type SceneType = 'procedural' | 'video' | 'animated' | 'image' | 'transparent' | 'custom';

export interface SceneState {
  sceneId: string;
  selectedSceneId: string;
  customUrl: string;
  sceneType: SceneType;
  isTransparent: boolean;
  isSceneVisible: boolean;
}

export interface CustomSceneItem {
  id: string;
  name: string;
  url?: string;
  filePath?: string;
  fileUrl?: string;
  mainPath?: string;
  previewPath?: string;
  type?: 'video' | 'animated' | 'image';
  description?: string;
}

export interface AvailableSceneInfo {
  id: string;
  name: string;
  category: string;
  type: string;
  url?: string;
  mainPath?: string;
  previewPath?: string;
  previewColor?: string;
  description: string;
}

const STORAGE_KEY_SELECTED_SCENE = 'cristi_ai_selected_scene_v3';
const STORAGE_KEY_SCENE_VISIBLE = 'cristi_ai_scene_visible_v3';
const STORAGE_KEY_CUSTOM_URL = 'cristi_ai_custom_scene_url_v2';
const STORAGE_KEY_CUSTOM_LIST = 'cristi_ai_custom_scenes_list_v2';

export class SceneManager {
  public selectedSceneId: string;
  public isSceneVisible: boolean;
  public customSceneUrl: string;
  public customScenesList: CustomSceneItem[];
  private listeners = new Set<(scene: SceneState) => void>();

  constructor() {
    this.selectedSceneId = this.loadSavedSelectedScene();
    this.isSceneVisible = this.loadSavedSceneVisibility();
    this.customSceneUrl = this.loadSavedCustomUrl();
    this.customScenesList = this.loadSavedCustomList();
  }

  private loadSavedSelectedScene(): string {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_SELECTED_SCENE) || localStorage.getItem('cristi_ai_scene_v2');
        if (saved && saved !== 'transparent') return saved;
      }
    } catch (_) {}
    return DEFAULT_SCENE_ID;
  }

  private loadSavedSceneVisibility(): boolean {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_SCENE_VISIBLE);
        if (saved !== null) return saved === 'true';
      }
    } catch (_) {}
    return false; // By default on desktop launch: transparent companion mode
  }

  private loadSavedCustomUrl(): string {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(STORAGE_KEY_CUSTOM_URL) || '';
      }
    } catch (_) {}
    return '';
  }

  private loadSavedCustomList(): CustomSceneItem[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_LIST);
        if (saved) return JSON.parse(saved) as CustomSceneItem[];
      }
    } catch (_) {}
    return [];
  }

  private saveCustomList(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CUSTOM_LIST, JSON.stringify(this.customScenesList));
      }
    } catch (_) {}
  }

  private saveState(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SELECTED_SCENE, this.selectedSceneId);
        localStorage.setItem(STORAGE_KEY_SCENE_VISIBLE, this.isSceneVisible ? 'true' : 'false');
        localStorage.setItem(STORAGE_KEY_CUSTOM_URL, this.customSceneUrl);
      }
    } catch (_) {}
  }

  public getScene(): SceneState {
    let customUrl = this.customSceneUrl;
    let sceneType: SceneType = 'procedural';

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
        customUrl = customItem.url || customItem.mainPath || '';
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

  public getAvailableScenes(): AvailableSceneInfo[] {
    const customScenes: AvailableSceneInfo[] = this.customScenesList.map((s) => ({
      id: s.id,
      name: s.name,
      category: 'custom',
      type: s.type || 'video',
      url: s.url || s.mainPath || '',
      mainPath: s.url || s.mainPath || '',
      previewPath: s.previewPath || s.url || s.mainPath || '',
      description: s.description || 'Fondo importado por el usuario'
    }));

    // Filter out any legacy 'transparent' from list
    const builtIn: AvailableSceneInfo[] = BACKGROUND_SCENES.filter((s) => s.id !== 'transparent').map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      type: s.type,
      previewColor: s.previewColor,
      description: s.description
    }));
    return [...builtIn, ...customScenes];
  }

  public addCustomScene(sceneData: Partial<CustomSceneItem> & { name?: string; url?: string; filePath?: string; fileUrl?: string }): void {
    const id = sceneData.id || `custom_${Date.now()}`;
    const url = sceneData.url || sceneData.filePath || sceneData.fileUrl || '';
    const newScene: CustomSceneItem = {
      id,
      name: sceneData.name || 'Fondo Personalizado',
      url,
      mainPath: url,
      type: sceneData.type || 'video',
      previewPath: sceneData.previewPath || url,
      description: sceneData.description || 'Fondo importado por el usuario'
    };

    this.customScenesList = [newScene, ...this.customScenesList.filter((s) => s.id !== id)];
    this.saveCustomList();
    this.setScene(id, newScene.url);
  }

  public removeCustomScene(id: string): void {
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
  public setScene(sceneId: string, customUrl = ''): void {
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
   */
  public toggleBackdrop(): boolean {
    this.isSceneVisible = !this.isSceneVisible;
    this.saveState();
    logger.info('SCENE', `Alternancia de fondo: ${this.isSceneVisible ? `Escena "${this.selectedSceneId}" visible` : 'Transparente'}`);
    eventBus.emit(EVENTS.SCENE_CHANGED, this.getScene());
    this.notify();
    return this.isSceneVisible;
  }

  public setTransparent(enabled: boolean): void {
    this.isSceneVisible = !enabled;
    this.saveState();
    eventBus.emit(EVENTS.SCENE_CHANGED, this.getScene());
    this.notify();
  }

  public onSceneChange(callback: (scene: SceneState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
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
