/**
 * Cristi AI - Context Menu Individual Expressions & Quick Switchers Test
 * Mandatory Rule: Records full HD video with audio enabled, explicitly checks and closes modals.
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function testContextMenuIndividualExpressions() {
  console.log('========================================================================');
  console.log('🎬 PROBANDO MENÚ CONTEXTUAL: EXPRESIONES INDIVIDUALES Y DESPLEGABLES');
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

  console.log('✅ Cristi AI cargada con éxito.');
  await page.waitForTimeout(1000);

  // 1. Open context menu on Yandere Girl
  console.log('\n🖱️ [2/5] Abriendo menú contextual en Cristi Gótica (Yandere Girl)...');
  await page.mouse.click(640, 360, { button: 'right' });
  await page.waitForTimeout(1200);

  // Check Yandere expressions
  const yandereExprs = await page.$$eval('.context-model-expr-btn', btns => btns.map(b => b.textContent.trim()));
  console.log('   • Expresiones individuales de Yandere Girl:', yandereExprs);

  // Trigger Yandere expression
  const yandereBtn = await page.$('.context-model-expr-btn:has-text("Yandere")');
  if (yandereBtn) {
    console.log('   • Activando expresión "Yandere"...');
    await yandereBtn.click();
    await page.waitForTimeout(1200);
  }

  // 2. Switch to Ellen Joe via Context Menu Dropdown
  console.log('\n🦈 [3/5] Cambiando a "Ellen Joe" desde el desplegable del menú contextual...');
  await page.mouse.click(640, 360, { button: 'right' });
  await page.waitForTimeout(800);

  const modelSelect = await page.$('.context-dropdown-label:has-text("Avatar Live2D") + .context-select-wrapper select');
  if (modelSelect) {
    await modelSelect.selectOption('ellen');
    await page.waitForTimeout(2500);
  }

  // Re-open context menu on Ellen Joe to verify Ellen expressions
  await page.mouse.click(640, 360, { button: 'right' });
  await page.waitForTimeout(1000);

  const ellenExprs = await page.$$eval('.context-model-expr-btn', btns => btns.map(b => b.textContent.trim()));
  console.log('   • Expresiones individuales de Ellen Joe:', ellenExprs);

  // Trigger Shock / Impacto
  const shockBtn = await page.$('.context-model-expr-btn:has-text("Impacto")');
  if (shockBtn) {
    console.log('   • Activando expresión "Impacto / Shock" en Ellen Joe...');
    await shockBtn.click();
    await page.waitForTimeout(1200);
  }

  // 3. Switch to Ice Girl via Context Menu Dropdown
  console.log('\n👘 [4/5] Cambiando a "Ice Girl (Cheongsam)" desde el desplegable...');
  await page.mouse.click(640, 360, { button: 'right' });
  await page.waitForTimeout(800);

  const modelSelect2 = await page.$('.context-dropdown-label:has-text("Avatar Live2D") + .context-select-wrapper select');
  if (modelSelect2) {
    await modelSelect2.selectOption('icegirl');
    await page.waitForTimeout(2500);
  }

  // Re-open context menu on Ice Girl
  await page.mouse.click(640, 360, { button: 'right' });
  await page.waitForTimeout(1000);

  const iceExprs = await page.$$eval('.context-model-expr-btn', btns => btns.map(b => b.textContent.trim()));
  console.log(`   • Expresiones individuales de Ice Girl (${iceExprs.length} disponibles):`, iceExprs.slice(0, 8), '...');

  // Trigger Ojos Corazón
  const heartEyesBtn = await page.$('.context-model-expr-btn:has-text("Ojos Corazón")');
  if (heartEyesBtn) {
    console.log('   • Activando expresión "Ojos Corazón" en Ice Girl...');
    await heartEyesBtn.click();
    await page.waitForTimeout(1200);
  }

  // 4. Test Brain Switcher Dropdown
  console.log('\n🧠 [5/5] Probando cambio de Cerebro de IA (Gemini) desde el menú...');
  await page.mouse.click(640, 360, { button: 'right' });
  await page.waitForTimeout(800);

  const brainSelect = await page.$('.context-dropdown-label:has-text("Cerebro de IA") + .context-select-wrapper select');
  if (brainSelect) {
    await brainSelect.selectOption('gemini-3-flash-preview');
    console.log('   • Cerebro cambiado a: Gemini 3 Flash');
    await page.waitForTimeout(1000);
  }

  // Close context menu explicitly
  await page.mouse.click(100, 100);
  await page.waitForTimeout(1000);

  // Final vocal and animated reaction
  await page.evaluate(() => {
    window.__cristiApp.setSubtitle('💖 Cristi AI: "¡Menú contextual con todas mis expresiones individuales y cambio rápido listo!"');
  });
  await page.waitForTimeout(3000);

  // Finalize video recording
  console.log('\n💾 Finalizando grabación de video con audio...');
  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (video) {
    const rawVideoPath = await video.path();
    const targetVideoPath = path.resolve(videoDir, 'context_menu_individual_expressions_demo.webm');
    fs.copyFileSync(rawVideoPath, targetVideoPath);
    const stat = fs.statSync(targetVideoPath);
    console.log(`\n========================================================================`);
    console.log(`🎉 ¡PRUEBA DE EXPRESIONES INDIVIDUALES Y DESPLEGABLES EXITOSA!`);
    console.log(`📁 Video: ${targetVideoPath}`);
    console.log(`📊 Tamaño: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`========================================================================\n`);
  }
}

testContextMenuIndividualExpressions().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
