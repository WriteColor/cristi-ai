/**
 * Deep param audit v2 — Lee targetValues del adapter y getParameterValueById por ID directo.
 * Compatible con Cubism4 WASM + pixi-live2d-display.
 */
import { chromium } from 'playwright';

const MODELS = ['yanderegirl','icegirl','jane_doe','ellen','hiyori','miara','toki','ruan_mei'];
const WATCH_PARAMS = [
  'ParamEyeLSmile','ParamEyeRSmile','ParamMouthForm','ParamCheek',
  'ParamBrowLY','ParamBrowRY','ParamEyeLOpen','ParamEyeROpen',
  'ParamBrowLForm','ParamBrowRForm','ParamMouthOpenY'
];

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://localhost:5173');
await page.waitForTimeout(6000);

// Helper: lee los params directamente del coreModel usando getParameterValueById
async function readParams(watchParams) {
  return page.evaluate((params) => {
    const av = window.__cristiAvatar;
    const cm = av?.model?.internalModel?.coreModel;
    const result = {};
    if (!cm) return result;
    for (const p of params) {
      try {
        const v = cm.getParameterValueById(p);
        if (v !== undefined && v !== null) result[p] = +v.toFixed(4);
      } catch(_) {}
    }
    return result;
  }, watchParams);
}

// Helper: lee targetValues del adapter (los targets suavizados)
async function readAdapterTargets(watchParams) {
  return page.evaluate((params) => {
    const av = window.__cristiAvatar;
    const tv = av?.adapter?.targetValues;
    if (!tv) return {};
    const result = {};
    for (const p of params) {
      if (tv.has(p)) result[p] = +tv.get(p).toFixed(4);
    }
    return result;
  }, watchParams);
}

// Helper: switch model via DOM select
async function switchModel(modelId) {
  const switched = await page.evaluate((id) => {
    // Intenta via eventBus primero
    if (window.__switchLive2DModel) { window.__switchLive2DModel(id); return 'eventBus'; }
    // Intenta disparar change en el select
    const sel = document.querySelector('select.context-select, select[data-model-select]');
    if (sel) {
      sel.value = id;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return 'select';
    }
    return 'none';
  }, modelId);

  if (switched === 'none') {
    // Abre context menu y usa el selector
    await page.mouse.click(640, 400, { button: 'right' });
    await page.waitForTimeout(500);
    const sel = page.locator('select').first();
    await sel.selectOption(modelId);
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(4500);
}

const SUMMARY = {};

for (const modelId of MODELS) {
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`🎭 ${modelId.toUpperCase()}`);
  console.log('═'.repeat(55));

  await switchModel(modelId);

  // Verifica que el modelo cargó
  const loaded = await page.evaluate(() => !!window.__cristiAvatar?.model?.internalModel?.coreModel);
  if (!loaded) {
    console.log('  ❌ coreModel no disponible');
    SUMMARY[modelId] = { error: 'no coreModel' };
    continue;
  }

  // Info de expressionManager
  const emInfo = await page.evaluate(() => {
    const em = window.__cristiAvatar?.model?.internalModel?.motionManager?.expressionManager;
    return { has: !!em, defs: em?.definitions?.length ?? 0, names: em?.definitions?.slice(0,5).map(d=>d.Name) ?? [] };
  });
  console.log(`  ExprManager: ${emInfo.has ? '✅' : '❌'} ${emInfo.defs} defs [${emInfo.names.join(', ')}]`);

  // PASO 1: Reset a idle y lee baseline
  await page.evaluate(() => window.__cristiAvatar?.controller?.setEmotion?.('idle'));
  await page.waitForTimeout(1500);
  const baseline = await readParams(WATCH_PARAMS);
  const baseTargets = await readAdapterTargets(WATCH_PARAMS);
  const availableParams = Object.keys(baseline);
  console.log(`  Params disponibles: [${availableParams.join(', ')}]`);
  if (availableParams.length === 0) {
    // Intenta via targetValues
    const tkeys = Object.keys(baseTargets);
    console.log(`  TargetValues keys: [${tkeys.join(', ')}]`);
    if (tkeys.length === 0) {
      console.log('  ⚠️  getParameterValueById no responde — usando adapter.targetValues');
    }
  }
  console.log(`  Baseline: ${availableParams.map(p=>`${p}=${baseline[p]}`).join(' | ') || '(vacío)'}`);

  // PASO 2: Activa 'happy'
  await page.evaluate(() => window.__cristiAvatar?.controller?.setEmotion?.('happy'));
  await page.waitForTimeout(2000); // Espera lerp

  const afterHappy = await readParams(WATCH_PARAMS);
  const afterTargets = await readAdapterTargets(WATCH_PARAMS);

  // PASO 3: Compara
  let changed = 0, total = 0;
  const details = [];

  // Compara coreModel values
  for (const p of availableParams) {
    total++;
    const b = baseline[p] ?? 0;
    const a = afterHappy[p] ?? 0;
    const delta = Math.abs(a - b);
    const ok = delta > 0.04;
    if (ok) changed++;
    details.push(`  ${ok ? '✅' : '❌'} ${p}: ${b.toFixed(3)} → ${a.toFixed(3)} (Δ${delta.toFixed(3)})`);
  }

  // Si no hubo params del coreModel, compara adapter targets
  if (total === 0) {
    console.log('  ⚠️  Usando adapter.targetValues para comparar...');
    const allKeys = new Set([...Object.keys(baseTargets), ...Object.keys(afterTargets)]);
    for (const p of allKeys) {
      total++;
      const b = baseTargets[p] ?? 0;
      const a = afterTargets[p] ?? 0;
      const delta = Math.abs(a - b);
      const ok = delta > 0.04;
      if (ok) changed++;
      details.push(`  ${ok ? '✅' : '❌'} [TARGET] ${p}: ${b.toFixed(3)} → ${a.toFixed(3)} (Δ${delta.toFixed(3)})`);
    }
  }

  details.forEach(l => console.log(l));

  // PASO 4: Si tiene exp3, prueba una expresión directa
  let exp3Result = null;
  if (emInfo.defs > 0) {
    const expr = emInfo.names[0];
    await page.evaluate((name) => window.__cristiAvatar?.setExpression?.(name), expr);
    await page.waitForTimeout(1500);
    const afterExpr = await readParams(WATCH_PARAMS);
    let exprChanged = 0;
    for (const p of availableParams) {
      const delta = Math.abs((afterExpr[p]??0) - (afterHappy[p]??0));
      if (delta > 0.04) exprChanged++;
    }
    exp3Result = { expr, changed: exprChanged, total: availableParams.length };
    console.log(`  🎭 Exp3 "${expr}": ${exprChanged}/${availableParams.length} params cambian`);
  }

  const icon = changed >= 2 ? '✅' : changed === 1 ? '⚠️' : '❌';
  console.log(`\n  ${icon} RESULTADO: ${changed}/${total} params cambian con 'happy'`);

  SUMMARY[modelId] = { changed, total, exp3: exp3Result, exprDefs: emInfo.defs };

  await page.evaluate(() => window.__cristiAvatar?.controller?.setEmotion?.('idle'));
  await page.waitForTimeout(600);
}

await browser.close();

console.log(`\n${'═'.repeat(60)}`);
console.log('📊 RESUMEN FINAL — PARAMS REALES');
console.log('═'.repeat(60));
for (const [model, r] of Object.entries(SUMMARY)) {
  if (r.error) {
    console.log(`❌ ${model.padEnd(15)} ERROR: ${r.error}`);
  } else {
    const icon = r.changed >= 2 ? '✅' : r.changed >= 1 ? '⚠️' : '❌';
    const exp3str = r.exp3 ? ` | exp3 "${r.exp3.expr}": ${r.exp3.changed}/${r.exp3.total}` : '';
    console.log(`${icon} ${model.padEnd(15)} happy: ${r.changed}/${r.total} params | ${r.exprDefs} exp3 defs${exp3str}`);
  }
}
