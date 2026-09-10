/**
 * Cristi AI Companion — Automated Post-Install Hook
 * 
 * Runs automatically after `pnpm install`.
 * Ensures:
 *   1. Electron prebuilt binary is installed.
 *   2. Base .env configuration file is created from .env.example.
 *   3. Electron main & preload scripts are compiled to electron/dist.
 *   4. Basic project integrity is verified.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('[PostInstall] Configurando entorno de Cristi AI Companion...');

// 1. Ensure Electron binary is present
try {
  const electronPkgDir = path.join(ROOT_DIR, 'node_modules', 'electron');
  const pathTxt = path.join(electronPkgDir, 'path.txt');
  const distExe = path.join(electronPkgDir, 'dist', 'electron.exe');

  const hasBinary =
    (fs.existsSync(pathTxt) && fs.existsSync(fs.readFileSync(pathTxt, 'utf8').trim())) ||
    fs.existsSync(distExe);

  if (!hasBinary) {
    const installScript = path.join(electronPkgDir, 'install.js');
    if (fs.existsSync(installScript)) {
      console.log('   [INFO] Descargando binario nativo de Electron...');
      execSync(`node "${installScript}"`, { stdio: 'inherit', cwd: ROOT_DIR });
      console.log('   [OK] Binario de Electron listo.');
    }
  } else {
    console.log('   [OK] Binario de Electron verificado.');
  }
} catch (err) {
  console.warn('   [WARN] Aviso al verificar binario de Electron:', err.message);
}

// 2. Ensure .env exists from .env.example
try {
  const envPath = path.join(ROOT_DIR, '.env');
  const envExamplePath = path.join(ROOT_DIR, '.env.example');
  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('   [OK] Archivo .env inicializado desde .env.example');
  } else if (fs.existsSync(envPath)) {
    console.log('   [OK] Archivo .env verificado.');
  }
} catch (err) {
  console.warn('   [WARN] No se pudo copiar .env.example:', err.message);
}

// 3. Compile Electron main and preload scripts
try {
  const { buildElectron } = require('./build-electron.cjs');
  buildElectron();
} catch (err) {
  console.warn('   [WARN] Fallo compilacion inicial de Electron:', err.message);
}

// 4. Validate Environment Integrity
try {
  const publicDir = path.join(ROOT_DIR, 'public');
  const cubismCore = path.join(publicDir, 'live2dcubismcore.min.js');
  if (fs.existsSync(cubismCore)) {
    console.log('   [OK] Live2D Cubism Core presente en public/');
  } else {
    console.warn('   [WARN] live2dcubismcore.min.js no detectado en public/');
  }
} catch (_) {}

console.log('[OK] [PostInstall] Entorno base listo con exito.\n');
process.exit(0);
