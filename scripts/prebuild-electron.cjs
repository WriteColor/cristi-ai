/**
 * Cristi AI Companion - Prebuild Verification & Cache Hardening
 * Ensures electron-builder caches (winCodeSign, nsis) are correctly prepared
 * avoiding 7-Zip symlink extraction errors on Windows non-developer accounts.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function prepareWinCodeSignCache() {
  if (process.platform !== 'win32') return;

  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return;

  const winCodeSignBase = path.join(localAppData, 'electron-builder', 'Cache', 'winCodeSign');
  const targetDir = path.join(winCodeSignBase, 'winCodeSign-2.6.0');

  if (fs.existsSync(targetDir) && fs.existsSync(path.join(targetDir, 'rcedit-x64.exe'))) {
    // Cache is already healthy
    return;
  }

  if (fs.existsSync(winCodeSignBase)) {
    // Look for any extracted numerical directory created by 7zip
    const entries = fs.readdirSync(winCodeSignBase, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && /^\d+$/.test(entry.name)) {
        const candidateDir = path.join(winCodeSignBase, entry.name);
        const rceditPath = path.join(candidateDir, 'rcedit-x64.exe');
        if (fs.existsSync(rceditPath)) {
          try {
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }
            // Copy windows tools to targetDir
            fs.cpSync(candidateDir, targetDir, { recursive: true, force: true });
            console.log(`[Prebuild] ✓ winCodeSign cache verificado y sincronizado en: ${targetDir}`);
            return;
          } catch (err) {
            // Ignore non-fatal copy errors
          }
        }
      }
    }
  }
}

function prepareWasapiHelper() {
  if (process.platform !== 'win32') return;
  const root = path.join(__dirname, '..');
  const source = path.join(root, 'native', 'CristiWasapiLoopback.cs');
  const script = path.join(root, 'native', 'build-wasapi-helper.ps1');
  const output = path.join(root, 'native', 'CristiWasapiLoopback.exe');
  if (!fs.existsSync(source) || !fs.existsSync(script)) return;
  const sourceMtime = fs.statSync(source).mtimeMs;
  const outputMtime = fs.existsSync(output) ? fs.statSync(output).mtimeMs : 0;
  if (outputMtime >= sourceMtime) return;
  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Output', output
  ], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) {
    console.warn('[Prebuild] Helper WASAPI no pudo compilarse; se usará getDisplayMedia como fallback.');
  }
}


try {
  prepareWinCodeSignCache();
  prepareWasapiHelper();
  // Vite copies public assets once, after clearing dist.
} catch (e) {
  // Non-fatal prebuild check
}
