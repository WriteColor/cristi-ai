import { chromium } from 'playwright';
import path from 'path';

async function testGazeAndDrag() {
  console.log('--- STARTING GAZE & DRAG PRECISION AUDIT ---');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    headless: false,
    args: ['--enable-webgl', '--ignore-gpu-blocklist']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log(`[ERROR CONSOLE]: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(err.message);
    console.log(`[PAGE ERROR]: ${err.message}`);
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);

  // 1. Test Gaze: Mouse BELOW her face (at bottom dock)
  console.log('Testing Gaze Down (Mouse at bottom)...');
  await page.mouse.move(640, 720);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.resolve('test_gaze_down.png') });

  // 2. Test Gaze: Mouse ABOVE her face (at top bar)
  console.log('Testing Gaze Up (Mouse at top)...');
  await page.mouse.move(640, 60);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.resolve('test_gaze_up.png') });

  // 3. Test Gaze: Mouse to the RIGHT of her face
  console.log('Testing Gaze Right...');
  await page.mouse.move(1100, 300);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.resolve('test_gaze_right.png') });

  // 4. Test Drag from (640, 250) to (350, 180)
  console.log('Testing Drag & Drop retention...');
  await page.mouse.move(640, 250);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(350, 180, { steps: 20 });
  await page.mouse.up({ button: 'left' });
  
  // Wait 3.5 seconds to confirm she STAYS at (350, 180) without bouncing or auto-repositioning!
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.resolve('test_drag_retained.png') });
  console.log('Saved test_drag_retained.png (Position must stay at dropped location).');

  // 5. Test Click on model (triggers random gesture) -> confirm NO repositioning
  console.log('Testing Click Interaction (Gesture in-place)...');
  await page.mouse.click(350, 180);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.resolve('test_click_gesture_in_place.png') });
  console.log('Saved test_click_gesture_in_place.png.');

  await browser.close();
  console.log('--- AUDIT COMPLETE ---');
  console.log('Total unhandled errors:', errors.length);
}

testGazeAndDrag().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
