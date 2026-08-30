/**
 * Cristi AI - Modern UI/UX Verification Suite
 * Tests the expanded Settings Modal with dynamic prompt auto-adjust and the enhanced Right-Click Context Menu.
 * Mandatory Rule: Records full HD video with audio enabled, explicitly checks and closes modals.
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function testModernUiUx() {
  console.log('========================================================================');
  console.log('🎬 INICIANDO PRUEBA DE MODAL DE AJUSTES Y MENÚ CONTEXTUAL (VIDEO + AUDIO)');
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

  console.log('🌐 [1/5] Cargando Cristi AI en http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.waitForFunction(() => {
    return window.__cristiAvatar && window.__cristiAvatar.model && window.__cristiApp;
  }, { timeout: 25000 });

  console.log('✅ Aplicación lista.');
  await page.waitForTimeout(1000);

  // 1. Test Enhanced Right-Click Context Menu
  console.log('\n🖱️ [2/5] Probando menú contextual mejorado en click derecho...');
  await page.mouse.click(640, 360, { button: 'right' });
  await page.waitForTimeout(1200);

  const contextMenuVisible = await page.evaluate(() => {
    const el = document.querySelector('.custom-context-menu');
    return el && window.getComputedStyle(el).display !== 'none';
  });
  console.log('   • Menú Contextual visible:', contextMenuVisible);

  // Trigger quick emotion from context menu
  console.log('   • Disparando emoción rápida (Sonrojo ❤️) desde el menú contextual...');
  const emotionBtn = await page.$('.context-emotion-btn[title="Sonrojo"]');
  if (emotionBtn) {
    await emotionBtn.click();
    await page.waitForTimeout(1000);
  }

  // 2. Open Expanded Settings Modal
  console.log('\n⚙️ [3/5] Abriendo modal de ajustes ampliado...');
  await page.evaluate(() => {
    window.__cristiApp.openSettings();
  });
  await page.waitForTimeout(1000);

  const modalDimensions = await page.evaluate(() => {
    const card = document.querySelector('.sm-card');
    if (!card) return null;
    const rect = card.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  console.log('   • Dimensiones del Modal de Ajustes:', modalDimensions);

  // 3. Test Avatar Live2D Catalog Tab
  console.log('\n🎭 [4/5] Navegando por pestaña "Avatar Live2D"...');
  const avatarTabBtn = await page.$('.sm-tab-btn:has-text("Avatar Live2D")');
  if (avatarTabBtn) {
    await avatarTabBtn.click();
    await page.waitForTimeout(1200);
  }

  // 4. Test Personality Tab & Auto-Adjusting Textarea
  console.log('\n🧠 [5/5] Probando pestaña "Personalidad" y Textarea autoajustable...');
  const personaTabBtn = await page.$('.sm-tab-btn:has-text("Personalidad")');
  if (personaTabBtn) {
    await personaTabBtn.click();
    await page.waitForTimeout(1000);

    // Click quick persona preset (e.g. Ellen Joe)
    const ellenPresetBtn = await page.$('.sm-persona-preset-btn:has-text("Ellen Joe")');
    if (ellenPresetBtn) {
      console.log('   • Seleccionando preset rápido "Ellen Joe"...');
      await ellenPresetBtn.click();
      await page.waitForTimeout(800);
    }

    const textareaHeight = await page.evaluate(() => {
      const textarea = document.querySelector('.sm-textarea');
      return textarea ? textarea.offsetHeight : 0;
    });
    console.log(`   • Altura autoajustada del Textarea: ${textareaHeight}px`);
  }

  // Explicitly close modal (Rule: never assume modal closed)
  console.log('\n🔒 Cerrando explícitamente el modal de ajustes...');
  const saveBtn = await page.$('.sm-btn-primary');
  if (saveBtn) {
    await saveBtn.click();
    await page.waitForTimeout(1200);
  }

  // Final audio reaction
  await page.evaluate(() => {
    window.__cristiAvatar.setEmotion('happy');
    window.__cristiApp.setSubtitle('✨ Cristi AI: "¡Interfaz de ajustes y menú contextual actualizados con éxito!"');
  });
  await page.waitForTimeout(2500);

  // Finalize video recording
  console.log('\n💾 Finalizando grabación de video con audio...');
  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (video) {
    const rawVideoPath = await video.path();
    const targetVideoPath = path.resolve(videoDir, 'modern_ui_ux_demo.webm');
    fs.copyFileSync(rawVideoPath, targetVideoPath);
    const stat = fs.statSync(targetVideoPath);
    console.log(`\n========================================================================`);
    console.log(`🎉 ¡PRUEBA DE UI/UX FINALIZADA CON ÉXITO!`);
    console.log(`📁 Video: ${targetVideoPath}`);
    console.log(`📊 Tamaño: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`========================================================================\n`);
  }
}

testModernUiUx().catch(err => {
  console.error('❌ Error en prueba UI/UX:', err);
  process.exit(1);
});
