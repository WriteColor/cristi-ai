/**
 * Cristi Desktop - Resilient Configuration & Backup Manager
 * Handles auto-backups, profile validation, JSON export/import, quota recovery, and settings integrity.
 */

import { logger } from './logger.js';

const STORAGE_KEY_CONFIG = 'cristi_ai_settings_v1';
const STORAGE_KEY_BACKUPS = 'cristi_ai_settings_backups_v1';
const MAX_BACKUP_HISTORY = 10;

export class ConfigManager {
  constructor() {
    this.storageKey = STORAGE_KEY_CONFIG;
    this.backupsKey = STORAGE_KEY_BACKUPS;
    this._memoryStore = {};
  }

  _getStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        // Test localStorage accessibility (handles Safari private mode / blocked storage)
        const testKey = '__storage_test__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        return localStorage;
      }
    } catch (_) {
      // Fallback to in-memory store
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
      if (!raw) return this.sanitizeConfig(defaultConfig);

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        logger.warn('CONFIG', 'Formato de configuración local anómalo. Usando valores por defecto.');
        return this.sanitizeConfig(defaultConfig);
      }

      return this.sanitizeConfig({ ...defaultConfig, ...parsed });
    } catch (err) {
      logger.error('CONFIG', `Error al parsear configuración local: ${err.message}. Restaurando valores por defecto.`);
      return this.sanitizeConfig(defaultConfig);
    }
  }

  /**
   * Saves configuration and generates an automatic timestamped backup point.
   */
  saveConfig(newConfig) {
    const sanitized = this.sanitizeConfig(newConfig);
    const storage = this._getStorage();

    try {
      storage.setItem(this.storageKey, JSON.stringify(sanitized));
      // Auto-create snapshot in history
      this.createBackupSnapshot(sanitized, 'auto_save');
      return { success: true, config: sanitized };
    } catch (err) {
      logger.warn('CONFIG', `Fallo al escribir en localStorage (${err.message}). Intentando recuperación de cuota...`);

      // Quota recovery strategy: purge old backups and retry
      try {
        storage.removeItem(this.backupsKey);
        storage.setItem(this.storageKey, JSON.stringify(sanitized));
        return { success: true, config: sanitized };
      } catch (retryErr) {
        // Final fallback: save in session memory store
        this._memoryStore[this.storageKey] = JSON.stringify(sanitized);
        logger.error('CONFIG', `Cuota de almacenamiento agotada; configuración retenida en memoria de sesión: ${retryErr.message}`);
        return { success: true, config: sanitized, fallback: 'memory' };
      }
    }
  }

  /**
   * Sanitizes and validates configuration object against expected schema.
   */
  sanitizeConfig(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      config = {};
    }

    return {
      apiKey: typeof config.apiKey === 'string' ? config.apiKey.trim() : '',
      modelId: typeof config.modelId === 'string' && config.modelId.trim() ? config.modelId.trim() : 'gemini-2.0-flash-exp',
      live2dModelId: typeof config.live2dModelId === 'string' && config.live2dModelId.trim() ? config.live2dModelId.trim() : 'yanderegirl',
      voiceName: typeof config.voiceName === 'string' && config.voiceName.trim() ? config.voiceName.trim() : 'Aoede',
      temperature: typeof config.temperature === 'number' && !isNaN(config.temperature) ? Math.max(0, Math.min(2, config.temperature)) : 0.75,
      systemPrompt: typeof config.systemPrompt === 'string' ? config.systemPrompt : '',
      updatedAt: config.updatedAt && typeof config.updatedAt === 'string' ? config.updatedAt : new Date().toISOString()
    };
  }

  /**
   * Creates an internal backup snapshot stored in localStorage.
   */
  createBackupSnapshot(config, label = 'manual') {
    try {
      const storage = this._getStorage();
      const historyRaw = storage.getItem(this.backupsKey);
      let history = [];

      try {
        const parsedHistory = historyRaw ? JSON.parse(historyRaw) : [];
        if (Array.isArray(parsedHistory)) {
          history = parsedHistory;
        }
      } catch {
        history = [];
      }

      const snapshot = {
        id: `backup_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        label,
        config: { ...config }
      };

      const updatedHistory = [snapshot, ...history].slice(0, MAX_BACKUP_HISTORY);
      storage.setItem(this.backupsKey, JSON.stringify(updatedHistory));
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
      const historyRaw = storage.getItem(this.backupsKey);
      if (!historyRaw) return [];
      const parsed = JSON.parse(historyRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Restores a configuration from a specific backup ID.
   */
  restoreBackup(backupId) {
    try {
      const history = this.getBackupHistory();
      const found = history.find(b => b.id === backupId);
      if (!found || !found.config) {
        throw new Error(`Punto de restauración "${backupId}" no encontrado.`);
      }
      return this.saveConfig(found.config);
    } catch (err) {
      logger.error('CONFIG', `Error al restaurar copia de seguridad: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Exports configuration to downloadable JSON string.
   */
  exportConfigJSON() {
    const current = this.loadConfig();
    const exportPayload = {
      app: 'Cristi AI Companion',
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
      if (typeof jsonString !== 'string' || !jsonString.trim()) {
        throw new Error('El contenido del archivo está vacío o no es una cadena de texto.');
      }

      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Formato JSON inválido.');
      }

      const configToImport = parsed.config || parsed;
      if (!configToImport || typeof configToImport !== 'object') {
        throw new Error('No se encontró un bloque de configuración válido en el archivo.');
      }

      const sanitized = this.sanitizeConfig(configToImport);
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
