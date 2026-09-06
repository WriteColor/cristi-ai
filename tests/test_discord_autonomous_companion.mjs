import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus, EVENTS } from '../src/services/eventBus.js';
import { DiscordCompanionService } from '../src/services/discord/DiscordCompanionService.js';
import { InteractionOrchestrator } from '../src/services/interaction/InteractionOrchestrator.js';

test('DiscordCompanionService evaluates autoReply eligibility properly', () => {
  const bus = new EventBus();
  const service = new DiscordCompanionService({ bus, bridge: {} });

  // When autoReply is false
  service.config.autoReply = false;
  service.config.monitoredChannels = ['123456789'];
  assert.equal(service.isAutoReplyEligible('123456789'), false);
  assert.equal(service.isAutoReplyEligible({ channelId: '123456789', isMentioned: true }), false);

  // When autoReply is true
  service.config.autoReply = true;
  service.config.monitoredChannels = ['123456789'];
  service.config.prefix = '!cristi';

  // Explicit channel match
  assert.equal(service.isAutoReplyEligible('123456789'), true);
  assert.equal(service.isAutoReplyEligible({ channelId: '123456789' }), true);

  // Unmonitored channel without mention
  assert.equal(service.isAutoReplyEligible('999999999'), false);
  assert.equal(service.isAutoReplyEligible({ channelId: '999999999', content: 'hola que tal' }), false);

  // Unmonitored channel WITH bot mention
  assert.equal(service.isAutoReplyEligible({ channelId: '999999999', isMentioned: true, content: 'hola cristi' }), true);

  // Direct Message (DM)
  assert.equal(service.isAutoReplyEligible({ channelId: 'dm-1', isDirectMessage: true, content: 'hola en privado' }), true);

  // Prefix match
  assert.equal(service.isAutoReplyEligible({ channelId: '999999999', content: '!cristi que opinas de esto?' }), true);

  // If monitoredChannels is empty, all channels become eligible when autoReply is true
  service.config.monitoredChannels = [];
  assert.equal(service.isAutoReplyEligible('any-channel'), true);
  assert.equal(service.isAutoReplyEligible({ channelId: 'random-ch' }), true);

  service.destroy();
});

test('DiscordCompanionService emits DISCORD_MESSAGE with correlationId and triggers orchestrator', async () => {
  const bus = new EventBus();
  let messageHandler = null;
  const mockBridge = {
    onDiscordMessage: (cb) => {
      messageHandler = cb;
      return () => { messageHandler = null; };
    },
    onDiscordEvent: () => () => {},
    onConfigUpdated: () => () => {}
  };

  const service = new DiscordCompanionService({ bus, bridge: mockBridge });
  service.config.autoReply = true;
  service.config.monitoredChannels = ['111222333'];

  const turns = [];
  const memory = {
    hasSession: () => true,
    ensureSession: () => {},
    recordTurn: (turn) => turns.push(turn),
    retrieveRelevant: () => [{ id: 'mem-1', content: 'Prefiere respuestas en español', category: 'preference' }]
  };

  const sentReplies = [];
  const orchestrator = new InteractionOrchestrator({
    bus,
    memory,
    senders: {
      discord: async (channelId, text) => {
        sentReplies.push({ channelId, text });
        return { success: true };
      }
    }
  });
  orchestrator.configure({ allowExternalAutoReply: true });
  orchestrator.start();

  const requestedEvents = [];
  bus.on('interaction.external_reply_requested', (evt) => requestedEvents.push(evt.payload));

  // Simulate incoming mention in an unmonitored channel
  messageHandler({
    id: 'msg-999',
    channelId: 'channel-unmonitored',
    authorId: 'user-xyz',
    authorName: 'Jeremy',
    content: 'Hola Cristi, ¿estás lista para jugar?',
    isMentioned: true,
    isDirectMessage: false
  });

  // Verify recent messages storage
  assert.equal(service.recentMessages.length, 1);
  assert.equal(service.recentMessages[0].id, 'msg-999');

  // Verify external reply request was generated with correlationId and memory context
  assert.equal(requestedEvents.length, 1);
  assert.equal(requestedEvents[0].correlationId, 'discord_msg-999');
  assert.equal(requestedEvents[0].channelId, 'channel-unmonitored');
  assert.equal(requestedEvents[0].authorId, 'user-xyz');
  assert.equal(requestedEvents[0].memories.length, 1);

  // Verify memory recorded the turn in discord session
  assert.equal(turns.length, 1);
  assert.equal(turns[0].sessionId, 'discord_channel-unmonitored');
  assert.equal(turns[0].speakerId, 'user-xyz');

  // Deliver simulated reply
  await orchestrator.deliverExternalResponse('¡Hola Jeremy! Sí, estoy totalmente lista.', 'discord_msg-999');
  assert.equal(sentReplies.length, 1);
  assert.equal(sentReplies[0].text, '¡Hola Jeremy! Sí, estoy totalmente lista.');

  service.destroy();
  orchestrator.destroy();
});
