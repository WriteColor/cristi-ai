import { eventBus, EVENTS } from '../../infrastructure/events/eventBus';
import { memoryService, type MemoryService } from '../integrations/memory/MemoryService';

const LOW_SIGNAL_EVENTS = new Set(['audio_analysis', 'audio_chunk', 'vision_detections_updated']);

export interface InteractionPolicy {
  discordCooldownMs?: number;
  gameCooldownMs?: number;
  maxContextMemories?: number;
  allowExternalAutoReply?: boolean;
  externalReplyTtlMs?: number;
}

export interface DomainInteractionEvent {
  type: string;
  source?: string;
  sessionId?: string | null;
  correlationId?: string | null;
  payload?: {
    channelId?: string;
    authorId?: string;
    content?: string;
    autoReplyEligible?: boolean;
    game?: string;
    eventType?: string;
    message?: string;
    payload?: {
      message?: string;
    };
  };
}

export interface ExternalResponseDelivery {
  success: boolean;
  channelId?: string;
  text?: string;
  error?: string;
}

export interface PendingExternalReply {
  correlationId: string;
  channelId: string;
  source: string;
  createdAt: number;
}

export type ExternalSenderFn = (channelId: string, text: string) => Promise<{ success?: boolean; error?: string | null; [key: string]: unknown }>;

export class InteractionOrchestrator {
  private geminiSocket: unknown = null;
  private memory: MemoryService;
  private bus: typeof eventBus;
  private senders: Record<string, ExternalSenderFn>;
  private running = false;
  private unsubscribe: (() => void) | null = null;
  private lastByKey = new Map<string, number>();
  private cooldowns = new Map<string, number>();
  private pendingExternalReplies = new Map<string, PendingExternalReply>();
  private policy: Required<InteractionPolicy> = {
    discordCooldownMs: 4000,
    gameCooldownMs: 2500,
    maxContextMemories: 5,
    allowExternalAutoReply: false,
    externalReplyTtlMs: 120000
  };

  constructor({ geminiSocket = null, memory = memoryService, bus = eventBus, senders = {} }: { geminiSocket?: unknown; memory?: MemoryService; bus?: typeof eventBus; senders?: Record<string, ExternalSenderFn> } = {}) {
    this.geminiSocket = geminiSocket;
    this.memory = memory;
    this.bus = bus;
    this.senders = { ...senders };
  }

  setGeminiSocket(socket: unknown): void {
    this.geminiSocket = socket;
  }

  configure(policy: InteractionPolicy = {}): void {
    this.policy = { ...this.policy, ...policy };
  }

  setExternalSender(source: string, sender: ExternalSenderFn): boolean {
    if (!source || typeof sender !== 'function') return false;
    this.senders[source] = sender;
    return true;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.unsubscribe = this.bus.onAny((eventName: string, data: unknown) => {
      if (!this.running || LOW_SIGNAL_EVENTS.has(eventName)) return;
      const envelope = eventName === EVENTS.DOMAIN_EVENT ? (data as DomainInteractionEvent) : null;
      if (!envelope?.type) return;
      void this.handle(envelope).catch((err) => {
        const error = err as Error;
        this.bus.emitDomain('interaction.error', { eventType: envelope.type, message: error.message }, {
          source: 'interaction_orchestrator', sessionId: envelope.sessionId, privacy: 'internal'
        });
      });
    });
  }

  stop(): void {
    this.running = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  async handle(event: DomainInteractionEvent): Promise<{ accepted: boolean; throttled?: boolean; memories?: unknown[] } | null> {
    if (!event || event.source === 'interaction_orchestrator') return null;
    const key = `${event.type}:${event.payload?.channelId || event.payload?.game || ''}`;
    const now = Date.now();
    const cooldown = event.type === EVENTS.DISCORD_MESSAGE
      ? this.policy.discordCooldownMs
      : event.type === 'game.event' || event.type === EVENTS.GAME_EVENT
        ? this.policy.gameCooldownMs
        : 0;
    if (event.type === EVENTS.DISCORD_MESSAGE) {
      const message = event.payload || {};
      const discordSessionId = `discord_${message.channelId || 'unknown'}`;
      if (!this.memory.hasSession?.(discordSessionId)) {
        if (typeof this.memory.ensureSession === 'function') this.memory.ensureSession(discordSessionId, { source: 'discord' });
        else if (this.memory.currentSessionId !== discordSessionId) this.memory.startSession(discordSessionId, { source: 'discord' });
      }
      this.memory.recordTurn?.({ role: 'user', text: message.content || '', source: 'discord', speakerId: message.authorId, sessionId: discordSessionId });
      if (cooldown && now - (this.lastByKey.get(key) || 0) < cooldown) return { accepted: true, throttled: true };
      this.lastByKey.set(key, now);
      const rawMemories = this.memory.retrieveRelevant?.(message.content || '', { limit: this.policy.maxContextMemories });
      const memories: Array<{ id?: string; content?: string; category?: string }> = Array.isArray(rawMemories) ? (rawMemories as Array<{ id?: string; content?: string; category?: string }>) : [];
      this.bus.emitDomain('interaction.context_ready', {
        channelId: message.channelId,
        authorId: message.authorId,
        text: message.content,
        memories: memories.map((memory) => ({ id: memory.id, content: memory.content, category: memory.category }))
      }, { source: 'interaction_orchestrator', sessionId: event.sessionId, privacy: 'external' });
      if (this.policy.allowExternalAutoReply && message.autoReplyEligible === true && event.correlationId) {
        this.pendingExternalReplies.set(event.correlationId, {
          correlationId: event.correlationId,
          channelId: message.channelId || '',
          source: 'discord',
          createdAt: now
        });
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
      this.memory.recordTurn?.({ role: 'system', text, source: payload.game || 'game', sessionId: gameSessionId });
      this.bus.emitDomain('interaction.game_context_ready', {
        game: payload.game || 'unknown', eventType: payload.eventType || 'state_changed', text
      }, { source: 'interaction_orchestrator', privacy: 'external' });
      return { accepted: true };
    }
    return null;
  }

  async deliverExternalResponse(text: string, correlationId: string | null = null): Promise<ExternalResponseDelivery> {
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

  destroy(): void {
    this.stop();
    this.lastByKey.clear();
    this.cooldowns.clear();
    this.pendingExternalReplies.clear();
  }
}

export const interactionOrchestrator = new InteractionOrchestrator();
export default interactionOrchestrator;
