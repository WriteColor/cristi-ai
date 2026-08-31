import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

await page.goto('http://localhost:5173');
await page.waitForTimeout(3000);

// Open context menu via exposed trigger or right click
await page.evaluate(() => {
  if (window.__cristiOpenContextMenu) {
    window.__cristiOpenContextMenu(640, 300);
  }
});

await page.waitForTimeout(800);

const menuStats = await page.evaluate(() => {
  const menu = document.querySelector('.custom-context-menu');
  const items = Array.from(document.querySelectorAll('.context-menu-item'));
  return {
    isOpen: !!menu,
    width: menu ? window.getComputedStyle(menu).width : null,
    maxHeight: menu ? window.getComputedStyle(menu).maxHeight : null,
    overflowY: menu ? window.getComputedStyle(menu).overflowY : null,
    itemCount: items.length,
    itemsText: items.map(i => i.innerText.split('\n')[0])
  };
});

console.log('Menú Contextual Minimalista:', menuStats);
await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/context_menu_minimalist_live.png' });

// Click on Lock Screen Mode
await page.evaluate(() => {
  if (window.__cristiToggleLockScreen) {
    window.__cristiToggleLockScreen();
  }
});

await page.waitForTimeout(800);

const lockWidgetStats = await page.evaluate(() => {
  const overlay = document.querySelector('.lockscreen-overlay-container');
  const clock = document.querySelector('.lockscreen-time')?.innerText;
  const presence = document.querySelector('.lockscreen-presence-text')?.innerText;
  return {
    isOpen: !!overlay,
    clock,
    presence
  };
});

console.log('Lock Screen Widget:', lockWidgetStats);
await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/lockscreen_widget_live.png' });

await browser.close();
