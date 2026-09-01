/**
 * Cristi AI Companion - Clean Environment Bootstrapper & Reproducibility Verifier
 * Validates a fresh machine installation using pnpm.
 * Verifies runtime requirements, Live2D Cubism Core, 8 official Live2D avatars,
 * AI neural weights, high-res icon assets, Electron runtime, and configuration.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const MODELS_DIR = path.join(PUBLIC_DIR, 'models');
const LIVE2D_DIR = path.join(MODELS_DIR, 'live2d');
const RESOURCES_ICONS_DIR = path.join(ROOT_DIR, 'resources', 'icons');

console.log('================================================================');
console.log('🚀 CRISTI AI COMPANION - PREPARACIÓN DE ENTORNO LIMPIO (BOOTSTRAPPER)');
console.log('================================================================\n');

let allChecksPassed = true;

// 1. Check Node.js Version & Platform
const nodeVersion = process.version;
const [major] = nodeVersion.replace('v', '').split('.').map(Number);
const isNodeCompatible = major >= 18 && major <= 24;
console.log(`[1/7] Entorno Node.js: ${nodeVersion} (${process.platform} ${process.arch})`);
if (isNodeCompatible) {
  console.log(`      ✅ Versión de Node.js compatible (${nodeVersion})`);
} else {
  console.warn(`      ⚠️ Aviso: Se recomienda Node.js v18.x - v24.x LTS. Versión actual: ${nodeVersion}`);
}

// 2. Verify pnpm Package Manager
try {
  const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
  console.log(`[2/7] ✅ Gestor de paquetes: pnpm v${pnpmVersion} (Cumplimiento de directiva estricta)`);
} catch (e) {
  console.error(`[2/7] ❌ Error: pnpm no detectado en PATH. Cristi requiere pnpm exclusivamente.`);
  allChecksPassed = false;
}

// 3. Verify Live2D Cubism Core Engine
console.log('\n[3/7] Verificando motor Live2D Cubism Core en tiempo de ejecución...');
const cubismCorePath = path.join(PUBLIC_DIR, 'live2dcubismcore.min.js');
if (fs.existsSync(cubismCorePath)) {
  const stats = fs.statSync(cubismCorePath);
  console.log(`      ✅ live2dcubismcore.min.js verificado (${(stats.size / 1024).toFixed(1)} KB)`);
} else {
  console.error('      ❌ FALTA live2dcubismcore.min.js en /public');
  allChecksPassed = false;
}

// 4. Verify 8 Official Live2D Models
console.log('\n[4/7] Verificando catálogo oficial de 8 modelos Live2D...');
const EXPECTED_LIVE2D_MODELS = [
  { id: 'yanderegirl', name: 'Cristi Gótica (Yandere Girl)', file: 'yanderegirl/yanderegirl.model3.json' },
  { id: 'icegirl', name: 'Ice Girl (Cheongsam)', file: 'icegirl/icegirl.model3.json' },
  { id: 'hiyori', name: 'Hiyori Momose (Pro Cubism)', file: 'hiyori/hiyori_free_t08.model3.json' },
  { id: 'miara', name: 'Miara (Pro Cubism)', file: 'miara/miara_pro_t03.model3.json' },
  { id: 'toki', name: 'Toki (Blue Archive)', file: 'toki/20220227toki.model3.json' },
  { id: 'ellen', name: 'Ellen Joe (ZZZ)', file: 'ellen/免费模型艾莲.model3.json' },
  { id: 'jane_doe', name: 'Jane Doe (ZZZ)', file: 'jane_doe/简.model3.json' },
  { id: 'ruan_mei', name: 'Ruan Mei (Honkai: Star Rail)', file: 'ruan_mei/ruan_mei.model3.json' }
];

let live2dCount = 0;
EXPECTED_LIVE2D_MODELS.forEach((m) => {
  const modelFilePath = path.join(LIVE2D_DIR, m.file);
  if (fs.existsSync(modelFilePath)) {
    console.log(`      ✓ Modelo "${m.name}" (${m.id}) verificado en disco.`);
    live2dCount++;
  } else {
    console.warn(`      ✗ FALTANTE: ${m.name} (${modelFilePath})`);
    allChecksPassed = false;
  }
});
console.log(`      ${live2dCount === 8 ? '✅' : '⚠️'} ${live2dCount}/8 modelos Live2D verificados con éxito.`);

// 5. Verify AI Neural Network Model Weights & Manifests
console.log('\n[5/7] Verificando integridad de redes neuronales (TensorFlow & Face-API)...');
const EXPECTED_AI_MODELS = [
  'tiny_face_detector_model.bin',
  'tiny_face_detector_model-weights_manifest.json',
  'face_landmark_68_tiny_model.bin',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_recognition_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_expression_model.bin',
  'face_expression_model-weights_manifest.json',
  'age_gender_model.bin',
  'age_gender_model-weights_manifest.json',
  'ssd_mobilenetv1_model.bin',
  'ssd_mobilenetv1_model-weights_manifest.json'
];

let aiModelsCount = 0;
EXPECTED_AI_MODELS.forEach((file) => {
  const fullPath = path.join(MODELS_DIR, file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log(`      ✓ ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
    aiModelsCount++;
  } else {
    console.warn(`      ✗ FALTANTE: ${file}`);
    allChecksPassed = false;
  }
});
console.log(`      ${aiModelsCount === EXPECTED_AI_MODELS.length ? '✅' : '⚠️'} ${aiModelsCount}/${EXPECTED_AI_MODELS.length} archivos de modelos neuronales presentes.`);

// 6. Verify Static High-Res Visual Identity Icons
console.log('\n[6/7] Verificando iconos e identidad visual estática para Windows y Web...');
try {
  const icoPath = path.join(RESOURCES_ICONS_DIR, 'icon.ico');
  const pngPath = path.join(RESOURCES_ICONS_DIR, 'icon.png');
  const publicIcoPath = path.join(PUBLIC_DIR, 'favicon.ico');
  const publicPngPath = path.join(PUBLIC_DIR, 'icon.png');
  
  if (fs.existsSync(icoPath) && fs.existsSync(pngPath) && fs.existsSync(publicIcoPath) && fs.existsSync(publicPngPath)) {
    const pngStats = fs.statSync(pngPath);
    console.log(`      ✅ Iconos maestros de alta resolución verificados: ${(pngStats.size / 1024).toFixed(1)} KB (.ico y .png listos)`);
  } else {
    console.warn('      ⚠️ Advertencia: Algunos iconos estáticos faltan en resources/icons o public/');
  }
} catch (e) {
  console.error('      ❌ Error al verificar iconos:', e.message);
  allChecksPassed = false;
}

// 7. Verify Electron Engine & Environment Configuration
console.log('\n[7/7] Verificando motor de escritorio Electron y configuración de entorno...');
let electronVersion = null;

// Ensure prebuilt electron executable is present
const electronPkgDir = path.join(ROOT_DIR, 'node_modules', 'electron');
const pathTxt = path.join(electronPkgDir, 'path.txt');
const distExe = path.join(electronPkgDir, 'dist', 'electron.exe');
let hasBinary = false;
try {
  hasBinary = (fs.existsSync(pathTxt) && fs.existsSync(fs.readFileSync(pathTxt, 'utf8').trim())) || fs.existsSync(distExe);
} catch (_) {}

if (!hasBinary) {
  const electronInstallScript = path.join(electronPkgDir, 'install.js');
  if (fs.existsSync(electronInstallScript)) {
    console.log('      ⏳ Descargando e inicializando binario de Electron precompilado...');
    try {
      execSync(`node "${electronInstallScript}"`, { stdio: 'inherit', cwd: ROOT_DIR });
    } catch (_) {}
  }
}

try {
  electronVersion = execSync('pnpm exec electron --version', { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8', cwd: ROOT_DIR }).trim();
} catch (e) {
  try {
    const electronInstallScript = path.join(electronPkgDir, 'install.js');
    if (fs.existsSync(electronInstallScript)) {
      execSync(`node "${electronInstallScript}"`, { stdio: 'inherit', cwd: ROOT_DIR });
      electronVersion = execSync('pnpm exec electron --version', { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8', cwd: ROOT_DIR }).trim();
    }
  } catch (_) {}
}

if (electronVersion) {
  console.log(`      ✅ Motor Electron verificado: ${electronVersion} (Arquitectura Desktop Mate lista)`);
} else {
  console.warn(`      ⚠️ Aviso: No se pudo verificar el binario de Electron.`);
  allChecksPassed = false;
}

const envPath = path.join(ROOT_DIR, '.env');
const envExamplePath = path.join(ROOT_DIR, '.env.example');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('VITE_GEMINI_API_KEY=') && envContent.split('VITE_GEMINI_API_KEY=')[1].trim().length > 0) {
    console.log('      ✅ Archivo .env configurado con VITE_GEMINI_API_KEY.');
  } else {
    console.log('      ℹ️  Archivo .env presente (VITE_GEMINI_API_KEY puede configurarse también en Ajustes de la App).');
  }
} else if (fs.existsSync(envExamplePath)) {
  try {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('      ✅ Archivo .env inicializado automáticamente a partir de .env.example');
  } catch (_) {
    console.log('      ℹ️  Archivo .env no detectado. Puedes crearlo copiando .env.example o ingresar la API key en Ajustes.');
  }
}

console.log('\n================================================================');
if (allChecksPassed) {
  console.log('✨ ¡ENTORNO DE CRISTI AI COMPANION 100% REPRODUCIBLE Y LISTO!');
  console.log('   • Desarrollo local:      pnpm run app:dev');
  console.log('   • Pruebas diagnósticas:  pnpm run test:diagnostics');
  console.log('   • Empaquetar instalador: pnpm run app:build');
} else {
  console.warn('⚠️ Se encontraron advertencias durante la preparación del entorno.');
}
console.log('================================================================\n');
