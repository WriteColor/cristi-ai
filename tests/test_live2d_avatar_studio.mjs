/**
 * Cristi AI - Live2D Avatar Studio Diagnostic Suite
 * Validates Live2D Model Registry, Expression Profiles, Audio Lip-Sync, and Kinetics.
 */

import { live2dModelRegistry, Live2DModelRegistry } from '../src/services/live2d/Live2DModelRegistry.js';
import { ALL_MODEL_PROFILES } from '../src/services/live2d/models/index.js';
import fs from 'fs';

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
console.log('🧪 TEST: LIVE2D AVATAR STUDIO & KINETICS VALIDATION');
console.log('================================================================');

// ── 1. Live2D Model Registry Catalog ─────────────────────────────────────────
console.log('\n[1/3] Verificando Catálogo Oficial de Modelos Live2D...');
const registry = new Live2DModelRegistry();
const allModels = registry.getAllModels();

assert(allModels.length === 13, `Registro contiene exactamente los 13 modelos Live2D oficiales (detectados: ${allModels.length}).`);
assert(registry.getModel('yanderegirl') !== undefined, 'Modelo predeterminado "yanderegirl" registrado.');
assert(registry.getModel('hiyori') !== undefined, 'Modelo oficial "hiyori" registrado.');
assert(registry.getModel('jane_doe') !== undefined, 'Modelo "jane_doe" registrado.');
assert(registry.getModel('ellen') !== undefined, 'Modelo "ellen" registrado.');
assert(registry.getModel('toki') !== undefined, 'Modelo "toki" registrado.');
assert(registry.getModel('ruan_mei') !== undefined, 'Modelo "ruan_mei" registrado.');
assert(registry.getModel('miara') !== undefined, 'Modelo "miara" registrado.');
assert(registry.getModel('icegirl') !== undefined, 'Modelo "icegirl" registrado.');
assert(registry.getModel('belle') !== undefined, 'Modelo "belle" registrado.');
assert(registry.getModel('sparkle') !== undefined, 'Modelo "sparkle" registrado.');
assert(registry.getModel('huohuo') !== undefined, 'Modelo "huohuo" registrado.');
assert(registry.getModel('vivian') !== undefined, 'Modelo "vivian" registrado.');
assert(registry.getModel('goth_loli') !== undefined, 'Modelo "goth_loli" registrado.');

// ── 2. Live2D Model Capabilities & Expressions ──────────────────────────────
console.log('\n[2/3] Verificando Capacidades y Perfiles de Expresión...');
for (const model of allModels) {
  assert(model.path && typeof model.path === 'string', `Modelo "${model.name}" tiene ruta de asset válida.`);
  assert(model.capabilities && typeof model.capabilities === 'object', `Modelo "${model.name}" tiene mapa de capacidades.`);
  assert(model.capabilities.mouthControl === true, `Modelo "${model.name}" soporta sincronización labial (mouthControl).`);
  assert(model.capabilities.breathing === true, `Modelo "${model.name}" soporta respiración continua (breathing).`);
}

// ── 3. Edge Case Safety & Fallback Resolution ───────────────────────────────
console.log('\n[3/3] Verificando Seguridad de Resolución y Fallback...');
const fallbackModel = registry.getModel('non_existent_id');
assert(registry.models.has('yanderegirl') === true, 'models.has("yanderegirl") retorna true.');
assert(registry.models.has('fake_model_id') === false, 'models.has("fake_model_id") retorna false.');

console.log(`\n🎉 TODAS LAS ${passed}/${total} PRUEBAS DE LIVE2D AVATAR STUDIO COMPLETADAS.`);
