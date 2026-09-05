/**
 * Cristi AI - Discord Companion Service (AIRI Inspired)
 * High-level Discord bot integration enabling Cristi to interact, chat, listen, and participate in Discord servers and channels.
 */

import { electronBridge } from '../desktop/ElectronBridge.js';
import { logger } from '../logger.js';
import { eventBus, EVENTS } from '../eventBus.js';

export class DiscordCompanionService {
  constructor() {
    this.storageKey = 'cristi_discord_config';
    this.config = {
      botToken: '',
      autoReply: true,
      monitoredChannels: [], // array of channel IDs
      statusMessage: 'Conectada con Jeremy | Cristi AI',
      activityType: 'Playing', // 'Playing' | 'Listening' | 'Watching'
      prefix: '!cristi'
    };

    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
    this.botInfo = null;
    this.recentMessages = [];
    this.maxRecentMessages = 200;
    this.unsubscribeMessage = electronBridge?.onDiscordMessage?.((message) => {
      const item = { ...message, receivedAt: Date.now() };
      this.recentMessages.push(item);
      if (this.recentMessages.length > this.maxRecentMessages) this.recentMessages.shift();
      eventBus.emitDomain(EVENTS.DISCORD_MESSAGE, item, {
        source: 'discord',
        privacy: 'external',
        sessionId: `discord_${message.channelId || 'unknown'}`
      });
    });
    this.unsubscribeEvent = electronBridge?.onDiscordEvent?.((event) => {
      eventBus.emitDomain(`discord.${event?.type || 'event'}`, event || {}, {
        source: 'discord', privacy: 'internal'
      });
      if (event?.type === 'disconnect' || event?.type === 'error') this.status = 'error';
    });

    this.loadConfig();
  }

  loadConfig() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(this.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Older builds used `token`; normalize it once at the boundary so
          // every caller can rely on the canonical `botToken` field.
          this.config = {
            ...this.config,
            ...parsed,
            botToken: parsed.botToken || parsed.token || this.config.botToken
          };
        }
      }
    } catch (e) {
      console.warn('[Discord] Error loading config:', e);
    }
  }

  saveConfig(newConfig = {}) {
    this.config = { ...this.config, ...newConfig };
    const { botToken, ...safeConfig } = this.config;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(safeConfig));
      }
      if (electronBridge?.isElectron) {
        electronBridge.saveDiscordConfig?.(safeConfig);
      }
    } catch (e) {
      console.warn('[Discord] Error saving config:', e);
    }
  }

  async connect(token = null) {
    let activeToken = token || this.config.botToken;
    if (!activeToken && electronBridge?.isElectron) {
      activeToken = await electronBridge.getSecureSecret('discord.botToken');
    }
    if (!activeToken) {
      return { status: 'error', message: 'Por favor ingresa un Bot Token de Discord válido en la configuración.' };
    }

    // Keep the in-memory configuration in sync with a token entered from the
    // settings screen. Persistence remains in the OS secure store below.
    this.config.botToken = activeToken;

    this.status = 'connecting';
    logger.info('DISCORD', 'Iniciando conexión con Discord Gateway...');
    if (electronBridge?.isElectron) {
      await electronBridge.setSecureSecret('discord.botToken', activeToken);
    }

    try {
      if (electronBridge?.isElectron) {
        const res = await electronBridge.discordConnect({
          token: activeToken,
          statusMessage: this.config.statusMessage,
          activityType: this.config.activityType
        });

        if (res && res.success) {
          this.status = 'connected';
          this.botInfo = res.botInfo;
          eventBus.emitDomain(EVENTS.DISCORD_CONNECTED, { bot: res.botInfo }, {
            source: 'discord', privacy: 'internal'
          });
          logger.info('DISCORD', `✓ Conectado exitosamente como ${res.botInfo?.tag || 'Cristi Bot'}`);
          return { status: 'success', bot: res.botInfo, message: `Conectado como ${res.botInfo?.tag}` };
        } else {
          this.status = 'error';
          logger.error('DISCORD', 'Fallo de autenticación Discord:', res?.error);
          return { status: 'error', message: res?.error || 'Token inválido o error de Discord.' };
        }
      }

      this.status = 'connected';
      return { status: 'success', message: 'Simulación de Discord Bot activa.' };
    } catch (err) {
      this.status = 'error';
      logger.error('DISCORD', 'Error crítico en Discord:', err);
      return { status: 'error', message: err.message };
    }
  }

  async disconnect() {
    this.status = 'disconnected';
    this.botInfo = null;
    logger.info('DISCORD', 'Desconectando bot de Discord...');
    try {
      if (electronBridge?.isElectron) {
        await electronBridge.discordDisconnect();
      }
      eventBus.emitDomain(EVENTS.DISCORD_DISCONNECTED, {}, { source: 'discord', privacy: 'internal' });
      return { status: 'success', message: 'Bot de Discord desconectado.' };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async sendMessage(channelId, content) {
    if (!channelId || !content) {
      return { status: 'error', message: 'Canal o mensaje inválido.' };
    }

    logger.info('DISCORD', `Enviando mensaje al canal ${channelId}: "${content}"`);
    try {
      if (electronBridge?.isElectron) {
        return await electronBridge.discordSendMessage({ channelId, content });
      }
      return { status: 'success', message: `Mensaje enviado al canal ${channelId}.` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async getRecentMessages(channelId, limit = 10) {
    try {
      if (electronBridge?.isElectron) {
        return await electronBridge.discordGetMessages({ channelId, limit });
      }
      return { status: 'success', messages: [] };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async setStatus(statusText, activityType = 'Playing') {
    this.config.statusMessage = statusText;
    this.config.activityType = activityType;
    this.saveConfig();

    try {
      if (electronBridge?.isElectron) {
        await electronBridge.discordSetStatus({ statusText, activityType });
      }
      return { status: 'success', message: `Estado actualizado a "${statusText}"` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  getRecentLocalMessages({ channelId = null, limit = 20 } = {}) {
    const filtered = channelId
      ? this.recentMessages.filter((message) => message.channelId === channelId)
      : this.recentMessages;
    return filtered.slice(-Math.min(100, Math.max(1, limit)));
  }

  destroy() {
    this.unsubscribeMessage?.();
    this.unsubscribeMessage = null;
    this.unsubscribeEvent?.();
    this.unsubscribeEvent = null;
  }
}

export const discordCompanion = new DiscordCompanionService();
