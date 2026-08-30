/**
 * Cristi AI - Ellen Joe Watermark Full Analysis & Clean Removal
 * Mandatory Rule: Records full HD video with audio enabled.
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function testEllenWatermarkRemoval() {
  console.log('========================================================================');
  console.log('🔍 ANÁLISIS COMPLETO Y ELIMINACIÓN DE MARCA DE AGUA EN ELLEN JOE');
  console.log('========================================================================\n');

  const videoDir = path.resolve('tests/videos');
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    headless: false,
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-extensions',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();
  page.on('console', msg => console.log('  [BROWSER CONSOLE]', msg.type(), msg.text()));

  console.log('🌐 [1/4] Cargando Cristi AI en http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.waitForFunction(() => {
    return window.__cristiAvatar && window.__cristiAvatar.model && window.__cristiApp;
  }, { timeout: 25000 });

  console.log('🔄 [2/4] Cambiando a modelo Ellen Joe y esperando carga completa...');
  await page.evaluate(() => {
    window.__cristiApp.switchLive2DModel('ellen');
  });

  // Wait for Ellen to be completely loaded in WebGL
  await page.waitForFunction(() => {
    const avatar = window.__cristiAvatar;
    const core = avatar?.model?.internalModel?.coreModel;
    return core && core._partIds && core._partIds.length > 50;
  }, { timeout: 30000 });
  await page.waitForTimeout(1500);

  console.log('✅ Ellen Joe cargada con éxito en WebGL. Analizando partes y drawables...');

  const info = await page.evaluate(() => {
    const avatar = window.__cristiAvatar;
    const core = avatar.model.internalModel.coreModel;

    const parts = core._partIds || [];
    const params = core._parameterIds || [];
    const drawables = core._drawableIds || [];

    const partData = parts.map((id, index) => ({
      id,
      index,
      opacity: typeof core.getPartOpacityByIndex === 'function' ? core.getPartOpacityByIndex(index) : 1
    }));

    const paramData = params.map((id, index) => ({
      id,
      index,
      value: typeof core.getParameterValueByIndex === 'function' ? core.getParameterValueByIndex(index) : 0,
      min: typeof core.getParameterMinimumValue === 'function' ? core.getParameterMinimumValue(index) : -1,
      max: typeof core.getParameterMaximumValue === 'function' ? core.getParameterMaximumValue(index) : 1,
      default: typeof core.getParameterDefaultValue === 'function' ? core.getParameterDefaultValue(index) : 0
    }));

    // Find any param or part with "shui", "yin", "xy", "text", "part17", "part78", "part8"
    const matchedParts = partData.filter(p => p.id === 'Part17' || p.id.toLowerCase().includes('shui') || p.id.toLowerCase().includes('yin'));
    const matchedParams = paramData.filter(p => p.id.toLowerCase().includes('headxy') || p.id.toLowerCase().includes('shui') || p.id.toLowerCase().includes('yin') || p.id.toLowerCase().includes('xy'));

    return {
      partCount: parts.length,
      paramCount: params.length,
      drawableCount: drawables.length,
      matchedParts,
      matchedParams,
      sampleParams: paramData.filter(p => p.default !== 0 || p.value !== 0)
    };
  });

  console.log('🔬 Diagnóstico de Ellen:', JSON.stringify(info, null, 2));

  // Inspect drawables belonging to Part17
  const drawableAnalysis = await page.evaluate(() => {
    const avatar = window.__cristiAvatar;
    const core = avatar.model.internalModel.coreModel;
    const drawables = core._drawableIds || [];

    const parentPartIndices = core._drawableParentPartIndices || [];
    const part17Drawables = [];

    for (let i = 0; i < drawables.length; i++) {
      const parentIdx = parentPartIndices[i];
      if (parentIdx === 0 || drawables[i].toLowerCase().includes('shui') || drawables[i].toLowerCase().includes('text') || drawables[i].toLowerCase().includes('free') || drawables[i].toLowerCase().includes('bili') || drawables[i].toLowerCase().includes('uid')) {
        part17Drawables.push({ id: drawables[i], index: i, parentPartIndex: parentIdx });
      }
    }

    return {
      totalDrawables: drawables.length,
      part17Drawables,
      parentPartIndicesLength: parentPartIndices.length
    };
  });

  console.log('🎨 Drawables de Part17 / Marcas de agua:', JSON.stringify(drawableAnalysis, null, 2));

  // Hide Part17 and all related drawables on every ticker frame or directly
  await page.evaluate(() => {
    const avatar = window.__cristiAvatar;
    const core = avatar.model.internalModel.coreModel;
    const model = avatar.model;

    // Add ticker hook to keep Part17 opacity at 0
    model.internalModel.coreModel._partOpacities[0] = 0;
    if (typeof core.setPartOpacityByIndex === 'function') {
      core.setPartOpacityByIndex(0, 0);
    }

    // Set parameters
    if (typeof core.setParameterValueById === 'function') {
      core.setParameterValueById('Paramheadxy', 0);
      core.setParameterValueById('ParambodyXY2', 0);
    }
  });

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tests/screenshots/ellen_no_watermark.png' });
  console.log('📸 Captura guardada en tests/screenshots/ellen_no_watermark.png');

  // Finalize video recording
  console.log('\n💾 [4/4] Guardando video...');
  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (video) {
    const rawVideoPath = await video.path();
    const targetVideoPath = path.resolve(videoDir, 'inspect_ellen_watermark.webm');
    fs.copyFileSync(rawVideoPath, targetVideoPath);
    const stat = fs.statSync(targetVideoPath);
    console.log(`📁 Video guardado: ${targetVideoPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
  }
}

testEllenWatermarkRemoval().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
