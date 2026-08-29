import { chromium } from 'playwright';
import path from 'path';

async function auditModalDesign() {
  console.log('--- STARTING PLAYWRIGHT MODAL DESIGN AUDIT ---');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    headless: false,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--disable-extensions']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log(`[CONSOLE ERROR]: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(err.message);
    console.log(`[PAGE ERROR]: ${err.message}`);
  });

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  // 1. Move mouse to trigger HUD and open Settings
  await page.mouse.move(640, 750);
  await page.waitForTimeout(600);

  const settingsBtn = page.locator('button[title*="Ajustes"]');
  await settingsBtn.click();
  await page.waitForTimeout(800);

  // Screenshot Tab 1: Model & API
  await page.screenshot({ path: path.resolve('tests/screenshots/modal_tab1_model_api.png') });
  console.log('Saved tests/screenshots/modal_tab1_model_api.png');

  // Screenshot Tab 2: Voices
  const voiceTabBtn = page.locator('.sm-tab-btn:has-text("Voz de Cristi")');
  await voiceTabBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.resolve('tests/screenshots/modal_tab2_voices.png') });
  console.log('Saved tests/screenshots/modal_tab2_voices.png');

  // Screenshot Tab 3: Personality
  const personaTabBtn = page.locator('.sm-tab-btn:has-text("Personalidad")');
  await personaTabBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.resolve('tests/screenshots/modal_tab3_personality.png') });
  console.log('Saved tests/screenshots/modal_tab3_personality.png');

  await browser.close();
  console.log('--- MODAL DESIGN AUDIT FINISHED ---');
  console.log('Total unhandled errors:', errors.length);
}

auditModalDesign().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
