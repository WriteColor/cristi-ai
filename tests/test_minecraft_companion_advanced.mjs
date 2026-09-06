import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus, EVENTS } from '../src/services/eventBus.js';
import { MinecraftCompanionService } from '../src/services/gameIntegration/MinecraftCompanionService.js';
import { InteractionOrchestrator } from '../src/services/interaction/InteractionOrchestrator.js';

test('MinecraftCompanionService provides accurate perception summaries and threat detection', () => {
  const bus = new EventBus();
  const service = new MinecraftCompanionService({ bus, bridge: {} });

  service.updateBotState({
    health: 20,
    food: 18,
    position: { x: 100, y: 64, z: -200 },
    dimension: 'overworld',
    nearbyPlayers: ['Jeremy'],
    nearbyEntities: [
      { name: 'pig', distance: 4, isHostile: false },
      { name: 'creeper', distance: 6, isHostile: true }
    ],
    inventory: [
      { name: 'iron_sword', count: 1 },
      { name: 'cooked_beef', count: 16 }
    ]
  });

  const perception = service.getPerceptionSummary();
  assert.equal(perception.health, 20);
  assert.equal(perception.food, 18);
  assert.equal(perception.isLowHealth, false);
  assert.equal(perception.threats.length, 1);
  assert.equal(perception.threats[0].name, 'creeper');
  assert.equal(perception.nearbyPlayers[0], 'Jeremy');
  assert.ok(perception.narrative.includes('Salud: 20/20'));
  assert.ok(perception.narrative.includes('creeper a 6m'));
  assert.ok(perception.narrative.includes('iron_sword (1)'));

  // Test low health detection
  service.updateBotState({ health: 4 });
  const lowPerception = service.getPerceptionSummary();
  assert.equal(lowPerception.health, 4);
  assert.equal(lowPerception.isLowHealth, true);

  service.destroy();
});

test('MinecraftCompanionService reacts to live health, damage, and death events', () => {
  const bus = new EventBus();
  let eventCallback = null;
  const mockBridge = {
    onMinecraftEvent: (cb) => {
      eventCallback = cb;
      return () => { eventCallback = null; };
    },
    onMinecraftChat: () => () => {}
  };

  const service = new MinecraftCompanionService({ bus, bridge: mockBridge });
  const alerts = [];
  bus.on('game.threat_alert', (evt) => alerts.push(evt.payload));

  // Receive normal health update
  eventCallback({ type: 'health', health: 16, food: 14 });
  assert.equal(service.botState.health, 16);
  assert.equal(service.botState.food, 14);
  assert.equal(alerts.length, 0);

  // Receive critical damage (low health alert)
  eventCallback({ type: 'health', health: 5, food: 8 });
  assert.equal(service.botState.health, 5);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].alertType, 'low_health');
  assert.equal(alerts[0].health, 5);

  // Receive death event
  eventCallback({ type: 'death', message: 'El bot ha muerto' });
  assert.equal(service.botState.health, 0);
  assert.equal(alerts.length, 2);
  assert.equal(alerts[1].alertType, 'bot_death');

  service.destroy();
});

test('Minecraft game events are recorded by InteractionOrchestrator without affecting voice call', async () => {
  const bus = new EventBus();
  const turns = [];
  const memory = {
    hasSession: () => true,
    ensureSession: () => {},
    recordTurn: (turn) => turns.push(turn),
    retrieveRelevant: () => []
  };

  const orchestrator = new InteractionOrchestrator({ bus, memory });
  orchestrator.start();

  const gameContexts = [];
  bus.on('interaction.game_context_ready', (evt) => gameContexts.push(evt.payload));

  bus.emitDomain(EVENTS.GAME_EVENT, {
    game: 'minecraft',
    eventType: 'threat_detected',
    payload: { message: 'Creeper detectado cerca de Jeremy' }
  }, { source: 'minecraft' });

  assert.equal(turns.length, 1);
  assert.equal(turns[0].source, 'minecraft');
  assert.equal(turns[0].text, 'Creeper detectado cerca de Jeremy');
  assert.equal(gameContexts.length, 1);
  assert.equal(gameContexts[0].game, 'minecraft');

  orchestrator.destroy();
});
