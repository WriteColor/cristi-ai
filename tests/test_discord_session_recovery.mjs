import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus } from '../src/services/eventBus.js';
import { DiscordCompanionService } from '../src/services/discord/DiscordCompanionService.js';

function createBridge() {
  let eventListener = null;
  let messageListener = null;
  const calls = { connect: 0, disconnect: 0, storedTokens: [] };
  return {
    isElectron: true,
    calls,
    onDiscordEvent(listener) { eventListener = listener; return () => { eventListener = null; }; },
    onDiscordMessage(listener) { messageListener = listener; return () => { messageListener = null; }; },
    async getSecureSecret() { return null; },
    async setSecureSecret(_key, value) { calls.storedTokens.push(value); return true; },
    async discordConnect() {
      calls.connect += 1;
      return { success: true, connectionId: 'discord-connection-a', botInfo: { tag: 'Cristi#0001' } };
    },
    async discordDisconnect() { calls.disconnect += 1; return { success: true }; },
    emitEvent(payload) { eventListener?.(payload); },
    emitMessage(payload) { messageListener?.(payload); }
  };
}

test('Discord retains the active connection through gateway recovery and ignores retired client events', async () => {
  const bridge = createBridge();
  const service = new DiscordCompanionService({ bridge, bus: new EventBus() });
  const result = await service.connect('bot-token');

  assert.equal(result.status, 'success');
  assert.equal(service.status, 'connected');
  assert.equal(service.transportConnectionId, 'discord-connection-a');
  assert.deepEqual(bridge.calls.storedTokens, ['bot-token']);

  bridge.emitEvent({ type: 'disconnect', connectionId: 'retired-client' });
  assert.equal(service.status, 'connected', 'late retired disconnect cannot demote the active bot');

  bridge.emitEvent({ type: 'disconnect', connectionId: 'discord-connection-a' });
  assert.equal(service.status, 'reconnecting');
  bridge.emitEvent({ type: 'ready', connectionId: 'discord-connection-a', shardId: 0 });
  assert.equal(service.status, 'connected', 'gateway ready restores the renderer status');

  bridge.emitMessage({ connectionId: 'retired-client', channelId: 'old', content: 'ignored' });
  bridge.emitMessage({ connectionId: 'discord-connection-a', channelId: 'current', content: 'accepted' });
  assert.deepEqual(service.getRecentLocalMessages({ limit: 10 }).map(item => item.content), ['accepted']);

  await service.disconnect();
  bridge.emitEvent({ type: 'ready', connectionId: 'discord-connection-a' });
  assert.equal(service.status, 'disconnected', 'manual disconnect cannot be revived by a late ready event');
  assert.equal(bridge.calls.disconnect, 1);
  service.destroy();
});
