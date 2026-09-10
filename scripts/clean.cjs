/**
 * Cristi AI Companion — Clean Build & Artifacts Purge Utility
 * 
 * Safely removes compiled bundles, temporary directories, caches, and logs.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

const TARGETS_TO_REMOVE = [
  path.join(ROOT_DIR, 'dist'),
  path.join(ROOT_DIR, 'electron', 'dist'),
  path.join(ROOT_DIR, '.test-build'),
  path.join(ROOT_DIR, 'release'),
  path.join(ROOT_DIR, 'tmp'),
  path.join(ROOT_DIR, '.tmp')
];

function clean() {
  console.log('[Clean] Iniciando purga de artefactos compilados y temporales...');
  let removedCount = 0;

  for (const target of TARGETS_TO_REMOVE) {
    if (fs.existsSync(target)) {
      try {
        fs.rmSync(target, { recursive: true, force: true });
        console.log(`[Clean] Eliminado: ${path.relative(ROOT_DIR, target)}`);
        removedCount++;
      } catch (err) {
        console.warn(`[Clean] No se pudo eliminar ${path.relative(ROOT_DIR, target)}:`, err.message);
      }
    }
  }

  // Remove loose *.log files in root
  try {
    const files = fs.readdirSync(ROOT_DIR);
    for (const file of files) {
      if (file.endsWith('.log') || file.endsWith('-memories.json')) {
        fs.rmSync(path.join(ROOT_DIR, file), { force: true });
        console.log(`[Clean] Eliminado archivo de estado local: ${file}`);
        removedCount++;
      }
    }
  } catch (err) {
    console.warn('[Clean] Error al inspeccionar archivos en la raiz:', err.message);
  }

  console.log(`[Clean] Purga completada. Total de elementos eliminados: ${removedCount}.`);
}

if (require.main === module) {
  clean();
}

module.exports = { clean };
