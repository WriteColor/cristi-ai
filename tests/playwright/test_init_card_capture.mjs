import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

await page.goto('http://localhost:5173');
await page.waitForTimeout(2000);

// Switch model via select in context menu
await page.mouse.click(640, 360, { button: 'right' });
await page.waitForTimeout(500);

// Select icegirl
await page.selectOption('.context-select', 'icegirl');
await page.waitForTimeout(100);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/widgets_07_init_card_live.png' });

await browser.close();
console.log('LIVE INIT CARD CAPTURED!');
