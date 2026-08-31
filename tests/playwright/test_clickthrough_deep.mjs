import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  headless: false,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

let consoleLogs = [];
page.on('console', msg => consoleLogs.push(msg.text()));
page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173');
await page.waitForTimeout(3000);

const domCheck = await page.evaluate(() => {
  const root = document.getElementById('root');
  const appContainer = root.firstElementChild;
  const live2d = document.querySelector('.live2d-canvas');
  const dock = document.querySelector('.hud-dock');
  const widgets = document.querySelector('.desktop-widget-container');

  return {
    rootChildTag: appContainer?.tagName,
    rootChildClass: appContainer?.className,
    hasLive2D: !!live2d,
    hasDock: !!dock,
    hasWidgets: !!widgets,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight
  };
});

console.log('DOM Check:', domCheck);

// Open context menu via right click on live2d canvas
const canvasBox = await page.locator('.live2d-canvas-container').boundingBox();
console.log('Canvas Box:', canvasBox);

await page.mouse.click(640, 360, { button: 'right' });
await page.waitForTimeout(1000);

const menuItems = await page.evaluate(() => {
  const menu = document.querySelector('.context-menu-container');
  const items = Array.from(document.querySelectorAll('.context-menu-item'));
  return {
    hasMenu: !!menu,
    itemCount: items.length,
    itemsText: items.map(el => el.innerText.split('\n')[0])
  };
});

console.log('Menu Items:', menuItems);

// Check helper hitboxes count
const helperRes = await fetch('http://127.0.0.1:38888/status');
const helperJson = await helperRes.json();
console.log('Helper Native Status:', helperJson);

await page.screenshot({ path: 'C:/Users/jerem/.gemini/antigravity-ide/brain/428cbd8d-9fd9-4bb5-b96a-e16db84be0cb/clickthrough_03_deep.png' });

await browser.close();
console.log('DEEP TEST FINISHED!');
