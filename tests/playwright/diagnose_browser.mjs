import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.text()));
page.on('pageerror', err => console.error('[PAGE ERROR]', err.message));

await page.goto('http://localhost:5173');
await page.waitForTimeout(4000);

const rootContent = await page.evaluate(() => {
  const root = document.getElementById('root');
  return {
    childrenCount: root?.children.length,
    html: root?.innerHTML.substring(0, 300)
  };
});

console.log('Root Content:', rootContent);
await browser.close();
