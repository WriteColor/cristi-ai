/**
 * Cristi AI - Minecraft Companion Service (AIRI Inspired)
 * High-level companion bot controller enabling Cristi to play Minecraft alongside the user.
 * Supports navigation, pathfinding, chatting, mining, building, combat, and environment perception.
 */

import { electronBridge } from '../desktop/ElectronBridge.js';
import { logger } from '../logger.js';
import { eventBus, EVENTS } from '../eventBus.js';

export class MinecraftCompanionService {
  constructor() {
    this.storageKey = 'cristi_minecraft_config';
    this.config = {
      host: 'localhost',
      port: 25565,
      username: 'Cristi_AI',
      version: false, // auto-detect
      autoConnect: false,
      followDistance: 3,
      defendCreator: true
    };

    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
    this.botState = {
      health: 20,
      food: 20,
      position: { x: 0, y: 0, z: 0 },
      dimension: 'overworld',
      inventory: [],
      nearbyPlayers: [],
      nearbyEntities: []
    };

    this.chatHistory = [];
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          this.config = { ...this.config, ...JSON.parse(stored) };
        }
      }
    } catch (e) {
      console.warn('[Minecraft] Error loading config:', e);
    }
  }

  getBotState() {
    return { ...this.botState };
  }

  saveConfig(newConfig = {}) {
    this.config = { ...this.config, ...newConfig };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.config));
      }
      if (electronBridge?.isElectron) {
        electronBridge.saveMinecraftConfig?.(this.config);
      }
    } catch (e) {
      console.warn('[Minecraft] Error saving config:', e);
    }
  }

  async connect(options = {}) {
    const opts = { ...this.config, ...options };
    this.status = 'connecting';
    logger.info('MINECRAFT', `Conectando al servidor ${opts.host}:${opts.port} con usuario "${opts.username}"...`);

    try {
      if (electronBridge?.isElectron) {
        const res = await electronBridge.minecraftConnect(opts);
        if (res && res.success) {
          this.status = 'connected';
          logger.info('MINECRAFT', '✓ Conexión establecida con el servidor de Minecraft.');
          return { status: 'success', message: `Conectada al servidor ${opts.host}:${opts.port} como ${opts.username}.` };
        } else {
          this.status = 'error';
          logger.error('MINECRAFT', 'Fallo al conectar:', res?.error);
          return { status: 'error', message: res?.error || 'Error de conexión.' };
        }
      }

      this.status = 'connected';
      return { status: 'success', message: 'Simulación de Minecraft Companion activa.' };
    } catch (err) {
      this.status = 'error';
      logger.error('MINECRAFT', 'Error crítico conectando a Minecraft:', err);
      return { status: 'error', message: err.message };
    }
  }

  async disconnect() {
    this.status = 'disconnected';
    logger.info('MINECRAFT', 'Desconectando bot de Minecraft...');
    try {
      if (electronBridge?.isElectron) {
        await electronBridge.minecraftDisconnect();
      }
      return { status: 'success', message: 'Bot desconectado del servidor de Minecraft.' };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async sendChat(message) {
    if (!message) return;
    logger.info('MINECRAFT', `Enviando chat in-game: "${message}"`);
    try {
      if (electronBridge?.isElectron) {
        await electronBridge.minecraftChat(message);
      }
      this.chatHistory.push({ sender: this.config.username, message, time: new Date().toLocaleTimeString() });
      return { status: 'success', message: `Mensaje enviado al chat: "${message}"` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async getStatus() {
    try {
      if (electronBridge?.isElectron) {
        const liveStatus = await electronBridge.minecraftGetStatus();
        if (liveStatus) {
          this.botState = { ...this.botState, ...liveStatus };
          this.status = liveStatus.status || this.status;
        }
      }
      return {
        status: this.status,
        bot: this.botState
      };
    } catch (err) {
      return { status: this.status, bot: this.botState, error: err.message };
    }
  }

  async moveTo(x, y, z) {
    logger.info('MINECRAFT', `Navegando a coordenadas: X=${x}, Y=${y}, Z=${z}`);
    try {
      if (electronBridge?.isElectron) {
        return await electronBridge.minecraftMoveTo({ x, y, z });
      }
      return { status: 'success', message: `Moviéndose a ${x}, ${y}, ${z}` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async followPlayer(playerName) {
    const target = playerName || 'creator';
    logger.info('MINECRAFT', `Siguiendo al jugador: ${target}`);
    try {
      if (electronBridge?.isElectron) {
        return await electronBridge.minecraftFollow(target);
      }
      return { status: 'success', message: `Siguiendo a ${target}.` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async stop() {
    logger.info('MINECRAFT', 'Deteniendo movimiento y acciones del bot.');
    try {
      if (electronBridge?.isElectron) {
        return await electronBridge.minecraftStop();
      }
      return { status: 'success', message: 'Bot detenido.' };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async mineBlock(x, y, z) {
    logger.info('MINECRAFT', `Minando bloque en ${x}, ${y}, ${z}`);
    try {
      if (electronBridge?.isElectron) {
        return await electronBridge.minecraftMineBlock({ x, y, z });
      }
      return { status: 'success', message: `Bloque minado en ${x}, ${y}, ${z}.` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async placeBlock(x, y, z, blockName) {
    logger.info('MINECRAFT', `Colocando bloque ${blockName} en ${x}, ${y}, ${z}`);
    try {
      if (electronBridge?.isElectron) {
        return await electronBridge.minecraftPlaceBlock({ x, y, z, blockName });
      }
      return { status: 'success', message: `Bloque colocado en ${x}, ${y}, ${z}.` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async attackEntity(entityName) {
    logger.info('MINECRAFT', `Atacando entidad objetivo: ${entityName}`);
    try {
      if (electronBridge?.isElectron) {
        return await electronBridge.minecraftAttack(entityName);
      }
      return { status: 'success', message: `Atacando a ${entityName}.` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }
}

export const minecraftCompanion = new MinecraftCompanionService();
