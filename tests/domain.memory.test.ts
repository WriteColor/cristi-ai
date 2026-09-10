import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryIndex } from '../src/domain/integrations/memory/MemoryIndex';
import { MemoryService, MEMORY_CATEGORIES } from '../src/domain/integrations/memory/MemoryService';
import type { MemoryItem } from '../src/domain/integrations/memory/MemoryService';

test('MemoryIndex tokenizes text with accent normalization and punctuation stripping', () => {
  const tokens = MemoryIndex.tokenize('¡Hola, mundo! ¿Cómo estás hoy?');
  assert.ok(tokens.includes('hola'));
  assert.ok(tokens.includes('mundo'));
  assert.ok(tokens.includes('como'));
  assert.ok(tokens.includes('estas'));
  assert.ok(tokens.includes('hoy'));
  assert.equal(tokens.includes('!'), false);
  assert.equal(tokens.includes('¿'), false);
});

test('MemoryIndex indexes items and performs lexical retrieval', () => {
  const index = new MemoryIndex();

  index.upsert({
    id: 'mem-1',
    key: 'comida_favorita',
    content: 'A Jeremy le encanta el sushi de salmón y la comida japonesa',
    category: 'preference'
  });

  index.upsert({
    id: 'mem-2',
    key: 'proyecto',
    content: 'Cristi AI es una compañera virtual Live2D creada con Next.js y Electron',
    category: 'fact'
  });

  const searchResults1 = index.search('sushi salmón');
  assert.ok(searchResults1.length > 0);
  assert.equal(searchResults1[0].id, 'mem-1');

  const searchResults2 = index.search('Live2D compañera');
  assert.ok(searchResults2.length > 0);
  assert.equal(searchResults2[0].id, 'mem-2');

  const emptyResults = index.search('bicicleta espacial desconocida');
  assert.equal(emptyResults.length, 0);

  index.remove('mem-1');
  const postDeleteResults = index.search('sushi');
  assert.equal(postDeleteResults.length, 0);
});

test('MemoryService remembers, recalls, and formats system prompt context', async () => {
  // Mock in-memory repository to test MemoryService business logic in isolation
  const inMemoryStore: MemoryItem[] = [];
  const mockRepo = {
    load: async () => [...inMemoryStore],
    save: async (records: MemoryItem[]) => {
      inMemoryStore.length = 0;
      inMemoryStore.push(...records);
      return { success: true, count: records.length };
    },
    exportJson: async () => JSON.stringify(inMemoryStore),
    importJson: async () => ({ success: true, count: 0 })
  };

  const service = new MemoryService({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repository: mockRepo as any
  });

  await service.initialize();

  const mem1 = await service.remember({
    key: 'apodo_usuario',
    content: 'El usuario prefiere que le digan Jeremy',
    category: MEMORY_CATEGORIES.PREFERENCE,
    importance: 0.95
  });

  assert.ok(mem1);
  assert.equal(mem1?.key, 'apodo_usuario');

  const mem2 = await service.remember({
    key: 'lenguaje_favorito',
    content: 'El lenguaje favorito de Jeremy es TypeScript',
    category: MEMORY_CATEGORIES.FACT,
    importance: 0.9
  });

  assert.ok(mem2);

  // Retrieve memories
  const relevant = service.retrieveRelevant('TypeScript Jeremy');
  assert.ok(relevant.length > 0);

  // Context formatting
  const promptContext = service.getSystemPromptContext({ limit: 5 });
  assert.ok(promptContext.includes('Jeremy'));
  assert.ok(promptContext.includes('TypeScript'));

  // Forget memory
  if (mem1) {
    const forgotten = await service.forget(mem1.id);
    assert.equal(forgotten, true);
    assert.equal(service.getMemory(mem1.id)?.status, 'invalidated');
  }
});
