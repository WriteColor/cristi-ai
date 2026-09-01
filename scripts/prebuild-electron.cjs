/**
 * Cristi AI Companion - Prebuild Verification & Cache Hardening
 * Ensures electron-builder caches (winCodeSign, nsis) are correctly prepared
 * avoiding 7-Zip symlink extraction errors on Windows non-developer accounts.
 */

'use strict';

const fs = require('fs');
const path = require('path');

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

try {
  prepareWinCodeSignCache();
} catch (e) {
  // Non-fatal prebuild check
}
