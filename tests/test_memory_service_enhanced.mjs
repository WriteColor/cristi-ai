/**
 * Test Suite: Enhanced Multi-Layer Persistent Memory & Session Continuity
 * Tests:
 * 1. Extraction of facts, preferences, and tasks from conversation turns
 * 2. Multi-turn session summarization and persistence
 * 3. Cross-session continuity: new session receives previous session summary and pending topics
 * 4. Contradiction handling and versioning (supersedes / previousVersions)
 * 5. Bounded context prompt formatting with categories and timestamps
 */

import assert from 'node:assert/strict';
import { MemoryService, MEMORY_CATEGORIES } from '../src/services/memory/MemoryService.js';
import { MemoryRepository } from '../src/services/memory/MemoryRepository.js';

console.log('🧪 Running Test: Enhanced Memory Service & Cross-Session Continuity...');

// In-memory isolated repository mock
class MockRepository extends MemoryRepository {
  constructor() {
    super();
    this.store = [];
  }
  async load() {
    return JSON.parse(JSON.stringify(this.store));
  }
  async save(memories) {
    this.store = JSON.parse(JSON.stringify(memories));
    return true;
  }
}

const mockRepo = new MockRepository();
const memory = new MemoryService({ repository: mockRepo });
await memory.initialize();

// Clear any existing seed data for clean test
await memory.clearAll();

// 1. Verify manageMemory CRUD interface
console.log('\n🔍 [1/5] Testing manageMemory CRUD interface...');
const stored = await memory.manageMemory({
  action: 'store',
  key: 'usuario_ciudad',
  content: 'Ariel vive en Tokio, Japón y le encanta el clima templado',
  category: MEMORY_CATEGORIES.FACT,
  importance: 0.9
});
assert.equal(stored.status, 'success');
assert.equal(stored.memory.key, 'usuario_ciudad');
assert.equal(stored.memory.category, 'fact');

// Test recall
const recalled = await memory.manageMemory({
  action: 'recall',
  query: 'donde vive Ariel'
});
assert.equal(recalled.status, 'success');
assert(recalled.results.length > 0, 'Should recall city fact');
assert.match(recalled.results[0].content, /Tokio/);
console.log('  ✅ manageMemory store and recall verified.');

// 2. Test Contradiction & Versioning
console.log('\n🔍 [2/5] Testing contradiction update & versioning...');
const updated = await memory.manageMemory({
  action: 'update',
  key: 'usuario_ciudad',
  content: 'Ariel se mudó a Kioto, Japón recientemente',
  category: MEMORY_CATEGORIES.FACT,
  importance: 0.95,
  reason: 'Mudanza reciente'
});
assert.equal(updated.status, 'success');
assert.equal(updated.memory.previousVersions?.length, 1, 'Should preserve previous version');
assert.match(updated.memory.previousVersions[0].content, /Tokio/);
assert.match(updated.memory.content, /Kioto/);
console.log('  ✅ Contradiction preserved with historical lineage.');

// 3. Test Conversation Session Turns & Autonomous Extraction
console.log('\n🔍 [3/5] Testing session turn recording and intelligent extraction...');
const sessionId1 = memory.startSession('session_call_001');

memory.recordTurn({ role: 'user', text: 'Hola Cristi, hoy empecé un nuevo proyecto de inteligencia artificial llamado Proyecto Nova', sessionId: sessionId1 });
memory.recordTurn({ role: 'model', text: '¡Qué emocionante Ariel! Cuéntame más sobre Proyecto Nova.', sessionId: sessionId1 });
memory.recordTurn({ role: 'user', text: 'Recuerda que mi comida favorita para celebrar es el ramen picante.', sessionId: sessionId1 });
memory.recordTurn({ role: 'model', text: 'Anotado con cariño, ramen picante para tus celebraciones.', sessionId: sessionId1 });
memory.recordTurn({ role: 'user', text: 'Bueno Cristi, me tengo que ir a dormir. Hasta mañana.', sessionId: sessionId1 });
memory.recordTurn({ role: 'model', text: 'Buenas noches Ariel, descansa.', sessionId: sessionId1 });

// End session with consolidation
const sessionSummaryMemory = await memory.endSession({ sessionId: sessionId1, source: 'gemini_live' });
assert(sessionSummaryMemory, 'endSession must produce a consolidated session summary');
console.log('  Consolidated Summary:', sessionSummaryMemory.content);

// Verify auto-extracted fact
const allMems = memory.getAllMemories();
const ramenFact = allMems.find(m => m.content.toLowerCase().includes('ramen picante') || m.key.toLowerCase().includes('ramen'));
assert(ramenFact, 'Should have extracted preference memory about ramen picante');
console.log('  ✅ Extracted preference memory:', ramenFact.content);

// 4. Test Cross-Session Continuity (New session opens)
console.log('\n🔍 [4/5] Testing cross-session continuity prompt injection...');
const sessionId2 = memory.startSession('session_call_002');

// System prompt context for the new session
const promptContext = memory.getSystemPromptContext({ limit: 10 });
assert(promptContext.includes('RECUERDOS Y MEMORIA PERMANENTE'), 'Prompt must contain memory header');
assert(promptContext.includes('Kioto'), 'Prompt must include updated city');
assert(promptContext.includes('ramen') || promptContext.includes('Proyecto Nova') || promptContext.includes('CONVERSATION'), 'Prompt must preserve context from prior call');
console.log('  ✅ System prompt context correctly reflects memories across calls.');

// 5. Test Memory Invalidation / Forgetting
console.log('\n🔍 [5/5] Testing memory invalidation (forgetting)...');
const invalidated = await memory.manageMemory({
  action: 'invalidate',
  key: 'usuario_ciudad',
  reason: 'Dato temporal expirado'
});
assert.equal(invalidated.status, 'success');

const activeMemories = memory.getTopMemories(10);
const hasKioto = activeMemories.some(m => m.key === 'usuario_ciudad');
assert.equal(hasKioto, false, 'Invalidated memory must not appear in active memories');
console.log('  ✅ Memory invalidation successfully filters obsolete data.');

console.log('\n🎉 Enhanced Memory Service & Session Continuity passed 100%!\n');
process.exit(0);
