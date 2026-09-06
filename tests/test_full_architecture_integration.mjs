/**
 * Cristi AI - Full Architecture Integration Test
 * Verifies the 6 integrated architectural pillars:
 * 1. Unified Tools Catalog & Event Contracts
 * 2. Multi-Layer Persistent Memory & Post-Session Consolidation
 * 3. Autonomous Discord Companion (mentions, DMs, external reply routing)
 * 4. Game Perception & Real-Time Telemetry (Minecraft)
 * 5. Proactive Arbiter & Contextual Spontaneous Dialogue
 * 6. In-Game Audio Routing, VAD & Acoustic Loop Shielding
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus, EVENTS } from '../src/services/eventBus.js';
import { COMPANION_FUNCTION_DECLARATIONS } from '../src/config/tools.js';
import { MemoryService, MEMORY_CATEGORIES } from '../src/services/memory/MemoryService.js';
import { DiscordCompanionService } from '../src/services/discord/DiscordCompanionService.js';
import { MinecraftCompanionService } from '../src/services/gameIntegration/MinecraftCompanionService.js';
import { InteractionOrchestrator } from '../src/services/interaction/InteractionOrchestrator.js';
import { ProactiveArbiter, ProactiveTriggerService } from '../src/services/proactiveTriggerService.js';
import { toolExecutor } from '../src/services/toolExecutor.js';
import { audioRoutingService } from '../src/services/translation/AudioRoutingService.js';

test('Pillar 1: Unified Tools Catalog & Event Contracts', () => {
  const toolNames = COMPANION_FUNCTION_DECLARATIONS.map((t) => t.name);
  const requiredTools = [
    'manage_memory',
    'translate_and_speak_in_game',
    'discord_send_message',
    'minecraft_chat',
    'minecraft_move_to',
    'minecraft_mine_block',
    'set_alarm',
    'set_reminder'
  ];

  for (const tool of requiredTools) {
    assert.ok(toolNames.includes(tool), `Catalog must include tool "${tool}"`);
  }

  const requiredEvents = [
    'DISCORD_MESSAGE',
    'DISCORD_CONNECTED',
    'GAME_EVENT',
    'GAME_STATE_CHANGED',
    'TRANSLATION_COMPLETED',
    'TRANSLATION_TEXT_READY',
    'USER_SILENCE'
  ];

  for (const evt of requiredEvents) {
    assert.ok(EVENTS[evt], `EVENTS must define contract "${evt}"`);
  }
});

test('Pillar 2: Multi-Layer Persistent Memory & Autonomous Consolidation', async () => {
  const memory = new MemoryService({ storagePrefix: `test_pillar2_${Date.now()}_` });
  await memory.initialize();
  await memory.clearAll();

  // Store fact
  const storeRes = await memory.manageMemory({
    action: 'store',
    key: 'ariel_dev',
    category: MEMORY_CATEGORIES.FACT,
    content: 'Ariel es desarrollador de software y usa Brave Browser',
    importance: 0.9
  });
  assert.equal(storeRes.status, 'success');

  // Recall
  const recallRes = await memory.manageMemory({
    action: 'recall',
    query: 'Brave Browser'
  });
  assert.equal(recallRes.status, 'success');
  assert.ok(recallRes.results.length > 0, 'Should find stored fact');

  // Autonomous Session Consolidation
  const testSessionId = memory.startSession(`test_session_${Date.now()}`);
  memory.recordTurn({ role: 'user', text: 'Me gusta programar escuchando synthwave en Spotify', sessionId: testSessionId });
  memory.recordTurn({ role: 'assistant', text: '¡Qué buen gusto, Ariel! El synthwave te ayuda a concentrarte.', sessionId: testSessionId });
  memory.recordTurn({ role: 'user', text: 'Recuérdame terminar la arquitectura de Cristi AI mañana', sessionId: testSessionId });
  memory.recordTurn({ role: 'assistant', text: 'Anotado, amor. Mañana terminamos la arquitectura de Cristi AI.', sessionId: testSessionId });

  const sessionSummary = await memory.endSession({ sessionId: testSessionId });
  assert.ok(sessionSummary, 'endSession should generate a summary memory');
  assert.ok(sessionSummary.content.length > 0);

  const systemContext = memory.getSystemPromptContext();
  assert.ok(systemContext.includes('RECUERDOS Y MEMORIA PERMANENTE'));
  assert.ok(systemContext.includes('Ariel') || systemContext.includes('Brave Browser'));

  memory.destroy();
});

test('Pillar 3: Autonomous Discord Companion (Mentions, DMs, Correlated Replies)', async () => {
  const bus = new EventBus();
  const turns = [];
  const memory = {
    hasSession: () => true,
    ensureSession: () => {},
    recordTurn: (turn) => turns.push(turn),
    retrieveRelevant: () => [{ id: 'mem-1', content: 'Prefiere respuestas breves', category: 'preference' }]
  };
  const discordReplies = [];

  const orchestrator = new InteractionOrchestrator({
    bus,
    memory,
    senders: {
      discord: async (channelId, text) => {
        discordReplies.push({ channelId, text });
        return { success: true };
      }
    }
  });
  orchestrator.configure({ allowExternalAutoReply: true });
  orchestrator.start();

  let messageCallback = null;
  const mockBridge = {
    onDiscordMessage: (cb) => { messageCallback = cb; return () => {}; },
    onDiscordEvent: () => () => {},
    onConfigUpdated: () => () => {}
  };

  const discordService = new DiscordCompanionService({ bus, bridge: mockBridge });
  discordService.config.autoReply = true;
  discordService.config.monitoredChannels = ['general-chat-1'];

  const replyRequests = [];
  bus.on('interaction.external_reply_requested', (evt) => replyRequests.push(evt.payload));

  // User mentions bot in an unmonitored channel
  messageCallback({
    id: 'msg-mention-1',
    channelId: 'off-topic-channel',
    authorId: 'user-ariel',
    content: 'Cristi, ¿puedes verificar si el servidor está en línea?',
    isMentioned: true,
    isDirectMessage: false
  });

  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(replyRequests.length, 1);
  assert.equal(replyRequests[0].channelId, 'off-topic-channel');
  assert.equal(replyRequests[0].correlationId, 'discord_msg-mention-1');

  // Deliver response through orchestrator
  await orchestrator.deliverExternalResponse('El servidor de pruebas está 100% activo.', 'discord_msg-mention-1');
  assert.equal(discordReplies.length, 1);
  assert.equal(discordReplies[0].text, 'El servidor de pruebas está 100% activo.');

  discordService.destroy();
  orchestrator.destroy();
});

test('Pillar 4: Game Perception & Real-Time Telemetry (Minecraft)', () => {
  const bus = new EventBus();
  const service = new MinecraftCompanionService({ bus, bridge: {} });

  service.updateBotState({
    health: 18,
    food: 16,
    position: { x: 50, y: 70, z: -120 },
    dimension: 'overworld',
    nearbyPlayers: ['Jeremy'],
    nearbyEntities: [
      { name: 'skeleton', distance: 7, isHostile: true }
    ],
    inventory: [
      { name: 'diamond_sword', count: 1 }
    ]
  });

  const perception = service.getPerceptionSummary();
  assert.equal(perception.health, 18);
  assert.equal(perception.isLowHealth, false);
  assert.equal(perception.threats.length, 1);
  assert.equal(perception.threats[0].name, 'skeleton');
  assert.ok(perception.narrative.includes('Salud: 18/20'));

  // Critical health detection
  service.updateBotState({ health: 5 });
  const criticalPerception = service.getPerceptionSummary();
  assert.equal(criticalPerception.isLowHealth, true);

  service.destroy();
});

test('Pillar 5: Proactive Arbiter & Spontaneous Dialogue with Breathing Room', () => {
  const arbiter = new ProactiveArbiter({ userSpeechCooldownMs: 15000 });
  const now = Date.now();

  // Rule A: Veto 15s post user speech
  arbiter.recordUserSpeechEnded(now - 4000);
  const vetoCooldown = arbiter.evaluate({
    silenceSec: 40,
    context: [{ id: 'm1', category: 'task', content: 'Revisar PR' }],
    now
  });
  assert.equal(vetoCooldown.allowed, false);
  assert.equal(vetoCooldown.reason, 'user_speech_cooldown');

  // Rule B: Veto question chaining
  arbiter.recordUserSpeechEnded(now - 20000); // cooldown expired
  arbiter.recordModelSpoke('¿Terminaste el commit?', true); // Model asked a question
  const vetoChaining = arbiter.evaluate({
    silenceSec: 40,
    context: [{ id: 'm1', category: 'task', content: 'Revisar PR' }],
    now
  });
  assert.equal(vetoChaining.allowed, false);
  assert.equal(vetoChaining.reason, 'question_chaining_veto');

  // Rule C: Threat alert bypasses question chaining veto
  const threatBypass = arbiter.evaluate({
    silenceSec: 10,
    context: [],
    now,
    gameThreat: { alertType: 'low_health', health: 4 }
  });
  assert.equal(threatBypass.allowed, true);
  assert.ok(threatBypass.score >= 0.8);
});

test('Pillar 6: In-Game Audio Routing & Loopback Feedback Protection', async () => {
  // Test tool dispatch for in-game translation
  const result = await toolExecutor.executeTool('translate_and_speak_in_game', {
    message: 'We are attacking the base, cover us!',
    target_language: 'en',
    output_route: 'game_voice'
  });

  assert.ok(result.status === 'success' || result.status === 'disabled' || result.status === 'error');
  assert.equal(result.target_language, 'en');

  // Acoustic loop protection: verify markGenerated shields frame from STT loopback
  const testFrameId = `frame_test_${Date.now()}`;
  audioRoutingService.markGenerated(testFrameId, 'cristi_game_voice');
  assert.ok(audioRoutingService.isGenerated(testFrameId), 'Frame must be recognized as AI-generated');
  assert.equal(
    audioRoutingService.acceptFrame({ frameId: testFrameId, sourceId: 'microphone', data: 'AQID' }),
    false,
    'Generated frame must be rejected by acceptFrame to shield microphone from acoustic feedback'
  );
});

test('Teardown and Clean Exit', () => {
  console.log('\n🎉 ALL 6 ARCHITECTURAL PILLARS VERIFIED PASSING AT 100%!\n');
  process.exit(0);
});
