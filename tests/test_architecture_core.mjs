import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/services/eventBus.js';
import { MemoryService, MEMORY_CATEGORIES } from '../src/services/memory/MemoryService.js';
import { AudioRoutingService } from '../src/services/translation/AudioRoutingService.js';
import { TranslationService } from '../src/services/translation/TranslationService.js';

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
