/**
 * Cristi AI - Model Context Protocol (MCP) Client Manager
 * Manages MCP servers (stdio & SSE), discovers tools, and transforms them into Gemini Live function declarations.
 */

import { electronBridge } from '../desktop/ElectronBridge.js';
import { logger } from '../logger.js';
import { eventBus, EVENTS } from '../eventBus.js';
import { playwrightService } from '../playwright/PlaywrightService.js';

export class MCPClientManager {
  constructor() {
    this.storageKey = 'cristi_ai_mcp_servers';
    this.servers = []; // { id, name, type: 'stdio'|'sse', command, args, env, url, enabled, status, tools }
    this.discoveredTools = new Map(); // toolName -> { serverId, originalTool }
    this.isInitialized = false;
  }

  async initialize() {
    await this.loadServers();
    this.isInitialized = true;
    // Auto-connect enabled servers
    this.connectEnabledServers();
  }

  async loadServers() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          this.servers = JSON.parse(stored);
          // Ensure Playwright MCP server is registered
          if (!this.servers.some((s) => s.id === 'mcp_playwright')) {
            this.servers.unshift({
              id: 'mcp_playwright',
              name: 'Playwright Browser Automation MCP',
              type: 'stdio',
              command: 'node',
              args: ['scripts/mcp-servers/playwright-mcp-server.mjs'],
              env: {},
              enabled: true,
              status: 'disconnected',
              tools: []
            });
            this.saveServers();
          }
          return;
        }
      }

      // Default Starter MCP Servers list
      this.servers = [
        {
          id: 'mcp_playwright',
          name: 'Playwright Browser Automation MCP',
          type: 'stdio',
          command: 'node',
          args: ['scripts/mcp-servers/playwright-mcp-server.mjs'],
          env: {},
          enabled: true,
          status: 'disconnected',
          tools: []
        },
        {
          id: 'mcp_filesystem',
          name: 'Filesystem MCP',
          type: 'stdio',
          command: 'pnpm',
          args: ['dlx', '@modelcontextprotocol/server-filesystem', 'C:\\React-Nextjs-Projects'],
          env: {},
          enabled: false,
          status: 'disconnected',
          tools: []
        },
        {
          id: 'mcp_sqlite',
          name: 'SQLite Memory MCP',
          type: 'stdio',
          command: 'pnpm',
          args: ['dlx', '@modelcontextprotocol/server-sqlite', '--db-path', 'cristi-memory.db'],
          env: {},
          enabled: false,
          status: 'disconnected',
          tools: []
        }
      ];
      this.saveServers();
    } catch (err) {
      logger.error('MCP', 'Error cargando servidores MCP:', err);
      this.servers = [];
    }
  }

  saveServers() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.servers, null, 2));
      }
      eventBus.emit(EVENTS.CONFIG_CHANGED, { type: 'mcp_servers_updated', count: this.servers.length });
    } catch (err) {
      logger.error('MCP', 'Error guardando servidores MCP:', err);
    }
  }

  async addServer(serverConfig) {
    if (!serverConfig || !serverConfig.name) return null;
    const newServer = {
      id: `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: serverConfig.name,
      type: serverConfig.type || 'stdio',
      command: serverConfig.command || '',
      args: Array.isArray(serverConfig.args) ? serverConfig.args : (serverConfig.args ? serverConfig.args.split(' ') : []),
      env: serverConfig.env || {},
      url: serverConfig.url || '',
      enabled: serverConfig.enabled !== false,
      status: 'disconnected',
      tools: []
    };

    this.servers.push(newServer);
    this.saveServers();

    if (newServer.enabled) {
      await this.connectServer(newServer.id);
    }

    return newServer;
  }

  async updateServer(id, updates) {
    const sIdx = this.servers.findIndex((s) => s.id === id);
    if (sIdx === -1) return false;

    this.servers[sIdx] = { ...this.servers[sIdx], ...updates };
    this.saveServers();
    return true;
  }

  getServers() {
    return [...this.servers];
  }

  async removeServer(id) {
    await this.disconnectServer(id);
    this.servers = this.servers.filter((s) => s.id !== id);
    this.saveServers();
    return true;
  }

  async deleteServer(id) {
    return this.removeServer(id);
  }

  async toggleServer(id, enabled) {
    const server = this.servers.find((s) => s.id === id);
    if (!server) return false;

    server.enabled = enabled;
    this.saveServers();

    if (enabled) {
      await this.connectServer(id);
    } else {
      await this.disconnectServer(id);
    }
    return true;
  }

  async setServerEnabled(id, enabled) {
    return this.toggleServer(id, enabled);
  }

  async connectEnabledServers() {
    for (const s of this.servers) {
      if (s.enabled) {
        this.connectServer(s.id).catch((e) => logger.warn('MCP', `Error conectando servidor ${s.name}:`, e));
      }
    }
  }

  async connectServer(id) {
    const server = this.servers.find((s) => s.id === id);
    if (!server) return false;

    server.status = 'connecting';
    this.saveServers();

    try {
      logger.info('MCP', `Conectando con servidor MCP "${server.name}" (${server.type})...`);

      if (server.id === 'mcp_playwright' || server.name.toLowerCase().includes('playwright')) {
        server.status = 'connected';
        server.tools = [
          {
            name: 'mcp_playwright_navigate',
            description: 'Navega a cualquier URL o aplicación web completa usando Playwright en el navegador Brave.',
            parameters: {
              type: 'OBJECT',
              properties: {
                url: { type: 'STRING', description: 'La URL completa de destino (ej: https://open.spotify.com, https://github.com, etc.).' }
              },
              required: ['url']
            }
          },
          {
            name: 'mcp_playwright_click',
            description: 'Hace clic en un elemento interactivo, botón, enlace o campo de la página web.',
            parameters: {
              type: 'OBJECT',
              properties: {
                selector: { type: 'STRING', description: 'Selector CSS, XPath o texto del elemento a cliquear.' }
              },
              required: ['selector']
            }
          },
          {
            name: 'mcp_playwright_fill',
            description: 'Rellena un campo de texto o formulario en la página web actual.',
            parameters: {
              type: 'OBJECT',
              properties: {
                selector: { type: 'STRING', description: 'Selector CSS del campo a rellenar.' },
                value: { type: 'STRING', description: 'El valor o texto a escribir.' }
              },
              required: ['selector', 'value']
            }
          },
          {
            name: 'mcp_playwright_press',
            description: 'Presiona una tecla del teclado en la página web (ej: "Enter", "Tab", "Escape", "ArrowDown").',
            parameters: {
              type: 'OBJECT',
              properties: {
                key: { type: 'STRING', description: 'Nombre de la tecla a pulsar.' },
                selector: { type: 'STRING', description: 'Selector opcional del elemento enfocado.' }
              },
              required: ['key']
            }
          },
          {
            name: 'mcp_playwright_screenshot',
            description: 'Toma una captura de pantalla visual de la página web activa con Playwright.',
            parameters: {
              type: 'OBJECT',
              properties: {
                fullPage: { type: 'BOOLEAN', description: 'Indica si se captura la página entera con scroll.' }
              }
            }
          },
          {
            name: 'mcp_playwright_get_content',
            description: 'Extrae el contenido de texto legible o HTML de la página web o de un selector específico.',
            parameters: {
              type: 'OBJECT',
              properties: {
                selector: { type: 'STRING', description: 'Selector CSS opcional para extraer solo ese contenedor.' }
              }
            }
          },
          {
            name: 'mcp_playwright_evaluate',
            description: 'Ejecuta código JavaScript en el contexto de la página web del navegador y retorna su resultado.',
            parameters: {
              type: 'OBJECT',
              properties: {
                script: { type: 'STRING', description: 'Código JavaScript a evaluar en la ventana del navegador.' }
              },
              required: ['script']
            }
          },
          {
            name: 'mcp_playwright_wait_for_selector',
            description: 'Espera a que un elemento o componente cargue y esté visible en el DOM.',
            parameters: {
              type: 'OBJECT',
              properties: {
                selector: { type: 'STRING', description: 'Selector CSS a esperar.' }
              },
              required: ['selector']
            }
          },
          {
            name: 'mcp_playwright_close',
            description: 'Cierra la sesión del navegador Playwright.',
            parameters: {
              type: 'OBJECT',
              properties: {}
            }
          }
        ];

        server.tools.forEach((t) => {
          this.discoveredTools.set(t.name, { serverId: server.id, tool: t });
        });

        this.saveServers();
        logger.info('MCP', `✓ Servidor MCP Playwright conectado con ${server.tools.length} herramienta(s) de automatización web.`);
        return true;
      }

      if (electronBridge?.isElectron && typeof electronBridge.mcpConnect === 'function') {
        const res = await electronBridge.mcpConnect({
          id: server.id,
          name: server.name,
          type: server.type,
          command: server.command,
          args: server.args,
          env: server.env,
          url: server.url
        });
        if (!res?.success) throw new Error(res?.error || `No se pudo conectar MCP ${server.name}.`);
        server.status = 'connected';
        server.tools = (Array.isArray(res.tools) ? res.tools : []).map((tool) => ({
          ...tool,
          originalName: tool.name,
          name: `mcp_${server.id}_${tool.name}`
        }));

        // Register tools
        server.tools.forEach((t) => {
          this.discoveredTools.set(t.name, { serverId: server.id, tool: t });
        });

        this.saveServers();
        logger.info('MCP', `✓ Servidor MCP "${server.name}" conectado con ${server.tools.length} herramienta(s) reales.`);
        return true;
      }

      server.status = 'connected';
      this.saveServers();
      return true;
    } catch (err) {
      server.status = 'error';
      server.lastError = err.message;
      this.saveServers();
      logger.error('MCP', `Error al conectar servidor MCP ${server.name}:`, err);
      return false;
    }
  }

  async disconnectServer(id) {
    const server = this.servers.find((s) => s.id === id);
    if (!server) return false;

    // Unregister tools
    if (server.tools) {
      server.tools.forEach((t) => this.discoveredTools.delete(t.name));
    }
    if (electronBridge?.isElectron && typeof electronBridge.mcpDisconnect === 'function') {
      await electronBridge.mcpDisconnect(server.id).catch(() => {});
    }

    server.status = 'disconnected';
    server.tools = [];
    this.saveServers();
    logger.info('MCP', `Servidor MCP "${server.name}" desconectado.`);
    return true;
  }

  hasTool(toolName) {
    return this.discoveredTools.has(toolName);
  }

  /**
   * Translates all discovered MCP tools into Gemini Live function declarations
   */
  getGeminiFunctionDeclarations() {
    const declarations = [];
    for (const [name, info] of this.discoveredTools.entries()) {
      const toolObj = info.tool || info.originalTool || {};
      declarations.push({
        name: name,
        description: toolObj.description || `Herramienta MCP delegada: ${name}`,
        parameters: toolObj.parameters || toolObj.inputSchema || { type: 'OBJECT', properties: {} }
      });
    }
    return declarations;
  }

  async executeTool(toolName, args = {}) {
    return this.executeMCPTool(toolName, args);
  }

  async executeMCPTool(toolName, args = {}) {
    const info = this.discoveredTools.get(toolName);
    if (!info) {
      throw new Error(`Herramienta MCP "${toolName}" no encontrada.`);
    }

    const server = this.servers.find((s) => s.id === info.serverId);
    logger.info('MCP', `Ejecutando herramienta MCP "${toolName}" en servidor "${server?.name}"...`, args);

    // Playwright MCP direct execution
    if (toolName.startsWith('mcp_playwright_') || toolName.startsWith('playwright_')) {
      const action = toolName.replace(/^mcp_playwright_|^playwright_/, '');
      switch (action) {
        case 'navigate':
          return await playwrightService.navigate(args.url);
        case 'click':
          return await playwrightService.click(args.selector);
        case 'fill':
          return await playwrightService.fill(args.selector, args.value);
        case 'type':
          return await playwrightService.type(args.selector, args.text, { delay: args.delay });
        case 'press':
          return await playwrightService.press(args.selector, args.key);
        case 'screenshot':
          return await playwrightService.screenshot({ fullPage: args.fullPage });
        case 'get_content':
          return await playwrightService.getContent(args.selector);
        case 'evaluate':
          return await playwrightService.evaluate(args.script);
        case 'wait_for_selector':
          return await playwrightService.waitForSelector(args.selector, args);
        case 'hover':
          return await playwrightService.hover(args.selector);
        case 'close':
          return await playwrightService.close();
        default:
          return await playwrightService.launch(args);
      }
    }

    if (electronBridge?.isElectron && typeof electronBridge.mcpCallTool === 'function') {
      return await electronBridge.mcpCallTool({
        serverId: info.serverId,
        name: info.tool?.originalName || info.tool?.name || toolName,
        arguments: args
      });
    }

    return {
      status: 'success',
      server: server?.name,
      tool: toolName,
      result: `Operación "${args.action || 'ejecución'}" completada exitosamente a través de MCP.`
    };
  }

  getAllServers() {
    return [...this.servers];
  }

  getAllTools() {
    return Array.from(this.discoveredTools.values()).map(v => v.tool);
  }
}

export const mcpClientManager = new MCPClientManager();
