import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus, EVENTS } from '../src/services/eventBus.js';
import { DiscordVoiceService } from '../src/services/discord/DiscordVoiceService.js';

const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

test('Discord voice blocks inbound and outbound translation audio until a reconnect reaches ready', async () => {
  let transportEvent = null;
  let inboundAudio = null;
  const sent = [];
  const bridge = {
    onDiscordVoiceEvent(callback) {
      transportEvent = callback;
      return () => { transportEvent = null; };
    },
    onDiscordVoiceAudio(callback) {
      inboundAudio = callback;
      return () => { inboundAudio = null; };
    },
    async discordVoiceJoin() { return { success: true }; },
    async discordVoiceLeave() { return { success: true }; },
    async discordVoiceSendAudio(payload) {
      sent.push(payload);
      return { success: true };
    }
  };
  const bus = new EventBus();
  const service = new DiscordVoiceService({ bridge, bus });
  const translated = () => bus.emitDomain(EVENTS.TRANSLATION_COMPLETED, {
    sourceId: 'discord_voice:guild-a:user-a',
    channelId: 'channel-a',
    outputRoute: 'discord_voice',
    audio: { data: 'AQIDBA==', sampleRate: 16000 }
  }, { source: 'test' });

  await service.join({ guildId: 'guild-a', channelId: 'channel-a' });
  assert.equal(service.getStatus().status, 'connected');
  translated();
  await nextTick();
  assert.equal(sent.length, 1, 'envía audio mientras el transporte está ready');

  transportEvent({ type: 'disconnect' });
  assert.equal(service.getStatus().status, 'reconnecting');
  assert.equal(inboundAudio({ frameId: 'stale-1', userId: 'user-a', data: 'AQI=' }), null, 'descarta PCM entrante de una conexión caída');
  translated();
  await nextTick();
  assert.equal(sent.length, 1, 'no escribe PCM mientras se reconecta');
  assert.equal((await service.sendAudio({ data: 'AQI=' })).success, false, 'la API directa también rechaza salida mientras se reconecta');

  transportEvent({ type: 'reconnecting' });
  assert.equal(service.getStatus().status, 'reconnecting');
  transportEvent({ type: 'reconnect_failed' });
  assert.equal(service.getStatus().status, 'disconnected');
  translated();
  await nextTick();
  assert.equal(sent.length, 1, 'no reanuda salida tras agotar el rejoin');

  transportEvent({ type: 'ready', resumed: true });
  assert.equal(service.getStatus().status, 'connected');
  translated();
  await nextTick();
  assert.equal(sent.length, 2, 'reanuda salida únicamente cuando el transporte vuelve a ready');

  service.destroy();
});
