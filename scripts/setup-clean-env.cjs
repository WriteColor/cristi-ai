/**
 * Cristi AI Companion — Clean Environment Bootstrapper & Reproducibility Verifier
 * 
 * Validates a clean machine installation:
 *  - Node.js (>= 20) & pnpm (>= 9)
 *  - Dependency integrity in node_modules
 *  - Live2D Cubism Core runtime & 8 official Live2D models
 *  - AI neural network model weights (Face-API & TensorFlow)
 *  - Brand visual identity assets (.png, tray, .ico)
 *  - Electron runtime & compiled entrypoints
 *  - .env validation & optional interactive API Key configuration
 *  - Native WASAPI loopback helper
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { execSync } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const MODELS_DIR = path.join(PUBLIC_DIR, 'models');
const LIVE2D_DIR = path.join(MODELS_DIR, 'live2d');

const isInteractive =
  process.stdin.isTTY &&
  !process.argv.includes('--ci') &&
  !process.argv.includes('--unattended') &&
  !process.argv.includes('-y');

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('================================================================');
  console.log('🚀 CRISTI AI COMPANION - PREPARACIÓN DE ENTORNO LIMPIO');
  console.log('================================================================\n');

  let allChecksPassed = true;

  // 1. Check Node.js Version & Platform
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.replace(/^v/, '').split('.')[0], 10);
  const isNodeCompatible = major >= 20;

  console.log(`[1/10] Entorno Node.js: ${nodeVersion} (${process.platform} ${process.arch})`);
  if (isNodeCompatible) {
    console.log(`      ✅ Versión de Node.js compatible (>= 20: ${nodeVersion})`);
  } else {
    console.warn(`      ⚠️ Se recomienda Node.js v20 o superior. Versión actual: ${nodeVersion}`);
    allChecksPassed = false;
  }

  // 2. Verify pnpm Package Manager & Dependencies
  console.log('\n[2/10] Verificando gestor de paquetes pnpm y dependencias...');
  try {
    const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
    const pnpmMajor = parseInt(pnpmVersion.split('.')[0], 10);
    if (pnpmMajor >= 9) {
      console.log(`      ✅ Gestor de paquetes: pnpm v${pnpmVersion} (cumple >= 9)`);
    } else {
      console.warn(`      ⚠️ pnpm v${pnpmVersion} detectado. Se recomienda >= 9`);
    }
  } catch {
    console.error('      ❌ Error: pnpm no detectado en PATH. Se requiere pnpm para Cristi AI.');
    allChecksPassed = false;
  }

  const nodeModulesDir = path.join(ROOT_DIR, 'node_modules');
  if (fs.existsSync(nodeModulesDir)) {
    const criticalPkgs = [
      'react',
      'react-dom',
      'electron',
      'esbuild',
      '@modelcontextprotocol/sdk',
      'pixi.js',
      'lucide-react'
    ];
    const missingPkgs = criticalPkgs.filter((pkg) => !fs.existsSync(path.join(nodeModulesDir, ...pkg.split('/'))));
    if (missingPkgs.length === 0) {
      console.log('      ✅ Dependencias clave del proyecto verificadas en node_modules.');
    } else {
      console.warn(`      ⚠️ Dependencias faltantes: ${missingPkgs.join(', ')}. Ejecutando pnpm install...`);
      try {
        execSync('pnpm install', { stdio: 'inherit', cwd: ROOT_DIR });
        console.log('      ✅ Dependencias instaladas con éxito.');
      } catch {
        console.error('      ❌ Error al instalar dependencias con pnpm.');
        allChecksPassed = false;
      }
    }
  } else {
    console.warn('      ⚠️ node_modules no encontrado. Ejecutando pnpm install...');
    try {
      execSync('pnpm install', { stdio: 'inherit', cwd: ROOT_DIR });
      console.log('      ✅ Dependencias instaladas correctamente.');
    } catch {
      console.error('      ❌ Error al instalar dependencias con pnpm.');
      allChecksPassed = false;
    }
  }

  // 3. Verify Live2D Cubism Core Engine
  console.log('\n[3/10] Verificando motor Live2D Cubism Core...');
  const cubismCorePath = path.join(PUBLIC_DIR, 'live2dcubismcore.min.js');
  if (fs.existsSync(cubismCorePath)) {
    const stats = fs.statSync(cubismCorePath);
    console.log(`      ✅ live2dcubismcore.min.js verificado (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    console.error('      ❌ FALTA live2dcubismcore.min.js en /public');
    allChecksPassed = false;
  }

  // 4. Verify 8 Official Live2D Models
  console.log('\n[4/10] Verificando catálogo oficial de 8 modelos Live2D...');
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
  for (const m of EXPECTED_LIVE2D_MODELS) {
    const modelFilePath = path.join(LIVE2D_DIR, m.file);
    if (fs.existsSync(modelFilePath)) {
      live2dCount++;
    } else {
      console.warn(`      ✗ Faltante: ${m.name} (${modelFilePath})`);
    }
  }
  console.log(`      ${live2dCount === 8 ? '✅' : '⚠️'} ${live2dCount}/8 modelos Live2D presentes en /public/models/live2d`);
  if (live2dCount < 8) allChecksPassed = false;

  // 5. Verify AI Neural Network Weights
  console.log('\n[5/10] Verificando redes neuronales (TensorFlow & Face-API)...');
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

  let aiCount = 0;
  for (const file of EXPECTED_AI_MODELS) {
    if (fs.existsSync(path.join(MODELS_DIR, file))) aiCount++;
  }
  console.log(`      ${aiCount === EXPECTED_AI_MODELS.length ? '✅' : '⚠️'} ${aiCount}/${EXPECTED_AI_MODELS.length} archivos de modelos neuronales presentes.`);
  if (aiCount < EXPECTED_AI_MODELS.length) allChecksPassed = false;

  // 6. Verify Brand Identity Assets
  console.log('\n[6/10] Verificando identidad de marca en public/...');
  const iconPng = path.join(PUBLIC_DIR, 'icon.png');
  const trayPng = path.join(PUBLIC_DIR, 'tray-icon.png');
  const faviconIco = path.join(PUBLIC_DIR, 'favicon.ico');

  if (fs.existsSync(iconPng) && fs.existsSync(trayPng) && fs.existsSync(faviconIco)) {
    console.log('      ✅ Iconos oficiales presentes (icon.png, tray-icon.png, favicon.ico)');
  } else {
    console.warn('      ⚠️ Faltan iconos en public/. Se pueden generar con pnpm run generate:brand');
  }

  // 7. Compile Electron Main & Preload Processes
  console.log('\n[7/10] Compilando procesos modulares de Electron (main & preload)...');
  try {
    const { buildElectron } = require('./build-electron.cjs');
    buildElectron();
    console.log('       ✅ electron/src compilado exitosamente a electron/dist (main.cjs & preload.cjs).');
  } catch (err) {
    console.error('       ❌ Error compilando procesos de Electron:', err.message);
    allChecksPassed = false;
  }

  // 8. Compile Frontend with Vite
  console.log('\n[8/10] Compilando frontend y assets con Vite...');
  try {
    execSync('pnpm run build', { stdio: 'inherit', cwd: ROOT_DIR });
    console.log('       ✅ Frontend compilado exitosamente en dist/ (multi-page bundle listo).');
  } catch (err) {
    console.error('       ❌ Error compilando frontend con Vite:', err.message);
    allChecksPassed = false;
  }

  // 9. Check and Compile Native WASAPI Audio Helper
  console.log('\n[9/10] Verificando helper nativo WASAPI loopback...');
  if (process.platform === 'win32') {
    const wasapiExe = path.join(ROOT_DIR, 'native/CristiWasapiLoopback.exe');
    if (fs.existsSync(wasapiExe)) {
      console.log('       ✅ Helper de audio nativo WASAPI loopback verificado.');
    } else {
      console.log('       ⏳ Compilando helper nativo WASAPI con csc.exe...');
      try {
        const { prepareWasapiHelper } = require('./prebuild-electron.cjs');
        prepareWasapiHelper();
      } catch (err) {
        console.warn('       ⚠️ Advertencia en compilación de WASAPI helper:', err.message);
      }
    }
  } else {
    console.log('       ℹ️  Plataforma no-Windows detectada, helper nativo omitido.');
  }

  // 10. Environment & API Keys Validation
  console.log('\n[10/10] Validando archivo de configuración .env y credenciales...');
  const envPath = path.join(ROOT_DIR, '.env');
  const envExamplePath = path.join(ROOT_DIR, '.env.example');

  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('       ✅ Archivo .env generado a partir de .env.example');
  }

  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const matchKey = envContent.match(/^VITE_GEMINI_API_KEY=(.*)$/m);
  const currentKey = matchKey ? matchKey[1].trim() : '';
  const hasValidKey = currentKey.length > 5 && !currentKey.includes('tu_gemini_api_key');

  if (hasValidKey) {
    console.log('       ✅ VITE_GEMINI_API_KEY configurada.');
  } else if (isInteractive) {
    console.log('       ℹ️  VITE_GEMINI_API_KEY no configurada aún.');
    const inputKey = await promptUser('       🔑 Ingrese su Gemini API Key (o presione Enter para omitir): ');
    if (inputKey.length > 5) {
      if (envContent.includes('VITE_GEMINI_API_KEY=')) {
        envContent = envContent.replace(/^VITE_GEMINI_API_KEY=.*$/m, `VITE_GEMINI_API_KEY=${inputKey}`);
      } else {
        envContent += `\nVITE_GEMINI_API_KEY=${inputKey}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('       ✅ VITE_GEMINI_API_KEY guardada en .env.');
    } else {
      console.log('       ℹ️  Omitido. La API Key puede configurarse más tarde en los Ajustes de la App.');
    }
  } else {
    console.log('       ℹ️  VITE_GEMINI_API_KEY vacía (se puede configurar en la ventana de Ajustes de Cristi).');
  }

  console.log('\n================================================================');
  if (allChecksPassed) {
    console.log('✨ ENTORNO DE CRISTI AI COMPANION 100% PREPARADO Y COMPILADO');
    console.log('   Todos los modelos, scripts y bundles están listos.');
    console.log('   Comandos siguientes:');
    console.log('   • Iniciar en modo desarrollo:  pnpm run app:dev');
    console.log('   • Empaquetar para producción: pnpm run app:build');
  } else {
    console.warn('⚠️ Se completó la preparación del entorno con advertencias.');
  }
  console.log('================================================================\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('[Setup Fatal Error]', err);
  process.exit(1);
});
