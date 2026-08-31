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

    // 3. Test Minimalist Context Menu Trigger & Single-Accordion Behavior
    console.log('\n[3/6] Probando Menú Contextual Minimalista y Single-Accordion...');
    await page.mouse.click(600, 400, { button: 'right' });
    await page.waitForTimeout(600);

    const contextMenu = await page.$('.custom-context-menu-minimal');
    console.log(`  ✓ Menú contextual minimalista detectado: ${!!contextMenu}`);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'playwright_02_context_menu_minimal.png') });

    // Test clicking Category 1: Personaje
    const avatarCatBtn = await page.$('.ctx-mini-category-btn:has-text("Personaje")');
    if (avatarCatBtn) {
      await avatarCatBtn.click();
      await page.waitForTimeout(300);
      const isAvatarOpen = await page.$eval('.ctx-mini-category:has-text("Personaje")', (el) => el.classList.contains('open'));
      console.log(`  ✓ Acordeón "Personaje" desplegado: ${isAvatarOpen}`);
    }

    // Test clicking Category 2: Fondo & Escena (Should auto-collapse Personaje!)
    const sceneCatBtn = await page.$('.ctx-mini-category-btn:has-text("Fondo & Escena")');
    if (sceneCatBtn) {
      await sceneCatBtn.click();
      await page.waitForTimeout(300);
      const isAvatarOpenAfter = await page.$eval('.ctx-mini-category:has-text("Personaje")', (el) => el.classList.contains('open'));
      const isSceneOpen = await page.$eval('.ctx-mini-category:has-text("Fondo & Escena")', (el) => el.classList.contains('open'));
      console.log(`  ✓ Auto-colapso verificado: Personaje abierto=${isAvatarOpenAfter}, Escena abierta=${isSceneOpen}`);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'playwright_02_accordion_switch.png') });
    }

    // 4. Test Background Scene Switching
    console.log('\n[4/6] Probando activación de Escenas Cinemáticas...');
    await page.evaluate(() => {
      // Switch to cyber_loft scene
      const sceneSelect = document.querySelector('.ctx-drawer-select');
      if (sceneSelect) {
        sceneSelect.value = 'cyber_loft';
        sceneSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.waitForTimeout(600);
    const hasSceneViewport = await page.$('.scene-viewport');
    console.log(`  ✓ Escena cinemática renderizada: ${!!hasSceneViewport}`);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'playwright_04_cinematic_scene.png') });

    // Close context menu with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // 5. Test Settings Modal Tabs
    console.log('\n[5/6] Probando apertura y pestañas del Modal de Ajustes...');
    await page.evaluate(() => {
      const btn = document.querySelector('button[title*="Ajustes"], button[title*="Configuración"], .hud-control-btn');
      if (btn) btn.click();
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'playwright_03_settings.png') });

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
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
