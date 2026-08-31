/**
 * Cristi Desktop - Resilient Configuration & Backup Manager
 * Handles auto-backups, profile validation, JSON export/import, and settings integrity.
 */

import { logger } from './logger.js';

const STORAGE_KEY_CONFIG = 'cristi_ai_settings_v1';
const STORAGE_KEY_BACKUPS = 'cristi_ai_settings_backups_v1';
const MAX_BACKUP_HISTORY = 10;

export class ConfigManager {
  constructor() {
    this.storageKey = STORAGE_KEY_CONFIG;
    this._memoryStore = {};
  }

  _getStorage() {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
    return {
      getItem: (k) => this._memoryStore[k] || null,
      setItem: (k, v) => { this._memoryStore[k] = String(v); },
      removeItem: (k) => { delete this._memoryStore[k]; }
    };
  }

  /**
   * Loads current persistent configuration with automatic fallback defaults.
   */
  loadConfig(defaultConfig = {}) {
    try {
      const storage = this._getStorage();
      const raw = storage.getItem(this.storageKey);
      if (!raw) return { ...defaultConfig };
      const parsed = JSON.parse(raw);
      return { ...defaultConfig, ...parsed };
    } catch (err) {
      logger.error('CONFIG', `Error al parsear configuración local: ${err.message}. Restaurando valores por defecto.`);
      return { ...defaultConfig };
    }
  }

  /**
   * Saves configuration and generates an automatic timestamped backup point.
   */
  saveConfig(newConfig) {
    try {
      const sanitized = this.sanitizeConfig(newConfig);
      const storage = this._getStorage();
      storage.setItem(this.storageKey, JSON.stringify(sanitized));

      // Auto-create snapshot in history
      this.createBackupSnapshot(sanitized, 'auto_save');
      return { success: true, config: sanitized };
    } catch (err) {
      logger.error('CONFIG', `Error al guardar configuración: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Sanitizes and validates configuration object against expected schema.
   */
  sanitizeConfig(config) {
    return {
      apiKey: typeof config.apiKey === 'string' ? config.apiKey.trim() : '',
      modelId: typeof config.modelId === 'string' ? config.modelId : 'gemini-2.0-flash-exp',
      live2dModelId: typeof config.live2dModelId === 'string' ? config.live2dModelId : 'yanderegirl',
      voiceName: typeof config.voiceName === 'string' ? config.voiceName : 'Aoede',
      temperature: typeof config.temperature === 'number' ? Math.max(0, Math.min(2, config.temperature)) : 0.75,
      systemPrompt: typeof config.systemPrompt === 'string' ? config.systemPrompt : '',
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Creates an internal backup snapshot stored in localStorage.
   */
  createBackupSnapshot(config, label = 'manual') {
    try {
      const storage = this._getStorage();
      const historyRaw = storage.getItem(STORAGE_KEY_BACKUPS);
      const history = historyRaw ? JSON.parse(historyRaw) : [];

      const snapshot = {
        id: `backup_${Date.now()}`,
        timestamp: new Date().toISOString(),
        label,
        config: { ...config }
      };

      const updatedHistory = [snapshot, ...history].slice(0, MAX_BACKUP_HISTORY);
      storage.setItem(STORAGE_KEY_BACKUPS, JSON.stringify(updatedHistory));
      return snapshot;
    } catch (err) {
      logger.warn('CONFIG', `No se pudo crear punto de restauración: ${err.message}`);
      return null;
    }
  }

  /**
   * Gets list of available backup snapshots.
   */
  getBackupHistory() {
    try {
      const storage = this._getStorage();
      const historyRaw = storage.getItem(STORAGE_KEY_BACKUPS);
      return historyRaw ? JSON.parse(historyRaw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Exports configuration to downloadable JSON string.
   */
  exportConfigJSON() {
    const current = this.loadConfig();
    const exportPayload = {
      app: 'Cristi Desktop',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      config: current
    };
    return JSON.stringify(exportPayload, null, 2);
  }

  /**
   * Imports configuration from JSON string with strict validation.
   */
  importConfigJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      const configData = parsed.config || parsed;

      if (!configData || typeof configData !== 'object') {
        throw new Error('Estructura de archivo de configuración inválida.');
      }

      const sanitized = this.sanitizeConfig(configData);
      this.saveConfig(sanitized);
      return { success: true, config: sanitized };
    } catch (err) {
      logger.error('CONFIG', `Error al importar archivo de configuración: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

export const configManager = new ConfigManager();
export default configManager;
