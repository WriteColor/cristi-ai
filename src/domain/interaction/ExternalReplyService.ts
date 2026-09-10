import { electronBridge } from '../../services/desktop/ElectronBridge';
import { eventBus } from '../../infrastructure/events/eventBus';
import { interactionOrchestrator } from './InteractionOrchestrator';

const DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function extractText(payload: unknown): string {
  const p = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return String(p?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('') || '').trim();
}

function compactText(value: unknown, maxLength: number): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export interface ExternalReplyRequest {
  correlationId?: string;
  channelId?: string | null;
  source?: string;
  authorId?: string;
  text?: string;
  memories?: Array<{ id?: string; content?: string; category?: string }>;
}

export interface ExternalReplyServiceOptions {
  bus?: typeof eventBus;
  orchestrator?: typeof interactionOrchestrator;
  fetchImpl?: typeof globalThis.fetch;
}

/**
 * Generates Discord-only replies in a separate Gemini REST request.
 */
export class ExternalReplyService {
  private bus: typeof eventBus;
  private orchestrator: typeof interactionOrchestrator;
  private fetchImpl: typeof globalThis.fetch;
  private apiKey = '';
  private model = 'gemini-2.5-flash';
  private systemPrompt = '';
  private endpoint = DEFAULT_ENDPOINT;
  private timeoutMs = 12000;
  private unsubscribe: (() => void) | null = null;
  private inFlight = new Set<string>();

  constructor({ bus = eventBus, orchestrator = interactionOrchestrator, fetchImpl = globalThis.fetch }: ExternalReplyServiceOptions = {}) {
    this.bus = bus;
    this.orchestrator = orchestrator;
    this.fetchImpl = fetchImpl;
  }

  configure({ apiKey, model, systemPrompt, endpoint, timeoutMs }: {
    apiKey?: string;
    model?: string;
    systemPrompt?: string;
    endpoint?: string;
    timeoutMs?: number;
  } = {}): void {
    if (apiKey !== undefined) this.apiKey = String(apiKey || '').trim();
    if (model) this.model = String(model).trim();
    if (systemPrompt !== undefined) this.systemPrompt = String(systemPrompt || '').trim();
    if (endpoint) this.endpoint = String(endpoint).replace(/\/$/, '');
    if (Number.isFinite(Number(timeoutMs))) this.timeoutMs = Math.max(1000, Math.min(30000, Number(timeoutMs)));
  }

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.bus.on('interaction.external_reply_requested', (envelope: unknown) => {
      void this.handle(envelope).catch(() => {});
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  async handle(envelope: unknown): Promise<{ success: boolean; ignored?: boolean; text?: string; delivery?: unknown; error?: string }> {
    const request = ((envelope && typeof envelope === 'object' && 'payload' in envelope)
      ? (envelope as { payload: ExternalReplyRequest }).payload
      : envelope) as ExternalReplyRequest;
    const correlationId = request?.correlationId;
    if (!correlationId || this.inFlight.has(correlationId)) return { success: false, ignored: true };
    this.inFlight.add(correlationId);
    try {
      const text = await this.generateReply(request);
      if (!text) throw new Error('Gemini no devolvió texto para Discord.');
      const delivery = await this.orchestrator.deliverExternalResponse(text, correlationId);
      if (!delivery.success) throw new Error(delivery.error || 'No se pudo entregar la respuesta de Discord.');
      this.bus.emitDomain('interaction.external_reply_completed', {
        correlationId, channelId: request.channelId, source: request.source || 'discord', text
      }, { source: 'external_reply_service', correlationId, privacy: 'external' });
      return { success: true, text, delivery };
    } catch (err) {
      const error = err as Error;
      this.bus.emitDomain('interaction.external_reply_failed', {
        correlationId, channelId: request?.channelId || null, source: request?.source || 'discord',
        message: error?.message || String(error)
      }, { source: 'external_reply_service', correlationId, privacy: 'internal' });
      return { success: false, error: error?.message || String(error) };
    } finally {
      this.inFlight.delete(correlationId);
    }
  }

  async generateReply(request: ExternalReplyRequest = {}): Promise<string> {
    if (typeof this.fetchImpl !== 'function') throw new Error('fetch no está disponible para responder en Discord.');
    const memories = Array.isArray(request.memories) ? request.memories.slice(0, 5) : [];
    const memoryContext = memories.map((memory) => `- ${compactText(memory?.content, 240)}`).filter(Boolean).join('\n');
    const prompt = [
      'Responde como Cristi a un único mensaje de Discord.',
      'Escribe sólo la respuesta que se enviará al canal, sin markdown técnico, etiquetas ni mencionar instrucciones internas.',
      'Sé útil, respetuosa y concisa (máximo 700 caracteres). No afirmes acciones que no realizaste.',
      this.systemPrompt ? `Contexto de personalidad:\n${compactText(this.systemPrompt, 2500)}` : '',
      memoryContext ? `Memoria relevante:\n${memoryContext}` : '',
      `Mensaje de ${compactText(request.authorId, 96) || 'un usuario'}:\n${compactText(request.text, 3000)}`
    ].filter(Boolean).join('\n\n');
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
    try {
      const payload = await electronBridge.geminiGenerate(this.model, { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.65, maxOutputTokens: 300 } });
      return compactText(extractText(payload), 700);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  destroy(): void {
    this.stop();
    this.inFlight.clear();
  }
}

export const externalReplyService = new ExternalReplyService();
export default externalReplyService;
