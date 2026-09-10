/**
 * Cristi AI - Discord Companion Service (AIRI Inspired)
 * High-level Discord bot integration enabling Cristi to interact, chat, listen, and participate in Discord servers and channels.
 */

import { electronBridge } from '../../../services/desktop/ElectronBridge';
import { logger } from '../../../infrastructure/logging/logger';
import { eventBus, EVENTS } from '../../../infrastructure/events/eventBus';

export interface DiscordConfig {
  botToken: string;
  autoReply: boolean;
  monitoredChannels: string[];
  statusMessage: string;
  activityType: 'Playing' | 'Listening' | 'Watching' | string;
  prefix: string;
}

export interface DiscordMessage {
  id?: string;
  channelId?: string;
  authorId?: string;
  authorTag?: string;
  content?: string;
  isMentioned?: boolean;
  isDirectMessage?: boolean;
  receivedAt?: number;
  connectionId?: string;
  [key: string]: unknown;
}

export interface DiscordBotInfo {
  id?: string;
  username?: string;
  tag?: string;
  avatar?: string;
}

function normalizeDiscordConfig(value: unknown = {}): DiscordConfig {
  const input = (value && typeof value === 'object' && !Array.isArray(value)) ? (value as Record<string, unknown>) : {};
  const monitoredChannels = Array.isArray(input.monitoredChannels)
    ? [...new Set(input.monitoredChannels
      .map((channelId) => String(channelId || '').trim())
      .filter((channelId) => /^\d{5,32}$/.test(channelId)))].slice(0, 100)
    : [];
  return {
    botToken: '',
    autoReply: input.autoReply === true,
    monitoredChannels,
    statusMessage: typeof input.statusMessage === 'string' && input.statusMessage.trim()
      ? input.statusMessage.trim().slice(0, 128)
      : 'Conectada con Jeremy | Cristi AI',
    activityType: ['Playing', 'Listening', 'Watching'].includes(String(input.activityType)) ? String(input.activityType) : 'Playing',
    prefix: typeof input.prefix === 'string' && input.prefix.trim() ? input.prefix.trim().slice(0, 32) : '!cristi'
  };
}

export class DiscordCompanionService {
  private bridge: typeof electronBridge;
  private bus: typeof eventBus;
  private storageKey = 'cristi_discord_config';
  public config: DiscordConfig;
  public status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' = 'disconnected';
  public botInfo: DiscordBotInfo | null = null;
  public transportConnectionId: string | null = null;
  public recentMessages: DiscordMessage[] = [];
  public maxRecentMessages = 200;

  private unsubscribeMessage: (() => void) | null = null;
  private unsubscribeEvent: (() => void) | null = null;
  private unsubscribeConfig: (() => void) | null = null;

  constructor({ bridge = electronBridge, bus = eventBus }: { bridge?: typeof electronBridge; bus?: typeof eventBus } = {}) {
    this.bridge = bridge;
    this.bus = bus;
    this.config = {
      botToken: '',
      autoReply: false,
      monitoredChannels: [],
      statusMessage: 'Conectada con Jeremy | Cristi AI',
      activityType: 'Playing',
      prefix: '!cristi'
    };

    this.unsubscribeMessage = this.bridge?.onDiscordMessage?.((rawMessage: unknown) => {
      const message = rawMessage as DiscordMessage;
      if (message?.connectionId && message.connectionId !== this.transportConnectionId) return;
      const item: DiscordMessage = { ...message, receivedAt: Date.now() };
      this.recentMessages.push(item);
      if (this.recentMessages.length > this.maxRecentMessages) this.recentMessages.shift();
      const autoReplyEligible = this.isAutoReplyEligible(message.channelId, message);
      const correlationId = message?.id ? `discord_${message.id}` : undefined;
      this.bus.emitDomain(EVENTS.DISCORD_MESSAGE, { ...item, autoReplyEligible }, {
        source: 'discord',
        privacy: 'external',
        sessionId: `discord_${message.channelId || 'unknown'}`,
        correlationId
      });
    }) || null;

    this.unsubscribeEvent = this.bridge?.onDiscordEvent?.((rawEvent: unknown) => {
      const event = rawEvent as { type?: string; connectionId?: string };
      if (event?.connectionId && event.connectionId !== this.transportConnectionId) return;
      this.bus.emitDomain(`discord.${event?.type || 'event'}`, event || {}, {
        source: 'discord', privacy: 'internal'
      });
      if (event?.type === 'disconnect' || event?.type === 'reconnecting') this.status = 'reconnecting';
      if (event?.type === 'ready') this.status = 'connected';
      if (event?.type === 'error') this.status = 'error';
    }) || null;

    this.unsubscribeConfig = this.bridge?.onConfigUpdated?.((config: unknown) => {
      const c = config as { discord?: Partial<DiscordConfig> };
      if (c?.discord) this.applyConfig(c.discord, { preserveToken: true });
    }) || null;

    this.loadConfig();
    if (this.bridge?.isElectron && this.bridge.getAppConfig) {
      void this.bridge.getAppConfig()
        .then((config: unknown) => {
          const c = config as { discord?: Partial<DiscordConfig> };
          if (c?.discord) this.applyConfig(c.discord, { preserveToken: true });
        })
        .catch(() => {});
    }
  }

  loadConfig(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(this.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.applyConfig({ ...parsed, botToken: parsed.botToken || parsed.token || this.config.botToken });
        }
      }
    } catch (e) {
      console.warn('[Discord] Error loading config:', e);
    }
  }

  saveConfig(newConfig: Partial<DiscordConfig> = {}): void {
    this.applyConfig(newConfig);
    const { botToken: _botToken, ...safeConfig } = this.config;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(safeConfig));
      }
      if (this.bridge?.isElectron && this.bridge.getAppConfig && this.bridge.saveAppConfig) {
        void this.bridge.getAppConfig()
          .then((current: unknown) => this.bridge.saveAppConfig({ ...((current as Record<string, unknown>) || {}), discord: safeConfig }))
          .catch(() => {});
      }
    } catch (e) {
      console.warn('[Discord] Error saving config:', e);
    }
  }

  applyConfig(nextConfig: Partial<DiscordConfig> = {}, { preserveToken = false }: { preserveToken?: boolean } = {}): DiscordConfig {
    const merged = normalizeDiscordConfig({ ...this.config, ...nextConfig });
    this.config = {
      ...merged,
      botToken: preserveToken ? this.config.botToken : (typeof nextConfig.botToken === 'string' ? nextConfig.botToken.trim() : this.config.botToken)
    };
    const { botToken: _token, ...safeConfig } = this.config;
    this.bus.emitDomain('discord.configuration_changed', safeConfig, { source: 'discord', privacy: 'internal' });
    return { ...this.config };
  }

  isAutoReplyEligible(channelIdOrMessage?: string | DiscordMessage, maybeMessage: DiscordMessage | null = null): boolean {
    if (!this.config.autoReply) return false;
    const message = (typeof channelIdOrMessage === 'object' && channelIdOrMessage !== null)
      ? channelIdOrMessage
      : maybeMessage;
    const channelId = String(
      (typeof channelIdOrMessage === 'string' ? channelIdOrMessage : '') ||
      message?.channelId ||
      ''
    ).trim();

    if (message?.isMentioned === true || message?.isDirectMessage === true) {
      return true;
    }
    if (message?.content && this.config.prefix && message.content.startsWith(this.config.prefix)) {
      return true;
    }
    if (this.config.monitoredChannels && this.config.monitoredChannels.length > 0) {
      return Boolean(channelId && this.config.monitoredChannels.includes(channelId));
    }
    return Boolean(channelId);
  }

  async connect(token: string | null = null): Promise<{ status: string; bot?: DiscordBotInfo; message: string }> {
    if (token) await this.bridge.setSecureSecret('discord.botToken', token);
    const credStatus = await this.bridge.credentialStatus();
    if (!credStatus.hasDiscordCredential) return { status: 'error', message: 'Configura Discord en Ajustes.' };
    this.status = 'connecting';
    try {
      if (this.bridge?.isElectron) {
        this.transportConnectionId = null;
        const res = await this.bridge.discordConnect({
          statusMessage: this.config.statusMessage,
          activityType: this.config.activityType
        });

        const result = res as Record<string, unknown>;
        if (result && result.success) {
          this.status = 'connected';
          this.transportConnectionId = (result.connectionId as string) || null;
          const botInfo = (result.botInfo as DiscordBotInfo) || null;
          this.botInfo = botInfo;
          this.bus.emitDomain(EVENTS.DISCORD_CONNECTED, { bot: botInfo, connectionId: this.transportConnectionId }, {
            source: 'discord', privacy: 'internal'
          });
          const tag = botInfo?.tag || 'Cristi Bot';
          logger.info('DISCORD', `✓ Conectado exitosamente como ${tag}`);
          return { status: 'success', bot: botInfo || undefined, message: `Conectado como ${tag}` };
        } else {
          this.status = 'error';
          logger.error('DISCORD', 'Fallo de autenticación Discord:', result?.error);
          return { status: 'error', message: typeof result?.error === 'string' ? result.error : 'Token inválido o error de Discord.' };
        }
      }

      this.status = 'connected';
      return { status: 'success', message: 'Simulación de Discord Bot activa.' };
    } catch (err) {
      const error = err as Error;
      this.status = 'error';
      logger.error('DISCORD', 'Error crítico en Discord:', error);
      return { status: 'error', message: error.message };
    }
  }

  async disconnect(): Promise<{ status: string; message: string }> {
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
      const error = err as Error;
      return { status: 'error', message: error.message };
    }
  }

  async sendMessage(channelId: string, content: string): Promise<{ success?: boolean; status?: string; message?: string }> {
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
      const error = err as Error;
      return { status: 'error', message: error.message };
    }
  }

  async getRecentMessages(channelId: string, limit = 10): Promise<{ messages?: unknown[]; error?: string; status?: string; message?: string }> {
    try {
      if (this.bridge?.isElectron) {
        return await this.bridge.discordGetMessages({ channelId, limit });
      }
      return { status: 'success', messages: [] };
    } catch (err) {
      const error = err as Error;
      return { status: 'error', message: error.message };
    }
  }

  async setStatus(statusText: string, activityType = 'Playing'): Promise<{ status: string; message: string }> {
    this.config.statusMessage = statusText;
    this.config.activityType = activityType;
    this.saveConfig();

    try {
      if (this.bridge?.isElectron) {
        await this.bridge.discordSetStatus({ statusText, activityType });
      }
      return { status: 'success', message: `Estado actualizado a "${statusText}"` };
    } catch (err) {
      const error = err as Error;
      return { status: 'error', message: error.message };
    }
  }

  getRecentLocalMessages({ channelId = null, limit = 20 }: { channelId?: string | null; limit?: number } = {}): DiscordMessage[] {
    const filtered = channelId
      ? this.recentMessages.filter((message) => message.channelId === channelId)
      : this.recentMessages;
    return filtered.slice(-Math.min(100, Math.max(1, limit)));
  }

  destroy(): void {
    this.unsubscribeMessage?.();
    this.unsubscribeMessage = null;
    this.unsubscribeEvent?.();
    this.unsubscribeEvent = null;
    this.unsubscribeConfig?.();
    this.unsubscribeConfig = null;
  }
}

export const discordCompanion = new DiscordCompanionService();
export default discordCompanion;
