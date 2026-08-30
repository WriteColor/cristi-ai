import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Ensure screenshots dir
if (!existsSync('tests/screenshots')) await mkdir('tests/screenshots', { recursive: true });
if (!existsSync('tests/videos')) await mkdir('tests/videos', { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
  args: ['--autoplay-policy=no-user-gesture-required']
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: 'tests/videos', size: { width: 1280, height: 720 } }
});
const page = await context.newPage();
page.on('console', m => { if (m.type() === 'error') console.error('[PAGE]', m.text()); });

await page.goto('http://localhost:5173');
await sleep(5000);

// Wait for initial model
await page.waitForFunction(() => window.__cristiAvatar?.model?.internalModel?.coreModel, { timeout: 20000 }).catch(() => {});
await sleep(1000);

await page.screenshot({ path: 'tests/screenshots/final_01_yanderegirl_initial.png' });
console.log('📸 Screenshot 1: Initial state (Yanderegirl)');

// Open context menu
await page.mouse.click(640, 400, { button: 'right' });
await sleep(800);
await page.screenshot({ path: 'tests/screenshots/final_02_context_menu_open.png' });
console.log('📸 Screenshot 2: Context menu open');

// Click Yandere
const yandereBtn = page.locator('button.context-model-expr-btn').filter({ hasText: 'Yandere' });
if (await yandereBtn.count() > 0) {
  await yandereBtn.first().click();
  await sleep(2000);
  await page.screenshot({ path: 'tests/screenshots/final_03_yandere_active.png' });
  console.log('✅ Screenshot 3: Yandere expression active');
} else {
  console.log('❌ Yandere button not found');
}

// Switch to IceGirl
await page.keyboard.press('Escape');
await sleep(400);
await page.mouse.click(640, 400, { button: 'right' });
await sleep(600);
const sel1 = page.locator('select.context-select').first();
await sel1.selectOption('icegirl');
await sleep(200);
await page.keyboard.press('Escape');
await sleep(4500);

await page.waitForFunction(() => window.__cristiAvatar?.model?.internalModel?.coreModel, { timeout: 15000 }).catch(() => {});
await page.screenshot({ path: 'tests/screenshots/final_04_icegirl_loaded.png' });
console.log('📸 Screenshot 4: IceGirl loaded');

await page.mouse.click(640, 400, { button: 'right' });
await sleep(800);
await page.screenshot({ path: 'tests/screenshots/final_05_icegirl_menu.png' });

const icegirlBtns = await page.locator('button.context-model-expr-btn').allTextContents();
console.log(`📋 IceGirl expression buttons count: ${icegirlBtns.length}`);
console.log(`   First 5: ${icegirlBtns.slice(0,5).join(', ')}`);

const heartBtn = page.locator('button.context-model-expr-btn').filter({ hasText: '爱心眼' });
if (await heartBtn.count() > 0) {
  await heartBtn.first().click();
  await sleep(2000);
  await page.screenshot({ path: 'tests/screenshots/final_06_icegirl_hearteyes.png' });
  console.log('✅ Screenshot 6: IceGirl 爱心眼 active');
} else {
  console.log('❌ 爱心眼 button not found. Available:', icegirlBtns.slice(0,10).join(', '));
}

// Switch to Hiyori
await page.keyboard.press('Escape');
await sleep(400);
await page.mouse.click(640, 400, { button: 'right' });
await sleep(600);
const sel2 = page.locator('select.context-select').first();
await sel2.selectOption('hiyori');
await sleep(200);
await page.keyboard.press('Escape');
await sleep(5000);

await page.waitForFunction(() => window.__cristiAvatar?.model?.internalModel?.coreModel, { timeout: 20000 }).catch(() => {});
await page.screenshot({ path: 'tests/screenshots/final_07_hiyori_loaded.png' });
console.log('📸 Screenshot 7: Hiyori loaded');

await page.mouse.click(640, 400, { button: 'right' });
await sleep(800);
await page.screenshot({ path: 'tests/screenshots/final_08_hiyori_menu.png' });

const hiyoriBtns = await page.locator('button.context-model-expr-btn').allTextContents();
console.log(`📋 Hiyori emotion buttons count: ${hiyoriBtns.length}`);
console.log(`   All: ${hiyoriBtns.join(', ')}`);

const happyBtn = page.locator('button.context-model-expr-btn').filter({ hasText: 'Feliz' });
if (await happyBtn.count() > 0) {
  await happyBtn.first().click();
  await sleep(3000);
  await page.screenshot({ path: 'tests/screenshots/final_09_hiyori_happy.png' });
  console.log('✅ Screenshot 9: Hiyori Feliz (happy) active');
} else {
  console.log('❌ Feliz button not found. Available:', hiyoriBtns.join(', '));
}

// Switch to Ruan Mei
await page.keyboard.press('Escape');
await sleep(400);
await page.mouse.click(640, 400, { button: 'right' });
await sleep(600);
const sel3 = page.locator('select.context-select').first();
await sel3.selectOption('ruan_mei');
await sleep(200);
await page.keyboard.press('Escape');
await sleep(4500);

await page.screenshot({ path: 'tests/screenshots/final_10_ruan_mei_loaded.png' });
console.log('📸 Screenshot 10: Ruan Mei loaded');

await page.mouse.click(640, 400, { button: 'right' });
await sleep(800);
const ruanMeiBtns = await page.locator('button.context-model-expr-btn').allTextContents();
console.log(`📋 Ruan Mei emotion buttons: ${ruanMeiBtns.join(', ')}`);
await page.screenshot({ path: 'tests/screenshots/final_11_ruan_mei_menu.png' });

await sleep(2000);
await context.close();
await browser.close();
console.log('\n✅ Final visual audit complete!');
