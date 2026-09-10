import { electronBridge } from '../../../services/desktop/ElectronBridge';
import { eventBus, EVENTS } from '../../../infrastructure/events/eventBus';
import { audioRoutingService } from '../../audio/AudioRoutingService';

const STATUS_BY_TRANSPORT_EVENT: Record<string, string> = Object.freeze({
  ready: 'connected',
  disconnect: 'reconnecting',
  reconnecting: 'reconnecting',
  reconnect_error: 'reconnecting',
  reconnect_failed: 'disconnected',
  disconnected: 'disconnected',
  destroyed: 'disconnected'
});

export interface DiscordVoiceSession {
  guildId: string;
  channelId: string;
  sessionId: string;
}

export interface DiscordVoiceAudioFrame {
  data: string;
  userId: string;
  frameId?: string;
  guildId?: string;
  channelId?: string;
  sampleRate?: number;
  encoding?: string;
}

export class DiscordVoiceService {
  private bridge: typeof electronBridge;
  private bus: typeof eventBus;
  public status = 'disconnected';
  public session: DiscordVoiceSession | null = null;
  private unsubscribeAudio: (() => void) | null = null;
  private unsubscribeEvent: (() => void) | null = null;
  private unsubscribeTranslation: (() => void) | null = null;

  constructor({ bridge = electronBridge, bus = eventBus }: { bridge?: typeof electronBridge; bus?: typeof eventBus } = {}) {
    this.bridge = bridge;
    this.bus = bus;

    this.unsubscribeAudio = bridge?.onDiscordVoiceAudio?.((rawFrame: unknown) => {
      this.handleAudio(rawFrame as DiscordVoiceAudioFrame);
    }) || null;

    this.unsubscribeEvent = bridge?.onDiscordVoiceEvent?.((rawEvent: unknown) => {
      const event = rawEvent as { type?: string };
      const nextStatus = event?.type ? STATUS_BY_TRANSPORT_EVENT[event.type] : undefined;
      if (nextStatus) this.status = nextStatus;
      this.bus.emitDomain(`discord.voice_${event?.type || 'event'}`, event || {}, {
        source: 'discord_voice', privacy: 'internal', sessionId: this.session?.sessionId || null
      });
    }) || null;

    this.unsubscribeTranslation = bus?.on?.(EVENTS.TRANSLATION_COMPLETED, (envelope: unknown) => {
      const rawPayload = (envelope && typeof envelope === 'object' && 'payload' in envelope)
        ? (envelope as { payload: unknown }).payload
        : envelope;
      const result = (rawPayload && typeof rawPayload === 'object') ? (rawPayload as Record<string, unknown>) : null;
      if (!result) return;
      const audio = result.audio as { data?: string; sampleRate?: number } | undefined;
      if (result.outputRoute !== 'discord_voice' || !String(result.sourceId || '').startsWith('discord_voice:') || !audio?.data || this.status !== 'connected') return;
      const [, eventGuildId] = String(result.sourceId).split(':');
      if (this.session?.guildId && eventGuildId && String(this.session.guildId) !== eventGuildId) return;
      if (this.session?.channelId && result.channelId && String(this.session.channelId) !== String(result.channelId)) return;
      const data = Number(audio.sampleRate) === 16000
        ? audio.data
        : resamplePcm16Base64(audio.data, Number(audio.sampleRate) || 24000, 16000);
      void this.sendAudio({ data, frameId: `translation_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` }).catch(() => {});
    }) || null;
  }

  async join({ guildId, channelId }: { guildId: string; channelId: string }): Promise<{ success: boolean; error?: string | null }> {
    if (!guildId || !channelId) return { success: false, error: 'guildId y channelId son obligatorios.' };
    this.status = 'connecting';
    const result = await this.bridge.discordVoiceJoin?.({ guildId, channelId });
    if (result?.success) {
      this.status = 'connected';
      this.session = { guildId, channelId, sessionId: `discord_voice_${guildId}_${channelId}` };
    } else {
      this.status = 'disconnected';
      this.session = null;
    }
    return result || { success: false, error: 'La API de voz de Electron no está disponible.' };
  }

  async leave(): Promise<{ success: boolean }> {
    try {
      const result = await this.bridge.discordVoiceLeave?.();
      return result || { success: true };
    } finally {
      this.status = 'disconnected';
      this.session = null;
    }
  }

  async sendAudio({ data, frameId = null }: { data: string; frameId?: string | null }): Promise<{ success: boolean; error?: string | null }> {
    if (!data) return { success: false, error: 'Audio vacío.' };
    if (this.status !== 'connected' || !this.session) {
      return { success: false, error: 'La conexión de voz de Discord no está lista para enviar audio.' };
    }
    const id = frameId || `cristi_discord_voice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    audioRoutingService.markGenerated(id, 'cristi_discord_voice');
    const result = await this.bridge.discordVoiceSendAudio?.({ data, frameId: id });
    return result || { success: false, error: 'La API de salida de voz no está disponible.' };
  }

  handleAudio(frame: DiscordVoiceAudioFrame): unknown {
    if (this.status !== 'connected' || !frame?.data || !frame.userId) return null;
    const sourceId = `discord_voice:${frame.guildId || 'unknown'}:${frame.userId}`;
    const routed = audioRoutingService.acceptFrame({
      frameId: frame.frameId || `frame_${Date.now()}`,
      sourceId,
      data: frame.data,
      sampleRate: frame.sampleRate || 16000,
      timestamp: Date.now()
    });
    if (!routed) return null;
    this.bus.emitDomain('discord.voice_audio', {
      ...routed,
      guildId: frame.guildId || null,
      channelId: frame.channelId || null,
      userId: frame.userId,
      speakerId: frame.userId,
      encoding: frame.encoding || 'pcm_s16le'
    }, {
      source: 'discord_voice', privacy: 'external',
      sessionId: this.session?.sessionId || null
    });
    return routed;
  }

  getStatus(): { status: string; session: DiscordVoiceSession | null } {
    return { status: this.status, session: this.session ? { ...this.session } : null };
  }

  destroy(): void {
    this.unsubscribeAudio?.();
    this.unsubscribeEvent?.();
    this.unsubscribeAudio = null;
    this.unsubscribeEvent = null;
    this.unsubscribeTranslation?.();
    this.unsubscribeTranslation = null;
    void this.leave();
  }
}

function resamplePcm16Base64(data: string, inputRate: number, outputRate: number): string {
  try {
    const bytes = typeof globalThis.atob === 'function'
      ? Uint8Array.from(globalThis.atob(String(data)), (char) => char.charCodeAt(0))
      : new Uint8Array(Buffer.from(String(data), 'base64'));
    const source = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const length = Math.max(1, Math.round(source.length * outputRate / inputRate));
    const target = new Int16Array(length);
    for (let i = 0; i < length; i += 1) {
      const position = i * inputRate / outputRate;
      const left = Math.floor(position);
      const right = Math.min(source.length - 1, left + 1);
      const fraction = position - left;
      target[i] = Math.round((source[left] || 0) * (1 - fraction) + (source[right] || 0) * fraction);
    }
    const out = new Uint8Array(target.buffer);
    let binary = '';
    for (let i = 0; i < out.length; i += 0x8000) binary += String.fromCharCode(...out.subarray(i, Math.min(i + 0x8000, out.length)));
    return typeof globalThis.btoa === 'function' ? globalThis.btoa(binary) : Buffer.from(out).toString('base64');
  } catch {
    return data;
  }
}

export const discordVoiceService = new DiscordVoiceService();
export default discordVoiceService;
