/**
 * Cristi AI - Discord Autonomous Companion & Voice Service (Domain Layer)
 * 
 * Provides Discord bot interaction: listening to mentions/messages, autonomous replies
 * preserving correlationId, voice channel connection, and 16 kHz PCM/Opus audio streaming.
 */

import type {
  DiscordCommandResult,
  DiscordConfig,
  DiscordMessage,
  DiscordVoiceAudioFrame,
  DiscordVoiceResult,
  DiscordVoiceState
} from '@/types';
import { electronBridge } from '@/services/desktop/ElectronBridge.js';
import { eventBus, EVENTS } from '@/services/eventBus.js';
import { logger } from '@/services/logger.js';

export interface IDiscordCompanionService {
  readonly status: 'disconnected' | 'connecting' | 'connected' | 'error';
  readonly botInfo: Record<string, any> | null;
  readonly voiceState: DiscordVoiceState;

  connect(token?: string | null): Promise<DiscordCommandResult>;
  disconnect(): Promise<DiscordCommandResult>;
  sendMessage(channelId: string, content: string, correlationId?: string): Promise<DiscordCommandResult>;
  replyToMessage(message: DiscordMessage, content: string): Promise<DiscordCommandResult>;
  getRecentMessages(channelId: string, limit?: number): Promise<{ status: string; messages?: any[]; error?: string }>;
  setStatus(statusText: string, activityType?: 'Playing' | 'Listening' | 'Watching'): Promise<DiscordCommandResult>;
  
  joinVoiceChannel(guildId: string, channelId: string): Promise<DiscordVoiceResult>;
  leaveVoiceChannel(): Promise<DiscordVoiceResult>;
  sendVoiceAudio(payload: { data: string; frameId?: string; sampleRate?: number }): Promise<DiscordVoiceResult>;
  getVoiceStatus(): DiscordVoiceState;

  isAutoReplyEligible(message: DiscordMessage): boolean;
  destroy(): void;
}

function normalizeDiscordConfig(value: Partial<DiscordConfig> = {}): DiscordConfig {
  const monitoredChannels = Array.isArray(value.monitoredChannels)
    ? [...new Set(value.monitoredChannels
        .map((ch) => String(ch || '').trim())
        .filter((ch) => /^\d{5,32}$/.test(ch)))].slice(0, 100)
    : [];

  const activity = value.activityType && ['Playing', 'Listening', 'Watching'].includes(value.activityType)
    ? value.activityType
    : 'Playing';

  return {
    botToken: typeof value.botToken === 'string' ? value.botToken.trim() : '',
    autoReply: value.autoReply === true,
    monitoredChannels,
    statusMessage: typeof value.statusMessage === 'string' && value.statusMessage.trim()
      ? value.statusMessage.trim().slice(0, 128)
      : 'Conectada con Jeremy | Cristi AI',
    activityType: activity,
    prefix: typeof value.prefix === 'string' && value.prefix.trim() ? value.prefix.trim().slice(0, 32) : '!cristi'
  };
}

export class DiscordCompanionService implements IDiscordCompanionService {
  private readonly bridge: typeof electronBridge;
  private readonly bus: typeof eventBus;
  private readonly storageKey = 'cristi_discord_config';

  public config: DiscordConfig;
  public status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  public botInfo: Record<string, any> | null = null;
  private transportConnectionId: string | null = null;

  public voiceState: DiscordVoiceState = {
    status: 'disconnected',
    session: null
  };

  public recentMessages: DiscordMessage[] = [];
  public readonly maxRecentMessages = 200;

  private unsubscribeMessage: (() => void) | null = null;
  private unsubscribeEvent: (() => void) | null = null;
  private unsubscribeVoiceAudio: (() => void) | null = null;
  private unsubscribeVoiceEvent: (() => void) | null = null;
  private unsubscribeConfig: (() => void) | null = null;

  constructor({ bridge = electronBridge, bus = eventBus } = {}) {
    this.bridge = bridge;
    this.bus = bus;

    const envToken =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DISCORD_BOT_TOKEN) ||
      (typeof process !== 'undefined' && (process.env?.VITE_DISCORD_BOT_TOKEN || process.env?.DISCORD_BOT_TOKEN)) ||
      '';

    this.config = normalizeDiscordConfig({ botToken: envToken });

    this.loadConfig();
    this.setupListeners();
  }

  private loadConfig(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(this.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.applyConfig({ ...parsed, botToken: parsed.botToken || parsed.token || this.config.botToken });
        }
      }
    } catch (e) {
      logger.warn?.('DISCORD', 'Error al cargar configuración:', e);
    }
  }

  public saveConfig(newConfig: Partial<DiscordConfig> = {}): void {
    this.applyConfig(newConfig);
    const { botToken, ...safeConfig } = this.config;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(safeConfig));
      }
      if (this.bridge?.isElectron && this.bridge.getAppConfig && this.bridge.saveAppConfig) {
        void this.bridge.getAppConfig().then((current: any) =>
          this.bridge.saveAppConfig({ ...(current || {}), discord: safeConfig })
        ).catch(() => {});
      }
    } catch (e) {
      logger.warn?.('DISCORD', 'Error al guardar configuración:', e);
    }
  }

  public applyConfig(nextConfig: Partial<DiscordConfig> = {}, { preserveToken = false } = {}): DiscordConfig {
    const merged = normalizeDiscordConfig({ ...this.config, ...nextConfig });
    this.config = {
      ...merged,
      botToken: preserveToken
        ? this.config.botToken
        : typeof nextConfig.botToken === 'string'
        ? nextConfig.botToken.trim()
        : this.config.botToken
    };
    const { botToken, ...safeConfig } = this.config;
    this.bus.emitDomain('discord.configuration_changed', safeConfig, { source: 'discord', privacy: 'internal' });
    return { ...this.config };
  }

  private setupListeners(): void {
    this.unsubscribeMessage = this.bridge?.onDiscordMessage?.((rawMessage: any) => {
      if (rawMessage?.connectionId && this.transportConnectionId && rawMessage.connectionId !== this.transportConnectionId) {
        return;
      }

      const correlationId = rawMessage?.id ? `discord_${rawMessage.id}` : `discord_msg_${Date.now()}`;
      const message: DiscordMessage = {
        id: String(rawMessage?.id || Date.now()),
        channelId: String(rawMessage?.channelId || ''),
        guildId: rawMessage?.guildId || null,
        content: String(rawMessage?.content || ''),
        author: {
          id: String(rawMessage?.author?.id || 'unknown'),
          username: String(rawMessage?.author?.username || 'User'),
          bot: Boolean(rawMessage?.author?.bot)
        },
        isMentioned: Boolean(rawMessage?.isMentioned),
        isDirectMessage: Boolean(rawMessage?.isDirectMessage),
        correlationId,
        receivedAt: Date.now()
      };

      this.recentMessages.push(message);
      if (this.recentMessages.length > this.maxRecentMessages) {
        this.recentMessages.shift();
      }

      const autoReplyEligible = this.isAutoReplyEligible(message);

      this.bus.emitDomain(
        EVENTS.DISCORD_MESSAGE,
        { ...message, autoReplyEligible },
        {
          source: 'discord',
          privacy: 'external',
          sessionId: `discord_${message.channelId || 'unknown'}`,
          correlationId
        }
      );
    }) ?? null;

    this.unsubscribeEvent = this.bridge?.onDiscordEvent?.((event: Record<string, any>) => {
      if (event?.connectionId && this.transportConnectionId && event.connectionId !== this.transportConnectionId) {
        return;
      }

      this.bus.emitDomain(`discord.${event?.type || 'event'}`, event || {}, {
        source: 'discord',
        privacy: 'internal'
      });

      if (event?.type === 'disconnect' || event?.type === 'reconnecting') this.status = 'error';
      if (event?.type === 'ready') this.status = 'connected';
      if (event?.type === 'error') this.status = 'error';
    }) ?? null;

    // Listen to voice incoming audio
    this.unsubscribeVoiceAudio = this.bridge?.onDiscordVoiceAudio?.((frame: any) => {
      if (this.voiceState.status !== 'connected' || !frame?.data || !frame.userId) return;

      const voiceFrame: DiscordVoiceAudioFrame = {
        frameId: frame.frameId || `frame_${Date.now()}`,
        guildId: frame.guildId || this.voiceState.session?.guildId || null,
        channelId: frame.channelId || this.voiceState.session?.channelId || null,
        userId: String(frame.userId),
        speakerId: String(frame.userId),
        data: frame.data,
        sampleRate: Number(frame.sampleRate) || 16000,
        encoding: frame.encoding || 'pcm_s16le',
        timestamp: Date.now()
      };

      this.bus.emitDomain('discord.voice_audio', voiceFrame, {
        source: 'discord_voice',
        privacy: 'external',
        sessionId: this.voiceState.session?.sessionId || null
      });
    }) ?? null;

    this.unsubscribeVoiceEvent = this.bridge?.onDiscordVoiceEvent?.((event: any) => {
      const type = event?.type;
      if (type === 'ready') this.voiceState.status = 'connected';
      if (['disconnect', 'reconnecting', 'reconnect_error'].includes(type)) this.voiceState.status = 'reconnecting';
      if (['disconnected', 'destroyed', 'reconnect_failed'].includes(type)) {
        this.voiceState.status = 'disconnected';
        this.voiceState.session = null;
      }

      this.bus.emitDomain(`discord.voice_${type || 'event'}`, event || {}, {
        source: 'discord_voice',
        privacy: 'internal',
        sessionId: this.voiceState.session?.sessionId || null
      });
    }) ?? null;

    this.unsubscribeConfig = this.bridge?.onConfigUpdated?.((config: any) => {
      if (config?.discord) this.applyConfig(config.discord, { preserveToken: true });
    }) ?? null;
  }

  public isAutoReplyEligible(message: DiscordMessage): boolean {
    if (!this.config.autoReply) return false;
    if (message.author?.bot) return false;

    if (message.isMentioned || message.isDirectMessage) {
      return true;
    }

    if (message.content && this.config.prefix && message.content.startsWith(this.config.prefix)) {
      return true;
    }

    if (this.config.monitoredChannels && this.config.monitoredChannels.length > 0) {
      return Boolean(message.channelId && this.config.monitoredChannels.includes(message.channelId));
    }

    return Boolean(message.channelId);
  }

  public async connect(token?: string | null): Promise<DiscordCommandResult> {
    let activeToken: string | undefined = (token || this.config.botToken) || undefined;
    if (!activeToken && this.bridge?.isElectron && this.bridge.getSecureSecret) {
      activeToken = (await this.bridge.getSecureSecret('discord.botToken')) || undefined;
    }

    if (!activeToken) {
      return {
        success: false,
        status: 'error',
        message: 'Por favor proporciona un Bot Token de Discord válido.'
      };
    }

    this.config.botToken = activeToken;
    this.status = 'connecting';
    logger.info?.('DISCORD', 'Iniciando conexión con Discord Gateway...');

    if (this.bridge?.isElectron && this.bridge.setSecureSecret) {
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

          this.bus.emitDomain(
            EVENTS.DISCORD_CONNECTED,
            { bot: res.botInfo, connectionId: this.transportConnectionId },
            { source: 'discord', privacy: 'internal' }
          );

          logger.info?.('DISCORD', `✓ Conectado exitosamente como ${res.botInfo?.tag || 'Cristi Bot'}`);
          return {
            success: true,
            status: 'success',
            bot: res.botInfo,
            message: `Conectado como ${res.botInfo?.tag}`
          };
        } else {
          this.status = 'error';
          logger.error?.('DISCORD', 'Fallo de autenticación Discord:', res?.error);
          return {
            success: false,
            status: 'error',
            message: res?.error || 'Token inválido o error de Discord.'
          };
        }
      }

      this.status = 'connected';
      return { success: true, status: 'success', message: 'Simulación de Discord Bot activa (entorno web).' };
    } catch (err: any) {
      this.status = 'error';
      logger.error?.('DISCORD', 'Error crítico en Discord:', err);
      return { success: false, status: 'error', message: err?.message || String(err) };
    }
  }

  public async disconnect(): Promise<DiscordCommandResult> {
    this.status = 'disconnected';
    this.botInfo = null;
    this.transportConnectionId = null;
    await this.leaveVoiceChannel();

    logger.info?.('DISCORD', 'Desconectando bot de Discord...');
    try {
      if (this.bridge?.isElectron) {
        await this.bridge.discordDisconnect();
      }
      this.bus.emitDomain(EVENTS.DISCORD_DISCONNECTED, {}, { source: 'discord', privacy: 'internal' });
      return { success: true, status: 'success', message: 'Bot de Discord desconectado.' };
    } catch (err: any) {
      return { success: false, status: 'error', message: err?.message || String(err) };
    }
  }

  public async sendMessage(channelId: string, content: string, correlationId?: string): Promise<DiscordCommandResult> {
    if (!channelId || !content) {
      return { success: false, status: 'error', message: 'Canal o mensaje inválido.' };
    }

    const corrId = correlationId || `discord_out_${Date.now()}`;
    logger.info?.('DISCORD', `Enviando mensaje al canal ${channelId} [corrId=${corrId}]: "${content}"`);

    try {
      let result: any = { success: true };
      if (this.bridge?.isElectron) {
        result = await this.bridge.discordSendMessage({ channelId, content });
      }

      this.bus.emitDomain(
        'discord.message_sent',
        { channelId, content, correlationId: corrId },
        { source: 'discord', correlationId: corrId, privacy: 'external' }
      );

      return {
        success: Boolean(result?.success ?? true),
        status: 'success',
        message: `Mensaje enviado al canal ${channelId}.`
      };
    } catch (err: any) {
      return { success: false, status: 'error', message: err?.message || String(err) };
    }
  }

  public async replyToMessage(message: DiscordMessage, content: string): Promise<DiscordCommandResult> {
    return this.sendMessage(message.channelId, content, message.correlationId);
  }

  public async getRecentMessages(
    channelId: string,
    limit = 10
  ): Promise<{ status: string; messages?: any[]; error?: string }> {
    try {
      if (this.bridge?.isElectron) {
        return await this.bridge.discordGetMessages({ channelId, limit });
      }
      return { status: 'success', messages: [] };
    } catch (err: any) {
      return { status: 'error', error: err?.message || String(err) };
    }
  }

  public async setStatus(statusText: string, activityType: 'Playing' | 'Listening' | 'Watching' = 'Playing'): Promise<DiscordCommandResult> {
    this.config.statusMessage = statusText;
    this.config.activityType = activityType;
    this.saveConfig();

    try {
      if (this.bridge?.isElectron) {
        await this.bridge.discordSetStatus({ statusText, activityType });
      }
      return { success: true, status: 'success', message: `Estado actualizado a "${statusText}"` };
    } catch (err: any) {
      return { success: false, status: 'error', message: err?.message || String(err) };
    }
  }

  public async joinVoiceChannel(guildId: string, channelId: string): Promise<DiscordVoiceResult> {
    if (!guildId || !channelId) {
      return { success: false, error: 'guildId y channelId son requeridos para unirse al canal de voz.' };
    }

    this.voiceState.status = 'connecting';
    logger.info?.('DISCORD', `Conectando a canal de voz: ${guildId} / ${channelId}`);

    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.discordVoiceJoin({ guildId, channelId });
        if (res && res.success) {
          const session = {
            guildId,
            channelId,
            sessionId: `discord_voice_${guildId}_${channelId}`
          };
          this.voiceState = { status: 'connected', session };
          return { success: true, session };
        }
        this.voiceState = { status: 'error', session: null };
        return { success: false, error: res?.error || 'Fallo al unirse al canal de voz.' };
      }

      const mockSession = {
        guildId,
        channelId,
        sessionId: `discord_voice_${guildId}_${channelId}`
      };
      this.voiceState = { status: 'connected', session: mockSession };
      return { success: true, session: mockSession };
    } catch (err: any) {
      this.voiceState = { status: 'error', session: null };
      return { success: false, error: err?.message || String(err) };
    }
  }

  public async leaveVoiceChannel(): Promise<DiscordVoiceResult> {
    try {
      if (this.bridge?.isElectron) {
        await this.bridge.discordVoiceLeave();
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    } finally {
      this.voiceState = { status: 'disconnected', session: null };
    }
  }

  public async sendVoiceAudio(payload: { data: string; frameId?: string; sampleRate?: number }): Promise<DiscordVoiceResult> {
    if (!payload?.data) {
      return { success: false, error: 'Audio data base64 requerida.' };
    }
    if (this.voiceState.status !== 'connected' || !this.voiceState.session) {
      return { success: false, error: 'No conectado a un canal de voz de Discord.' };
    }

    const frameId = payload.frameId || `voice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const inputSampleRate = payload.sampleRate || 16000;

    // Resample to 16 kHz if necessary
    const resampledData = inputSampleRate === 16000
      ? payload.data
      : this.resamplePcm16Base64(payload.data, inputSampleRate, 16000);

    try {
      if (this.bridge?.isElectron) {
        const res = await this.bridge.discordVoiceSendAudio({ data: resampledData, frameId });
        return { success: Boolean(res?.success ?? true), error: res?.error };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  public getVoiceStatus(): DiscordVoiceState {
    return {
      status: this.voiceState.status,
      session: this.voiceState.session ? { ...this.voiceState.session } : null
    };
  }

  /**
   * Resamples PCM 16-bit LE Base64 audio between sample rates using linear interpolation.
   */
  private resamplePcm16Base64(data: string, inputRate: number, outputRate: number): string {
    try {
      const bytes = typeof globalThis.atob === 'function'
        ? Uint8Array.from(globalThis.atob(String(data)), (char) => char.charCodeAt(0))
        : new Uint8Array(Buffer.from(String(data), 'base64'));

      const source = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
      const length = Math.max(1, Math.round(source.length * outputRate / inputRate));
      const target = new Int16Array(length);

      for (let i = 0; i < length; i += 1) {
        const position = (i * inputRate) / outputRate;
        const left = Math.floor(position);
        const right = Math.min(source.length - 1, left + 1);
        const fraction = position - left;
        target[i] = Math.round((source[left] || 0) * (1 - fraction) + (source[right] || 0) * fraction);
      }

      const out = new Uint8Array(target.buffer);
      let binary = '';
      for (let i = 0; i < out.length; i += 0x8000) {
        binary += String.fromCharCode(...out.subarray(i, Math.min(i + 0x8000, out.length)));
      }
      return typeof globalThis.btoa === 'function' ? globalThis.btoa(binary) : Buffer.from(out).toString('base64');
    } catch (_) {
      return data;
    }
  }

  public destroy(): void {
    this.unsubscribeMessage?.();
    this.unsubscribeMessage = null;
    this.unsubscribeEvent?.();
    this.unsubscribeEvent = null;
    this.unsubscribeVoiceAudio?.();
    this.unsubscribeVoiceAudio = null;
    this.unsubscribeVoiceEvent?.();
    this.unsubscribeVoiceEvent = null;
    this.unsubscribeConfig?.();
    this.unsubscribeConfig = null;
    void this.leaveVoiceChannel();
  }
}

export const discordCompanionService = new DiscordCompanionService();
export default discordCompanionService;
