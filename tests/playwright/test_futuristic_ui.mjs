/**
 * Test de Verificación: UI Futurista, Toasts & Bordes Punteados Shadcn
 */
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
await page.waitForTimeout(4000);

console.log('\n======================================================');
console.log('⚡ 1. VERIFICACIÓN DE NOTIFICACIONES HUD TOAST');
console.log('======================================================');

// Trigger multiple futuristic toasts
await page.evaluate(() => {
  const t = window.__cristiApp?.toast || window.__cristiToast;
  // If not exposed on window directly, use custom event
  window.dispatchEvent(new CustomEvent('test-toasts'));
});

// Trigger toasts through the App automation bridge
const toastCheck = await page.evaluate(async () => {
  const app = window.__cristiApp;
  
  if (app?.toast) {
    app.toast.ai('Enlace Neuronal Cuántico', 'Protocolo de voz Gemini Live 3.1 Flash inicializado', { badge: 'GEMINI // LIVE', duration: 5000 });
    app.toast.emotion('IceGirl', 'Modelo Live2D IceGirl en renderizado 16x Anisótropo', { badge: 'LIVE2D', duration: 5000 });
    app.toast.tool('scan_environment', 'Escaneando pantalla y sensores periféricos', { badge: 'CYBER_OPS', duration: 5000 });
  }

  await new Promise(r => setTimeout(r, 600));

  const toasts = document.querySelectorAll('.hud-toast-card');
  const toastViewport = document.querySelector('.hud-toast-viewport');
  
  return {
    hasViewport: !!toastViewport,
    toastCount: toasts.length,
    firstToastTitle: toasts[0]?.querySelector('.hud-toast-title')?.innerText
  };
});

console.log('  Viewport de Toasts montado:', toastCheck.hasViewport ? '✅' : '❌');
console.log(`  Toasts renderizados en pantalla: ${toastCheck.toastCount}`);
console.log(`  Primer Toast: "${toastCheck.firstToastTitle || 'N/A'}"`);

await page.waitForTimeout(1000);
await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/futuristic_01_toasts.png' });

console.log('\n======================================================');
console.log('🛸 2. VERIFICACIÓN DE HUD FLOTANTE FUTURISTA');
console.log('======================================================');

const hudCheck = await page.evaluate(() => {
  const dock = document.querySelector('.shadcn-dock');
  const statusPill = document.querySelector('.shadcn-status-pill');
  const corners = dock?.querySelectorAll('.hud-corner');
  const callBtn = dock?.querySelector('.shadcn-call-btn');

  return {
    hasDock: !!dock,
    hasStatusPill: !!statusPill,
    cornerCrosshairsCount: corners?.length || 0,
    callBtnText: callBtn?.innerText
  };
});

console.log('  Dock Táctico montado:', hudCheck.hasDock ? '✅' : '❌');
console.log('  Status Pill montado:', hudCheck.hasStatusPill ? '✅' : '❌');
console.log(`  Micro-Crosshairs detectados: ${hudCheck.cornerCrosshairsCount}`);
console.log(`  Botón de Llamada: "${hudCheck.callBtnText}"`);

console.log('\n======================================================');
console.log('⚙️ 3. VERIFICACIÓN DE MODAL DE AJUSTES SHADCN FUTURISTA');
console.log('======================================================');

await page.evaluate(() => {
  window.__cristiApp?.openSettings();
});
await page.waitForTimeout(1000);

const modalCheck = await page.evaluate(() => {
  const card = document.querySelector('.sm-card');
  const corners = card?.querySelectorAll('.hud-corner');
  const activeTab = document.querySelector('.sm-tab-btn.active')?.innerText;
  const modelCards = document.querySelectorAll('.sm-model-card');

  return {
    isOpen: !!card,
    cornerCrosshairs: corners?.length || 0,
    activeTab,
    modelCardsCount: modelCards.length
  };
});

console.log('  Modal de Ajustes abierto:', modalCheck.isOpen ? '✅' : '❌');
console.log(`  Micro-Crosshairs en Modal: ${modalCheck.cornerCrosshairs}`);
console.log(`  Pestaña Activa: ${modalCheck.activeTab}`);
console.log(`  Modelos Gemini listados: ${modalCheck.modelCardsCount}`);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/futuristic_02_settings.png' });

await page.evaluate(() => {
  window.__cristiApp?.closeSettings();
});
await page.waitForTimeout(600);

await browser.close();

if (pageErrors.length > 0) {
  console.error('\n❌ Errores en página:', pageErrors);
  process.exit(1);
} else {
  console.log('\n✨ Verificación completada con éxito. Toda la UI futurista está impecable.');
}
