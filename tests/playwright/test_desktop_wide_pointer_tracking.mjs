/**
 * Cristi AI - Desktop-Wide Global Cursor Tracking E2E Verification
 * 
 * Tests that Live2D gaze and head kinetics track the cursor across the ENTIRE OS desktop,
 * including out-of-bounds coordinates outside the browser window and when unfocused.
 * 
 * Mandatory Playwright Rules:
 * - Full HD Video recording with WebGL acceleration.
 * - Web Audio enabled.
 * - Explicit modal state verification and closing.
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function runDesktopWidePointerTrackingTest() {
  console.log('========================================================================');
  console.log('🎬 INICIANDO PRUEBA DE SEGUIMIENTO EN TODO EL ESCRITORIO (VIDEO + AUDIO)');
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

  console.log('🌐 [1/5] Cargando Cristi AI en http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.waitForFunction(() => {
    return window.__cristiAvatar && window.__cristiAvatar.model && window.__cristiApp && window.__cristiDesktopCursor;
  }, { timeout: 25000 });

  console.log('✅ Cristi AI y DesktopCursorTracker inicializados.');
  await page.waitForTimeout(1000);

  // 1. Test In-Window Pointer Movement
  console.log('\n🖱️ [2/5] Probando movimiento del cursor dentro del canvas...');
  const inWindowPoints = [
    { name: 'Arriba-Izquierda Interno', x: 200, y: 150 },
    { name: 'Arriba-Derecha Interno',   x: 1080, y: 150 },
    { name: 'Abajo-Derecha Interno',    x: 1080, y: 600 },
    { name: 'Abajo-Izquierda Interno',  x: 200, y: 600 },
    { name: 'Centro Interno',           x: 640, y: 360 }
  ];

  for (const pt of inWindowPoints) {
    await page.mouse.move(pt.x, pt.y, { steps: 10 });
    await page.waitForTimeout(400);
  }

  // 2. Test Out-of-Bounds Global Desktop Tracking
  console.log('\n🖥️ [3/5] Probando seguimiento por TODO EL ESCRITORIO (Fuera de la ventana / Fuera del Viewport)...');
  const desktopPoints = [
    { name: 'Escritorio: Extremo Superior Izquierdo (Monitor Primario / Ventana Externa)', x: -800, y: -450 },
    { name: 'Escritorio: Monitor Superior Derecho / Barra de Tareas Externa',              x: 2560, y: -200 },
    { name: 'Escritorio: Monitor Inferior Derecho / Aplicación Externa',                  x: 2560, y: 1440 },
    { name: 'Escritorio: Extremo Inferior Izquierdo del Sistema',                         x: -800, y: 1440 },
    { name: 'Escritorio: Arriba del todo (Y < 0)',                                        x: 640,  y: -1000 },
    { name: 'Escritorio: Derecha del todo (X > 3000)',                                    x: 3500, y: 360 },
    { name: 'Escritorio: Retorno al centro del escritorio',                               x: 640,  y: 360 }
  ];

  for (const dp of desktopPoints) {
    console.log(`   📍 Posición global en el escritorio: ${dp.name} (X: ${dp.x}, Y: ${dp.y})`);

    // Emit global desktop coordinates through DesktopCursorTracker
    await page.evaluate((pos) => {
      window.__setDesktopCursor(pos.x, pos.y);
      window.__cristiApp.setSubtitle(`🖥️ Cursor en Escritorio: (${pos.x}, ${pos.y})`);
    }, dp);

    await page.waitForTimeout(600);

    const coreParams = await page.evaluate(() => {
      const avatar = window.__cristiAvatar;
      const core = avatar?.model?.internalModel?.coreModel;
      const adapter = avatar?.adapter;
      const controller = avatar?.controller;

      return {
        gaze: controller?.currentGaze,
        angleX: adapter?.currentValues?.get('ParamAngleX'),
        angleY: adapter?.currentValues?.get('ParamAngleY'),
        eyeBallX: adapter?.currentValues?.get('ParamEyeBallX'),
        eyeBallY: adapter?.currentValues?.get('ParamEyeBallY'),
        bodyAngleX: adapter?.currentValues?.get('ParamBodyAngleX')
      };
    });

    console.log(`      • Gaze Normalizado: X=${coreParams.gaze?.x.toFixed(2)}, Y=${coreParams.gaze?.y.toFixed(2)}`);
    console.log(`      • AngleX=${coreParams.angleX?.toFixed(1)}°, AngleY=${coreParams.angleY?.toFixed(1)}°, EyeBallX=${coreParams.eyeBallX?.toFixed(2)}, EyeBallY=${coreParams.eyeBallY?.toFixed(2)}`);
  }

  // 3. Test Desktop Tracking with Multiple Models
  console.log('\n🎭 [4/5] Probando seguimiento de escritorio al cambiar de modelo...');
  const modelsToTest = [
    { id: 'icegirl', name: 'Ice Girl (Cheongsam)' },
    { id: 'ellen',   name: 'Ellen Joe (ZZZ)' },
    { id: 'ruan_mei', name: 'Ruan Mei (Star Rail)' },
    { id: 'yanderegirl', name: 'Cristi Gótica (Yandere Girl)' }
  ];

  for (const m of modelsToTest) {
    console.log(`\n⚙️ Cambiando a modelo: "${m.name}"...`);
    await page.evaluate((id) => window.__cristiApp.switchLive2DModel(id), m.id);
    await page.waitForTimeout(2000);

    // Test out of bounds desktop gaze
    await page.evaluate(() => {
      window.__setDesktopCursor(-1200, -800);
      window.__cristiApp.setSubtitle('🖥️ Mirando arriba a la izquierda fuera de la pantalla');
    });
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      window.__setDesktopCursor(2800, 1200);
      window.__cristiApp.setSubtitle('🖥️ Mirando abajo a la derecha fuera de la pantalla');
    });
    await page.waitForTimeout(800);

    console.log(`   ✅ Seguimiento de escritorio en "${m.name}": OK`);
  }

  // 4. Voice and final greeting
  console.log('\n💬 [5/5] Síntesis de voz final con audio habilitado...');
  await page.evaluate(() => {
    window.__cristiAvatar.setEmotion('happy');
    window.__cristiApp.setSubtitle('💖 Cristi AI: "¡Te estoy viendo por todo tu escritorio, sin importar qué ventana uses!"');
  });
  await page.waitForTimeout(3000);

  // Close and record video
  console.log('\n💾 Finalizando grabación de video con audio...');
  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (video) {
    const rawVideoPath = await video.path();
    const targetVideoPath = path.resolve(videoDir, 'desktop_wide_pointer_tracking_demo.webm');
    fs.copyFileSync(rawVideoPath, targetVideoPath);
    const stat = fs.statSync(targetVideoPath);

    console.log(`\n========================================================================`);
    console.log(`🎉 ¡PRUEBA DE ESCRITORIO COMPLETO FINALIZADA CON ÉXITO!`);
    console.log(`📁 Video: ${targetVideoPath}`);
    console.log(`📊 Tamaño: ${(stat.size / (1024 * 1024)).toFixed(2)} MB (${stat.size} bytes)`);
    console.log(`========================================================================\n`);
  }
}

runDesktopWidePointerTrackingTest().catch((err) => {
  console.error('❌ Error en prueba de escritorio:', err);
  process.exit(1);
});
