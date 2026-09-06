import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus, EVENTS } from '../src/services/eventBus.js';
import { InteractionOrchestrator } from '../src/services/interaction/InteractionOrchestrator.js';
import { ExternalReplyService } from '../src/services/interaction/ExternalReplyService.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('eligible Discord messages receive a separately correlated Gemini response without using Live audio', async () => {
  const bus = new EventBus();
  const sent = [];
  const memory = {
    hasSession: () => false,
    ensureSession() {},
    recordTurn() {},
    retrieveRelevant: () => [{ id: 'memory-1', content: 'Prefiere respuestas breves', category: 'preference' }]
  };
  const liveSocket = { isConnected: true, sent: 0, sendTextMessage() { this.sent += 1; } };
  const orchestrator = new InteractionOrchestrator({
    bus, memory, geminiSocket: liveSocket,
    senders: { discord: async (channelId, text) => { sent.push({ channelId, text }); return { success: true }; } }
  });
  orchestrator.configure({ allowExternalAutoReply: true });
  const replyService = new ExternalReplyService({
    bus, orchestrator,
    fetchImpl: async () => ({ ok: true, async json() { return { candidates: [{ content: { parts: [{ text: 'Claro, dime qué necesitas.' }] } }] }; } })
  });
  replyService.configure({ apiKey: 'test-key', systemPrompt: 'Responde con claridad.' });
  replyService.start();
  orchestrator.start();

  bus.emitDomain(EVENTS.DISCORD_MESSAGE, {
    channelId: 'channel-1', authorId: 'user-1', content: '¿Puedes ayudarme?', autoReplyEligible: true
  }, { source: 'discord', sessionId: 'discord_channel-1', correlationId: 'discord-correlation-1', privacy: 'external' });
  await tick();
  await tick();
  await tick();

  assert.deepEqual(sent, [{ channelId: 'channel-1', text: 'Claro, dime qué necesitas.' }]);
  assert.equal(liveSocket.sent, 0, 'a Discord reply cannot consume or publish a Live-call answer');
  assert.equal(orchestrator.pendingExternalReplies.size, 0);

  bus.emitDomain(EVENTS.DISCORD_MESSAGE, {
    channelId: 'channel-1', authorId: 'user-2', content: 'No responder automáticamente', autoReplyEligible: false
  }, { source: 'discord', sessionId: 'discord_channel-1', correlationId: 'discord-correlation-2', privacy: 'external' });
  await tick();
  assert.equal(sent.length, 1, 'channels outside the explicit allow-list retain context but do not receive a reply');

  replyService.destroy();
  orchestrator.destroy();
});

test('Discord auto-reply keeps its pending item when delivery fails', async () => {
  const bus = new EventBus();
  const orchestrator = new InteractionOrchestrator({
    bus,
    senders: { discord: async () => ({ success: false, error: 'Missing Send Messages permission' }) }
  });
  orchestrator.pendingExternalReplies.set('corr-fail', {
    correlationId: 'corr-fail', channelId: 'channel-fail', source: 'discord', createdAt: Date.now()
  });
  const failures = [];
  const stop = bus.on('interaction.external_reply_failed', (event) => failures.push(event.payload));
  const replyService = new ExternalReplyService({
    bus, orchestrator,
    fetchImpl: async () => ({ ok: true, async json() { return { candidates: [{ content: { parts: [{ text: 'Intento de respuesta' }] } }] }; } })
  });
  replyService.configure({ apiKey: 'test-key' });
  const result = await replyService.handle({ payload: { correlationId: 'corr-fail', channelId: 'channel-fail', source: 'discord', text: 'hola' } });

  assert.equal(result.success, false);
  assert.equal(orchestrator.pendingExternalReplies.has('corr-fail'), true);
  assert.match(failures[0].message, /Missing Send Messages permission/);
  stop();
  replyService.destroy();
  orchestrator.destroy();
});
