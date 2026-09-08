/**
 * Cristi AI Companion — Electron Main & Preload esbuild Compiler
 * 
 * Compiles modular TypeScript entrypoints from electron/src to electron/dist:
 *   - electron/src/main.ts    -> electron/dist/main.cjs
 *   - electron/src/preload.ts -> electron/dist/preload.cjs
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');

function buildElectron() {
  const rootDir = path.resolve(__dirname, '..');
  const srcMain = path.join(rootDir, 'electron/src/main.ts');
  const srcPreload = path.join(rootDir, 'electron/src/preload.ts');
  const distDir = path.join(rootDir, 'electron/dist');
  const outMain = path.join(distDir, 'main.cjs');
  const outPreload = path.join(distDir, 'preload.cjs');
  const rootPreload = path.join(rootDir, 'electron/preload.cjs');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  let esbuild;
  try {
    esbuild = require('esbuild');
  } catch (err) {
    console.error('[BuildElectron] Error: esbuild is required to build the Electron processes.');
    throw err;
  }

  const startTime = Date.now();

  const external = [
    'electron',
    '@discordjs/voice',
    'discord.js',
    'mineflayer',
    'mineflayer-pathfinder',
    'playwright',
    'prism-media',
    '@modelcontextprotocol/sdk',
    'zod',
    'node:sqlite'
  ];

  // 1. Build Main Process
  try {
    esbuild.buildSync({
      entryPoints: [srcMain],
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      outfile: outMain,
      external,
      sourcemap: 'inline',
      logLevel: 'warning'
    });
  } catch (err) {
    console.error('[BuildElectron] Failed to compile main process:', err.message);
    throw err;
  }

  // 2. Build Preload Script
  try {
    esbuild.buildSync({
      entryPoints: [srcPreload],
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      outfile: outPreload,
      external: ['electron'],
      sourcemap: 'inline',
      logLevel: 'warning'
    });

    // Mirror to electron/preload.cjs for backward compatibility
    fs.copyFileSync(outPreload, rootPreload);
  } catch (err) {
    console.error('[BuildElectron] Failed to compile preload script:', err.message);
    throw err;
  }

  const elapsed = Date.now() - startTime;
  console.log(`[BuildElectron] ✓ Successfully compiled electron/src to electron/dist in ${elapsed}ms`);
}

async function watchElectron() {
  const rootDir = path.resolve(__dirname, '..');
  const srcMain = path.join(rootDir, 'electron/src/main.ts');
  const srcPreload = path.join(rootDir, 'electron/src/preload.ts');
  const distDir = path.join(rootDir, 'electron/dist');
  const outMain = path.join(distDir, 'main.cjs');
  const outPreload = path.join(distDir, 'preload.cjs');
  const rootPreload = path.join(rootDir, 'electron/preload.cjs');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const esbuild = require('esbuild');
  const external = [
    'electron',
    '@discordjs/voice',
    'discord.js',
    'mineflayer',
    'mineflayer-pathfinder',
    'playwright',
    'prism-media',
    '@modelcontextprotocol/sdk',
    'zod',
    'node:sqlite'
  ];

  const mainCtx = await esbuild.context({
    entryPoints: [srcMain],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: outMain,
    external,
    sourcemap: 'inline',
    logLevel: 'warning'
  });

  const preloadCtx = await esbuild.context({
    entryPoints: [srcPreload],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: outPreload,
    external: ['electron'],
    sourcemap: 'inline',
    logLevel: 'warning',
    plugins: [
      {
        name: 'copy-root-preload',
        setup(build) {
          build.onEnd(() => {
            try {
              fs.copyFileSync(outPreload, rootPreload);
            } catch (_) {}
          });
        }
      }
    ]
  });

  await mainCtx.watch();
  await preloadCtx.watch();
  console.log('[BuildElectron] ⚡ Watch mode activo para electron/src.');
}

if (require.main === module) {
  if (process.argv.includes('--watch')) {
    watchElectron().catch((err) => {
      console.error('[BuildElectron Fatal Watch]', err);
      process.exit(1);
    });
  } else {
    try {
      buildElectron();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  }
}

module.exports = { buildElectron, watchElectron };

