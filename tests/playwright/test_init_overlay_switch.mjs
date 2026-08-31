import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

await page.goto('http://localhost:5173');
await page.waitForTimeout(3000);

// Open Settings and switch avatar to trigger loading card
await page.evaluate(() => window.__cristiApp?.openSettings());
await page.waitForTimeout(500);

// Switch to Avatar tab
await page.click('.sm-tab-btn:nth-child(2)');
await page.waitForTimeout(500);

// Click on Ruan Mei model card (card 6)
await page.evaluate(() => {
  const cards = document.querySelectorAll('.sm-avatar-card');
  if (cards.length > 5) cards[5].click(); // Ruan Mei
});

await page.evaluate(() => window.__cristiApp?.closeSettings());
await page.waitForTimeout(100);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/widgets_06_loading_overlay.png' });

await browser.close();
console.log('LOADING OVERLAY SCREENSHOT CAPTURED!');
