import React, { useState, useEffect } from 'react';
import {
  Music,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
  Play,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2
} from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { spotifyService } from '../../domain/integrations/spotify/SpotifyService.js';
import { soundFxService } from '../../domain/audio/SoundFxService.js';
import { toastService } from '../../infrastructure/notifications/toastService.js';

export interface SpotifyStatusData {
  isRunning: boolean;
  isPlaying: boolean;
  track: string | null;
  artist: string | null;
}

export const SpotifyTab: React.FC = () => {
  const spotifyClientId = useSettingsStore((s) => s.spotifyClientId);
  const spotifyClientSecret = useSettingsStore((s) => s.spotifyClientSecret);
  const setField = useSettingsStore((s) => s.setField);

  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyStatusData>({
    isRunning: false,
    isPlaying: false,
    track: null,
    artist: null
  });
  const [spotifyTestQuery, setSpotifyTestQuery] = useState('lofi hip hop');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshStatus = async () => {
    setIsRefreshing(true);
    try {
      const st: any = await spotifyService.getStatus();
      setSpotifyStatus({
        isRunning: Boolean(st?.isRunning),
        isPlaying: Boolean(st?.isPlaying),
        track: st?.track || null,
        artist: st?.artist || null
      });
    } catch (_) {
      // Ignorar errores transitorios
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto space-y-5 pr-1">
      <div>
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100 flex items-center gap-2">
          <Music className="text-emerald-400" size={16} /> Control de Spotify & Música
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Reproduce música para Ariel en la aplicación Spotify Desktop o a través del reproductor web con Playwright.
        </p>
      </div>

      {/* Estado en Vivo de Spotify */}
      <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-zinc-200">
            Estado de la Aplicación
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-none ${
                spotifyStatus.isRunning
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {spotifyStatus.isRunning
                ? spotifyStatus.isPlaying
                  ? 'REPRODUCIENDO'
                  : 'ACTIVO / PAUSADO'
                : 'DESKTOP CERRADO'}
            </span>
            <button
              type="button"
              onClick={() => {
                soundFxService.playClick();
                void refreshStatus();
              }}
              className={`p-1 hover:bg-zinc-800 rounded-sm text-zinc-400 hover:text-zinc-200 transition-colors ${
                isRefreshing ? 'animate-spin' : ''
              }`}
              title="Refrescar estado"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {spotifyStatus.track && (
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-sm">
            <div className="text-[11px] font-mono text-zinc-400">Pista actual:</div>
            <div className="text-xs font-bold text-emerald-400 truncate">{spotifyStatus.track}</div>
            {spotifyStatus.artist && (
              <div className="text-[11px] text-zinc-300 truncate">Artista: {spotifyStatus.artist}</div>
            )}
          </div>
        )}

        {/* Botones de Control Rápido */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button
            type="button"
            onClick={async () => {
              soundFxService.playClick();
              await spotifyService.previous();
              const st: any = await spotifyService.getStatus();
              setSpotifyStatus({
                isRunning: Boolean(st?.isRunning),
                isPlaying: Boolean(st?.isPlaying),
                track: st?.track || null,
                artist: st?.artist || null
              });
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm border border-zinc-700 transition-colors"
          >
            <SkipBack size={12} /> Anterior
          </button>
          <button
            type="button"
            onClick={async () => {
              soundFxService.playClick();
              await spotifyService.play();
              const st: any = await spotifyService.getStatus();
              setSpotifyStatus({
                isRunning: Boolean(st?.isRunning),
                isPlaying: Boolean(st?.isPlaying),
                track: st?.track || null,
                artist: st?.artist || null
              });
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-mono bg-emerald-700 hover:bg-emerald-600 text-white rounded-sm border border-emerald-600 transition-colors font-semibold"
          >
            <Play size={12} className="fill-current" /> Play / Pausa
          </button>
          <button
            type="button"
            onClick={async () => {
              soundFxService.playClick();
              await spotifyService.next();
              const st: any = await spotifyService.getStatus();
              setSpotifyStatus({
                isRunning: Boolean(st?.isRunning),
                isPlaying: Boolean(st?.isPlaying),
                track: st?.track || null,
                artist: st?.artist || null
              });
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm border border-zinc-700 transition-colors"
          >
            <SkipForward size={12} /> Siguiente
          </button>
          <button
            type="button"
            onClick={async () => {
              soundFxService.playClick();
              await spotifyService.setVolume({ direction: 'up' });
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-sm border border-zinc-700 transition-colors"
          >
            <Volume2 size={12} /> Vol +
          </button>
          <button
            type="button"
            onClick={async () => {
              soundFxService.playClick();
              await spotifyService.setVolume({ direction: 'down' });
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-sm border border-zinc-700 transition-colors"
          >
            <Volume1 size={12} /> Vol -
          </button>
        </div>
      </div>

      {/* Prueba de Búsqueda y Reproducción */}
      <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded-sm space-y-3">
        <span className="text-xs font-mono font-medium text-zinc-200 block">
          Probar Búsqueda y Reproducción
        </span>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <input
            type="text"
            value={spotifyTestQuery}
            onChange={(e) => setSpotifyTestQuery(e.target.value)}
            placeholder="Canción o playlist (ej: Lofi beats)..."
            className="flex-1 px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={async () => {
              if (!spotifyTestQuery.trim()) return;
              soundFxService.playClick();
              await (spotifyService as any).play({ query: spotifyTestQuery.trim() });
              toastService.success('Spotify', `Reproduciendo "${spotifyTestQuery.trim()}"`);
              setTimeout(() => spotifyService.getStatus().then((st: any) => setSpotifyStatus({
                isRunning: Boolean(st?.isRunning),
                isPlaying: Boolean(st?.isPlaying),
                track: st?.track || null,
                artist: st?.artist || null
              })), 1500);
            }}
            className="px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm border border-zinc-700 transition-colors whitespace-nowrap"
          >
            Reproducir en Spotify
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!spotifyTestQuery.trim()) return;
              soundFxService.playClick();
              await (spotifyService as any).play({ query: spotifyTestQuery.trim(), useWeb: true });
              toastService.success('Spotify Web', 'Abriendo en Spotify Web vía Playwright');
            }}
            className="px-3 py-1.5 text-xs font-mono bg-purple-950 hover:bg-purple-900 text-purple-200 rounded-sm border border-purple-800 transition-colors whitespace-nowrap"
          >
            Abrir Web (Playwright)
          </button>
        </div>
      </div>

      {/* Credenciales Opcionales de Spotify Developer API */}
      <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-medium text-zinc-200 block">
              Spotify Web API (Opcional - Para búsqueda avanzada con metadatos)
            </span>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Si no dispones de credenciales, Cristi controlará directamente tu aplicación de escritorio y la web automáticamente.
            </p>
          </div>
          {spotifyClientId && spotifyClientSecret ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-none shrink-0">
              <ShieldCheck size={11} /> Vinculado
            </span>
          ) : (
            <a
              href="https://developer.spotify.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200 underline flex items-center gap-1 shrink-0"
            >
              Crear App <ExternalLink size={10} />
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono text-zinc-400 block mb-1">Client ID:</label>
            <input
              type="text"
              value={spotifyClientId}
              onChange={(e) => {
                setField('spotifyClientId', e.target.value);
                spotifyService.configure({ clientId: e.target.value, clientSecret: spotifyClientSecret });
              }}
              placeholder="Tu Client ID de Spotify..."
              className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono text-zinc-400 block mb-1">Client Secret:</label>
            <input
              type="password"
              value={spotifyClientSecret}
              onChange={(e) => {
                setField('spotifyClientSecret', e.target.value);
                spotifyService.configure({ clientId: spotifyClientId, clientSecret: e.target.value });
              }}
              placeholder="Tu Client Secret..."
              className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpotifyTab;
