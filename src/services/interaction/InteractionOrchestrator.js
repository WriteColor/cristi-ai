import { eventBus, EVENTS } from '../eventBus.js';
import { memoryService } from '../memory/MemoryService.js';

const LOW_SIGNAL_EVENTS = new Set(['audio_analysis', 'audio_chunk', 'vision_detections_updated']);

export class InteractionOrchestrator {
  constructor({ geminiSocket = null, memory = memoryService, bus = eventBus, senders = {} } = {}) {
    this.geminiSocket = geminiSocket;
    this.memory = memory;
    this.bus = bus;
    this.senders = { ...senders };
    this.running = false;
    this.unsubscribe = null;
    this.lastByKey = new Map();
    this.cooldowns = new Map();
    this.pendingExternalReplies = new Map();
    this.policy = {
      discordCooldownMs: 4000,
      gameCooldownMs: 2500,
      maxContextMemories: 5,
      allowExternalAutoReply: false,
      externalReplyTtlMs: 120000
    };
  }

  setGeminiSocket(socket) {
    this.geminiSocket = socket;
  }

  configure(policy = {}) {
    this.policy = { ...this.policy, ...policy };
  }

  setExternalSender(source, sender) {
    if (!source || typeof sender !== 'function') return false;
    this.senders[source] = sender;
    return true;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.unsubscribe = this.bus.onAny((eventName, data) => {
      if (!this.running || LOW_SIGNAL_EVENTS.has(eventName)) return;
      const envelope = eventName === EVENTS.DOMAIN_EVENT ? data : null;
      if (!envelope?.type) return;
      void this.handle(envelope).catch((error) => {
        this.bus.emitDomain('interaction.error', { eventType: envelope.type, message: error.message }, {
          source: 'interaction_orchestrator', sessionId: envelope.sessionId, privacy: 'internal'
        });
      });
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
    if (event.type === EVENTS.DISCORD_MESSAGE) {
      const message = event.payload;
      const discordSessionId = `discord_${message.channelId || 'unknown'}`;
      if (!this.memory.hasSession?.(discordSessionId)) {
        if (typeof this.memory.ensureSession === 'function') this.memory.ensureSession(discordSessionId, { source: 'discord' });
        else if (this.memory.currentSessionId !== discordSessionId) this.memory.startSession(discordSessionId, { source: 'discord' });
      }
      this.memory.recordTurn({ role: 'user', text: message.content, source: 'discord', speakerId: message.authorId, sessionId: discordSessionId });
      if (cooldown && now - (this.lastByKey.get(key) || 0) < cooldown) return { accepted: true, throttled: true };
      this.lastByKey.set(key, now);
      const memories = this.memory.retrieveRelevant(message.content, { limit: this.policy.maxContextMemories });
      this.bus.emitDomain('interaction.context_ready', {
        channelId: message.channelId,
        authorId: message.authorId,
        text: message.content,
        memories: memories.map((memory) => ({ id: memory.id, content: memory.content, category: memory.category }))
      }, { source: 'interaction_orchestrator', sessionId: event.sessionId, privacy: 'external' });
      if (this.policy.allowExternalAutoReply && message.autoReplyEligible === true && event.correlationId) {
        this.pendingExternalReplies.set(event.correlationId, {
          correlationId: event.correlationId,
          channelId: message.channelId,
          source: 'discord',
          createdAt: now
        });
        // A shared Live turn has no reply correlation. Publishing a request lets
        // a dedicated responder produce a tagged answer without leaking the
        // next spoken answer from the primary call into Discord.
        this.bus.emitDomain('interaction.external_reply_requested', {
          correlationId: event.correlationId,
          channelId: message.channelId,
          source: 'discord',
          authorId: message.authorId,
          text: message.content,
          memories: memories.map((memory) => ({ id: memory.id, content: memory.content, category: memory.category }))
        }, { source: 'interaction_orchestrator', sessionId: discordSessionId, privacy: 'external' });
      }
      return { accepted: true, memories };
    }

    if (event.type === 'game.event' || event.type === EVENTS.GAME_EVENT || event.type === EVENTS.GAME_STATE_CHANGED) {
      const payload = event.payload || {};
      const text = payload.payload?.message || payload.message || `${payload.eventType || 'evento'} en ${payload.game || 'juego'}`;
      const gameSessionId = event.sessionId || `game_${payload.game || 'unknown'}`;
      this.memory.ensureSession?.(gameSessionId, { source: payload.game || 'game' });
      this.memory.recordTurn({ role: 'system', text, source: payload.game || 'game', sessionId: gameSessionId });
      this.bus.emitDomain('interaction.game_context_ready', {
        game: payload.game || 'unknown', eventType: payload.eventType || 'state_changed', text
      }, { source: 'interaction_orchestrator', privacy: 'external' });
      return { accepted: true };
    }
    return null;
  }

  async deliverExternalResponse(text, correlationId = null) {
    if (!text) return { success: false, error: 'Respuesta vacía.' };
    if (!correlationId) return { success: false, error: 'La respuesta externa requiere correlationId.' };
    const pending = this.pendingExternalReplies.get(correlationId);
    if (!pending) return { success: false, error: 'No existe una respuesta externa pendiente.' };
    const ttl = Math.max(1000, Number(this.policy.externalReplyTtlMs) || 120000);
    if (Date.now() - pending.createdAt > ttl) {
      this.pendingExternalReplies.delete(correlationId);
      return { success: false, error: 'La respuesta externa pendiente expiró.' };
    }
    const sender = this.senders[pending.source];
    if (!sender) return { success: false, error: `No existe emisor para ${pending.source}.` };
    const delivery = await sender(pending.channelId, text);
    if (delivery?.success === false) throw new Error(delivery.error || 'El canal externo rechazó la respuesta.');
    this.pendingExternalReplies.delete(correlationId);
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
