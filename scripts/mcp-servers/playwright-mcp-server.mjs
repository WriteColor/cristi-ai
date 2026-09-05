/**
 * Cristi AI - Official Playwright MCP Server
 * Model Context Protocol (MCP) Server for comprehensive browser automation using Playwright and Brave.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { chromium } from 'playwright';
import fs from 'fs';

const BRAVE_PATH_CANDIDATES = [
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\chrome_proxy.exe'
];

function getBravePath() {
  for (const candidate of BRAVE_PATH_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

let browser = null;
let context = null;
let page = null;

async function ensurePage() {
  if (!browser || !browser.isConnected()) {
    const bravePath = getBravePath();
    if (!bravePath) {
      throw new Error('Brave.exe no está instalado; el MCP no iniciará otro navegador.');
    }
    browser = await chromium.launch({
      executablePath: bravePath,
      headless: false,
      args: ['--disable-blink-features=AutomationControlled', '--start-maximized', '--no-default-browser-check']
    });
    context = await browser.newContext({ viewport: null });
    page = await context.newPage();
  } else if (!page || page.isClosed()) {
    page = await context.newPage();
  }
  return page;
}

const server = new McpServer({
  name: 'Cristi-Playwright-MCP',
  version: '1.0.0'
});

// 1. Navigate
server.tool(
  'playwright_navigate',
  'Navega a cualquier URL o aplicación web en el navegador Brave.',
  {
    url: { type: 'string', description: 'La URL completa a la que se desea navegar (ej: https://open.spotify.com o https://github.com)' }
  },
  async ({ url }) => {
    try {
      const p = await ensurePage();
      let target = url.trim();
      if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
      await p.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const title = await p.title();
      return {
        content: [{ type: 'text', text: `Navegación completada a "${target}". Título: "${title}"` }]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error al navegar: ${err.message}` }], isError: true };
    }
  }
);

// 2. Click
server.tool(
  'playwright_click',
  'Hace clic en un elemento, botón, enlace o campo de la página.',
  {
    selector: { type: 'string', description: 'Selector CSS, texto o XPath del elemento a clickear' }
  },
  async ({ selector }) => {
    try {
      const p = await ensurePage();
      await p.click(selector, { timeout: 10000 });
      return { content: [{ type: 'text', text: `Clic exitoso en "${selector}".` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error al hacer clic en "${selector}": ${err.message}` }], isError: true };
    }
  }
);

// 3. Fill Form
server.tool(
  'playwright_fill',
  'Escribe o llena un campo de entrada (input, textarea) en la página.',
  {
    selector: { type: 'string', description: 'Selector CSS o selector de texto del campo' },
    value: { type: 'string', description: 'El texto a ingresar en el campo' }
  },
  async ({ selector, value }) => {
    try {
      const p = await ensurePage();
      await p.fill(selector, value, { timeout: 10000 });
      return { content: [{ type: 'text', text: `Texto ingresado exitosamente en "${selector}".` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error al llenar "${selector}": ${err.message}` }], isError: true };
    }
  }
);

// 4. Press Key
server.tool(
  'playwright_press',
  'Presiona una tecla del teclado (Enter, Escape, Tab, ArrowDown, etc.).',
  {
    key: { type: 'string', description: 'Tecla a presionar (ej: "Enter", "Tab", "Escape")' },
    selector: { type: 'string', description: 'Selector opcional en el que presionar la tecla' }
  },
  async ({ key, selector }) => {
    try {
      const p = await ensurePage();
      await p.press(selector || 'body', key);
      return { content: [{ type: 'text', text: `Tecla "${key}" presionada con éxito.` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error al presionar tecla: ${err.message}` }], isError: true };
    }
  }
);

// 5. Screenshot
server.tool(
  'playwright_screenshot',
  'Toma una captura de pantalla de la página web actual.',
  {},
  async () => {
    try {
      const p = await ensurePage();
      const buffer = await p.screenshot({ fullPage: false });
      return {
        content: [
          { type: 'text', text: `Captura realizada con éxito (${buffer.length} bytes).` },
          { type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' }
        ]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error al capturar pantalla: ${err.message}` }], isError: true };
    }
  }
);

// 6. Get Content
server.tool(
  'playwright_get_content',
  'Obtiene el contenido de texto legible o HTML de la página web actual o de un elemento.',
  {
    selector: { type: 'string', description: 'Selector opcional para extraer solo ese bloque' }
  },
  async ({ selector }) => {
    try {
      const p = await ensurePage();
      let text = '';
      if (selector) {
        text = await p.locator(selector).innerText({ timeout: 5000 });
      } else {
        text = await p.evaluate(() => document.body?.innerText || document.documentElement?.innerText || '');
      }
      return {
        content: [{ type: 'text', text: text.slice(0, 4000) }]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error al leer contenido: ${err.message}` }], isError: true };
    }
  }
);

// 7. Evaluate Script
server.tool(
  'playwright_evaluate',
  'Ejecuta un script de JavaScript en el contexto de la página web.',
  {
    script: { type: 'string', description: 'Expresión o función JavaScript a ejecutar' }
  },
  async ({ script }) => {
    try {
      const p = await ensurePage();
      const result = await p.evaluate(script);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error al evaluar script: ${err.message}` }], isError: true };
    }
  }
);

// 8. Close Browser
server.tool(
  'playwright_close',
  'Cierra la sesión del navegador web Playwright.',
  {},
  async () => {
    try {
      if (browser) {
        await browser.close().catch(() => {});
        browser = null;
        context = null;
        page = null;
      }
      return { content: [{ type: 'text', text: 'Navegador Playwright cerrado exitosamente.' }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error al cerrar navegador: ${err.message}` }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP Playwright] Servidor iniciado en stdio.');
}

main().catch((err) => {
  console.error('[MCP Playwright Fatal Error]', err);
  process.exit(1);
});
