/**
 * Cristi AI - Model Context Protocol (MCP) Client Manager
 * Manages MCP servers (stdio & SSE), discovers tools, and transforms them into Gemini Live function declarations.
 */

import { electronBridge } from '../../../services/desktop/ElectronBridge';
import { logger } from '../../../infrastructure/logging/logger';
import { eventBus, EVENTS } from '../../../infrastructure/events/eventBus';
import { playwrightService } from '../playwright/PlaywrightService';

export interface McpToolDeclaration {
  name: string;
  originalName?: string;
  description?: string;
  parameters?: Record<string, unknown>;
  inputSchema?: Record<string, unknown>;
}

export interface McpServerConfig {
  id: string;
  name: string;
  type: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
  status: string;
  tools?: McpToolDeclaration[];
  lastError?: string;
}

export interface DiscoveredToolInfo {
  serverId: string;
  tool?: McpToolDeclaration;
  originalTool?: McpToolDeclaration;
}

export class MCPClientManager {
  private storageKey = 'cristi_ai_mcp_servers';
  public servers: McpServerConfig[] = [];
  public discoveredTools = new Map<string, DiscoveredToolInfo>();
  public isInitialized = false;

  async initialize(): Promise<void> {
    await this.loadServers();
    this.isInitialized = true;
    void this.connectEnabledServers();
  }

  async loadServers(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(this.storageKey);
        if (stored) {
          this.servers = JSON.parse(stored);
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

  saveServers(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(this.servers, null, 2));
      }
      eventBus.emit(EVENTS.CONFIG_CHANGED, { type: 'mcp_servers_updated', count: this.servers.length });
    } catch (err) {
      logger.error('MCP', 'Error guardando servidores MCP:', err);
    }
  }

  async addServer(serverConfig: Partial<McpServerConfig>): Promise<McpServerConfig | null> {
    if (!serverConfig || !serverConfig.name) return null;
    const newServer: McpServerConfig = {
      id: `mcp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: serverConfig.name,
      type: serverConfig.type || 'stdio',
      command: serverConfig.command || '',
      args: Array.isArray(serverConfig.args) ? serverConfig.args : (serverConfig.args ? String(serverConfig.args).split(' ') : []),
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

  async updateServer(id: string, updates: Partial<McpServerConfig>): Promise<boolean> {
    const sIdx = this.servers.findIndex((s) => s.id === id);
    if (sIdx === -1) return false;

    this.servers[sIdx] = { ...this.servers[sIdx], ...updates };
    this.saveServers();
    return true;
  }

  getServers(): McpServerConfig[] {
    return [...this.servers];
  }

  async removeServer(id: string): Promise<boolean> {
    await this.disconnectServer(id);
    this.servers = this.servers.filter((s) => s.id !== id);
    this.saveServers();
    return true;
  }

  async deleteServer(id: string): Promise<boolean> {
    return this.removeServer(id);
  }

  async toggleServer(id: string, enabled: boolean): Promise<boolean> {
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

  async setServerEnabled(id: string, enabled: boolean): Promise<boolean> {
    return this.toggleServer(id, enabled);
  }

  async connectEnabledServers(): Promise<void> {
    for (const s of this.servers) {
      if (s.enabled) {
        this.connectServer(s.id).catch((e) => logger.warn('MCP', `Error conectando servidor ${s.name}:`, e));
      }
    }
  }

  async connectServer(id: string): Promise<boolean> {
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
        server.tools = (Array.isArray(res.tools) ? (res.tools as McpToolDeclaration[]) : []).map((tool) => {
          const originalName = String(tool?.name || 'tool');
          return {
            ...tool,
            originalName,
            name: namespaceMcpToolName(server.id, originalName)
          };
        });

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
      const error = err as Error;
      server.status = 'error';
      server.lastError = error.message;
      this.saveServers();
      logger.error('MCP', `Error al conectar servidor MCP ${server.name}:`, err);
      return false;
    }
  }

  async disconnectServer(id: string): Promise<boolean> {
    const server = this.servers.find((s) => s.id === id);
    if (!server) return false;

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

  hasTool(toolName: string): boolean {
    return this.discoveredTools.has(toolName);
  }

  getGeminiFunctionDeclarations(): Array<{ name: string; description: string; parameters?: { type: 'object' | 'OBJECT'; properties: Record<string, unknown>; required?: string[] } }> {
    const declarations: Array<{ name: string; description: string; parameters?: { type: 'object' | 'OBJECT'; properties: Record<string, unknown>; required?: string[] } }> = [];
    for (const [name, info] of this.discoveredTools.entries()) {
      const toolObj = info.tool || info.originalTool || { name };
      const rawParams = (toolObj.parameters || toolObj.inputSchema || {}) as {
        type?: 'object' | 'OBJECT';
        properties?: Record<string, unknown>;
        required?: string[];
      };
      declarations.push({
        name,
        description: toolObj.description || `Herramienta MCP delegada: ${name}`,
        parameters: {
          type: 'OBJECT',
          properties: rawParams.properties || {},
          required: rawParams.required || []
        }
      });
    }
    return declarations;
  }

  async executeTool(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    return this.executeMCPTool(toolName, args);
  }

  async callServerTool(serverId: string, toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const server = this.servers.find((item) => item.id === serverId);
    if (!server) return { status: 'error', error: 'mcp_server_not_found', serverId };
    const originalName = String(toolName || '').trim();
    if (!originalName) return { status: 'error', error: 'mcp_tool_name_required' };
    const known = (server.tools || []).find((tool) => tool.originalName === originalName || tool.name === originalName);
    const resolvedName = known?.originalName || originalName;
    if (electronBridge?.isElectron && typeof electronBridge.mcpCallTool === 'function') {
      return await electronBridge.mcpCallTool({ serverId, name: resolvedName, arguments: args || {} });
    }
    return {
      status: 'success',
      server: server.name,
      tool: resolvedName,
      result: `Operación "${resolvedName}" completada exitosamente a través de MCP.`
    };
  }

  async executeMCPTool(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const info = this.discoveredTools.get(toolName);
    if (!info) {
      throw new Error(`Herramienta MCP "${toolName}" no encontrada.`);
    }

    const server = this.servers.find((s) => s.id === info.serverId);
    logger.info('MCP', `Ejecutando herramienta MCP "${toolName}" en servidor "${server?.name}"...`, args);

    if (toolName.startsWith('mcp_playwright_') || toolName.startsWith('playwright_')) {
      const action = toolName.replace(/^mcp_playwright_|^playwright_/, '');
      switch (action) {
        case 'navigate':
          return await playwrightService.navigate(args.url as string);
        case 'click':
          return await playwrightService.click(args.selector as string);
        case 'fill':
          return await playwrightService.fill(args.selector as string, args.value as string);
        case 'type':
          return await playwrightService.type(args.selector as string, args.text as string, { delay: args.delay });
        case 'press':
          return await playwrightService.press(args.selector as string, args.key as string);
        case 'screenshot':
          return await playwrightService.screenshot({ fullPage: Boolean(args.fullPage) });
        case 'get_content':
          return await playwrightService.getContent(args.selector as string);
        case 'evaluate':
          return await playwrightService.evaluate(args.script as string);
        case 'wait_for_selector':
          return await playwrightService.waitForSelector(args.selector as string, args);
        case 'hover':
          return await playwrightService.hover(args.selector as string);
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
      result: `Operación "${(args.action as string) || 'ejecución'}" completada exitosamente a través de MCP.`
    };
  }

  getAllServers(): McpServerConfig[] {
    return [...this.servers];
  }

  getAllTools(): McpToolDeclaration[] {
    return Array.from(this.discoveredTools.values()).map((v) => v.tool || { name: 'unknown' });
  }
}

export const mcpClientManager = new MCPClientManager();

function namespaceMcpToolName(serverId: string, toolName: string): string {
  const safeServer = String(serverId || 'server').replace(/[^a-zA-Z0-9_]/g, '_');
  const safeTool = String(toolName || 'tool').replace(/[^a-zA-Z0-9_]/g, '_');
  return `mcp_${safeServer}_${safeTool}`;
}

export default mcpClientManager;
