/**
 * Verifies the Electron MCP bridge contract without launching Electron.
 * The renderer manager must namespace discovered tools and route execution
 * back through the main-process transport with the original MCP tool name.
 */

const calls = [];
const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  },
  electronAPI: {
    isElectron: true,
    mcpConnect: async (config) => {
      calls.push({ type: 'connect', config });
      return {
        success: true,
        protocolVersion: '2025-03-26',
        tools: [{
          name: 'echo',
          description: 'Echo de prueba',
          inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }
        }]
      };
    },
    mcpCallTool: async (payload) => {
      calls.push({ type: 'call', payload });
      return { success: true, content: [{ type: 'text', text: payload.arguments.text }] };
    },
    mcpDisconnect: async (serverId) => {
      calls.push({ type: 'disconnect', serverId });
      return { success: true };
    }
  }
};
globalThis.localStorage = globalThis.window.localStorage;

const { MCPClientManager } = await import('../src/services/mcp/MCPClientManager.js');
const manager = new MCPClientManager();
await manager.initialize();

// Keep the test deterministic by removing the auto-discovered Playwright entry.
for (const server of manager.getServers()) await manager.deleteServer(server.id);

const server = await manager.addServer({
  name: 'Echo MCP',
  type: 'stdio',
  command: 'node',
  args: ['echo-server.mjs'],
  enabled: false
});
if (!server?.id) throw new Error('No se pudo registrar el servidor MCP de prueba.');
await manager.toggleServer(server.id, true);

const namespaced = `mcp_${server.id}_echo`;
if (!manager.hasTool(namespaced)) throw new Error('La herramienta MCP no fue namespaceada en el renderer.');
const declarations = manager.getGeminiFunctionDeclarations();
const declaration = declarations.find((entry) => entry.name === namespaced);
if (!declaration?.parameters?.properties?.text) throw new Error('El esquema MCP no llegó a Gemini.');

const result = await manager.executeMCPTool(namespaced, { text: 'hola' });
if (result?.content?.[0]?.text !== 'hola') throw new Error('La respuesta de tools/call no fue devuelta.');
await manager.disconnectServer(server.id);

const connectCall = calls.find((entry) => entry.type === 'connect');
const toolCall = calls.find((entry) => entry.type === 'call');
if (connectCall?.config?.id !== server.id) throw new Error('mcp-connect no recibió el id del servidor.');
if (toolCall?.payload?.name !== 'echo') throw new Error('mcp-call-tool no restauró el nombre original.');
if (!calls.some((entry) => entry.type === 'disconnect')) throw new Error('mcp-disconnect no fue invocado.');

console.log('✅ MCP Electron bridge: conexión, descubrimiento namespaceado, ejecución y desconexión verificados.');
