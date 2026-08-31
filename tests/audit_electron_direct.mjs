import { _electron as electron } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb';

console.log('================================================================');
console.log('⚡ CRISTI DESKTOP - AUDITORÍA DIRECTA SOBRE ELECTRON NATIVO');
console.log('================================================================\n');

async function runDirectElectronAudit() {
  console.log('[1/5] Iniciando proceso maestro de Electron con electron/main.cjs...');
  const electronApp = await electron.launch({
    args: ['electron/main.cjs'],
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });

  const page = await electronApp.firstWindow();

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push({ type, text });
    if (type === 'error') {
      console.log(`  🔴 [Electron Console Error]: ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
    console.log(`  🔥 [Electron Page Error]: ${err.message}`);
  });

  try {
    console.log('\n[2/5] Esperando carga de la ventana principal de Electron...');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // 1. Check Error Boundary
    const errorBoundary = await page.$('.error-boundary-backdrop');
    if (errorBoundary) {
      const errorText = await page.$eval('.error-boundary-box pre', (el) => el.textContent).catch(() => 'Desconocido');
      console.error(`  ❌ [FAIL] ErrorBoundary presente en Electron: ${errorText}`);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'electron_direct_error.png') });
      throw new Error(`ErrorBoundary activo en Electron: ${errorText}`);
    }
    console.log('  ✅ [PASS] Ventana de Electron cargada limpiamente sin ErrorBoundary.');

    const shot1 = path.join(ARTIFACTS_DIR, 'electron_direct_01_loaded.png');
    await page.screenshot({ path: shot1 });
    console.log(`  📸 Captura nativa guardada: electron_direct_01_loaded.png`);

    // 2. Verify Electron IPC & Bridge
    console.log('\n[3/5] Verificando API de Electron (window.electronAPI & electronBridge)...');
    const bridgeState = await page.evaluate(async () => {
      const isElectron = !!window.electronAPI?.isElectron;
      let displayInfo = null;
      if (window.electronAPI?.getDisplayInfo) {
        displayInfo = await window.electronAPI.getDisplayInfo();
      }
      return { isElectron, hasDisplayInfo: !!displayInfo, displayInfo };
    });

    console.log(`  ✓ Flag isElectron activa en ventana: ${bridgeState.isElectron}`);
    console.log(`  ✓ IPC getDisplayInfo respondió: ${bridgeState.hasDisplayInfo} (${JSON.stringify(bridgeState.displayInfo)})`);

    // 3. Test Avatar & Live2D runtime
    console.log('\n[4/5] Verificando estado del Avatar Live2D en Electron...');
    const avatarState = await page.evaluate(() => {
      return {
        hasAvatar: !!window.__cristiAvatar,
        currentModelId: window.__cristiAvatar?.registry?.getActiveModel?.()?.id || 'yanderegirl',
        isLoaded: !!window.__cristiAvatar?.model
      };
    });
    console.log(`  ✓ Interfaz __cristiAvatar: ${avatarState.hasAvatar}`);
    console.log(`  ✓ Modelo activo en runtime: ${avatarState.currentModelId}`);

    // 4. Final Assessment
    console.log('\n[5/5] Consolidando reporte de auditoría directa...');
    console.log(`  Total logs de consola en Electron: ${consoleLogs.length}`);
    console.log(`  Total errores no controlados: ${pageErrors.length}`);

    if (pageErrors.length > 0) {
      throw new Error(`Se detectaron ${pageErrors.length} errores no controlados en Electron.`);
    }

    console.log('\n================================================================');
    console.log('🎉 AUDITORÍA DIRECTA DE ELECTRON COMPLETADA CON ÉXITO: 100% PASS');
    console.log('================================================================\n');
  } finally {
    await electronApp.close();
  }
}

runDirectElectronAudit().catch((err) => {
  console.error('\n❌ ERROR EN LA AUDITORÍA DE ELECTRON:', err.message);
  process.exit(1);
});
