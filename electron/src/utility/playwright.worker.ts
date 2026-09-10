import fs from 'node:fs';
import { validateRequest } from '../../../shared/ipc/contracts';
import type { PlaywrightExecuteParams } from '../types/electron.types';
const BRAVE_EXE_CANDIDATES = [
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\chrome_proxy.exe',
];

function getBraveExecutablePath(): string | null {
  for (const candidate of BRAVE_EXE_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

let playwrightBrowser: any = null;
let playwrightContext: any = null;
let playwrightPage: any = null;

async function getOrCreatePlaywrightPage(options: PlaywrightExecuteParams = {}): Promise<any> {
   
  const { chromium } = require('playwright');
  if (!playwrightBrowser || !playwrightBrowser.isConnected()) {
    const bravePath = getBraveExecutablePath();
    if (!bravePath) {
      throw new Error('Brave.exe no está instalado en una ruta compatible; se rechazó usar otro navegador.');
    }
    const launchOptions = {
      executablePath: bravePath,
      headless: options.headless !== undefined ? Boolean(options.headless) : false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--no-default-browser-check',
        '--disable-infobars',
      ],
    };
    playwrightBrowser = await chromium.launch(launchOptions);
    playwrightContext = await playwrightBrowser.newContext({ viewport: null });
    playwrightPage = await playwrightContext.newPage();
  } else if (!playwrightPage || playwrightPage.isClosed()) {
    playwrightPage = await playwrightContext.newPage();
  }
  return playwrightPage;
}


async function execute(action: string, params: PlaywrightExecuteParams = {}) {
    try {
      switch (action) {
        case 'launch':
        case 'navigate': {
          const page = await getOrCreatePlaywrightPage(params);
          if (params.url) {
            await page.goto(params.url, { timeout: 30000, waitUntil: params.waitUntil || 'domcontentloaded' });
          }
          return {
            success: true,
            url: page.url(),
            title: await page.title().catch(() => ''),
          };
        }
        case 'click': {
          const page = await getOrCreatePlaywrightPage();
          await page.click(params.selector, { timeout: params.timeout || 10000 });
          return { success: true, message: `Clic ejecutado en selector "${params.selector}".` };
        }
        case 'fill': {
          const page = await getOrCreatePlaywrightPage();
          await page.fill(params.selector, String(params.value ?? ''), { timeout: params.timeout || 10000 });
          return { success: true, message: `Campo "${params.selector}" completado.` };
        }
        case 'type': {
          const page = await getOrCreatePlaywrightPage();
          await page.type(params.selector, String(params.text ?? ''), { delay: params.delay || 30 });
          return { success: true, message: `Texto tecleado en "${params.selector}".` };
        }
        case 'press': {
          const page = await getOrCreatePlaywrightPage();
          await page.press(params.selector || 'body', params.key);
          return { success: true, message: `Tecla "${params.key}" pulsada.` };
        }
        case 'screenshot': {
          const page = await getOrCreatePlaywrightPage();
          const buffer = await page.screenshot({ fullPage: Boolean(params.fullPage) });
          return {
            success: true,
            base64: `data:image/png;base64,${buffer.toString('base64')}`,
            size: buffer.length,
          };
        }
        case 'get_content': {
          const page = await getOrCreatePlaywrightPage();
          let content = '';
          if (params.selector) {
            content = await page.locator(params.selector).innerText({ timeout: 5000 }).catch(() => '');
          } else {
            content = await page.evaluate(() => document.body?.innerText || document.documentElement?.innerText || '');
          }
          return {
            success: true,
            url: page.url(),
            title: await page.title().catch(() => ''),
            content: content.slice(0, 5000),
          };
        }
        case 'wait_for_selector': {
          const page = await getOrCreatePlaywrightPage();
          await page.waitForSelector(params.selector, {
            state: params.state || 'visible',
            timeout: params.timeout || 15000,
          });
          return { success: true, message: `Elemento "${params.selector}" presente en la página.` };
        }
        case 'hover': {
          const page = await getOrCreatePlaywrightPage();
          await page.hover(params.selector, { timeout: 10000 });
          return { success: true, message: `Cursor posicionado sobre "${params.selector}".` };
        }
        case 'status': {
          const isRunning = Boolean(
            playwrightBrowser && playwrightBrowser.isConnected() && playwrightPage && !playwrightPage.isClosed()
          );
          return {
            success: true,
            isRunning,
            url: isRunning ? playwrightPage.url() : null,
            title: isRunning ? await playwrightPage.title().catch(() => null) : null,
          };
        }
        case 'close': {
          if (playwrightBrowser) {
            await playwrightBrowser.close().catch(() => {});
            playwrightBrowser = null;
            playwrightContext = null;
            playwrightPage = null;
          }
          return { success: true, message: 'Sesión de Playwright cerrada exitosamente.' };
        }
        default:
          return { success: false, error: `Acción de Playwright no soportada: "${action}"` };
      }
    } catch (err) {
      console.error('[Playwright Native Error]', err);
      return { success: false, error: (err as Error).message };
    }
}
let queue = Promise.resolve();
process.parentPort.on('message', (event) => {
 const { id, action, params } = event.data;
 queue = queue.then(async () => {
   try {
     validateRequest('playwright-execute', [action, params]);
     const result = await execute(action, params);
     process.parentPort.postMessage({ id, result });
   } catch { process.parentPort.postMessage({ id, result: { success: false, error: 'Solicitud de automatización rechazada.' } }); }
 });
});
