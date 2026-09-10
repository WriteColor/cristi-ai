import React, { useState, useEffect, useCallback } from 'react';
import {
  Gamepad2,
  Bot,
  Volume2,
  Activity,
  CheckCircle2,
  Radio
} from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { minecraftCompanion } from '../../domain/integrations/minecraft/MinecraftCompanionService.js';
import { discordCompanion } from '../../domain/integrations/discord/DiscordCompanionService.js';
import { soundFxService } from '../../domain/audio/SoundFxService.js';
import { toastService } from '../../infrastructure/notifications/toastService.js';

export const GamesTab: React.FC = () => {
  const discordToken = useSettingsStore((s) => s.discordToken);
  const discordAutoReply = useSettingsStore((s) => s.discordAutoReply);
  const discordMonitoredChannels = useSettingsStore((s) => s.discordMonitoredChannels);
  const discordVoiceChannel = useSettingsStore((s) => s.discordVoiceChannel);
  const discordActivityStatus = useSettingsStore((s) => s.discordActivityStatus);
  const setField = useSettingsStore((s) => s.setField);

  // Minecraft State
  const [mcConfig, setMcConfig] = useState(() => {
    try {
      return (minecraftCompanion as any).config || { host: 'localhost', port: 25565, username: 'Cristi_AI' };
    } catch (_) {
      return { host: 'localhost', port: 25565, username: 'Cristi_AI' };
    }
  });

  const [mcStatus, setMcStatus] = useState(() => {
    try {
      return (minecraftCompanion as any).status || 'disconnected';
    } catch (_) {
      return 'disconnected';
    }
  });

  // Discord State
  const [discordStatus, setDiscordStatus] = useState(() => {
    try {
      return (discordCompanion as any).status || 'disconnected';
    } catch (_) {
      return 'disconnected';
    }
  });

  useEffect(() => {
    setMcStatus((minecraftCompanion as any).status || 'disconnected');
    setDiscordStatus((discordCompanion as any).status || 'disconnected');
  }, []);

  const saveDiscordReplyOptions = useCallback(
    (patch: { autoReply?: boolean; monitoredChannels?: string; voiceChannel?: string; activityStatus?: string } = {}) => {
      const channelIds = (patch.monitoredChannels ?? discordMonitoredChannels)
        .split(/[\s,]+/)
        .map((value) => value.trim())
        .filter(Boolean);

      const saved = (discordCompanion as any).saveConfig?.({
        autoReply: patch.autoReply ?? discordAutoReply,
        monitoredChannels: channelIds,
        voiceChannel: patch.voiceChannel ?? discordVoiceChannel,
        statusMessage: patch.activityStatus ?? discordActivityStatus
      });

      if (saved) {
        setField('discordAutoReply', Boolean(saved.autoReply));
        if (Array.isArray(saved.monitoredChannels)) {
          setField('discordMonitoredChannels', saved.monitoredChannels.join(', '));
        }
      }
    },
    [discordAutoReply, discordMonitoredChannels, discordVoiceChannel, discordActivityStatus, setField]
  );

  return (
    <div className="flex-1 overflow-y-auto space-y-5 pr-1">
      <div>
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100 flex items-center gap-2">
          <Gamepad2 size={16} className="text-zinc-400" />
          Compañera en Videojuegos & Discord
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Conexión autónoma para acompañarte jugando Minecraft y participar en servidores de Discord.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Minecraft */}
        <div className="border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-3 rounded-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-zinc-200 flex items-center gap-1.5">
              <Gamepad2 size={13} className="text-zinc-400" />
              Minecraft Companion (Mineflayer)
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-none ${
                mcStatus === 'connected'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : mcStatus === 'connecting'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {mcStatus.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-mono text-zinc-400 block mb-1">Host:</label>
              <input
                type="text"
                value={mcConfig.host || 'localhost'}
                onChange={(e) => setMcConfig({ ...mcConfig, host: e.target.value })}
                className="w-full px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-zinc-400 block mb-1">Puerto:</label>
              <input
                type="number"
                value={mcConfig.port || 25565}
                onChange={(e) => setMcConfig({ ...mcConfig, port: Number(e.target.value) })}
                className="w-full px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-zinc-400 block mb-1">Bot Username:</label>
              <input
                type="text"
                value={mcConfig.username || 'Cristi_AI'}
                onChange={(e) => setMcConfig({ ...mcConfig, username: e.target.value })}
                className="w-full px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={async () => {
                soundFxService.playClick();
                setMcStatus('connecting');
                try {
                  await (minecraftCompanion as any).connect(mcConfig);
                  setMcStatus((minecraftCompanion as any).status);
                  toastService.success('Minecraft', 'Conectando bot de Cristi a Minecraft...');
                } catch (err: any) {
                  setMcStatus('disconnected');
                  toastService.error('Minecraft', err?.message || 'Error al conectar bot.');
                }
              }}
              className="px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm border border-zinc-700 transition-colors"
            >
              Conectar a Minecraft
            </button>
            {mcStatus === 'connected' && (
              <button
                type="button"
                onClick={async () => {
                  soundFxService.playClick();
                  await (minecraftCompanion as any).disconnect();
                  setMcStatus('disconnected');
                  toastService.info('Minecraft', 'Bot desconectado.');
                }}
                className="px-3 py-1.5 text-xs font-mono bg-rose-950/60 hover:bg-rose-900/60 text-rose-200 rounded-sm border border-rose-800 transition-colors"
              >
                Desconectar
              </button>
            )}
          </div>
        </div>

        {/* Discord */}
        <div className="border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-3 rounded-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-zinc-200 flex items-center gap-1.5">
              <Bot size={13} className="text-zinc-400" />
              Discord Companion Bot
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-none ${
                discordStatus === 'connected'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : discordStatus === 'connecting'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {discordStatus.toUpperCase()}
            </span>
          </div>

          <div>
            <label className="text-[10px] font-mono text-zinc-400 block mb-1">Bot Token:</label>
            <input
              type="password"
              value={discordToken}
              onChange={(e) => setField('discordToken', e.target.value)}
              placeholder="Pega aquí el Token de tu Bot de Discord..."
              className="w-full px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={discordAutoReply}
              onChange={(event) => {
                setField('discordAutoReply', event.target.checked);
                saveDiscordReplyOptions({ autoReply: event.target.checked });
              }}
              className="mt-0.5 accent-emerald-500 rounded"
            />
            <span>
              Respuesta automática en canales permitidos
              <span className="block mt-0.5 text-[10px] text-zinc-500">
                Cristi usa una solicitud Gemini separada; no publica la siguiente respuesta de tu llamada Live.
              </span>
            </span>
          </label>

          <div>
            <label className="text-[10px] font-mono text-zinc-400 block mb-1">
              IDs de canales de texto permitidos (separados por coma):
            </label>
            <input
              type="text"
              value={discordMonitoredChannels}
              onChange={(event) => setField('discordMonitoredChannels', event.target.value)}
              onBlur={() => saveDiscordReplyOptions()}
              placeholder="123456789012345678, 987654321098765432"
              className="w-full px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Con la lista vacía, el bot puede leer mensajes pero no responde automáticamente.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/60">
            <div>
              <label className="text-[10px] font-mono text-zinc-400 flex items-center gap-1 mb-1">
                <Volume2 size={11} /> Canal de Voz (ID):
              </label>
              <input
                type="text"
                value={discordVoiceChannel}
                onChange={(e) => setField('discordVoiceChannel', e.target.value)}
                onBlur={() => saveDiscordReplyOptions({ voiceChannel: discordVoiceChannel })}
                placeholder="ID de canal de voz..."
                className="w-full px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-zinc-400 flex items-center gap-1 mb-1">
                <Activity size={11} /> Estado de Actividad:
              </label>
              <input
                type="text"
                value={discordActivityStatus}
                onChange={(e) => setField('discordActivityStatus', e.target.value)}
                onBlur={() => saveDiscordReplyOptions({ activityStatus: discordActivityStatus })}
                placeholder="Mensaje de estado..."
                className="w-full px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={async () => {
                soundFxService.playClick();
                setDiscordStatus('connecting');
                try {
                  await (discordCompanion as any).connect(discordToken);
                  setDiscordStatus((discordCompanion as any).status);
                  toastService.success('Discord', 'Conectando bot de Cristi a Discord...');
                } catch (err: any) {
                  setDiscordStatus('disconnected');
                  toastService.error('Discord', err?.message || 'Error al conectar bot de Discord.');
                }
              }}
              className="px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm border border-zinc-700 transition-colors"
            >
              Conectar Bot de Discord
            </button>
            {discordStatus !== 'disconnected' && (
              <button
                type="button"
                onClick={async () => {
                  soundFxService.playClick();
                  await (discordCompanion as any).disconnect();
                  setDiscordStatus((discordCompanion as any).status);
                  toastService.info('Discord', 'Bot de Discord desconectado.');
                }}
                className="px-3 py-1.5 text-xs font-mono bg-rose-950/60 hover:bg-rose-900/60 text-rose-200 rounded-sm border border-rose-800 transition-colors"
              >
                Desconectar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamesTab;
