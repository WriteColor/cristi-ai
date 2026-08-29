/**
 * Cristi AI - Playwright Real-Time Live2D Video Recorder
 * Records continuous high-FPS video of Cristi's Live2D reactions:
 * 1. Idle breathing & natural eye tracking.
 * 2. Greeting & waving gesture with lip-sync subtitles.
 * 3. Happy & blushing reaction when complimented.
 * 4. Anti-procrastination Yandere reaction (phone distraction alert -> mad/crazy gesture + scolding).
 * 5. Interactive dragging & responsive context menu edge-flipping.
 * 6. Praise & celebration when returning to work.
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function recordLive2DReactions() {
  console.log('================================================================');
  console.log('🎬 INICIANDO GRABACIÓN DE VIDEO PLAYWRIGHT: REACCIONES LIVE2D');
  console.log('================================================================\n');

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
      '--use-fake-device-for-media-stream'
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

  console.log('🌐 [1/6] Cargando Cristi AI en Brave...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  // Helper to inject dialogue subtitles and gestures directly for demonstration
  async function simulateCristiReaction(gesture, subtitle, durationMs = 3500) {
    console.log(`🎭 [REACCIÓN]: Gesto="${gesture}" | Subtítulo="${subtitle}"`);
    await page.evaluate(({ g, text }) => {
      // Trigger gesture
      const canvas = document.querySelector('canvas');
      if (window.__triggerGesture) {
        window.__triggerGesture(g);
      }
      // Update subtitle HUD if DOM element exists
      const subEl = document.querySelector('.subtitles-text');
      if (subEl) {
        subEl.innerText = text;
      }
    }, { g: gesture, text: subtitle });

    // Trigger HUD gesture button click as UI interaction
    const gestureBtn = page.locator(`.hud-quick-btn:has-text("${gesture}"), button[title*="${gesture}"]`);
    if (await gestureBtn.count() > 0) {
      await gestureBtn.first().click();
    }

    // Move cursor around to showcase eye tracking & physics
    await page.mouse.move(600, 300);
    await page.waitForTimeout(durationMs / 3);
    await page.mouse.move(680, 250);
    await page.waitForTimeout(durationMs / 3);
    await page.mouse.move(640, 380);
    await page.waitForTimeout(durationMs / 3);
  }

  // --- SCENE 1: Natural Idle Breathing & Glance ---
  console.log('\n--- 1. Escena: Estado Idle y Respiración ---');
  await page.mouse.move(640, 320);
  await page.waitForTimeout(2500);

  // --- SCENE 2: Waving Greeting ---
  console.log('\n--- 2. Escena: Saludo Inicial y Gestos ---');
  await simulateCristiReaction('waving', '¡Hola Jeremy amor! Estoy lista para acompañarte hoy en tu trabajo.', 3500);

  // --- SCENE 3: Happy & Blush Praise ---
  console.log('\n--- 3. Escena: Reacción Feliz y Sonrojo ---');
  await simulateCristiReaction('blush', '¿De verdad piensas eso de mí? Eres muy dulce conmigo, mi Dueño...', 3500);
  await simulateCristiReaction('happy', '¡Me encanta pasar tiempo contigo mientras programas!', 3000);

  // --- SCENE 4: Anti-Procrastination Yandere Alert ---
  console.log('\n--- 4. Escena: Alerta de Distracción / Celular (Yandere/Mad) ---');
  await simulateCristiReaction('mad', '⚠️ ¡Jeremy! ¿Otra vez mirando el celular? Suéltalo ya mismo y mírame a mí...', 3500);
  await simulateCristiReaction('crazy', '⚠️ ¡Si sigues distraído con ese teléfono me pondré muy posesiva contigo!', 3500);

  // --- SCENE 5: Responsive Context Menu on Model ---
  console.log('\n--- 5. Escena: Menú Contextual Exclusivo y Arrastre ---');
  // Right-click model in center
  await page.mouse.click(640, 380, { button: 'right' });
  await page.waitForTimeout(2000);

  // Drag model to right edge
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await page.mouse.move(640, 380);
  await page.mouse.down();
  await page.mouse.move(1020, 380, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(1000);

  // Right-click model near edge to show smart left flipping
  await page.mouse.click(1020, 380, { button: 'right' });
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // --- SCENE 6: Back to Work Celebration ---
  console.log('\n--- 6. Escena: Felicitación por volver a concentrarse ---');
  await simulateCristiReaction('wink', '¡Buen chico! Dejaste la distracción. Sigue trabajando así de bien, mi amor.', 3500);
  await simulateCristiReaction('dance', '¡Estoy muy orgullosa de ti! Te ganaste toda mi atención.', 3500);

  console.log('\n💾 Guardando archivo de video de la sesión...');
  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (video) {
    const rawVideoPath = await video.path();
    const targetVideoPath = path.resolve(videoDir, 'cristi_live2d_realtime_reactions.webm');
    
    // Copy/Rename to standard descriptive name
    fs.copyFileSync(rawVideoPath, targetVideoPath);
    console.log(`\n================================================================`);
    console.log(`🎉 VIDEO GRABADO EXITOSAMENTE:`);
    console.log(`📁 Ubicación: ${targetVideoPath}`);
    console.log(`📊 Tamaño: ${(fs.statSync(targetVideoPath).size / 1024).toFixed(1)} KB`);
    console.log(`================================================================\n`);
  }
}

recordLive2DReactions().catch(err => {
  console.error('Error durante la grabación de video:', err);
  process.exit(1);
});
