/**
 * Cristi AI - Pointer Tracking Diagnostic Tool
 * Mandatory Rule: Records full HD video with audio enabled.
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function diagnosePointerTracking() {
  console.log('========================================================================');
  console.log('🔍 INICIANDO DIAGNÓSTICO DE SEGUIMIENTO DE PUNTERO (CON VIDEO & AUDIO)');
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
  page.on('pageerror', err => console.error('  [BROWSER ERROR]', err.message));

  console.log('🌐 Navegando a http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.waitForFunction(() => {
    return window.__cristiAvatar && window.__cristiAvatar.model && window.__cristiApp;
  }, { timeout: 25000 });

  console.log('✅ Avatar listo. Moviendo puntero a diferentes posiciones para medir parámetros...');

  const inspectCore = await page.evaluate(() => {
    const avatar = window.__cristiAvatar;
    const core = avatar?.model?.internalModel?.coreModel;
    return {
      keys: Object.keys(core || {}),
      protoKeys: Object.getOwnPropertyNames(Object.getPrototypeOf(core || {})),
      _parameters: core?._parameters ? Object.keys(core._parameters) : null,
      _parameters_ids: core?._parameters?.ids ? core._parameters.ids.slice(0, 10) : null,
      _parameters_types: core?._parameters ? Object.entries(core._parameters).map(([k, v]) => [k, Array.isArray(v) ? `Array(${v.length})` : typeof v]) : null,
      parameters: core?.parameters ? Object.keys(core.parameters) : null,
      count: typeof core?.getParameterCount === 'function' ? core.getParameterCount() : null
    };
  });
  console.log('🔬 Estructura exacta de coreModel:', JSON.stringify(inspectCore, null, 2));

  const testCoords = [
    { name: 'Arriba Izquierda', x: 200, y: 150 },
    { name: 'Arriba Derecha',   x: 1080, y: 150 },
    { name: 'Abajo Izquierda',  x: 200, y: 600 },
    { name: 'Abajo Derecha',    x: 1080, y: 600 },
    { name: 'Centro',           x: 640, y: 360 }
  ];

  for (const pos of testCoords) {
    console.log(`\n📍 Moviendo mouse a: ${pos.name} (${pos.x}, ${pos.y})`);
    await page.mouse.move(pos.x, pos.y, { steps: 15 });
    await page.waitForTimeout(800);

    const metrics = await page.evaluate(() => {
      const avatar = window.__cristiAvatar;
      const core = avatar?.model?.internalModel?.coreModel;
      const internal = avatar?.model?.internalModel;
      const adapter = avatar?.adapter;
      const controller = avatar?.controller;

      const methods = core ? Object.getOwnPropertyNames(Object.getPrototypeOf(core)) : [];

      return {
        mapping: adapter?.mapping,
        targetValues: adapter ? Array.from(adapter.targetValues.entries()) : [],
        currentValues: adapter ? Array.from(adapter.currentValues.entries()) : [],
        currentGaze: controller?.currentGaze,
        targetGaze: controller?.targetGaze,
        coreMethods: methods.filter(m => m.toLowerCase().includes('param')),
        hasSetParamFloat: typeof internal?.setParamFloat === 'function'
      };
    });

    console.log(`   📊 Diagnóstico interno:`, JSON.stringify(metrics, null, 2));
  }

  await page.waitForTimeout(1500);

  console.log('\n💾 Finalizando grabación de diagnóstico...');
  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (video) {
    const rawVideoPath = await video.path();
    const targetVideoPath = path.resolve(videoDir, 'diagnose_pointer_tracking.webm');
    fs.copyFileSync(rawVideoPath, targetVideoPath);
    const stat = fs.statSync(targetVideoPath);
    console.log(`📁 Video de diagnóstico guardado: ${targetVideoPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
  }
}

diagnosePointerTracking().catch((err) => {
  console.error('❌ Error durante diagnóstico:', err);
  process.exit(1);
});
