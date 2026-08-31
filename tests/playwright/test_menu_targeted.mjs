import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

page.on('console', msg => console.log('[BROWSER LOG]', msg.text()));

await page.goto('http://localhost:5173');
await page.waitForTimeout(3000);

const testResult = await page.evaluate(() => {
  const hasFn = typeof window.__cristiOpenContextMenu === 'function';
  if (hasFn) {
    window.__cristiOpenContextMenu(640, 300);
  }
  return {
    hasFn,
    menuEl: document.querySelector('.custom-context-menu')?.className,
    rootHtml: document.getElementById('root')?.innerHTML.substring(0, 300)
  };
});

console.log('Test Result 1:', testResult);
await page.waitForTimeout(500);

const testResult2 = await page.evaluate(() => {
  const menu = document.querySelector('.custom-context-menu');
  return {
    hasMenu: !!menu,
    menuClass: menu?.className,
    items: Array.from(document.querySelectorAll('.context-menu-item')).map(i => i.innerText.split('\n')[0])
  };
});

console.log('Test Result 2:', testResult2);
await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/context_menu_minimalist_live.png' });

// Now test lock screen
await page.evaluate(() => {
  window.__cristiToggleLockScreen();
});
await page.waitForTimeout(500);

const lockTest = await page.evaluate(() => {
  const overlay = document.querySelector('.lockscreen-overlay-container');
  return {
    hasOverlay: !!overlay,
    time: document.querySelector('.lockscreen-time')?.innerText
  };
});
console.log('Lock Test:', lockTest);
await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/lockscreen_widget_live.png' });

await browser.close();
