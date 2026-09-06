import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus, EVENTS } from '../src/services/eventBus.js';
import { InteractionOrchestrator } from '../src/services/interaction/InteractionOrchestrator.js';

test('interaction orchestrator routes Discord context without duplicating sessions', async () => {
  const bus = new EventBus();
  const memory = {
    currentSessionId: null,
    turns: [],
    startSession(id) { this.currentSessionId = id; this.turns = []; },
    recordTurn(turn) { this.turns.push(turn); },
    retrieveRelevant() { return [{ id: 'm1', content: 'Ariel juega Minecraft', category: 'preference' }]; }
  };
  const orchestrator = new InteractionOrchestrator({ memory, bus });
  const contextEvents = [];
  bus.on('interaction.context_ready', (event) => contextEvents.push(event));
  orchestrator.start();
  bus.emitDomain(EVENTS.DISCORD_MESSAGE, {
    channelId: 'c1', authorId: 'u1', authorName: 'Ariel', content: '¿Jugamos Minecraft?'
  }, { source: 'discord', sessionId: 'discord_c1', privacy: 'external' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(memory.currentSessionId, 'discord_c1');
  assert.equal(memory.turns.length, 1);
  assert.equal(contextEvents.length, 1);
  orchestrator.destroy();
});

test('Discord cooldown throttles replies without discarding turns or changing the active Live session', async () => {
  const bus = new EventBus();
  const memory = {
    currentSessionId: 'live_call',
    sessions: new Map([['live_call', { turns: [] }]]),
    hasSession(id) { return this.sessions.has(id); },
    ensureSession(id) { if (!this.sessions.has(id)) this.sessions.set(id, { turns: [] }); },
    recordTurn(turn) { this.sessions.get(turn.sessionId).turns.push(turn); },
    retrieveRelevant() { return []; }
  };
  const orchestrator = new InteractionOrchestrator({ memory, bus });
  const first = await orchestrator.handle({ type: EVENTS.DISCORD_MESSAGE, payload: { channelId: 'c1', authorId: 'u1', content: 'Primero' } });
  const second = await orchestrator.handle({ type: EVENTS.DISCORD_MESSAGE, payload: { channelId: 'c1', authorId: 'u1', content: 'Segundo' } });
  assert.equal(first.accepted, true);
  assert.equal(second.throttled, true);
  assert.equal(memory.currentSessionId, 'live_call');
  assert.deepEqual(memory.sessions.get('discord_c1').turns.map(turn => turn.text), ['Primero', 'Segundo']);
});

test('external replies require their exact correlation and never use the shared Live reply', async () => {
  const bus = new EventBus();
  const memory = {
    hasSession: () => false,
    ensureSession() {},
    recordTurn() {},
    retrieveRelevant: () => []
  };
  const sharedSocket = { isConnected: true, sent: 0, sendTextMessage() { this.sent++; } };
  const sent = [];
  const requested = [];
  bus.on('interaction.external_reply_requested', event => requested.push(event));
  const orchestrator = new InteractionOrchestrator({ memory, bus, geminiSocket: sharedSocket,
    senders: { discord: async (channelId, text) => sent.push({ channelId, text }) } });
  orchestrator.configure({ allowExternalAutoReply: true, externalReplyTtlMs: 60000 });
  const event = {
    type: EVENTS.DISCORD_MESSAGE,
    correlationId: 'corr-1',
    payload: { channelId: 'c1', authorId: 'u1', content: '¿Sigues ahí?', autoReplyEligible: true }
  };
  await orchestrator.handle(event);
  assert.equal(sharedSocket.sent, 0);
  assert.equal(requested.length, 1);
  assert.equal((await orchestrator.deliverExternalResponse('Respuesta equivocada')).success, false);
  assert.equal((await orchestrator.deliverExternalResponse('Respuesta correcta', 'corr-1')).success, true);
  assert.deepEqual(sent, [{ channelId: 'c1', text: 'Respuesta correcta' }]);
  assert.equal((await orchestrator.deliverExternalResponse('Reintento', 'corr-1')).success, false);
  orchestrator.destroy();
});

test('external reply keeps its pending item when the transport fails and expires safely', async () => {
  const orchestrator = new InteractionOrchestrator({ senders: { discord: async () => { throw new Error('network unavailable'); } } });
  orchestrator.pendingExternalReplies.set('corr-2', { correlationId: 'corr-2', channelId: 'c2', source: 'discord', createdAt: Date.now() });
  await assert.rejects(orchestrator.deliverExternalResponse('Mensaje', 'corr-2'), /network unavailable/);
  assert.equal(orchestrator.pendingExternalReplies.has('corr-2'), true);
  orchestrator.pendingExternalReplies.get('corr-2').createdAt = Date.now() - 5000;
  orchestrator.configure({ externalReplyTtlMs: 1000 });
  const expired = await orchestrator.deliverExternalResponse('Mensaje', 'corr-2');
  assert.equal(expired.success, false);
  assert.equal(orchestrator.pendingExternalReplies.has('corr-2'), false);
});
