import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

let pageErrors = [];
page.on('pageerror', (err) => {
  console.error('❌ Page Error:', err.message);
  pageErrors.push(err.message);
});

// Navigate and immediately take screenshot to test loading screen
await page.goto('http://localhost:5173');
await page.waitForTimeout(300);

console.log('\n======================================================');
console.log('⚡ 1. TEST INITIALIZATION OVERLAY ("Invocando a Cristi")');
console.log('======================================================');

const initStats = await page.evaluate(() => {
  const overlay = document.querySelector('.live2d-init-overlay');
  const card = document.querySelector('.live2d-init-card');
  const title = card?.querySelector('.live2d-init-title')?.innerText;
  return {
    hasOverlay: !!overlay,
    hasCard: !!card,
    title: title || ''
  };
});

console.log('  Init Overlay:', initStats.hasOverlay ? '✅' : 'ℹ️ (Model loaded fast)');
console.log(`  Título detectado: "${initStats.title}"`);

await page.waitForTimeout(3500); // Wait for full Live2D load

console.log('\n======================================================');
console.log('🕒 2. TEST DESKTOP CYBER WIDGETS (RELOJ & RECORDATORIOS)');
console.log('======================================================');

const widgetStats = await page.evaluate(() => {
  const widget = document.querySelector('.desktop-widget-container');
  const clock = widget?.querySelector('.widget-clock-digital')?.innerText;
  const reminders = widget?.querySelectorAll('.widget-reminder-item');
  return {
    hasWidget: !!widget,
    clockTime: clock || '',
    remindersCount: reminders?.length || 0
  };
});

console.log('  Widget Montado:', widgetStats.hasWidget ? '✅' : '❌');
console.log(`  Hora Digital: ${widgetStats.clockTime}`);
console.log(`  Recordatorios Iniciales: ${widgetStats.remindersCount}`);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/widgets_01_live.png' });

console.log('\n======================================================');
console.log('🎙️ 3. TEST CATÁLOGO DE 30 VOCES EN AJUSTES Y MENÚ');
console.log('======================================================');

await page.evaluate(() => window.__cristiApp?.openSettings());
await page.waitForTimeout(800);

// Switch to Voice tab
await page.click('.sm-tab-btn:nth-child(3)');
await page.waitForTimeout(600);

const voiceTabStats = await page.evaluate(() => {
  const voiceCards = document.querySelectorAll('.sm-voice-card');
  const titleDesc = document.querySelector('.sm-section-desc')?.innerText;
  const tabDesc = document.querySelectorAll('.sm-tab-desc')[2]?.innerText;
  return {
    voiceCardsCount: voiceCards.length,
    titleDesc,
    tabDesc
  };
});

console.log(`  Tarjetas de voces renderizadas: ${voiceTabStats.voiceCardsCount}`);
console.log(`  Descripción de pestaña: "${voiceTabStats.tabDesc}"`);
console.log(`  Descripción de cabecera: "${voiceTabStats.titleDesc}"`);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/widgets_02_voices_tab.png' });

await page.evaluate(() => window.__cristiApp?.closeSettings());
await page.waitForTimeout(600);

console.log('\n======================================================');
console.log('🎯 4. TEST MENÚ CONTEXTUAL CON TOGGLE DE WIDGETS & 30 VOCES');
console.log('======================================================');

await page.mouse.click(640, 360, { button: 'right' });
await page.waitForTimeout(800);

const menuStats = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.context-menu-item'));
  const settingsItem = items.find(el => el.innerText.includes('Ajustes'));
  const widgetsItem = items.find(el => el.innerText.includes('Widgets'));
  return {
    settingsHint: settingsItem?.querySelector('.context-item-hint')?.innerText,
    widgetsTitle: widgetsItem?.querySelector('.context-item-info span')?.innerText
  };
});

console.log(`  Hint de Ajustes en Menú: "${menuStats.settingsHint}"`);
console.log(`  Opción de Widgets en Menú: "${menuStats.widgetsTitle}"`);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/widgets_03_context_menu.png' });

await browser.close();

if (pageErrors.length > 0) {
  console.error('\n❌ Errores:', pageErrors);
  process.exit(1);
} else {
  console.log('\n✨ Verificación completada con éxito.');
}
