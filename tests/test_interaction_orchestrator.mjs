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
