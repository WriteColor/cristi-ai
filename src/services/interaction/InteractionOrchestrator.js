import { eventBus, EVENTS } from '../eventBus.js';
import { memoryService } from '../memory/MemoryService.js';

const LOW_SIGNAL_EVENTS = new Set(['audio_analysis', 'audio_chunk', 'vision_detections_updated']);

export class InteractionOrchestrator {
  constructor({ geminiSocket = null, memory = memoryService, bus = eventBus } = {}) {
    this.geminiSocket = geminiSocket;
    this.memory = memory;
    this.bus = bus;
    this.running = false;
    this.unsubscribe = null;
    this.lastByKey = new Map();
    this.cooldowns = new Map();
    this.pendingExternalReplies = new Map();
    this.policy = {
      discordCooldownMs: 4000,
      gameCooldownMs: 2500,
      maxContextMemories: 5,
      allowExternalAutoReply: false
    };
  }

  setGeminiSocket(socket) {
    this.geminiSocket = socket;
  }

  configure(policy = {}) {
    this.policy = { ...this.policy, ...policy };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.unsubscribe = this.bus.onAny((eventName, data) => {
      if (!this.running || LOW_SIGNAL_EVENTS.has(eventName)) return;
      const envelope = eventName === EVENTS.DOMAIN_EVENT ? data : null;
      if (!envelope?.type) return;
      void this.handle(envelope);
    });
  }

  stop() {
    this.running = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  async handle(event) {
    if (!event || event.source === 'interaction_orchestrator') return null;
    const key = `${event.type}:${event.payload?.channelId || event.payload?.game || ''}`;
    const now = Date.now();
    const cooldown = event.type === EVENTS.DISCORD_MESSAGE
      ? this.policy.discordCooldownMs
      : event.type === 'game.event' || event.type === EVENTS.GAME_EVENT
        ? this.policy.gameCooldownMs
        : 0;
    if (cooldown && now - (this.lastByKey.get(key) || 0) < cooldown) return null;
    this.lastByKey.set(key, now);

    if (event.type === EVENTS.DISCORD_MESSAGE) {
      const message = event.payload;
      const discordSessionId = `discord_${message.channelId || 'unknown'}`;
      if (this.memory.currentSessionId !== discordSessionId) {
        this.memory.startSession(discordSessionId, { source: 'discord' });
      }
      this.memory.recordTurn({ role: 'user', text: message.content, source: 'discord', speakerId: message.authorId });
      const memories = this.memory.retrieveRelevant(message.content, { limit: this.policy.maxContextMemories });
      this.bus.emitDomain('interaction.context_ready', {
        channelId: message.channelId,
        authorId: message.authorId,
        text: message.content,
        memories: memories.map((memory) => ({ id: memory.id, content: memory.content, category: memory.category }))
      }, { source: 'interaction_orchestrator', sessionId: event.sessionId, privacy: 'external' });
      if (this.policy.allowExternalAutoReply && this.geminiSocket?.isConnected) {
        this.pendingExternalReplies.set(event.correlationId, {
          correlationId: event.correlationId,
          channelId: message.channelId,
          source: 'discord',
          createdAt: now
        });
        this.geminiSocket.sendTextMessage(`[CONTEXTO DISCORD] ${message.authorName || 'Usuario'} dijo: ${message.content}. Responde solo si es relevante y de forma breve.`);
      }
      return { accepted: true, memories };
    }

    if (event.type === 'game.event' || event.type === EVENTS.GAME_EVENT || event.type === EVENTS.GAME_STATE_CHANGED) {
      const payload = event.payload || {};
      const text = payload.payload?.message || payload.message || `${payload.eventType || 'evento'} en ${payload.game || 'juego'}`;
      this.memory.recordTurn({ role: 'system', text, source: payload.game || 'game' });
      this.bus.emitDomain('interaction.game_context_ready', {
        game: payload.game || 'unknown', eventType: payload.eventType || 'state_changed', text
      }, { source: 'interaction_orchestrator', privacy: 'external' });
      return { accepted: true };
    }
    return null;
  }

  async deliverExternalResponse(text, correlationId = null) {
    if (!text) return { success: false, error: 'Respuesta vacía.' };
    const pending = correlationId ? this.pendingExternalReplies.get(correlationId) : this.pendingExternalReplies.values().next().value;
    if (!pending) return { success: false, error: 'No existe una respuesta externa pendiente.' };
    this.pendingExternalReplies.delete(correlationId || pending.correlationId);
    this.bus.emitDomain('interaction.external_response', {
      channelId: pending.channelId, text, source: pending.source
    }, { source: 'interaction_orchestrator', privacy: 'external' });
    return { success: true, channelId: pending.channelId, text };
  }

  destroy() {
    this.stop();
    this.lastByKey.clear();
    this.cooldowns.clear();
    this.pendingExternalReplies.clear();
  }
}

export const interactionOrchestrator = new InteractionOrchestrator();
export default interactionOrchestrator;
