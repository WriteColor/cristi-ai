import { electronBridge } from '../desktop/ElectronBridge.js';
import { eventBus } from '../eventBus.js';
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
    void this.leave();
  }
}

export const discordVoiceService = new DiscordVoiceService();
export default discordVoiceService;
