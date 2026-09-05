import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus, eventBus, EVENTS } from '../src/services/eventBus.js';
import { MemoryService, MEMORY_CATEGORIES } from '../src/services/memory/MemoryService.js';
import { AudioRoutingService } from '../src/services/translation/AudioRoutingService.js';
import { TranslationService } from '../src/services/translation/TranslationService.js';
import { DesktopLoopbackCaptureService } from '../src/services/translation/DesktopLoopbackCaptureService.js';
import { MemoryIndex } from '../src/services/memory/MemoryIndex.js';
import { DiscordVoiceService } from '../src/services/discord/DiscordVoiceService.js';

test('domain event envelopes are traceable and wildcard listeners are isolated', () => {
  const bus = new EventBus();
  const seen = [];
  bus.onAny((type, data) => seen.push({ type, data }));
  const event = bus.emitDomain('memory.created', { key: 'music' }, {
    source: 'test', sessionId: 's1', correlationId: 'c1', priority: 'high', privacy: 'private'
  });
  assert.equal(event.sessionId, 's1');
  assert.equal(event.correlationId, 'c1');
  assert.equal(seen.length, 2);
  assert.equal(seen[0].type, 'domain_event');
  assert.equal(seen[1].type, 'memory.created');
});

test('memory sessions persist summaries and supersede contradictions', async () => {
  let stored = [];
  const memory = new MemoryService({ repository: {
    storageKey: 'test-memory',
    async load() { return stored; },
    async save(records) { stored = structuredClone(records); return true; }
  }});
  await memory.initialize();
  memory.startSession('test-session');
  memory.recordTurn({ role: 'user', text: 'Me gusta jugar Minecraft por las noches.' });
  memory.recordTurn({ role: 'model', text: 'Lo recordaré para acompañarte.' });
  const first = await memory.remember({ key: 'favorite_game', content: 'Minecraft', category: MEMORY_CATEGORIES.PREFERENCE, source: 'test' });
  const second = await memory.remember({ key: 'favorite_game', content: 'Stardew Valley', category: MEMORY_CATEGORIES.PREFERENCE, source: 'test' });
  assert.equal(second.id, first.id);
  assert.equal(second.previousVersions.length, 1);
  const summary = await memory.endSession();
  assert.equal(summary.category, MEMORY_CATEGORIES.CONVERSATION);
  assert.match(summary.content, /Minecraft/);
});

test('translation routing rejects generated audio and preserves source boundaries', async () => {
  const routing = new AudioRoutingService();
  routing.registerSource('game_loopback');
  const generatedId = 'generated-1';
  routing.markGenerated(generatedId);
  assert.equal(routing.acceptFrame({ frameId: generatedId, sourceId: 'game_loopback', data: 'pcm' }), false);

  const service = new TranslationService({ provider: {
    transcribe: async () => ({ text: 'hola' }),
    detectLanguage: async () => ({ language: 'es' }),
    translate: async ({ text }) => ({ text: `${text} translated` }),
    synthesize: async () => ({ frameId: generatedId, pcm: 'audio' })
  }});
  const result = await service.processFrame({ frameId: 'external-1', sourceId: 'game_loopback', data: 'pcm' });
  assert.equal(result.success, true);
  assert.equal(result.sourceLanguage, 'es');
  assert.equal(result.translation, 'hola translated');
  assert.equal(service.getMetrics().completed, 1);
});

test('translation source attachment keeps one latest frame per source and preserves speaker context', async () => {
  let handler = null;
  const completed = [];
  const service = new TranslationService({ provider: {
    isVoiceActivity: () => true,
    transcribe: async ({ data }) => {
      await new Promise((resolve) => setTimeout(resolve, 8));
      return { text: String(data), speakerId: 'speaker-a' };
    },
    detectLanguage: async () => ({ language: 'en' }),
    translate: async ({ text }) => ({ text: `es:${text}` }),
    synthesize: async ({ text }) => ({ frameId: `generated-${text}` })
  }});
  const source = { setFrameHandler(next) { handler = next; } };
  const unsubscribe = eventBus.on(EVENTS.TRANSLATION_COMPLETED, (event) => completed.push(event.payload));
  assert.equal(service.attachSource(source, { targetLanguage: 'es' }), true);
  handler({ frameId: 'f1', sourceId: 'game_loopback', data: 'first', sampleRate: 16000 });
  handler({ frameId: 'f2', sourceId: 'game_loopback', data: 'latest', sampleRate: 16000 });
  await new Promise((resolve) => setTimeout(resolve, 40));
  unsubscribe();
  assert.equal(completed.length, 2);
  assert.equal(completed[0].speakerId, 'speaker-a');
  assert.equal(completed.at(-1).transcript, 'latest');
  assert.equal(service.detachSource(source), true);
  assert.equal(service.attachEventSource('test.translation.audio', { targetLanguage: 'es' }), true);
  eventBus.emitDomain('test.translation.audio', { frameId: 'f3', sourceId: 'discord_voice:g1:u1', data: 'event', sampleRate: 16000 });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(service.detachEventSource('test.translation.audio'), true);
});

test('desktop loopback capture fails safely outside a browser media environment', async () => {
  const capture = new DesktopLoopbackCaptureService();
  const result = await capture.start({ sourceId: 'game_loopback' });
  assert.equal(result.success, false);
  assert.match(result.error, /loopback no disponible/i);
  assert.equal(capture.getStatus().running, false);
});

test('memory index supports bounded semantic fallback and replacement without stale postings', () => {
  const index = new MemoryIndex({ dimensions: 32 });
  index.upsert({ id: 'one', key: 'juego favorito', content: 'Minecraft por las noches', category: 'preference' });
  index.upsert({ id: 'two', key: 'bebida', content: 'café sin azúcar', category: 'preference' });
  assert.equal(index.search('Minecraft', { limit: 1 })[0].id, 'one');
  index.upsert({ id: 'one', key: 'juego favorito', content: 'Stardew Valley los fines de semana', category: 'preference' });
  assert.equal(index.search('Minecraft', { limit: 2, minScore: 0.01 }).some((item) => item.id === 'one'), false);
  assert.equal(index.search('Stardew', { limit: 1 })[0].id, 'one');
});

test('discord voice adapter isolates participant sources and handles lifecycle without Electron', async () => {
  let audioHandler = null;
  let eventHandler = null;
  let left = false;
  const bridge = {
    onDiscordVoiceAudio(handler) { audioHandler = handler; return () => { audioHandler = null; }; },
    onDiscordVoiceEvent(handler) { eventHandler = handler; return () => { eventHandler = null; }; },
    async discordVoiceJoin() { return { success: true }; },
    async discordVoiceLeave() { left = true; return { success: true }; },
    async discordVoiceSendAudio() { return { success: true }; }
  };
  const service = new DiscordVoiceService({ bridge, bus: new EventBus() });
  assert.equal((await service.join({ guildId: 'g1', channelId: 'c1' })).success, true);
  assert.equal(service.getStatus().status, 'connected');
  const routed = audioHandler({ frameId: 'voice-1', guildId: 'g1', channelId: 'c1', userId: 'u1', data: 'cGNi', sampleRate: 16000 });
  assert.equal(routed.sourceId, 'discord_voice:g1:u1');
  eventHandler({ type: 'ready' });
  await service.leave();
  assert.equal(left, true);
  service.destroy();
});
