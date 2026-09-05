import { electronBridge } from '../desktop/ElectronBridge.js';
import { eventBus, EVENTS } from '../eventBus.js';
import { audioRoutingService } from '../translation/AudioRoutingService.js';

/**
 * Voice-channel adapter. Discord transport remains in Electron main; this
 * service only owns source labels, loop prevention and renderer integration.
 */
export class DiscordVoiceService {
  constructor({ bridge = electronBridge, bus = eventBus } = {}) {
    this.bridge = bridge;
    this.bus = bus;
    this.status = 'disconnected';
    this.session = null;
    this.unsubscribeAudio = bridge?.onDiscordVoiceAudio?.((frame) => this.handleAudio(frame));
    this.unsubscribeEvent = bridge?.onDiscordVoiceEvent?.((event) => {
      this.status = event?.type === 'ready' ? 'connected' : event?.type === 'disconnected' || event?.type === 'destroyed' ? 'disconnected' : this.status;
      this.bus.emitDomain(`discord.voice_${event?.type || 'event'}`, event || {}, {
        source: 'discord_voice', privacy: 'internal', sessionId: this.session?.sessionId || null
      });
    });
    this.unsubscribeTranslation = bus?.on?.(EVENTS.TRANSLATION_COMPLETED, (envelope) => {
      const result = envelope?.payload || envelope;
      if (result?.outputRoute !== 'discord_voice' || !result?.sourceId?.startsWith('discord_voice:') || !result.audio?.data || this.status !== 'connected') return;
      const [, eventGuildId] = String(result.sourceId).split(':');
      if (this.session?.guildId && eventGuildId && String(this.session.guildId) !== eventGuildId) return;
      if (this.session?.channelId && result.channelId && String(this.session.channelId) !== String(result.channelId)) return;
      const data = Number(result.audio.sampleRate) === 16000
        ? result.audio.data
        : resamplePcm16Base64(result.audio.data, Number(result.audio.sampleRate) || 24000, 16000);
      void this.sendAudio({ data, frameId: `translation_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }).catch(() => {});
    });
  }

  async join({ guildId, channelId } = {}) {
    if (!guildId || !channelId) return { success: false, error: 'guildId y channelId son obligatorios.' };
    const result = await this.bridge.discordVoiceJoin?.({ guildId, channelId });
    if (result?.success) {
      this.status = 'connected';
      this.session = { guildId, channelId, sessionId: `discord_voice_${guildId}_${channelId}` };
    }
    return result || { success: false, error: 'La API de voz de Electron no está disponible.' };
  }

  async leave() {
    const result = await this.bridge.discordVoiceLeave?.();
    this.status = 'disconnected';
    this.session = null;
    return result || { success: true };
  }

  async sendAudio({ data, frameId = null } = {}) {
    if (!data) return { success: false, error: 'Audio vacío.' };
    const id = frameId || `cristi_discord_voice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    audioRoutingService.markGenerated(id, 'cristi_discord_voice');
    const result = await this.bridge.discordVoiceSendAudio?.({ data, frameId: id });
    return result || { success: false, error: 'La API de salida de voz no está disponible.' };
  }

  handleAudio(frame) {
    if (!frame?.data || !frame.userId) return null;
    const sourceId = `discord_voice:${frame.guildId || 'unknown'}:${frame.userId}`;
    const routed = audioRoutingService.acceptFrame({
      frameId: frame.frameId,
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

  getStatus() {
    return { status: this.status, session: this.session ? { ...this.session } : null };
  }

  destroy() {
    this.unsubscribeAudio?.();
    this.unsubscribeEvent?.();
    this.unsubscribeAudio = null;
    this.unsubscribeEvent = null;
    this.unsubscribeTranslation?.();
    this.unsubscribeTranslation = null;
    void this.leave();
  }
}

function resamplePcm16Base64(data, inputRate, outputRate) {
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
  } catch (_) {
    return data;
  }
}

export const discordVoiceService = new DiscordVoiceService();
export default discordVoiceService;
