/**
 * Cristi AI - Persistent Context & Long-Term Memory Service Diagnostic Suite
 * Validates CRUD, Unicode Search, Spanish Diacritics, Category Filtering, and Context Injection.
 */

import { MemoryService, MEMORY_CATEGORIES } from '../src/services/memory/MemoryService.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Test failed: ${message}`);
  }
}

console.log('================================================================');
console.log('🧪 TEST: LONG-TERM MEMORY & CONTEXT SERVICE VALIDATION');
console.log('================================================================');

async function runMemoryTests() {
  const service = new MemoryService();
  await service.initialize();

  // ── 1. Default Memories & Initialization ────────────────────────────────────
  console.log('\n[1/5] Verificando Inicialización y Recuerdos Semilla...');
  const initialMemories = service.getAllMemories();
  assert(initialMemories.length >= 1, `Almacén de memoria inicializado con recuerdos (total: ${initialMemories.length}).`);
  assert(initialMemories.some(m => m.key === 'creator_identity'), 'Recuerdo sobre la identidad de Jeremy presente.');

  // ── 2. CRUD Operations (Remember, Update, Delete) ───────────────────────────
  console.log('\n[2/5] Verificando Operaciones CRUD en Memoria Permanente...');
  const newMem = await service.remember({
    key: 'lenguaje_favorito',
    content: 'A Jeremy le encanta programar en JavaScript moderno y TypeScript.',
    category: MEMORY_CATEGORIES.PREFERENCE,
    importance: 0.95
  });

  assert(newMem && newMem.id, 'Nuevo recuerdo almacenado con ID único.');
  assert(service.getAllMemories().some(m => m.key === 'lenguaje_favorito'), 'Recuerdo persistido en la colección.');

  // Update existing key
  const updatedMem = await service.remember({
    key: 'lenguaje_favorito',
    content: 'A Jeremy le apasiona JavaScript moderno, Next.js y React 19.',
    category: MEMORY_CATEGORIES.PREFERENCE,
    importance: 1.0
  });

  assert(updatedMem.id === newMem.id, 'Actualización sobre la misma clave reutiliza el ID existente.');
  assert(updatedMem.content.includes('React 19'), 'Contenido del recuerdo actualizado correctamente.');

  // Delete memory
  const deleted = await service.deleteMemory(newMem.id);
  assert(deleted === true, 'Recuerdo eliminado correctamente.');
  assert(!service.getAllMemories().some(m => m.id === newMem.id), 'ID ya no existe en la colección.');

  // ── 3. Unicode & Spanish Accents Search ─────────────────────────────────────
  console.log('\n[3/5] Verificando Búsqueda Sensorial con Caracteres Acentuados...');
  await service.remember({
    key: 'cumpleaños_aniversario',
    content: 'El cumpleaños de Jeremy se celebra con pastel de café y chocolate.',
    category: MEMORY_CATEGORIES.FACT,
    importance: 0.9
  });

  await service.remember({
    key: 'minecraft_ubicacion',
    content: 'Coordenadas de la fortaleza subterránea en X: -420, Y: 12, Z: 890.',
    category: MEMORY_CATEGORIES.MINECRAFT,
    importance: 0.8
  });

  const searchAccents1 = service.recall('cumpleaños');
  assert(searchAccents1.length >= 1, 'Búsqueda de "cumpleaños" con virgulilla ñ exitosa.');

  const searchAccents2 = service.recall('café');
  assert(searchAccents2.length >= 1, 'Búsqueda de "café" con tilde é exitosa.');

  const searchAccents3 = service.recall('subterránea');
  assert(searchAccents3.length >= 1, 'Búsqueda de "subterránea" con tilde á exitosa.');

  // ── 4. Categorization and Filters ──────────────────────────────────────────
  console.log('\n[4/5] Verificando Filtros Categóricos...');
  const mcMemories = service.getByCategory(MEMORY_CATEGORIES.MINECRAFT);
  assert(mcMemories.length >= 1, 'Filtrado por categoría MINECRAFT exitoso.');
  assert(mcMemories[0].category === MEMORY_CATEGORIES.MINECRAFT, 'Categoría coincide exactamente.');

  // ── 5. Gemini Live Context Prompt Formatting ────────────────────────────────
  console.log('\n[5/5] Verificando Formateo de Contexto para Gemini Live API...');
  const contextPrompt = service.getMemoryContextPrompt(5);
  assert(typeof contextPrompt === 'string' && contextPrompt.length > 20, 'Prompt de memoria generado como string válido.');
  assert(contextPrompt.includes('cumpleaños') || contextPrompt.includes('Jeremy'), 'Contexto incluye recuerdos relevantes.');

  console.log('\n================================================================');
  console.log(`📊 RESULTADO: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
  console.log('================================================================\n');

  process.exit(0);
}

runMemoryTests().catch(err => {
  console.error('Fatal Memory Test Error:', err);
  process.exit(1);
});
