/**
 * Cristi AI - Context Menu Exclusivity & Smart Edge Responsiveness Test
 * Validates:
 * 1. Right-clicking empty backdrop does NOT open context menu.
 * 2. Right-clicking on the Live2D avatar opens context menu.
 * 3. Positioning near the right edge flips the menu to the left side (`placement-left`).
 * 4. Captures screenshots in Brave browser.
 */

import { chromium } from 'playwright';
import path from 'path';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Test fallido: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function run() {
  console.log('================================================================');
  console.log('🔍 PROBANDO EXCLUSIVIDAD Y RESPONSIVIDAD DEL MENÚ CONTEXTUAL');
  console.log('================================================================\n');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    headless: false,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--disable-extensions']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  // 1. Right-click on empty background (Top-Left corner: 80, 80)
  console.log('--- 1. Probando click derecho sobre fondo vacío (80, 80) ---');
  await page.mouse.click(80, 80, { button: 'right' });
  await page.waitForTimeout(500);

  const menuOnEmpty = await page.locator('.custom-context-menu').count();
  assert(menuOnEmpty === 0, 'El menú contextual NO se abre en fondo vacío o fuera del modelo');

  // 2. Right-click directly on Live2D model (Center of screen: 640, 400)
  console.log('\n--- 2. Probando click derecho sobre el modelo Live2D (640, 400) ---');
  await page.mouse.click(640, 400, { button: 'right' });
  await page.waitForTimeout(600);

  const menuOnModel = await page.locator('.custom-context-menu').count();
  assert(menuOnModel === 1, 'El menú contextual se abre correctamente al hacer click derecho sobre el modelo');

  // Screenshot default right placement
  const screenshotDefault = path.resolve('tests/screenshots/context_menu_default_right.png');
  await page.screenshot({ path: screenshotDefault });
  console.log(`📸 Captura de apertura por defecto (derecha): ${screenshotDefault}`);

  // Close context menu by pressing Escape or clicking outside
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // 3. Test Edge-Aware Responsiveness: Right-click near the right edge of model (e.g. 1150, 400)
  console.log('\n--- 3. Probando detección de borde derecho y volteo a la izquierda ---');
  // Drag avatar towards right side
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(1050, 400, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(600);

  // Right-click on avatar near right screen edge
  await page.mouse.click(1050, 400, { button: 'right' });
  await page.waitForTimeout(600);

  const menuNearEdge = page.locator('.custom-context-menu');
  assert(await menuNearEdge.count() === 1, 'Menú contextual abierto cerca del borde');

  const boundingBox = await menuNearEdge.boundingBox();
  console.log(`📐 Posición del menú: x=${boundingBox.x}, y=${boundingBox.y}, width=${boundingBox.width}, height=${boundingBox.height}`);

  assert(boundingBox.x + boundingBox.width <= 1280, 'El menú contextual NO se desborda de la pantalla por la derecha');
  assert(boundingBox.x < 1050, 'El menú se posicionó en el lado IZQUIERDO del punto de click/modelo por detección de borde');

  // Screenshot left-flipped placement
  const screenshotEdge = path.resolve('tests/screenshots/context_menu_edge_flipped_left.png');
  await page.screenshot({ path: screenshotEdge });
  console.log(`📸 Captura de volteo a la izquierda por borde: ${screenshotEdge}`);

  await browser.close();

  console.log('\n================================================================');
  console.log('🎉 TODAS LAS PRUEBAS DE MENÚ CONTEXTUAL APROBADAS EXITOSAMENTE');
  console.log('================================================================\n');
}

run().catch(err => {
  console.error('Error en pruebas:', err);
  process.exit(1);
});
