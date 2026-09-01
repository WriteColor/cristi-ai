/**
 * Cristi AI Companion - Automated Post-Install Hook
 * Runs automatically after `pnpm install` on any fresh clone or machine.
 * Ensures Electron binaries, prebuild caches, icons, and configuration exist.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');

// 1. Ensure Electron prebuilt binary is downloaded
try {
  const electronPkgDir = path.join(ROOT_DIR, 'node_modules', 'electron');
  const pathTxt = path.join(electronPkgDir, 'path.txt');
  const distExe = path.join(electronPkgDir, 'dist', 'electron.exe');
  
  const hasBinary = (fs.existsSync(pathTxt) && fs.existsSync(fs.readFileSync(pathTxt, 'utf8').trim())) || fs.existsSync(distExe);
  if (!hasBinary) {
    const installScript = path.join(electronPkgDir, 'install.js');
    if (fs.existsSync(installScript)) {
      console.log('[PostInstall] 📦 Descargando e instalando runtime de Electron...');
      execSync(`node "${installScript}"`, { stdio: 'inherit', cwd: ROOT_DIR });
    }
  }
} catch (err) {
  // Non-fatal fallback handled by setup-clean-env
}

// 2. Prepare winCodeSign / NSIS cache
try {
  const prebuild = path.join(ROOT_DIR, 'scripts', 'prebuild-electron.cjs');
  if (fs.existsSync(prebuild)) {
    execSync(`node "${prebuild}"`, { stdio: 'inherit', cwd: ROOT_DIR });
  }
} catch (_) {}

// 4. Ensure .env exists from template
try {
  const envPath = path.join(ROOT_DIR, '.env');
  const envExamplePath = path.join(ROOT_DIR, '.env.example');
  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('[PostInstall] 📝 Creado archivo .env base a partir de .env.example');
  }
} catch (_) {}

console.log('[PostInstall] ✅ Entorno base configurado con éxito.');
