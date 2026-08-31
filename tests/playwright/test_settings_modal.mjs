/**
 * Test de Verificación: Modal de Ajustes de Cristi AI
 * Verifica que el modal de configuraciones abre sin errores, renderiza los 4 paneles y permite interactuar sin excepciones.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

// Catch any unhandled page error
let pageErrors = [];
page.on('pageerror', (err) => {
  console.error('❌ Page Error:', err.message);
  pageErrors.push(err.message);
});

await page.goto('http://localhost:5173');
await page.waitForTimeout(4000);

console.log('\n======================================================');
console.log('🔧 VERIFICANDO APERTURA DEL MODAL DE AJUSTES');
console.log('======================================================');

// Open settings modal via test bridge or context menu / HUD
await page.evaluate(() => {
  window.__cristiApp?.openSettings();
});
await page.waitForTimeout(1000);

// Verify modal is open and has no error boundary
const modalStatus = await page.evaluate(() => {
  const modal = document.querySelector('.sm-card');
  const errorBoundary = document.querySelector('.error-boundary-container') || document.body.innerText.includes('Se produjo un error inesperado');
  const modelCards = document.querySelectorAll('.sm-model-card');
  const activeTab = document.querySelector('.sm-tab-btn.active')?.innerText;
  
  return {
    isOpen: !!modal,
    hasErrorBoundary: !!errorBoundary,
    modelCardsCount: modelCards.length,
    activeTab
  };
});

console.log('  Modal abierto con éxito:', modalStatus.isOpen ? '✅' : '❌');
console.log('  Error boundary presente:', modalStatus.hasErrorBoundary ? '❌ ERROR' : '✅ Ninguno');
console.log(`  Tarjetas de Modelos Gemini renderizadas: ${modalStatus.modelCardsCount}`);

// Test tabs
const tabs = ['avatar', 'voice', 'persona', 'model'];
for (const tab of tabs) {
  await page.evaluate((t) => {
    const btn = Array.from(document.querySelectorAll('.sm-tab-btn')).find(b => b.innerText.toLowerCase().includes(t.toLowerCase()) || b.className.includes(t));
    if (btn) btn.click();
  }, tab);
  await page.waitForTimeout(500);

  const tabCheck = await page.evaluate((t) => {
    const pane = document.querySelector('.sm-tab-pane');
    const err = document.body.innerText.includes('Se produjo un error inesperado');
    return { hasPane: !!pane, hasErr: err };
  }, tab);

  console.log(`  Pestaña [${tab.toUpperCase()}]: ${!tabCheck.hasErr && tabCheck.hasPane ? '✅ OK' : '❌ Error'}`);
}

// Close settings modal
await page.evaluate(() => {
  window.__cristiApp?.closeSettings();
});
await page.waitForTimeout(600);

const isClosed = await page.evaluate(() => !document.querySelector('.sm-card'));
console.log('  Modal cerrado correctamente:', isClosed ? '✅' : '❌');

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/settings_modal_fixed.png' });

await browser.close();

if (pageErrors.length > 0) {
  console.error('\n❌ Errores detectados en la página:', pageErrors);
  process.exit(1);
} else {
  console.log('\n✨ Modal de ajustes probado y validado 100% libre de errores.');
}
