/**
 * Cristi AI - Discord Companion Service (AIRI Inspired)
 * High-level Discord bot integration enabling Cristi to interact, chat, listen, and participate in Discord servers and channels.
 */

import { electronBridge } from '../desktop/ElectronBridge.js';
import { logger } from '../logger.js';
import { eventBus, EVENTS } from '../eventBus.js';

function normalizeDiscordConfig(value = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const monitoredChannels = Array.isArray(input.monitoredChannels)
    ? [...new Set(input.monitoredChannels
      .map((channelId) => String(channelId || '').trim())
      .filter((channelId) => /^\d{5,32}$/.test(channelId)))].slice(0, 100)
    : [];
  return {
    botToken: typeof input.botToken === 'string' ? input.botToken.trim() : '',
    autoReply: input.autoReply === true,
    monitoredChannels,
    statusMessage: typeof input.statusMessage === 'string' && input.statusMessage.trim()
      ? input.statusMessage.trim().slice(0, 128)
      : 'Conectada con Jeremy | Cristi AI',
    activityType: ['Playing', 'Listening', 'Watching'].includes(input.activityType) ? input.activityType : 'Playing',
    prefix: typeof input.prefix === 'string' && input.prefix.trim() ? input.prefix.trim().slice(0, 32) : '!cristi'
  };
}

export class DiscordCompanionService {
  constructor({ bridge = electronBridge, bus = eventBus } = {}) {
    this.bridge = bridge;
    this.bus = bus;
    this.storageKey = 'cristi_discord_config';
    this.config = {
      botToken: '',
      autoReply: false,
      monitoredChannels: [], // array of channel IDs
      statusMessage: 'Conectada con Jeremy | Cristi AI',
      activityType: 'Playing', // 'Playing' | 'Listening' | 'Watching'
      prefix: '!cristi'
    };

    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
    this.botInfo = null;
    this.transportConnectionId = null;
    this.recentMessages = [];
    this.maxRecentMessages = 200;
    this.unsubscribeMessage = this.bridge?.onDiscordMessage?.((message) => {
      if (message?.connectionId && message.connectionId !== this.transportConnectionId) return;
      const item = { ...message, receivedAt: Date.now() };
      this.recentMessages.push(item);
      if (this.recentMessages.length > this.maxRecentMessages) this.recentMessages.shift();
      const autoReplyEligible = this.isAutoReplyEligible(message.channelId);
      this.bus.emitDomain(EVENTS.DISCORD_MESSAGE, { ...item, autoReplyEligible }, {
        source: 'discord',
        privacy: 'external',
        sessionId: `discord_${message.channelId || 'unknown'}`
      });
    });
    this.unsubscribeEvent = this.bridge?.onDiscordEvent?.((event) => {
      if (event?.connectionId && event.connectionId !== this.transportConnectionId) return;
      this.bus.emitDomain(`discord.${event?.type || 'event'}`, event || {}, {
        source: 'discord', privacy: 'internal'
      });
      if (event?.type === 'disconnect' || event?.type === 'reconnecting') this.status = 'reconnecting';
      if (event?.type === 'ready') this.status = 'connected';
      if (event?.type === 'error') this.status = 'error';
    });

    this.unsubscribeConfig = this.bridge?.onConfigUpdated?.((config) => {
      if (config?.discord) this.applyConfig(config.discord, { preserveToken: true });
    });

    this.loadConfig();
    if (this.bridge?.isElectron && this.bridge.getAppConfig) {
      void this.bridge.getAppConfig()
        .then((config) => { if (config?.discord) this.applyConfig(config.discord, { preserveToken: true }); })
        .catch(() => {});
    }
  }

  loadConfig() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(this.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Older builds used `token`; normalize it once at the boundary so
          // every caller can rely on the canonical `botToken` field.
          this.applyConfig({ ...parsed, botToken: parsed.botToken || parsed.token || this.config.botToken });
        }
      }
    } catch (e) {
      console.warn('[Discord] Error loading config:', e);
    }
  }

  saveConfig(newConfig = {}) {
    this.applyConfig(newConfig);
    const { botToken, ...safeConfig } = this.config;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(safeConfig));
      }
      if (this.bridge?.isElectron && this.bridge.getAppConfig && this.bridge.saveAppConfig) {
        void this.bridge.getAppConfig()
          .then((current) => this.bridge.saveAppConfig({ ...(current || {}), discord: safeConfig }))
          .catch(() => {});
      }
    } catch (e) {
      console.warn('[Discord] Error saving config:', e);
    }
  }

  applyConfig(nextConfig = {}, { preserveToken = false } = {}) {
    const merged = normalizeDiscordConfig({ ...this.config, ...nextConfig });
    this.config = {
      ...merged,
      botToken: preserveToken ? this.config.botToken : (typeof nextConfig.botToken === 'string' ? nextConfig.botToken.trim() : this.config.botToken)
    };
    const { botToken, ...safeConfig } = this.config;
    this.bus.emitDomain('discord.configuration_changed', safeConfig, { source: 'discord', privacy: 'internal' });
    return { ...this.config };
  }

  isAutoReplyEligible(channelId) {
    if (!this.config.autoReply) return false;
    const id = String(channelId || '').trim();
    return Boolean(id && this.config.monitoredChannels.includes(id));
  }

  async connect(token = null) {
    let activeToken = token || this.config.botToken;
    if (!activeToken && this.bridge?.isElectron) {
      activeToken = await this.bridge.getSecureSecret('discord.botToken');
    }
    if (!activeToken) {
      return { status: 'error', message: 'Por favor ingresa un Bot Token de Discord válido en la configuración.' };
    }

    // Keep the in-memory configuration in sync with a token entered from the
    // settings screen. Persistence remains in the OS secure store below.
    this.config.botToken = activeToken;

    this.status = 'connecting';
    logger.info('DISCORD', 'Iniciando conexión con Discord Gateway...');
    if (this.bridge?.isElectron) {
      await this.bridge.setSecureSecret('discord.botToken', activeToken);
    }

    try {
      if (this.bridge?.isElectron) {
        this.transportConnectionId = null;
        const res = await this.bridge.discordConnect({
          token: activeToken,
          statusMessage: this.config.statusMessage,
          activityType: this.config.activityType
        });

        if (res && res.success) {
          this.status = 'connected';
          this.transportConnectionId = res.connectionId || null;
          this.botInfo = res.botInfo;
          this.bus.emitDomain(EVENTS.DISCORD_CONNECTED, { bot: res.botInfo, connectionId: this.transportConnectionId }, {
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
    this.transportConnectionId = null;
    logger.info('DISCORD', 'Desconectando bot de Discord...');
    try {
      if (this.bridge?.isElectron) {
        await this.bridge.discordDisconnect();
      }
      this.bus.emitDomain(EVENTS.DISCORD_DISCONNECTED, {}, { source: 'discord', privacy: 'internal' });
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
      if (this.bridge?.isElectron) {
        return await this.bridge.discordSendMessage({ channelId, content });
      }
      return { status: 'success', message: `Mensaje enviado al canal ${channelId}.` };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async getRecentMessages(channelId, limit = 10) {
    try {
      if (this.bridge?.isElectron) {
        return await this.bridge.discordGetMessages({ channelId, limit });
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
      if (this.bridge?.isElectron) {
        await this.bridge.discordSetStatus({ statusText, activityType });
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
    this.unsubscribeConfig?.();
    this.unsubscribeConfig = null;
  }
}

export const discordCompanion = new DiscordCompanionService();
