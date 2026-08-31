import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

await page.goto('http://localhost:5173');
await page.waitForTimeout(3000);

await page.evaluate(() => window.__cristiApp?.openSettings());
await page.waitForTimeout(600);

// Click Tab 2 (Avatar Live2D)
await page.click('.sm-tab-btn:nth-child(2)');
await page.waitForTimeout(600);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/futuristic_03_avatars.png' });

// Click Tab 3 (Voz de Cristi)
await page.click('.sm-tab-btn:nth-child(3)');
await page.waitForTimeout(600);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/futuristic_04_voices.png' });

await browser.close();
console.log('TABS VERIFIED!');
