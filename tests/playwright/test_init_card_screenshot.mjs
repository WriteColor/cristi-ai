import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

// Slow down network or take screenshot immediately
await page.goto('http://localhost:5173');
await page.waitForTimeout(50);
await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/widgets_05_init_card.png' });

await browser.close();
console.log('INIT CARD SCREENSHOT CAPTURED!');
