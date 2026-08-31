import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

let logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => console.error('PAGE_ERR:', err));

await page.goto('http://localhost:5173');
await page.waitForTimeout(3000);

// Check error text if any
const errorText = await page.evaluate(() => {
  const errEl = document.querySelector('h2, .error, pre, code, div[style*="rgba(0, 0, 0, 0.5)"]');
  return {
    heading: document.querySelector('h2')?.innerText,
    errorMsg: document.querySelector('div[style*="monospace"]')?.innerText,
    bodyText: document.body.innerText
  };
});
console.log('DIAGNOSTIC ERROR:', JSON.stringify(errorText, null, 2));

// Trigger toasts
await page.evaluate(() => {
  if (window.__cristiApp?.toast) {
    window.__cristiApp.toast.ai('Enlace Neuronal Activo', 'Gemini Live 3.1 Flash sincronizado a 24kHz');
    window.__cristiApp.toast.emotion('IceGirl', 'Modelo Live2D IceGirl cargado en resolución nativa');
    window.__cristiApp.toast.tool('analizar_codigo', 'Escaneando archivos del proyecto');
  }
});

await page.waitForTimeout(1500);

const toastCount = await page.evaluate(() => document.querySelectorAll('.hud-toast-card').length);
console.log('TOASTS RENDERED:', toastCount);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/futuristic_toasts_live.png' });

// Open settings
await page.evaluate(() => window.__cristiApp?.openSettings());
await page.waitForTimeout(1000);

const isModalOpen = await page.evaluate(() => !!document.querySelector('.sm-card'));
console.log('MODAL OPEN:', isModalOpen);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/futuristic_settings_live.png' });

// Close settings
await page.evaluate(() => window.__cristiApp?.closeSettings());
await page.waitForTimeout(600);

await browser.close();
console.log('DONE!');
