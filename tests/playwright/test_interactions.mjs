import { chromium } from 'playwright';
import path from 'path';

async function testInteractions() {
  console.log('--- STARTING COMPREHENSIVE INTERACTION TEST ---');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    headless: false,
    args: ['--enable-webgl', '--ignore-gpu-blocklist']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log(`[ERROR CONSOLE]: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(err.message);
    console.log(`[PAGE CRASH]: ${err.message}`);
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);

  // 1. Hover/move mouse to show HUD
  await page.mouse.move(640, 400);
  await page.mouse.move(640, 750);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.resolve('test_01_hud_visible.png') });
  console.log('Test 1: HUD visible screenshot saved.');

  // 2. Open Settings Modal
  const settingsBtn = page.locator('button[title*="Ajustes"]');
  await settingsBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.resolve('test_02_settings_model_tab.png') });
  console.log('Test 2: Settings Model Tab screenshot saved.');

  // 3. Switch to Voice tab
  const voiceTabBtn = page.locator('button:has-text("Voz de Cristi")');
  await voiceTabBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.resolve('test_03_settings_voice_tab.png') });
  console.log('Test 3: Settings Voice Tab screenshot saved.');

  // 4. Switch to Persona tab
  const personaTabBtn = page.locator('button:has-text("Personalidad")');
  await personaTabBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.resolve('test_04_settings_persona_tab.png') });
  console.log('Test 4: Settings Persona Tab screenshot saved.');

  // 5. Close settings
  const closeBtn = page.locator('.shadcn-modal-top-strip .shadcn-close-btn');
  await closeBtn.click();
  await page.waitForTimeout(600);

  // 6. Test Drag on Model (from center 640, 350 to right 850, 350)
  await page.mouse.move(640, 350);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(850, 320, { steps: 15 });
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.resolve('test_05_after_drag.png') });
  console.log('Test 5: After Drag screenshot saved.');

  // 7. Test Right-Click Context Menu on Model
  await page.mouse.click(850, 320, { button: 'right' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.resolve('test_06_context_menu.png') });
  console.log('Test 6: Context Menu screenshot saved.');

  await browser.close();
  console.log('--- ALL TESTS COMPLETED ---');
  console.log('Total unhandled errors:', errors.length);
}

testInteractions().catch(err => {
  console.error('Test script failed:', err);
  process.exit(1);
});
