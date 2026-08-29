import { chromium } from 'playwright';
import path from 'path';

async function runAudit() {
  console.log('--- STARTING PLAYWRIGHT AUDIT IN BRAVE ---');
  
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    headless: false,
    args: ['--enable-webgl', '--ignore-gpu-blocklist']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleLogs.push({ type, text });
    console.log(`[BROWSER CONSOLE ${type.toUpperCase()}]: ${text}`);
  });

  page.on('pageerror', err => {
    console.log(`[PAGE ERROR]: ${err.message}\n${err.stack}`);
  });

  page.on('requestfailed', req => {
    console.log(`[REQUEST FAILED]: ${req.url()} - ${req.failure()?.errorText}`);
  });

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 }).catch(err => {
    console.log('Goto notice:', err.message);
  });

  console.log('Waiting 5 seconds to observe model rendering and potential black screen...');
  await page.waitForTimeout(5000);

  const screenshotPath = path.resolve('scratch_screenshot.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot saved to ${screenshotPath}`);

  // Inspect DOM state
  const live2dRootHtml = await page.$eval('.live2d-root', el => el.outerHTML).catch(e => e.message);
  console.log('Live2D Root HTML:', live2dRootHtml);

  const bodyBg = await page.$eval('body', el => window.getComputedStyle(el).backgroundColor).catch(e => e.message);
  console.log('Body Computed Background:', bodyBg);

  const appContainerBg = await page.$eval('.app-container', el => window.getComputedStyle(el).background).catch(e => e.message);
  console.log('AppContainer Computed Background:', appContainerBg);

  await browser.close();
  console.log('--- AUDIT FINISHED ---');
}

runAudit().catch(err => {
  console.error('Audit script failed:', err);
  process.exit(1);
});
