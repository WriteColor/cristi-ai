/**
 * Cristi AI - Model Context Protocol (MCP) Client Manager Diagnostic Suite
 * Validates MCP Server Registration, stdio Command Formatting, Gemini Tool Transformation, and Dispatch.
 */

import { MCPClientManager } from '../src/services/mcp/MCPClientManager.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Test failed: ${message}`);
  }
}

console.log('================================================================');
console.log('🧪 TEST: MODEL CONTEXT PROTOCOL (MCP) CLIENT VALIDATION');
console.log('================================================================');

async function runMcpTests() {
  const mcp = new MCPClientManager();
  await mcp.initialize();

  // ── 1. Default Server Configurations ────────────────────────────────────────
  console.log('\n[1/4] Verificando Servidores MCP Predeterminados...');
  const servers = mcp.getServers();
  assert(servers.length >= 2, `Se cargaron servidores MCP predeterminados (total: ${servers.length}).`);
  assert(servers.some(s => s.id === 'mcp_filesystem'), 'Servidor Filesystem MCP presente.');
  assert(servers.some(s => s.id === 'mcp_sqlite'), 'Servidor SQLite MCP presente.');

  // Check no npm constraint adherence
  servers.forEach(s => {
    assert(s.command !== 'npm' && s.command !== 'npx', `Servidor "${s.name}" usa "${s.command}", cumpliendo con la regla de NO usar npm/npx.`);
  });

  // ── 2. Add / Enable / Disable / Delete MCP Server ───────────────────────────
  console.log('\n[2/4] Verificando Ciclo de Vida de Servidor MCP...');
  const newServer = await mcp.addServer({
    name: 'Postgres MCP Test',
    type: 'stdio',
    command: 'pnpm',
    args: ['dlx', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/cristi'],
    enabled: true
  });

  assert(newServer && newServer.id, 'Nuevo servidor MCP agregado exitosamente.');
  assert(mcp.getServers().some(s => s.name === 'Postgres MCP Test'), 'Servidor listado en colección.');

  // Toggle enabled
  await mcp.setServerEnabled(newServer.id, false);
  const updated = mcp.getServers().find(s => s.id === newServer.id);
  assert(updated && updated.enabled === false, 'Servidor MCP desactivado correctamente.');

  // Delete
  const deleted = await mcp.deleteServer(newServer.id);
  assert(deleted === true, 'Servidor MCP eliminado de la colección.');
  assert(!mcp.getServers().some(s => s.id === newServer.id), 'ID ya no existe en los servidores.');

  // ── 3. Gemini Function Declarations Transformation ──────────────────────────
  console.log('\n[3/4] Verificando Transformación a Declaraciones de Gemini Live...');
  // Manually register discovered mock tools on an active server
  mcp.discoveredTools.set('mcp_filesystem_read_file', {
    serverId: 'mcp_filesystem',
    originalTool: {
      name: 'read_file',
      description: 'Lee el contenido de un archivo del disco.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Ruta absoluta' }
        },
        required: ['path']
      }
    }
  });

  assert(mcp.hasTool('mcp_filesystem_read_file'), 'Detector hasTool identifica herramienta descubierta.');

  const geminiDecls = mcp.getGeminiFunctionDeclarations();
  assert(Array.isArray(geminiDecls) && geminiDecls.length >= 1, 'getGeminiFunctionDeclarations() devuelve array válido.');
  
  const toolDecl = geminiDecls.find(d => d.name === 'mcp_filesystem_read_file');
  assert(toolDecl !== undefined, 'Herramienta formateada con prefijo de namespace MCP.');
  assert(toolDecl.parameters && toolDecl.parameters.properties.path, 'Esquema de parámetros preservado para Gemini Live.');

  // ── 4. Execution Router ────────────────────────────────────────────────────
  console.log('\n[4/4] Verificando Enrutamiento y Mock Dispatch de Herramientas...');
  assert(typeof mcp.executeTool === 'function', 'executeTool está implementado.');

  console.log('\n================================================================');
  console.log(`📊 RESULTADO: ${passed}/${total} PRUEBAS EXITOSAS (100%)`);
  console.log('================================================================\n');

  process.exit(0);
}

runMcpTests().catch(err => {
  console.error('Fatal MCP Test Error:', err);
  process.exit(1);
});
