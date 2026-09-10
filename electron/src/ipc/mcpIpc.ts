import { approveMcpLaunch } from '../security/McpPolicy';
import { handleTrusted } from '../security/CapabilityRouter';
import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import { processManager } from '../core/processManager';
import { McpStdioConfig, McpToolCallPayload } from '../types/electron.types';

interface McpPendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface McpSseClient {
  connect(transport: unknown): Promise<void>;
  listTools(): Promise<{ tools?: unknown[] }>;
  callTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<unknown>;
  close?(): Promise<void>;
  getServerVersion?(): { version?: string };
}

interface McpStdioState {
  id: string;
  transport: 'stdio';
  process: ChildProcess;
  nextId: number;
  pending: Map<number, McpPendingRequest>;
  buffer: string;
}

interface McpSseState {
  id: string;
  transport: 'sse';
  client: McpSseClient;
  pending: Map<number, McpPendingRequest>;
}

type McpState = McpStdioState | McpSseState;

const mcpProcesses = new Map<string, McpState>();

function rejectMcpPending(state: McpState, error: Error): void {
  for (const pending of state.pending.values()) {
    pending.reject(error);
  }
  state.pending.clear();
}

function sendMcpRequest(state: McpStdioState, method: string, params: Record<string, unknown> = {}, timeoutMs = 15000): Promise<unknown> {
  if (!state.process || state.process.killed) {
    return Promise.reject(new Error('Servidor MCP no está ejecutándose.'));
  }
  const id = state.nextId++;
  const payload = `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      state.pending.delete(id);
      reject(new Error(`Tiempo de espera agotado para MCP (${method}).`));
    }, Math.max(1000, Math.min(60000, timeoutMs)));

    state.pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });

    try {
      state.process.stdin?.write(payload);
    } catch (error) {
      clearTimeout(timer);
      state.pending.delete(id);
      reject(error as Error);
    }
  });
}

function sendMcpNotification(state: McpStdioState, method: string, params: Record<string, unknown> = {}): boolean {
  if (!state.process || state.process.killed) return false;
  try {
    state.process.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
    return true;
  } catch (_) {
    return false;
  }
}

function quoteWindowsShellArg(value: unknown): string {
  const text = String(value ?? '');
  if (!/[\s"&|<>^]/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

async function connectMcpSse(serverId: string, config: McpStdioConfig): Promise<Record<string, unknown>> {
  const urlText = String(config.url || '').trim();
  if (!urlText) return { success: false, error: 'MCP SSE requiere una URL.' };

  let url: URL;
  try {
    url = new URL(urlText);
  } catch (_) {
    return { success: false, error: 'URL SSE inválida.' };
  }

  try {
     
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
     
    const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');

    const headers = Object.fromEntries(
      Object.entries(config.headers || {})
        .filter(([key, value]) => /^[A-Za-z0-9-]+$/.test(key) && value !== undefined)
        .map(([key, value]) => [key, String(value)])
    );

    const transport = new SSEClientTransport(url, { requestInit: { headers } });
    const client = new Client({ name: 'Cristi AI Companion', version: app.getVersion() });
    await client.connect(transport);
    const listed = await client.listTools();

    const state: McpSseState = { id: serverId, transport: 'sse', client, pending: new Map() };
    mcpProcesses.set(serverId, state);

    transport.onerror = (error: Error) => console.warn(`[MCP:${serverId}] SSE`, error?.message || String(error));
    transport.onclose = () => {
      if (mcpProcesses.get(serverId) === state) mcpProcesses.delete(serverId);
    };

    return {
      success: true,
      serverId,
      protocolVersion: client.getServerVersion?.()?.version || null,
      tools: Array.isArray(listed.tools) ? listed.tools : [],
    };
  } catch (error) {
    return { success: false, error: `No se pudo conectar MCP SSE: ${(error as Error).message}` };
  }
}

async function closeMcpState(state: McpState, reason = 'Servidor MCP desconectado.'): Promise<void> {
  if (!state) return;
  if (state.transport === 'sse') {
    try {
      await state.client?.close?.();
    } catch (_) {}
  } else {
    rejectMcpPending(state, new Error(reason));
    try {
      state.process?.kill?.();
    } catch (_) {}
  }
}

/**
 * Registers Model Context Protocol (MCP) IPC handlers.
 */
export function registerMcpIpc(): void {
  processManager.registerCleanupHook('mcp', async () => {
    for (const state of mcpProcesses.values()) {
      await closeMcpState(state, 'App cerrada.');
    }
    mcpProcesses.clear();
  });

  handleTrusted('mcp-connect', async (_event, config: McpStdioConfig = { id: '' }) => {
    await approveMcpLaunch(config);
    const serverId = String(config.id || '').trim();
    const transportType = String(config.type || 'stdio').trim().toLowerCase();

    if (!serverId) return { success: false, error: 'MCP requiere id.' };

    if (transportType === 'sse') {
      const previous = mcpProcesses.get(serverId);
      if (previous) {
        await closeMcpState(previous, 'Conexión MCP reemplazada.');
        mcpProcesses.delete(serverId);
      }
      return connectMcpSse(serverId, config);
    }

    const command = String(config.command || '').trim();
    if (!command) return { success: false, error: 'MCP stdio requiere id y command.' };

    const previous = mcpProcesses.get(serverId);
    if (previous) {
      await closeMcpState(previous, 'Conexión MCP reemplazada.');
      mcpProcesses.delete(serverId);
    }

    const args = Array.isArray(config.args) ? config.args.map((value) => String(value)) : [];
    const env = Object.fromEntries(
      Object.entries(config.env || {}).filter(([key, value]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && value !== undefined)
    );

    const shellCommand = command;
    const shellArgs = args;

    let child: ChildProcess;
    try {
      child = spawn(shellCommand, shellArgs, {
        cwd: app.isPackaged ? app.getPath('userData') : process.cwd(),
        env: { ...process.env, ...env },
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      return { success: false, error: `No se pudo iniciar MCP: ${(error as Error).message}` };
    }

    const state: McpStdioState = {
      id: serverId,
      transport: 'stdio',
      process: child,
      nextId: 1,
      pending: new Map(),
      buffer: '',
    };

    mcpProcesses.set(serverId, state);
    processManager.track(child);

    if (child.stdout) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        state.buffer += chunk;
        let newline: number;
        while ((newline = state.buffer.indexOf('\n')) >= 0) {
          const line = state.buffer.slice(0, newline).trim();
          state.buffer = state.buffer.slice(newline + 1);
          if (!line) continue;
          try {
            const message = JSON.parse(line);
            if (message.id !== undefined && state.pending.has(message.id)) {
              const pending = state.pending.get(message.id);
              state.pending.delete(message.id);
              if (message.error) {
                pending?.reject(new Error(message.error.message || 'Error MCP.'));
              } else {
                pending?.resolve(message.result || {});
              }
            }
          } catch (_) {}
        }
      });
    }

    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => console.warn(`[MCP:${serverId}]`, String(chunk).trim()));
    }

    child.once('error', (error: Error) => rejectMcpPending(state, error));
    child.once('exit', (code, signal) => {
      processManager.untrack(child);
      if (mcpProcesses.get(serverId) === state) mcpProcesses.delete(serverId);
      rejectMcpPending(state, new Error(`Servidor MCP terminó (${code ?? signal ?? 'desconocido'}).`));
    });

    try {
      const initialize = (await sendMcpRequest(state, 'initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'Cristi AI Companion', version: app.getVersion() },
      })) as { protocolVersion?: string };

      sendMcpNotification(state, 'notifications/initialized');
      const listed = (await sendMcpRequest(state, 'tools/list', {})) as { tools?: unknown[] };

      return {
        success: true,
        serverId,
        protocolVersion: initialize.protocolVersion || null,
        tools: Array.isArray(listed.tools) ? listed.tools : [],
      };
    } catch (error) {
      try {
        child.kill();
      } catch (_) {}
      if (mcpProcesses.get(serverId) === state) mcpProcesses.delete(serverId);
      return { success: false, error: (error as Error).message };
    }
  });

  handleTrusted('mcp-call-tool', async (_event, payload: McpToolCallPayload = { serverId: '', name: '' }) => {
    const serverId = String(payload.serverId || '');
    const state = mcpProcesses.get(serverId);
    if (!state) return { success: false, error: 'Servidor MCP no conectado.' };

    try {
      if (state.transport === 'sse') {
        const result = await state.client.callTool({
          name: String(payload.name || ''),
          arguments: payload.arguments || {},
        });
        return { success: true, ...(result as Record<string, unknown>) };
      }

      const result = await sendMcpRequest(state, 'tools/call', {
        name: String(payload.name || ''),
        arguments: payload.arguments || {},
      });
      return { success: true, ...(result as Record<string, unknown>) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  handleTrusted('mcp-disconnect', async (_event, serverId: unknown) => {
    const id = String(serverId || '');
    const state = mcpProcesses.get(id);
    if (!state) return { success: true, alreadyDisconnected: true };

    if (state.transport !== 'sse') {
      try {
        sendMcpNotification(state, 'notifications/cancelled', { reason: 'client_disconnect' });
      } catch (_) {}
    }

    await closeMcpState(state);
    mcpProcesses.delete(id);
    rejectMcpPending(state, new Error('Servidor MCP desconectado.'));
    return { success: true };
  });
}
