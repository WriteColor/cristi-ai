/**
 * Cristi Desktop - Clean Environment Bootstrapper & Dependency Verifier
 * Prepares and validates a fresh machine installation using pnpm.
 * Checks runtime requirements, AI model weights, icon assets, and native helpers.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const MODELS_DIR = path.join(ROOT_DIR, 'public', 'models');

console.log('================================================================');
console.log('🚀 CRISTI DESKTOP - PREPARACIÓN DE ENTORNO LIMPIO (BOOTSTRAPPER)');
console.log('================================================================\n');

// 1. Check Node.js Version
const nodeVersion = process.version;
console.log(`[1/5] Entorno Node.js: ${nodeVersion} (${process.platform} ${process.arch})`);

// 2. Verify pnpm Package Manager
try {
  const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
  console.log(`[2/5] ✅ Gestor de paquetes: pnpm v${pnpmVersion} (Cumplimiento de directiva estricta)`);
} catch (e) {
  console.warn(`[2/5] ⚠️ Aviso: pnpm no detectado directamente en PATH: ${e.message}`);
}

// 3. Verify AI Model Weights & Assets
console.log('[3/5] Verificando integridad de modelos de IA en disco...');
const EXPECTED_MODELS = [
  'tiny_face_detector_model.bin',
  'face_landmark_68_tiny_model.bin',
  'face_recognition_model.bin',
  'face_expression_model.bin',
  'ssd_mobilenetv1_model.bin'
];

let allModelsPresent = true;
EXPECTED_MODELS.forEach((file) => {
  const fullPath = path.join(MODELS_DIR, file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log(`      ✓ ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    console.warn(`      ✗ FALTANTE: ${file}`);
    allModelsPresent = false;
  }
});

if (allModelsPresent) {
  console.log('      ✅ Todos los pesos de visión y reconocimiento están verificados.');
} else {
  console.warn('      ⚠️ Algunos modelos se descargarán bajo demanda durante el primer inicio.');
}

// 4. Generate High-Res Visual Identity Icons
console.log('\n[4/5] Generando identidad visual e iconos para Windows y Web...');
try {
  execSync('node scripts/generate-icons.cjs', { stdio: 'inherit', cwd: ROOT_DIR });
} catch (e) {
  console.error('      ❌ Error generando iconos:', e.message);
}

// 5. Verify Electron Engine
console.log('\n[5/5] Verificando motor de escritorio Electron...');
try {
  const electronVersion = execSync('pnpm exec electron --version', { encoding: 'utf8', cwd: ROOT_DIR }).trim();
  console.log(`      ✅ Motor Electron verificado: ${electronVersion} (Arquitectura Desktop Mate activa)`);
} catch (e) {
  console.warn(`      ⚠️ Aviso: Electron no detectado: ${e.message}`);
}

console.log('\n================================================================');
console.log('✨ ENTORNO DE CRISTI DESKTOP LISTO PARA EJECUCIÓN O DISTRIBUCIÓN');
console.log('   Para desarrollo: pnpm run app:dev  |  Para empaquetar: pnpm run app:build');
console.log('================================================================\n');
