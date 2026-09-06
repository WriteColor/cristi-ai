import test from 'node:test';
import assert from 'node:assert/strict';

import { MemoryService, MEMORY_CATEGORIES } from '../src/services/memory/MemoryService.js';

function memory(id, key, content, category, updatedAt, importance = 0.5) {
  return { id, key, content, category, importance, confidence: 0.9, updatedAt, createdAt: updatedAt, status: 'active' };
}

test('new Live-session context preserves stable facts and recent conversation summaries', async () => {
  const repository = {
    storageKey: 'test-memory',
    async load() {
      return [
        memory('pref', 'nombre', 'El usuario prefiere que lo llamen Ariel.', MEMORY_CATEGORIES.PREFERENCE, '2026-01-01T00:00:00.000Z', 1),
        memory('old-summary', 'session_summary_old', 'Hablamos de fotografía hace meses.', MEMORY_CATEGORIES.CONVERSATION, '2026-01-02T00:00:00.000Z'),
        memory('recent-summary', 'session_summary_recent', 'Ariel estaba depurando la reconexión de Gemini Live.', MEMORY_CATEGORIES.CONVERSATION, '2026-09-05T10:00:00.000Z'),
        memory('newest-summary', 'session_summary_newest', 'Quedó pendiente configurar el audio virtual para el juego.', MEMORY_CATEGORIES.CONVERSATION, '2026-09-05T11:00:00.000Z')
      ];
    },
    async save() { return true; }
  };
  const service = new MemoryService({ repository });
  await service.initialize();

  const context = service.getSystemPromptContext({ limit: 4, maxConversationSummaries: 2 });
  assert.match(context, /prefiere que lo llamen Ariel/i);
  assert.match(context, /audio virtual para el juego/i);
  assert.match(context, /reconexión de Gemini Live/i);
  assert.doesNotMatch(context, /fotografía hace meses/i);
});

test('query-specific context avoids injecting unrelated session summaries', async () => {
  const repository = {
    storageKey: 'test-memory-query',
    async load() {
      return [
        memory('minecraft', 'minecraft_base', 'La base de Minecraft está cerca del portal del Nether.', MEMORY_CATEGORIES.MINECRAFT, '2026-09-01T00:00:00.000Z', 0.8),
        memory('conversation', 'session_summary_recent', 'Ariel ajustó la voz virtual de Discord.', MEMORY_CATEGORIES.CONVERSATION, '2026-09-05T11:00:00.000Z', 0.6)
      ];
    },
    async save() { return true; }
  };
  const service = new MemoryService({ repository });
  await service.initialize();

  const context = service.getMemoryContextPrompt(3, '¿Dónde está mi base de Minecraft?');
  assert.match(context, /portal del Nether/i);
  assert.doesNotMatch(context, /Discord/i);
});
