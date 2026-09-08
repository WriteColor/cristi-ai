import type { IToolHandler } from '../IToolHandler';
import { mcpClientManager } from '@/services/mcp/MCPClientManager.js';

export const mcpAddServerHandler: IToolHandler = {
  name: 'mcp_add_server',
  declaration: {
    name: 'mcp_add_server',
    description: 'Registra y conecta un servidor MCP nuevo para ampliar tus herramientas. Usa stdio para procesos locales o sse para endpoints HTTP compatibles.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Nombre legible del servidor MCP.' },
        transport: { type: 'STRING', enum: ['stdio', 'sse'], description: 'Transporte MCP.' },
        command: { type: 'STRING', description: 'Comando del proceso local (stdio), por ejemplo node, pnpm o python.' },
        args: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Argumentos del proceso stdio, en orden.' },
        url: { type: 'STRING', description: 'URL del endpoint SSE cuando transport es sse.' },
        enabled: { type: 'BOOLEAN', description: 'Conecta el servidor inmediatamente (por defecto true).' }
      },
      required: ['name']
    }
  },
  async execute(args: {
    name?: string;
    transport?: string;
    command?: string;
    args?: any[];
    url?: string;
    enabled?: boolean;
  }) {
    const server = await mcpClientManager.addServer({
      name: String(args?.name || '').trim(),
      type: args?.transport === 'sse' ? 'sse' : 'stdio',
      command: String(args?.command || '').trim(),
      args: Array.isArray(args?.args) ? args.args.map(value => String(value)) : [],
      url: String(args?.url || '').trim(),
      enabled: args?.enabled !== false
    });

    if (!server) {
      return { status: 'error', message: 'El servidor MCP requiere un nombre válido.' };
    }

    return {
      status: server.status === 'connected' ? 'success' : 'error',
      server: {
        id: server.id,
        name: server.name,
        type: server.type,
        status: server.status,
        lastError: (server as any).lastError || null,
        tools: (server.tools || []).map((tool: any) => tool.name)
      }
    };
  }
};

export const mcpRemoveServerHandler: IToolHandler = {
  name: 'mcp_remove_server',
  declaration: {
    name: 'mcp_remove_server',
    description: 'Desconecta y elimina un servidor MCP registrado.',
    parameters: {
      type: 'OBJECT',
      properties: {
        server_id: { type: 'STRING', description: 'ID del servidor MCP.' }
      },
      required: ['server_id']
    }
  },
  async execute(args: { server_id?: string }) {
    const serverId = String(args?.server_id || '').trim();
    const removed = await mcpClientManager.removeServer(serverId);
    return removed
      ? { status: 'success', server_id: serverId }
      : { status: 'error', message: `Servidor MCP "${serverId}" no encontrado.` };
  }
};

export const mcpListServersHandler: IToolHandler = {
  name: 'mcp_list_servers',
  declaration: {
    name: 'mcp_list_servers',
    description: 'Lista los servidores MCP registrados, su estado y las herramientas descubiertas.'
  },
  async execute() {
    return {
      status: 'success',
      servers: mcpClientManager.getServers().map((server: any) => ({
        id: server.id,
        name: server.name,
        type: server.type,
        enabled: server.enabled,
        status: server.status,
        lastError: server.lastError || null,
        tools: (server.tools || []).map((tool: any) => tool.name)
      }))
    };
  }
};

export const mcpReconnectServerHandler: IToolHandler = {
  name: 'mcp_reconnect_server',
  declaration: {
    name: 'mcp_reconnect_server',
    description: 'Reconecta un servidor MCP existente y vuelve a descubrir sus herramientas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        server_id: { type: 'STRING', description: 'ID del servidor MCP.' }
      },
      required: ['server_id']
    }
  },
  async execute(args: { server_id?: string }) {
    const serverId = String(args?.server_id || '').trim();
    const server = mcpClientManager.getServers().find((item: any) => item.id === serverId);
    if (!server) {
      return { status: 'error', message: `Servidor MCP "${serverId}" no encontrado.` };
    }

    await mcpClientManager.disconnectServer(serverId);
    const connected = await mcpClientManager.connectServer(serverId);
    const current = mcpClientManager.getServers().find((item: any) => item.id === serverId) || server;

    return {
      status: connected ? 'success' : 'error',
      server: {
        id: current.id,
        name: current.name,
        status: current.status,
        tools: (current.tools || []).map((tool: any) => tool.name),
        lastError: current.lastError || null
      }
    };
  }
};

export const mcpCallToolHandler: IToolHandler = {
  name: 'mcp_call_tool',
  declaration: {
    name: 'mcp_call_tool',
    description: 'Ejecuta una herramienta MCP por servidor y nombre original. Permite usar inmediatamente un servidor recién creado sin esperar a reconectar la llamada Live.',
    parameters: {
      type: 'OBJECT',
      properties: {
        server_id: { type: 'STRING', description: 'ID del servidor MCP conectado.' },
        tool_name: { type: 'STRING', description: 'Nombre exacto de la herramienta anunciado por el servidor MCP.' },
        arguments: { type: 'OBJECT', description: 'Argumentos JSON requeridos por la herramienta.' }
      },
      required: ['server_id', 'tool_name']
    }
  },
  async execute(args: { server_id?: string; tool_name?: string; arguments?: Record<string, any> }) {
    return await mcpClientManager.callServerTool(
      String(args?.server_id || '').trim(),
      String(args?.tool_name || '').trim(),
      args?.arguments && typeof args.arguments === 'object' ? args.arguments : {}
    );
  }
};

export const mcpTools: IToolHandler[] = [
  mcpAddServerHandler,
  mcpRemoveServerHandler,
  mcpListServersHandler,
  mcpReconnectServerHandler,
  mcpCallToolHandler
];
