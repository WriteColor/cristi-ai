/**
 * Cristi AI — Playwright Deep Audit: All Live2D Models Expressions
 * 
 * Audits ALL 8 models, activating EVERY expression and capturing
 * before/after screenshots. Validates real visual changes.
 * 
 * Rules:
 * - Video recording enabled with audio on every run
 * - Screenshots before/after each expression activation
 * - Explicit close verification for context menu
 * - Sufficient delay for render cycle
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:5173';
const VIDEOS_DIR = path.resolve(__dirname, '../videos');
const SCREENSHOTS_DIR = path.resolve(__dirname, '../screenshots/expression_audit');
const RESULTS_FILE = path.resolve(__dirname, '../output/expression_audit_results.json');

// Ensure output dirs exist
[VIDEOS_DIR, SCREENSHOTS_DIR, path.resolve(__dirname, '../output')].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Model IDs to audit
const MODELS_TO_AUDIT = [
  'yanderegirl',
  'icegirl',
  'jane_doe',
  'ellen',
  'hiyori',
  'miara',
  'toki',
  'ruan_mei'
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Switch to a specific Live2D model via the ContextMenu dropdown
 */
async function switchModel(page, modelId) {
  console.log(`  → Switching to model: ${modelId}`);
  
  // Right-click in center of canvas (on the model area)
  await page.mouse.click(640, 400, { button: 'right' });
  await sleep(600);
  
  // Verify menu is open
  const menuOpen = await page.locator('.custom-context-menu').isVisible().catch(() => false);
  if (!menuOpen) {
    console.warn('  ⚠️ Context menu did not open, retrying...');
    await sleep(300);
    await page.mouse.click(640, 400, { button: 'right' });
    await sleep(600);
  }

  // Select model from dropdown
  const select = page.locator('.custom-context-menu .context-select').first();
  await select.selectOption(modelId);
  await sleep(200);

  // Close menu by pressing Escape
  await page.keyboard.press('Escape');
  await sleep(3500); // Wait for model to load
  
  // Verify menu is closed
  const menuStillOpen = await page.locator('.custom-context-menu').isVisible().catch(() => false);
  if (menuStillOpen) {
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  console.log(`  ✓ Model switched to ${modelId}`);
}

/**
 * Get available expressions for the current model.
 * Pass modelId explicitly to avoid stale registry reads.
 */
async function getModelCapabilities(page, modelId) {
  return await page.evaluate((targetModelId) => {
    const avatar = window.__cristiAvatar;
    if (!avatar) return null;
    const registry = avatar.registry;
    // Use the explicitly passed modelId rather than the stale registry.activeModelId
    const profile = registry?.getModel(targetModelId);
    return {
      modelId: targetModelId,
      expressions: profile?.capabilities?.customExpressions || [],
      motions: profile?.capabilities?.motions || [],
      blockedExpressions: profile?.blockedExpressions || [],
      expressionManagerDefs: (() => {
        try {
          const defs = avatar.model?.internalModel?.motionManager?.expressionManager?.definitions;
          return defs ? defs.map(d => d.name) : [];
        } catch (e) { return []; }
      })()
    };
  }, modelId);
}

/**
 * Capture pixel hash from a region (used to detect visual changes)
 */
async function captureRegionHash(page) {
  return await page.evaluate(() => {
    const canvas = document.querySelector('.live2d-pixi-view') || document.querySelector('canvas');
    if (!canvas) return 'no-canvas';
    try {
      const ctx = canvas.getContext('webgl') || canvas.getContext('webgl2');
      if (!ctx) {
        // Try 2D
        const ctx2d = canvas.getContext('2d');
        if (!ctx2d) return 'no-context';
        const d = ctx2d.getImageData(100, 100, 400, 400).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i+1] + d[i+2];
        return String(sum);
      }
      // WebGL readback
      const w = Math.min(canvas.width, 400);
      const h = Math.min(canvas.height, 400);
      const buf = new Uint8Array(w * h * 4);
      ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i += 4) sum += buf[i] + buf[i+1] + buf[i+2];
      return String(sum);
    } catch (e) { return 'error-' + e.message.substring(0, 20); }
  });
}

/**
 * Audit a single expression on the currently loaded model
 */
async function auditExpression(page, modelId, exprName, screenshotDir) {
  const result = {
    expression: exprName,
    activated: false,
    visualChange: false,
    hashBefore: null,
    hashAfter: null,
    error: null
  };

  try {
    // Screenshot + hash BEFORE
    const beforePath = path.join(screenshotDir, `${exprName.replace(/[^a-zA-Z0-9]/g, '_')}_before.png`);
    await page.screenshot({ path: beforePath, fullPage: false });
    result.hashBefore = await captureRegionHash(page);

    // Activate expression via window.__cristiAvatar
    const activated = await page.evaluate((expName) => {
      try {
        if (!window.__cristiAvatar?.setExpression) return false;
        window.__cristiAvatar.setExpression(expName);
        return true;
      } catch (e) { return false; }
    }, exprName);
    result.activated = activated;

    // Wait for render cycle (expression needs time to interpolate)
    await sleep(1200);

    // Screenshot + hash AFTER
    const afterPath = path.join(screenshotDir, `${exprName.replace(/[^a-zA-Z0-9]/g, '_')}_after.png`);
    await page.screenshot({ path: afterPath, fullPage: false });
    result.hashAfter = await captureRegionHash(page);

    // Visual change detection
    result.visualChange = result.hashBefore !== result.hashAfter;
    if (result.visualChange) {
      console.log(`    ✅ ${exprName}: VISUAL CHANGE CONFIRMED`);
    } else {
      console.log(`    ❌ ${exprName}: NO VISUAL CHANGE (hash: ${result.hashAfter?.substring(0, 8)})`);
    }

    // Reset to neutral
    await page.evaluate(() => {
      window.__cristiAvatar?.setExpression('none');
    });
    await sleep(600);

  } catch (e) {
    result.error = e.message;
    console.error(`    💥 ${exprName}: ERROR — ${e.message}`);
  }

  return result;
}

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    headless: false,
    args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: VIDEOS_DIR,
      size: { width: 1280, height: 720 }
    },
    permissions: ['microphone', 'camera']
  });

  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('  [PAGE ERROR]', msg.text());
  });

  console.log('🎬 Starting Live2D Expression Audit...');
  console.log(`📡 Connecting to ${BASE_URL}`);
  
  await page.goto(BASE_URL);
  await page.waitForTimeout(4000);

  // Wait for initial model to load
  await page.waitForFunction(() => window.__cristiAvatar?.model?.internalModel?.coreModel !== undefined, {
    timeout: 30000
  }).catch(() => console.warn('⚠️ Initial model load timeout — continuing anyway'));

  const allResults = {};

  for (const modelId of MODELS_TO_AUDIT) {
    console.log(`\n🎭 ═══════════════════════════════════`);
    console.log(`🎭 Auditing model: ${modelId.toUpperCase()}`);
    console.log(`🎭 ═══════════════════════════════════`);
    
    const modelScreenshotDir = path.join(SCREENSHOTS_DIR, modelId);
    if (!fs.existsSync(modelScreenshotDir)) fs.mkdirSync(modelScreenshotDir, { recursive: true });

    // Switch to this model
    await switchModel(page, modelId);

    // Wait for model to fully load
    await page.waitForFunction(() => window.__cristiAvatar?.model?.internalModel?.coreModel !== undefined, {
      timeout: 20000
    }).catch(() => console.warn('  ⚠️ Model load timeout'));
    await sleep(1000);

    // Get capabilities with explicit modelId (avoids stale registry reads)
    const caps = await getModelCapabilities(page, modelId);
    console.log(`  📋 Expressions in profile: [${(caps?.expressions || []).join(', ')}]`);
    console.log(`  📋 ExpressionManager defs: [${(caps?.expressionManagerDefs || []).join(', ')}]`);

    allResults[modelId] = {
      expressions: [],
      summary: { total: 0, changed: 0, failed: 0 }
    };

    const exprs = caps?.expressions || [];
    if (exprs.length === 0) {
      console.log(`  ℹ️ No customExpressions registered for ${modelId} — testing semantic actions via parameter targets`);
      // Test a few semantic parameter-based emotions
      const semanticTests = ['happy', 'blush', 'angry', 'sad', 'surprised', 'love'];
      for (const emotion of semanticTests) {
        const r = await auditExpression(page, modelId, emotion, modelScreenshotDir);
        allResults[modelId].expressions.push(r);
        if (r.visualChange) allResults[modelId].summary.changed++;
        else if (r.error) allResults[modelId].summary.failed++;
        allResults[modelId].summary.total++;
      }
    } else {
      for (const exprName of exprs) {
        const r = await auditExpression(page, modelId, exprName, modelScreenshotDir);
        allResults[modelId].expressions.push(r);
        if (r.visualChange) allResults[modelId].summary.changed++;
        else if (r.error) allResults[modelId].summary.failed++;
        allResults[modelId].summary.total++;
      }
    }

    const s = allResults[modelId].summary;
    console.log(`\n  📊 ${modelId}: ${s.changed}/${s.total} expressions confirmed visual change`);
  }

  // Save results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(allResults, null, 2));
  console.log(`\n💾 Results saved to: ${RESULTS_FILE}`);

  // Final summary
  console.log('\n\n═══════════════════════════════════════════');
  console.log('📊 FINAL AUDIT SUMMARY');
  console.log('═══════════════════════════════════════════');
  let grandTotal = 0, grandChanged = 0;
  for (const [modelId, data] of Object.entries(allResults)) {
    const s = data.summary;
    grandTotal += s.total;
    grandChanged += s.changed;
    const icon = s.changed === s.total ? '✅' : s.changed > 0 ? '⚠️' : '❌';
    console.log(`${icon} ${modelId.padEnd(15)}: ${s.changed}/${s.total} visual changes`);
  }
  console.log(`\n🏆 Overall: ${grandChanged}/${grandTotal} (${Math.round(grandChanged/grandTotal*100)}%)`);

  await sleep(3000);
  await context.close();
  await browser.close();
  console.log('\n✅ Audit complete. Video saved.');
}

main().catch(console.error);
