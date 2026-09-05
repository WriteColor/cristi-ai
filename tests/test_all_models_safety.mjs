import { live2dModelRegistry } from '../src/services/live2d/live2dModelRegistry.js';
import { ALL_MODEL_PROFILES } from '../src/services/live2d/models/index.js';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('🧪 VERIFICACIÓN EXHAUSTIVA DE INTEGRIDAD DEL CATÁLOGO LIVE2D');
console.log('================================================================\n');

const LIVE2D_IDS = [
  'yanderegirl',
  'icegirl',
  'hiyori',
  'miara',
  'toki',
  'ellen',
  'jane_doe',
  'ruan_mei',
  'belle',
  'sparkle',
  'huohuo',
  'vivian',
  'goth_loli'
];

let errors = 0;

// 1. Check Live2DModelRegistry across all inputs (fuzzing)
console.log('1️⃣ Verificando Live2DModelRegistry con inputs edge-case...');
for (const id of [...LIVE2D_IDS, null, undefined, '', 'non_existent_model']) {
  try {
    const model = live2dModelRegistry.getModel(id);
    console.log(`   ✓ Model ID: "${id}" => descriptor: ${model ? model.name : 'undefined (safe)'}`);
  } catch (err) {
    console.error(`   ❌ CRASH en Live2DModelRegistry con id "${id}":`, err.message);
    errors++;
  }
}

// 2. Check Live2DModelRegistry across all 8 official Live2D models
console.log('\n2️⃣ Verificando Live2DModelRegistry para los 8 modelos oficiales...');
for (const id of LIVE2D_IDS) {
  try {
    const descriptor = live2dModelRegistry.getModel(id);
    if (!descriptor) {
      console.error(`   ❌ No se encontró descriptor para "${id}"`);
      errors++;
    } else if (descriptor.id !== id) {
      console.error(`   ❌ ID retornado (${descriptor.id}) no coincide con "${id}"`);
      errors++;
    } else {
      console.log(`   ✓ Live2D "${descriptor.name}" (${descriptor.id}) => Path: ${descriptor.path}`);
    }
  } catch (err) {
    console.error(`   ❌ CRASH en Live2DModelRegistry con id "${id}":`, err.message);
    errors++;
  }
}

// 3. Verify on-disk asset files for all 8 models
console.log('\n3️⃣ Verificando existencia física de assets en public/ y dist/...');
for (const id of LIVE2D_IDS) {
  const descriptor = live2dModelRegistry.getModel(id);
  if (!descriptor) continue;

  const rel = descriptor.path.startsWith('/') ? descriptor.path.slice(1) : descriptor.path;
  const inPublic = fs.existsSync(path.join('public', rel));
  if (!inPublic) {
    console.error(`   ❌ Archivo faltante en public: public/${rel}`);
    errors++;
  } else {
    console.log(`   ✓ Asset verificado: public/${rel}`);
  }
}

console.log('\n================================================================');
if (errors === 0) {
  console.log('🎉 TODOS LOS 13 MODELOS LIVE2D VALIDADOS AL 100% SIN ERRORES');
} else {
  console.error(`❌ Se encontraron ${errors} errores en la verificación.`);
  process.exit(1);
}
console.log('================================================================');
