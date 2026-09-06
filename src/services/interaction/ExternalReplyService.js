import { eventBus } from '../eventBus.js';
import { interactionOrchestrator } from './InteractionOrchestrator.js';

const DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function extractText(payload) {
  return String(payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('') || '').trim();
}

function compactText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

/**
 * Generates Discord-only replies in a separate Gemini REST request. It never
 * consumes the answer of the shared Live conversation, so a channel message
 * cannot accidentally make Cristi speak or post the wrong response.
 */
export class ExternalReplyService {
  constructor({ bus = eventBus, orchestrator = interactionOrchestrator, fetchImpl = globalThis.fetch } = {}) {
    this.bus = bus;
    this.orchestrator = orchestrator;
    this.fetchImpl = fetchImpl;
    this.apiKey = '';
    this.model = 'gemini-2.5-flash';
    this.systemPrompt = '';
    this.endpoint = DEFAULT_ENDPOINT;
    this.timeoutMs = 12000;
    this.unsubscribe = null;
    this.inFlight = new Set();
  }

  configure({ apiKey, model, systemPrompt, endpoint, timeoutMs } = {}) {
    if (apiKey !== undefined) this.apiKey = String(apiKey || '').trim();
    if (model) this.model = String(model).trim();
    if (systemPrompt !== undefined) this.systemPrompt = String(systemPrompt || '').trim();
    if (endpoint) this.endpoint = String(endpoint).replace(/\/$/, '');
    if (Number.isFinite(Number(timeoutMs))) this.timeoutMs = Math.max(1000, Math.min(30000, Number(timeoutMs)));
  }

  start() {
    if (this.unsubscribe) return;
    this.unsubscribe = this.bus.on('interaction.external_reply_requested', (envelope) => {
      void this.handle(envelope).catch(() => {});
    });
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  async handle(envelope) {
    const request = envelope?.payload || envelope;
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
    } catch (error) {
      this.bus.emitDomain('interaction.external_reply_failed', {
        correlationId, channelId: request?.channelId || null, source: request?.source || 'discord',
        message: error?.message || String(error)
      }, { source: 'external_reply_service', correlationId, privacy: 'internal' });
      return { success: false, error: error?.message || String(error) };
    } finally {
      this.inFlight.delete(correlationId);
    }
  }

  async generateReply(request = {}) {
    if (!this.apiKey) throw new Error('Configura la API key de Gemini antes de activar respuestas automáticas de Discord.');
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
      const response = await this.fetchImpl(`${this.endpoint}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller?.signal,
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.65, maxOutputTokens: 300 } })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || `Gemini HTTP ${response.status}`);
      return compactText(extractText(payload), 700);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  destroy() {
    this.stop();
    this.inFlight.clear();
  }
}

export const externalReplyService = new ExternalReplyService();
export default externalReplyService;
