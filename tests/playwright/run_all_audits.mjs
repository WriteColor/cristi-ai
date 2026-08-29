/**
 * Cristi AI - Master Test & Audit Runner
 * Executes all functional, terminal, Live API, and visual audit test suites in sequence.
 */

import { execSync } from 'child_process';

const suites = [
  { name: 'Terminal & Command Coverage (46 Tests)', script: 'tests/playwright/test_real_models_and_tools.mjs' },
  { name: 'Model Catalog & UI Design Audit', script: 'tests/playwright/audit_modal_design.mjs' },
  { name: 'Real Process & File Creation Verification', script: 'tests/playwright/live_real_process_launcher_test.mjs' },
  { name: 'Dual Local Vision & Anti-Procrastination Engine', script: 'tests/playwright/test_local_vision_engine.mjs' }
];

console.log('================================================================');
console.log('🚀 CRISTI AI - SUITE MAESTRA DE AUDITORÍAS Y PRUEBAS');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

for (const suite of suites) {
  console.log(`▶️ Ejecutando: ${suite.name} (${suite.script})...`);
  try {
    execSync(`node ${suite.script}`, { stdio: 'inherit' });
    console.log(`✅ [APROBADO]: ${suite.name}\n`);
    passed++;
  } catch (err) {
    console.error(`❌ [FALLIDO]: ${suite.name}\n`);
    failed++;
  }
}

console.log('================================================================');
console.log(`📊 RESUMEN FINAL: ${passed} Aprobadas | ${failed} Fallidas`);
console.log('================================================================\n');

process.exit(failed > 0 ? 1 : 0);
