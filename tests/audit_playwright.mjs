import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb';
const BRAVE_PATH = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

console.log('================================================================');
console.log('🎭 CRISTI DESKTOP - AUDITORÍA PROFUNDA E2E PLAYWRIGHT (BRAVE)');
console.log('================================================================\n');

async function runAudit() {
  const browser = await chromium.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--use-gl=swiftshader']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push({ type, text });
    if (type === 'error') {
      console.log(`  🔴 [Browser Console Error]: ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
    console.log(`  🔥 [Unhandled Page Error]: ${err.message}`);
  });

  try {
    // 1. Initial Load
    console.log('[1/6] Navegando a http://localhost:5173/ y esperando carga...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2500);

    const errorBoundary = await page.$('.error-boundary-backdrop');
    if (errorBoundary) {
      const errorText = await page.$eval('.error-boundary-box pre', (el) => el.textContent).catch(() => 'Desconocido');
      console.error(`  ❌ [FAIL] ErrorBoundary activo: ${errorText}`);
      throw new Error(`ErrorBoundary activo: ${errorText}`);
    }
    console.log('  ✅ [PASS] Cero interrupciones de ErrorBoundary.');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'playwright_01_loaded.png') });

    // 2. Test Live2D Canvas & HUD Dock
    console.log('\n[2/6] Verificando componentes estructurales (Live2D & Floating HUD)...');
    const live2dRoot = await page.$('.live2d-root');
    console.log(`  ✓ Contenedor Live2D presente: ${!!live2dRoot}`);

    const hudDock = await page.$('.hud-dock');
    console.log(`  ✓ Tactical Floating HUD presente: ${!!hudDock}`);

    // 3. Test Context Menu Trigger
    console.log('\n[3/6] Probando disparo y renderizado del Menú Contextual...');
    await page.mouse.click(600, 400, { button: 'right' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'playwright_02_context_menu.png') });

    // 4. Test Settings Modal via App Event
    console.log('\n[4/6] Probando apertura y pestañas del Modal de Ajustes...');
    await page.evaluate(() => {
      // Disparar apertura de ajustes mediante evento o teclado
      window.dispatchEvent(new CustomEvent('open-settings'));
    });
    await page.waitForTimeout(600);

    // Open via clicking settings button if visible or evaluate
    const settingsOpened = await page.evaluate(() => {
      const btn = document.querySelector('button[title*="Ajustes"], button[title*="Configuración"], .hud-control-btn');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'playwright_03_settings.png') });

    // 5. Test Live2D Model Registry & Switching
    console.log('\n[5/6] Verificando catálogo de avatares en runtime (__cristiAvatar)...');
    const runtimeAvatar = await page.evaluate(() => {
      return {
        hasAvatar: !!window.__cristiAvatar,
        modelLoaded: !!window.__cristiAvatar?.model,
        modelsCount: window.__cristiAvatar?.registry?.getAllModels?.()?.length || 0
      };
    });
    console.log(`  ✓ Interfaz __cristiAvatar activa: ${runtimeAvatar.hasAvatar}`);
    console.log(`  ✓ Total modelos registrados en cliente: ${runtimeAvatar.modelsCount}`);

    // 6. Final Assessment
    console.log('\n[6/6] Consolidando resultados de la auditoría...');
    console.log(`  Total logs de consola: ${consoleLogs.length}`);
    console.log(`  Total errores no controlados: ${pageErrors.length}`);

    if (pageErrors.length > 0) {
      throw new Error(`Se detectaron ${pageErrors.length} errores no controlados.`);
    }

    console.log('\n================================================================');
    console.log('🎉 AUDITORÍA PLAYWRIGHT COMPLETADA CON ÉXITO: 0 ERRORES');
    console.log('================================================================\n');
  } finally {
    await browser.close();
  }
}

runAudit().catch((err) => {
  console.error('\n❌ ERROR EN LA AUDITORÍA PLAYWRIGHT:', err.message);
  process.exit(1);
});
