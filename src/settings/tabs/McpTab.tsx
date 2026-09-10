import React, { useState, useEffect } from 'react';
import {
  Layers,
  Globe,
  RefreshCw,
  Plus,
  Trash2,
  Terminal,
  Server,
  Wrench,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { mcpClientManager } from '../../domain/integrations/mcp/MCPClientManager.js';
import { playwrightService } from '../../domain/integrations/playwright/PlaywrightService.js';
import { soundFxService } from '../../domain/audio/SoundFxService.js';
import { toastService } from '../../infrastructure/notifications/toastService.js';

export interface PlaywrightStatusData {
  isRunning: boolean;
  url: string | null;
  title: string | null;
}

export const McpTab: React.FC = () => {
  // MCP Servers
  const [mcpServers, setMcpServers] = useState<any[]>(() => {
    try {
      return mcpClientManager.getServers() || [];
    } catch (_) {
      return [];
    }
  });

  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpType, setNewMcpType] = useState<'stdio' | 'sse'>('stdio');
  const [newMcpCommand, setNewMcpCommand] = useState('pnpm');
  const [newMcpArgs, setNewMcpArgs] = useState('dlx @modelcontextprotocol/server-filesystem C:\\React-Nextjs-Projects');
  const [newMcpUrl, setNewMcpUrl] = useState('http://localhost:3000/sse');
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);

  // Playwright Controller State
  const [playwrightStatus, setPlaywrightStatus] = useState<PlaywrightStatusData>({
    isRunning: false,
    url: null,
    title: null
  });
  const [playwrightTestUrl, setPlaywrightTestUrl] = useState('https://open.spotify.com');
  const [playwrightLoading, setPlaywrightLoading] = useState(false);

  const refreshPlaywrightStatus = async () => {
    try {
      const st = await playwrightService.getStatus() as { isRunning?: boolean; success?: boolean; url?: string; title?: string } | null;
      setPlaywrightStatus({
        isRunning: Boolean(st?.isRunning || st?.success),
        url: typeof st?.url === 'string' ? st.url : null,
        title: typeof st?.title === 'string' ? st.title : null
      });
    } catch (_) {}
  };

  const refreshMcpServers = () => {
    try {
      setMcpServers(mcpClientManager.getServers() || []);
    } catch (_) {}
  };

  useEffect(() => {
    refreshMcpServers();
    void refreshPlaywrightStatus();
  }, []);

  const handleRegisterServer = async () => {
    if (!newMcpName.trim()) {
      toastService.warn('Servidor MCP', 'Por favor especifica un nombre para el servidor.');
      return;
    }
    soundFxService.playClick();
    try {
      if (newMcpType === 'stdio') {
        if (!newMcpCommand.trim()) return;
        await mcpClientManager.addServer({
          name: newMcpName.trim(),
          type: 'stdio',
          command: newMcpCommand.trim(),
          args: newMcpArgs.split(' ').filter(Boolean),
          enabled: true
        });
      } else {
        if (!newMcpUrl.trim()) return;
        await mcpClientManager.addServer({
          name: newMcpName.trim(),
          type: 'sse',
          url: newMcpUrl.trim(),
          enabled: true
        });
      }
      refreshMcpServers();
      setNewMcpName('');
      toastService.success('Servidor MCP', `Servidor "${newMcpName.trim()}" registrado con éxito.`);
    } catch (err: any) {
      toastService.error('Error MCP', err?.message || 'Fallo al registrar servidor.');
    }
  };

  const handleRemoveServer = async (id: string, name: string) => {
    soundFxService.playClick();
    await mcpClientManager.removeServer(id);
    refreshMcpServers();
    toastService.info('Servidor MCP', `Servidor "${name}" eliminado.`);
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-5 pr-1">
      <div>
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100 flex items-center gap-2">
          <Layers size={16} className="text-purple-400" />
          Servidores Model Context Protocol (MCP)
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Conecta herramientas externas estándar por protocolo MCP (stdio / SSE) e inspecciona sus capacidades en tiempo real.
        </p>
      </div>

      {/* Control de Navegador Playwright MCP */}
      <div className="border border-purple-900/40 bg-purple-950/10 p-4 rounded-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="text-purple-400" size={16} />
            <span className="text-xs font-mono font-medium text-zinc-100">
              Playwright MCP Browser Controller (Brave Browser)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-none ${
                playwrightStatus.isRunning
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {playwrightStatus.isRunning ? 'NAVEGADOR ACTIVO' : 'EN ESPERA'}
            </span>
            <button
              type="button"
              onClick={() => {
                soundFxService.playClick();
                void refreshPlaywrightStatus();
              }}
              className="p-1 hover:bg-zinc-800 rounded-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Refrescar estado de Playwright"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {playwrightStatus.url && (
          <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-sm text-xs font-mono">
            <div className="text-[10px] text-zinc-400">Página actual:</div>
            <div className="text-purple-300 truncate font-semibold">
              {playwrightStatus.title || 'Sin título'}
            </div>
            <div className="text-[11px] text-zinc-500 truncate">{playwrightStatus.url}</div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <input
            type="text"
            value={playwrightTestUrl}
            onChange={(e) => setPlaywrightTestUrl(e.target.value)}
            placeholder="URL a probar (ej: https://open.spotify.com)..."
            className="flex-1 px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-purple-500"
          />
          <button
            type="button"
            disabled={playwrightLoading}
            onClick={async () => {
              if (!playwrightTestUrl.trim()) return;
              soundFxService.playClick();
              setPlaywrightLoading(true);
              try {
                const res = await playwrightService.navigate(playwrightTestUrl.trim());
                if (res.success) {
                  toastService.success('Playwright MCP', `Navegado a ${res.url}`);
                  await refreshPlaywrightStatus();
                } else {
                  toastService.error('Error Playwright', res.error || 'Error al navegar.');
                }
              } finally {
                setPlaywrightLoading(false);
              }
            }}
            className="px-3 py-1.5 text-xs font-mono bg-purple-600 hover:bg-purple-500 text-white rounded-sm font-semibold transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {playwrightLoading ? 'Navegando...' : 'Navegar con Playwright'}
          </button>
          {playwrightStatus.isRunning && (
            <button
              type="button"
              onClick={async () => {
                soundFxService.playClick();
                await playwrightService.close();
                await refreshPlaywrightStatus();
                toastService.info('Playwright', 'Navegador cerrado.');
              }}
              className="px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-sm border border-zinc-700 transition-colors whitespace-nowrap"
            >
              Cerrar Navegador
            </button>
          )}
        </div>
      </div>

      {/* Registrar Nuevo Servidor MCP */}
      <div className="border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-3 rounded-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-zinc-200 block">
            Registrar Servidor MCP
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setNewMcpType('stdio')}
              className={`px-2.5 py-0.5 text-[10px] font-mono border rounded-sm transition-colors ${
                newMcpType === 'stdio'
                  ? 'bg-purple-900/60 border-purple-600 text-purple-200 font-medium'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
            >
              stdio (CLI)
            </button>
            <button
              type="button"
              onClick={() => setNewMcpType('sse')}
              className={`px-2.5 py-0.5 text-[10px] font-mono border rounded-sm transition-colors ${
                newMcpType === 'sse'
                  ? 'bg-purple-900/60 border-purple-600 text-purple-200 font-medium'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
            >
              SSE (HTTP/Web)
            </button>
          </div>
        </div>

        {newMcpType === 'stdio' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={newMcpName}
              onChange={(e) => setNewMcpName(e.target.value)}
              placeholder="Nombre (ej. filesystem)..."
              className="px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
            />
            <input
              type="text"
              value={newMcpCommand}
              onChange={(e) => setNewMcpCommand(e.target.value)}
              placeholder="Comando (ej. pnpm)..."
              className="px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
            />
            <input
              type="text"
              value={newMcpArgs}
              onChange={(e) => setNewMcpArgs(e.target.value)}
              placeholder="Argumentos..."
              className="px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={newMcpName}
              onChange={(e) => setNewMcpName(e.target.value)}
              placeholder="Nombre (ej. remote-tools)..."
              className="px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
            />
            <input
              type="text"
              value={newMcpUrl}
              onChange={(e) => setNewMcpUrl(e.target.value)}
              placeholder="URL SSE (ej. http://localhost:3000/sse)..."
              className="px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleRegisterServer}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm border border-zinc-700 transition-colors"
        >
          <Plus size={12} /> Registrar Servidor MCP
        </button>
      </div>

      {/* Lista de Servidores Conectados y Herramientas Provistas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400 px-1">
          <span>Servidores Activos ({mcpServers.length})</span>
          <span>Herramientas & Estado</span>
        </div>

        {mcpServers.map((s) => {
          const isExpanded = expandedServerId === s.id;
          const tools = Array.isArray(s.tools) ? s.tools : [];
          return (
            <div
              key={s.id}
              className="border border-zinc-800 bg-zinc-900/40 rounded-sm p-3 space-y-2 transition-colors hover:border-zinc-700"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Server size={14} className="text-purple-400 shrink-0" />
                  <span className="font-semibold text-xs font-mono text-zinc-200 truncate">
                    {s.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-800 text-zinc-400 border border-zinc-700/60 rounded-none shrink-0">
                    {s.type || 'stdio'}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-none border shrink-0 ${
                      s.status === 'connected'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    {s.status || 'conectado'}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {tools.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedServerId(isExpanded ? null : s.id)}
                      className="flex items-center gap-1 text-[11px] font-mono text-purple-300 hover:text-purple-200 px-2 py-0.5 bg-purple-950/40 border border-purple-800/60 rounded-sm transition-colors"
                    >
                      <Wrench size={10} />
                      <span>{tools.length} {tools.length === 1 ? 'herramienta' : 'herramientas'}</span>
                      {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveServer(s.id, s.name)}
                    className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                    title="Eliminar servidor"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="text-[11px] font-mono text-zinc-400 truncate bg-zinc-950/60 px-2 py-1 rounded-sm border border-zinc-800/80">
                {s.type === 'sse' ? (
                  s.url
                ) : (
                  <span>
                    <Terminal size={11} className="inline mr-1 text-zinc-500" />
                    {s.command} {Array.isArray(s.args) ? s.args.join(' ') : s.args || ''}
                  </span>
                )}
              </div>

              {/* Lista desplegable de herramientas provistas */}
              {isExpanded && tools.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/60 space-y-1.5 pl-2">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 block">
                    Herramientas descubiertas por MCP:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {tools.map((t: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-1.5 bg-zinc-950 border border-zinc-800 rounded-sm text-xs font-mono"
                      >
                        <div className="font-semibold text-purple-300 flex items-center gap-1">
                          <Wrench size={10} />
                          <span>{t.name}</span>
                        </div>
                        {t.description && (
                          <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                            {t.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {mcpServers.length === 0 && (
          <p className="text-xs text-zinc-500 font-mono italic text-center py-6 border border-dashed border-zinc-800/80 rounded-sm">
            No hay servidores MCP configurados actualmente.
          </p>
        )}
      </div>
    </div>
  );
};

export default McpTab;
