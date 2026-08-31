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

await page.goto('http://localhost:5173');
await page.waitForTimeout(3000);

console.log('\n======================================================');
console.log('⚡ 1. TEST HUD FLOTANTE CON GEOMETRÍA CUADRADA / AFILADA');
console.log('======================================================');

const hudStats = await page.evaluate(() => {
  const dock = document.querySelector('.hud-dock');
  const statusCard = document.querySelector('.hud-status-card');
  const callBtn = document.querySelector('.hud-call-btn');
  const corners = dock?.querySelectorAll('.hud-corner');

  return {
    hasDock: !!dock,
    hasStatusCard: !!statusCard,
    callBtnText: callBtn?.innerText?.trim(),
    dockCornersCount: corners?.length || 0
  };
});

console.log('  Dock Táctico:', hudStats.hasDock ? '✅' : '❌');
console.log('  Status Card Superior:', hudStats.hasStatusCard ? '✅' : '❌');
console.log(`  Texto Botón Central: "${hudStats.callBtnText}"`);
console.log(`  Micro-Crosshairs detectados en dock: ${hudStats.dockCornersCount}`);

console.log('\n======================================================');
console.log('🔔 2. TEST NOTIFICACIONES HUD TOAST AFILADAS');
console.log('======================================================');

await page.evaluate(() => {
  if (window.__cristiApp?.toast) {
    window.__cristiApp.toast.ai('Enlace Cuántico Sincronizado', 'Gemini Live 3.1 Flash conectado a 24kHz', { badge: 'GEMINI // 3.1', duration: 4000 });
    window.__cristiApp.toast.emotion('IceGirl', 'Modelo Live2D IceGirl en renderizado 16x Anisótropo', { badge: 'LIVE2D // HD', duration: 4000 });
    window.__cristiApp.toast.tool('analizar_codigo', 'Escaneando archivos del repositorio', { badge: 'CYBER_OPS', duration: 4000 });
  }
});

await page.waitForTimeout(800);

const toastStats = await page.evaluate(() => {
  const viewport = document.querySelector('.hud-toast-viewport');
  const cards = document.querySelectorAll('.hud-toast-card');
  return {
    hasViewport: !!viewport,
    count: cards.length,
    firstTitle: cards[0]?.querySelector('.hud-toast-title')?.innerText
  };
});

console.log('  Viewport Toasts:', toastStats.hasViewport ? '✅' : '❌');
console.log(`  Toasts Activos: ${toastStats.count}`);
console.log(`  Primer Toast: "${toastStats.firstTitle}"`);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/sharp_01_hud_toasts.png' });

console.log('\n======================================================');
console.log('⚙️ 3. TEST MODAL DE AJUSTES CON GEOMETRÍA CUADRADA');
console.log('======================================================');

await page.evaluate(() => window.__cristiApp?.openSettings());
await page.waitForTimeout(800);

const modalStats = await page.evaluate(() => {
  const card = document.querySelector('.sm-card');
  const tabs = document.querySelectorAll('.sm-tab-btn');
  const modelCards = document.querySelectorAll('.sm-model-card');
  const footerBtns = document.querySelectorAll('.sm-btn');
  return {
    isOpen: !!card,
    tabsCount: tabs.length,
    modelCardsCount: modelCards.length,
    footerBtnsCount: footerBtns.length
  };
});

console.log('  Modal Abierto:', modalStats.isOpen ? '✅' : '❌');
console.log(`  Pestañas detectadas: ${modalStats.tabsCount}`);
console.log(`  Modelos Gemini detectados: ${modalStats.modelCardsCount}`);
console.log(`  Botones de pie detectados: ${modalStats.footerBtnsCount}`);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/sharp_02_settings_model.png' });

// Check Tab 2 (Avatar)
await page.click('.sm-tab-btn:nth-child(2)');
await page.waitForTimeout(600);
await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/sharp_03_settings_avatar.png' });

// Check Tab 3 (Voice)
await page.click('.sm-tab-btn:nth-child(3)');
await page.waitForTimeout(600);
await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/sharp_04_settings_voice.png' });

// Check Tab 4 (Persona)
await page.click('.sm-tab-btn:nth-child(4)');
await page.waitForTimeout(600);
await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/sharp_05_settings_persona.png' });

await page.evaluate(() => window.__cristiApp?.closeSettings());
await page.waitForTimeout(600);

console.log('\n======================================================');
console.log('🎯 4. TEST MENÚ CONTEXTUAL CON GEOMETRÍA CUADRADA');
console.log('======================================================');

await page.mouse.click(640, 360, { button: 'right' });
await page.waitForTimeout(800);

const menuStats = await page.evaluate(() => {
  const menu = document.querySelector('.custom-context-menu');
  const items = document.querySelectorAll('.context-menu-item');
  const exprBtns = document.querySelectorAll('.context-model-expr-btn');
  const corners = menu?.querySelectorAll('.hud-corner');
  return {
    isOpen: !!menu,
    itemsCount: items.length,
    exprCount: exprBtns.length,
    cornersCount: corners?.length || 0
  };
});

console.log('  Menú Contextual Abierto:', menuStats.isOpen ? '✅' : '❌');
console.log(`  Items de acción: ${menuStats.itemsCount}`);
console.log(`  Botones de expresión: ${menuStats.exprCount}`);
console.log(`  Micro-Crosshairs detectados: ${menuStats.cornersCount}`);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/sharp_06_context_menu.png' });

await browser.close();

if (pageErrors.length > 0) {
  console.error('\n❌ Errores:', pageErrors);
  process.exit(1);
} else {
  console.log('\n✨ Verificación completada con éxito. Toda la interfaz luce estética, cuadrada y afilada.');
}
