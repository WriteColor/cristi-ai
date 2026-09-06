/**
 * Cristi AI - Minecraft Companion Service (AIRI Inspired)
 * High-level companion bot controller enabling Cristi to play Minecraft alongside the user.
 * Supports navigation, pathfinding, chatting, mining, building, combat, and environment perception.
 */

import { electronBridge } from '../desktop/ElectronBridge.js';
import { logger } from '../logger.js';
import { eventBus, EVENTS } from '../eventBus.js';

export class MinecraftCompanionService {
  constructor({ bridge = electronBridge, bus = eventBus } = {}) {
    this.bridge = bridge;
    this.bus = bus;
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
    this.maxChatHistory = 200;
    this.reconnectPolicy = {
      enabled: true,
      maxAttempts: 8,
      baseDelayMs: 1000,
      maxDelayMs: 30000
    };
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.sessionId = null;
    this.transportConnectionId = null;
    this.unsubscribeEvent = this.bridge?.onMinecraftEvent?.((event) => {
      // Retired Mineflayer instances can emit `end` after their replacement
      // is already connected. Ignore those events before they affect state.
      if (event?.connectionId && event.connectionId !== this.transportConnectionId) return;

      if (event?.type === 'health') {
        if (event.health !== undefined) this.botState.health = event.health;
        if (event.food !== undefined) this.botState.food = event.food;
      } else if (event?.type === 'death') {
        this.botState.health = 0;
      } else if (event?.type === 'hurt') {
        if (event.health !== undefined) this.botState.health = event.health;
      }

      const perception = this.getPerceptionSummary();
      this.bus.emitDomain(EVENTS.GAME_EVENT, {
        game: 'minecraft', eventType: event?.type || 'unknown', payload: event || {}, perception, sessionId: this.sessionId
      }, { source: 'minecraft', sessionId: this.sessionId, privacy: 'external' });

      if (event?.type === 'health' && (event.health ?? 20) <= 6 && (event.health ?? 20) > 0) {
        this.bus.emitDomain('game.threat_alert', {
          game: 'minecraft', alertType: 'low_health', health: event.health, perception, sessionId: this.sessionId
        }, { source: 'minecraft', priority: 'high', privacy: 'external' });
      } else if (event?.type === 'death') {
        this.bus.emitDomain('game.threat_alert', {
          game: 'minecraft', alertType: 'bot_death', perception, sessionId: this.sessionId
        }, { source: 'minecraft', priority: 'high', privacy: 'external' });
      }

      if (['end', 'kicked', 'error', 'disconnect'].includes(event?.type)) {
        this.status = 'error';
        this.scheduleReconnect(this.config, event?.message || event?.reason || 'desconexión inesperada');
      }
    });
    this.unsubscribeChat = this.bridge?.onMinecraftChat?.((message) => {
      if (message?.connectionId && message.connectionId !== this.transportConnectionId) return;
      const item = { ...message, receivedAt: Date.now() };
      this.chatHistory.push(item);
      if (this.chatHistory.length > this.maxChatHistory) this.chatHistory.shift();
      this.bus.emitDomain(EVENTS.GAME_EVENT, {
        game: 'minecraft', eventType: 'chat_message', payload: item, sessionId: this.sessionId
      }, { source: 'minecraft', sessionId: this.sessionId, privacy: 'external' });
    });
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

  getPerceptionSummary() {
    const { health, food, position, dimension, nearbyPlayers, nearbyEntities, inventory } = this.botState;
    const threats = (nearbyEntities || []).filter((e) => e.isHostile || ['creeper', 'zombie', 'skeleton', 'spider', 'witch', 'enderman', 'phantom', 'drowned'].includes((e.name || '').toLowerCase()));
    const items = (inventory || []).slice(0, 10).map((i) => `${i.name} (${i.count})`);

    const parts = [
      `Salud: ${health ?? 20}/20`,
      `Comida: ${food ?? 20}/20`,
      `Posición: [${position?.x ?? 0}, ${position?.y ?? 0}, ${position?.z ?? 0}] (${dimension || 'overworld'})`
    ];

    if (nearbyPlayers && nearbyPlayers.length > 0) {
      parts.push(`Jugadores cerca: ${nearbyPlayers.join(', ')}`);
    }

    if (threats.length > 0) {
      const threatDesc = threats.slice(0, 3).map((t) => `${t.name} a ${t.distance}m`).join(', ');
      parts.push(`¡Amenazas!: ${threatDesc}`);
    } else {
      parts.push('Sin amenazas inmediatas');
    }

    if (items.length > 0) {
      parts.push(`Inventario: ${items.join(', ')}`);
    }

    const narrative = parts.join(' | ');

    return {
      status: this.status,
      health: health ?? 20,
      food: food ?? 20,
      isLowHealth: (health ?? 20) <= 6,
      position: position || { x: 0, y: 0, z: 0 },
      dimension: dimension || 'overworld',
      threats,
      nearbyPlayers: nearbyPlayers || [],
      inventorySummary: items,
      narrative
    };
  }

  updateBotState(partialState = {}) {
    this.botState = { ...this.botState, ...partialState };
    const perception = this.getPerceptionSummary();
    this.bus.emitDomain(EVENTS.GAME_STATE_CHANGED, {
      game: 'minecraft',
      state: this.botState,
      perception,
      sessionId: this.sessionId
    }, {
      source: 'minecraft',
      sessionId: this.sessionId,
      privacy: 'external'
    });
    return this.botState;
  }

  saveConfig(newConfig = {}) {
    this.config = { ...this.config, ...newConfig };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.config));
      }
      if (this.bridge?.isElectron) {
        this.bridge.saveMinecraftConfig?.(this.config);
      }
    } catch (e) {
      console.warn('[Minecraft] Error saving config:', e);
    }
  }

  async connect(options = {}) {
    this.reconnectPolicy.enabled = true;
    if (this.status === 'connected' || this.status === 'connecting') {
      return { status: 'success', message: 'El bot de Minecraft ya está conectado o conectándose.' };
    }
    const opts = { ...this.config, ...options };
    this.config = { ...this.config, ...options };
    if (!this.sessionId) {
      this.sessionId = `minecraft_${opts.host || 'localhost'}_${opts.port || 25565}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    this.status = 'connecting';
    logger.info('MINECRAFT', `Conectando al servidor ${opts.host}:${opts.port} con usuario "${opts.username}"...`);

    try {
      if (this.bridge?.isElectron) {
        this.transportConnectionId = null;
        const res = await this.bridge.minecraftConnect(opts);
        if (res && res.success) {
          this.status = 'connected';
          this.transportConnectionId = res.connectionId || null;
          this.reconnectAttempts = 0;
          this.bus.emitDomain(EVENTS.GAME_CONNECTED, { game: 'minecraft', host: opts.host, port: opts.port, sessionId: this.sessionId, connectionId: this.transportConnectionId }, {
            source: 'minecraft', sessionId: this.sessionId, privacy: 'internal'
          });
          logger.info('MINECRAFT', '✓ Conexión establecida con el servidor de Minecraft.');
          return { status: 'success', sessionId: this.sessionId, message: `Conectada al servidor ${opts.host}:${opts.port} como ${opts.username}.` };
        } else {
          this.status = 'error';
          this.scheduleReconnect(opts, res?.error || 'Error de conexión.');
          logger.error('MINECRAFT', 'Fallo al conectar:', res?.error);
          return { status: 'error', message: res?.error || 'Error de conexión.' };
        }
      }

      this.status = 'connected';
      this.bus.emitDomain(EVENTS.GAME_CONNECTED, { game: 'minecraft', host: opts.host, port: opts.port, sessionId: this.sessionId, connectionId: null }, {
        source: 'minecraft', sessionId: this.sessionId, privacy: 'internal'
      });
      return { status: 'success', sessionId: this.sessionId, message: 'Simulación de Minecraft Companion activa.' };
    } catch (err) {
      this.status = 'error';
      this.scheduleReconnect(opts, err.message);
      logger.error('MINECRAFT', 'Error crítico conectando a Minecraft:', err);
      return { status: 'error', message: err.message };
    }
  }

  async disconnect() {
    this.reconnectPolicy.enabled = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.status = 'disconnected';
    this.transportConnectionId = null;
    const sessionId = this.sessionId;
    logger.info('MINECRAFT', 'Desconectando bot de Minecraft...');
    try {
      if (this.bridge?.isElectron) {
        await this.bridge.minecraftDisconnect();
      }
      this.bus.emitDomain(EVENTS.GAME_DISCONNECTED, { game: 'minecraft', sessionId }, {
        source: 'minecraft', sessionId, privacy: 'internal'
      });
      this.sessionId = null;
      return { status: 'success', message: 'Bot desconectado del servidor de Minecraft.' };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async sendChat(message) {
    if (!message) return;
    logger.info('MINECRAFT', `Enviando chat in-game: "${message}"`);
    try {
      if (this.bridge?.isElectron) {
        await this.bridge.minecraftChat(message);
      }
      this.chatHistory.push({ sender: this.config.username, message, time: new Date().toLocaleTimeString() });
      return { status: 'success', message: `Mensaje enviado al chat: "${message}"` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async getStatus() {
    try {
      if (this.bridge?.isElectron) {
        const liveStatus = await this.bridge.minecraftGetStatus();
        if (liveStatus) {
          if (liveStatus.connectionId && liveStatus.connectionId !== this.transportConnectionId) {
            return { status: this.status, sessionId: this.sessionId, bot: this.botState, perception: this.getPerceptionSummary(), staleStatusIgnored: true };
          }
          this.botState = { ...this.botState, ...liveStatus };
          this.status = liveStatus.status || this.status;
          const perception = this.getPerceptionSummary();
          this.bus.emitDomain(EVENTS.GAME_STATE_CHANGED, { game: 'minecraft', state: this.botState, perception, sessionId: this.sessionId }, {
            source: 'minecraft', sessionId: this.sessionId, privacy: 'external'
          });
        }
      }
      return {
        status: this.status,
        sessionId: this.sessionId,
        bot: this.botState,
        perception: this.getPerceptionSummary()
      };
    } catch (err) {
      return { status: this.status, bot: this.botState, perception: this.getPerceptionSummary(), error: err.message };
    }
  }

  scheduleReconnect(options, reason = 'desconexión') {
    if (!this.reconnectPolicy.enabled || this.reconnectTimer || this.status === 'connected') return;
    if (this.reconnectAttempts >= this.reconnectPolicy.maxAttempts) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(
      this.reconnectPolicy.maxDelayMs,
      this.reconnectPolicy.baseDelayMs * (2 ** (this.reconnectAttempts - 1))
    );
    logger.warn('MINECRAFT', `Reintento ${this.reconnectAttempts}/${this.reconnectPolicy.maxAttempts} en ${delay}ms: ${reason}`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.status === 'disconnected' || !this.reconnectPolicy.enabled) return;
      this.status = 'disconnected';
      await this.connect(options);
    }, delay);
  }

  destroy() {
    this.reconnectPolicy.enabled = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.unsubscribeChat?.();
    this.unsubscribeChat = null;
    this.unsubscribeEvent?.();
    this.unsubscribeEvent = null;
  }

  async moveTo(x, y, z) {
    logger.info('MINECRAFT', `Navegando a coordenadas: X=${x}, Y=${y}, Z=${z}`);
    try {
      if (this.bridge?.isElectron) {
        return await this.bridge.minecraftMoveTo({ x, y, z });
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
      if (this.bridge?.isElectron) {
        return await this.bridge.minecraftFollow(target);
      }
      return { status: 'success', message: `Siguiendo a ${target}.` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async stop() {
    logger.info('MINECRAFT', 'Deteniendo movimiento y acciones del bot.');
    try {
      if (this.bridge?.isElectron) {
        return await this.bridge.minecraftStop();
      }
      return { status: 'success', message: 'Bot detenido.' };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async mineBlock(x, y, z) {
    logger.info('MINECRAFT', `Minando bloque en ${x}, ${y}, ${z}`);
    try {
      if (this.bridge?.isElectron) {
        return await this.bridge.minecraftMineBlock({ x, y, z });
      }
      return { status: 'success', message: `Bloque minado en ${x}, ${y}, ${z}.` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async placeBlock(x, y, z, blockName) {
    logger.info('MINECRAFT', `Colocando bloque ${blockName} en ${x}, ${y}, ${z}`);
    try {
      if (this.bridge?.isElectron) {
        return await this.bridge.minecraftPlaceBlock({ x, y, z, blockName });
      }
      return { status: 'success', message: `Bloque colocado en ${x}, ${y}, ${z}.` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async attackEntity(entityName) {
    logger.info('MINECRAFT', `Atacando entidad objetivo: ${entityName}`);
    try {
      if (this.bridge?.isElectron) {
        return await this.bridge.minecraftAttack(entityName);
      }
      return { status: 'success', message: `Atacando a ${entityName}.` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }
}

export const minecraftCompanion = new MinecraftCompanionService();
