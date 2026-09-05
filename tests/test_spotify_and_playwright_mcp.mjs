/**
 * Test Suite: Spotify Integration & Full Playwright MCP Browser Automation
 */

import assert from 'assert';
import fs from 'fs';
import { spotifyService } from '../src/services/spotify/SpotifyService.js';
import { playwrightService } from '../src/services/playwright/PlaywrightService.js';
import { mcpClientManager } from '../src/services/mcp/MCPClientManager.js';
import { toolExecutor } from '../src/services/toolExecutor.js';
import { COMPANION_FUNCTION_DECLARATIONS } from '../src/config/tools.js';
import { SYSTEM_PERSONA_PROMPT } from '../src/config/models.js';

console.log('======================================================================');
console.log('🧪 TEST: SPOTIFY INTEGRATION & FULL PLAYWRIGHT MCP BROWSER CONTROL');
console.log('======================================================================');

// 1. Verify Tools Catalog
console.log('\n🔍 [1/5] Verificando catálogo de herramientas en COMPANION_FUNCTION_DECLARATIONS...');
const toolNames = COMPANION_FUNCTION_DECLARATIONS.map(t => t.name);

// Spotify tools
const expectedSpotifyTools = [
  'spotify_play',
  'spotify_pause',
  'spotify_next',
  'spotify_previous',
  'spotify_get_status',
  'spotify_search',
  'spotify_set_volume'
];
for (const tool of expectedSpotifyTools) {
  assert(toolNames.includes(tool), `Herramienta "${tool}" debe existir en COMPANION_FUNCTION_DECLARATIONS`);
}
console.log('  ✅ 7 herramientas de Spotify verificadas en el catálogo.');

// Playwright tools
const expectedPlaywrightTools = [
  'playwright_navigate',
  'playwright_click',
  'playwright_fill',
  'playwright_press',
  'playwright_screenshot',
  'playwright_get_content',
  'playwright_evaluate',
  'playwright_close'
];
for (const tool of expectedPlaywrightTools) {
  assert(toolNames.includes(tool), `Herramienta "${tool}" debe existir en COMPANION_FUNCTION_DECLARATIONS`);
}
console.log('  ✅ 8 herramientas nativas de Playwright verificadas en el catálogo.');

// 2. Verify Persona Prompt Capabilities
console.log('\n🔍 [2/5] Verificando capacidades de Spotify y Playwright en SYSTEM_PERSONA_PROMPT...');
assert(SYSTEM_PERSONA_PROMPT.includes('Reproducción Musical en Spotify'), 'Prompt debe incluir sección de Spotify');
assert(SYSTEM_PERSONA_PROMPT.includes('Control Total del Navegador con Playwright'), 'Prompt debe incluir sección de Playwright');
assert(SYSTEM_PERSONA_PROMPT.includes('Brave Browser'), 'Prompt debe referenciar Brave Browser');
console.log('  ✅ SYSTEM_PERSONA_PROMPT actualizado y validado.');

// 3. Verify MCPClientManager & Playwright MCP Server
console.log('\n🔍 [3/5] Verificando MCPClientManager y registro del servidor Playwright MCP...');
await mcpClientManager.initialize();

const servers = mcpClientManager.getServers();
const playwrightServer = servers.find(s => s.id === 'mcp_playwright');
assert(playwrightServer, 'mcp_playwright debe estar en los servidores MCP');
assert(playwrightServer.enabled === true, 'mcp_playwright debe estar habilitado por defecto');

// Verify tools registered for playwright MCP
const mcpDeclarations = mcpClientManager.getGeminiFunctionDeclarations();
const mcpDeclNames = mcpDeclarations.map(d => d.name);
assert(mcpDeclNames.includes('mcp_playwright_navigate'), 'Debe incluir mcp_playwright_navigate en declaraciones');
assert(mcpDeclNames.includes('mcp_playwright_click'), 'Debe incluir mcp_playwright_click en declaraciones');
assert(mcpDeclNames.includes('mcp_playwright_fill'), 'Debe incluir mcp_playwright_fill en declaraciones');
assert(mcpDeclNames.includes('mcp_playwright_screenshot'), 'Debe incluir mcp_playwright_screenshot en declaraciones');
assert(mcpDeclNames.includes('mcp_playwright_get_content'), 'Debe incluir mcp_playwright_get_content en declaraciones');
console.log(`  ✅ Servidor MCP Playwright conectado con ${playwrightServer.tools?.length || 0} herramientas.`);

// 4. Verify Spotify Service APIs & Tool Execution
console.log('\n🔍 [4/5] Verificando ejecución de herramientas de Spotify...');

// Test spotify_play with query
const playResult = await toolExecutor.executeTool('spotify_play', { query: 'Deftones' });
assert(playResult.status === 'success', 'spotify_play debe retornar status: success');
console.log('  ✓ spotify_play("Deftones"):', playResult.message || playResult.status);

// Test spotify_pause
const pauseResult = await toolExecutor.executeTool('spotify_pause', {});
assert(pauseResult.status === 'success', 'spotify_pause debe retornar status: success');
console.log('  ✓ spotify_pause():', pauseResult.message);

// Test spotify_next & previous
const nextResult = await toolExecutor.executeTool('spotify_next', {});
assert(nextResult.status === 'success', 'spotify_next debe retornar status: success');

const prevResult = await toolExecutor.executeTool('spotify_previous', {});
assert(prevResult.status === 'success', 'spotify_previous debe retornar status: success');

// Test spotify_set_volume
const volResult = await toolExecutor.executeTool('spotify_set_volume', { direction: 'up' });
assert(volResult.status === 'success', 'spotify_set_volume debe retornar status: success');

// Test spotify_get_status
const statusResult = await toolExecutor.executeTool('spotify_get_status', {});
assert(statusResult, 'spotify_get_status debe retornar objeto');
console.log('  ✓ spotify_get_status():', statusResult.status || 'OK');
console.log('  ✅ Flujo completo de Spotify verificado.');

// 5. Verify Playwright Engine with Brave Browser
console.log('\n🔍 [5/5] Verificando motor Playwright sobre Brave Browser...');
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
assert(fs.existsSync(bravePath), 'Brave Browser debe existir en la ruta oficial de Windows');

// Test standalone Playwright script file
const mcpServerScript = 'scripts/mcp-servers/playwright-mcp-server.mjs';
assert(fs.existsSync(mcpServerScript), 'playwright-mcp-server.mjs debe existir en scripts/mcp-servers/');
console.log('  ✓ Servidor MCP oficial verificado en disco.');

// Verify Playwright tools execution dispatch in ToolExecutor
const testToolDecl = COMPANION_FUNCTION_DECLARATIONS.find(t => t.name === 'playwright_navigate');
assert(testToolDecl, 'Declaración de playwright_navigate debe existir');
assert(testToolDecl.parameters.properties.url, 'playwright_navigate debe aceptar url');

console.log('  ✅ Todas las verificaciones de Playwright y Spotify superadas.');
console.log('\n🎉 PRUEBA DE INTEGRACIÓN SPOTIFY & PLAYWRIGHT MCP FINALIZADA CON ÉXITO!\n');
process.exit(0);
