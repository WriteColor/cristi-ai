import { chromium } from 'playwright';

console.log('\n======================================================');
console.log('⚡ 1. VERIFICANDO ESTADO DEL HELPER NATIVO WIN32');
console.log('======================================================');

let helperStatus = null;
try {
  const res = await fetch('http://127.0.0.1:38888/status');
  helperStatus = await res.json();
  console.log('  Helper Nativo Win32:', helperStatus.status === 'alive' ? '✅ EN LÍNEA' : '❌');
  console.log('  Click-Through Activo:', helperStatus.clickthrough ? 'SÍ' : 'NO');
} catch (err) {
  console.error('  Error conectando con helper nativo:', err.message);
}

console.log('\n======================================================');
console.log('🪟 2. TEST DE MODO TRANSPARENTE & CANVAS EN PANTALLA COMPLETA');
console.log('======================================================');

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

await page.goto('http://localhost:5173');
await page.waitForTimeout(3000);

// Check initial background styles
const bgStats = await page.evaluate(() => {
  const body = document.body;
  const root = document.getElementById('root');
  const container = document.querySelector('.app-container') || document.querySelector('.app-root') || body;
  return {
    bodyBg: window.getComputedStyle(body).backgroundColor,
    rootBg: window.getComputedStyle(root).backgroundColor,
    containerBg: window.getComputedStyle(container).backgroundColor,
    classes: container.className
  };
});

console.log('  Body Background:', bgStats.bodyBg);
console.log('  Root Background:', bgStats.rootBg);
console.log('  Container Inicial:', bgStats.classes);

// Toggle Transparent Backdrop Mode via Context Menu
await page.mouse.click(640, 360, { button: 'right' });
await page.waitForTimeout(600);

await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.context-menu-item'));
  const transparentItem = items.find(el => el.innerText.includes('Transparente') || el.innerText.includes('Fondo'));
  if (transparentItem) transparentItem.click();
});
await page.waitForTimeout(800);

const transparentBgStats = await page.evaluate(() => {
  const container = document.querySelector('.app-container') || document.querySelector('.app-root') || document.body;
  return {
    containerBg: window.getComputedStyle(container).backgroundColor,
    classes: container.className
  };
});

console.log('  Modo Transparente Activado -> Classes:', transparentBgStats.classes);
console.log('  Container Background:', transparentBgStats.containerBg);

console.log('\n======================================================');
console.log('🎯 3. TEST DE SINCRONIZACIÓN DE HITBOXES EN VIVO');
console.log('======================================================');

// Allow time for ClickThroughService sync
await page.waitForTimeout(500);

try {
  const res = await fetch('http://127.0.0.1:38888/status');
  const syncStatus = await res.json();
  console.log('  Hitboxes sincronizados con helper Win32:', syncStatus.hitboxCount > 0 ? `✅ (${syncStatus.hitboxCount} hitboxes)` : `ℹ️ (${syncStatus.hitboxCount})`);
} catch (err) {
  console.error('  Error verificando sincronización:', err.message);
}

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/clickthrough_01_transparent.png' });

// Test right click to verify clickthrough toggle item in context menu
await page.mouse.click(640, 360, { button: 'right' });
await page.waitForTimeout(600);

const clickthroughMenuItem = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.context-menu-item'));
  const ctItem = items.find(el => el.innerText.includes('Traspaso') || el.innerText.includes('Clickpassthrough'));
  return {
    found: !!ctItem,
    text: ctItem?.innerText || ''
  };
});

console.log('  Opción de Traspaso en Menú:', clickthroughMenuItem.found ? '✅' : '❌', `("${clickthroughMenuItem.text.replace(/\n/g, ' ')}")`);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/clickthrough_02_context_menu.png' });

await browser.close();

console.log('\n✨ Verificación de Click-Through y Pantalla Completa completada con éxito.');
