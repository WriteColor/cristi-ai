import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneCall,
  PhoneOff,
  Settings,
  Sparkles,
  Monitor,
  MonitorOff,
  Crosshair,
  Trash2,
  User,
  Maximize2,
  Frame,
  Activity
} from 'lucide-react';
import { useClickThrough } from '../hooks/useClickThrough.js';
import { soundFxService } from '../services/soundFxService.js';
import { clickThroughService } from '../services/desktop/ClickThroughService.js';

/**
 * Cristi AI - Barra de Herramientas Flotante (Floating HUD)
 * 100% Tailwind CSS Architecture - Estilo Shadcn Gris Minimalista
 * Bordes finos, esquinas puntiagudas (rounded-sm), paleta dark zinc y estados hover limpios.
 */
export function FloatingHUD({
  isConnected = false,
  isConnecting = false,
  isMuted = false,
  isCameraActive = false,
  isSolidBackdrop = false,
  modelId = null,
  voiceName = null,
  isSpeaking = false,
  isListening = false,
  activeToolName = null,
  onToggleConnection,
  onToggleMute,
  onToggleCamera,
  onToggleBackdrop,
  onOpenSettings,
  isScreenWatchActive = false,
  hasScreenRegion = false,
  onToggleScreenWatch,
  onOpenRegionPicker,
  onClearScreenRegion,
  viewMode = 'torso',
  onToggleViewMode,
  isZenMode = false,
  onToggleZenMode,
  isUiVisible = true,
  onWakeUi,
  onTogglePerformanceHUD
}) {
  const dockRef = useRef(null);
  const [isIdleFade, setIsIdleFade] = useState(false);
  const [, setIsHovered] = useState(false);

  const { interactiveProps } = useClickThrough();

  // Detector de inactividad para atenuación suave (Zen / Idle) con aceleración sin bloqueo
  useEffect(() => {
    let timer = null;
    let lastReset = 0;
    const resetTimer = () => {
      const now = Date.now();
      if (now - lastReset < 500) return; // Limitar a máximo 2 eventos por segundo
      lastReset = now;
      setIsIdleFade(false);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setIsIdleFade(true);
      }, 6000);
    };

    window.addEventListener('mousemove', resetTimer, { passive: true });
    window.addEventListener('keydown', resetTimer, { passive: true });
    resetTimer();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, []);

  // Sincronizar hitbox interactivo del Dock de herramientas con Electron Main
  useEffect(() => {
    if (dockRef.current && isUiVisible && !isZenMode) {
      const rect = dockRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        clickThroughService.registerHitbox('hud', {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
      }
    } else {
      clickThroughService.unregisterHitbox('hud');
    }
  }, [isUiVisible, isZenMode]);

  if (!isUiVisible || isZenMode) return null;

  const handleConnectionClick = () => {
    soundFxService.playClick();
    if (isConnected) {
      soundFxService.playDisconnect();
    } else {
      soundFxService.playConnect();
    }
    onToggleConnection?.();
  };

  const handleMuteClick = () => {
    soundFxService.playMuteToggle(!isMuted);
    onToggleMute?.();
  };

  const handleCameraClick = () => {
    soundFxService.playClick();
    onToggleCamera?.();
  };

  const handleScreenWatchClick = () => {
    soundFxService.playClick();
    onToggleScreenWatch?.();
  };

  const handleSettingsClick = () => {
    soundFxService.playMenuOpen();
    onOpenSettings?.();
  };

  return (
    <>
      {/* Indicador superior de visión de pantalla activa (sin badges de acción/pensamiento) */}
      {isScreenWatchActive && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-sm bg-zinc-950/90 backdrop-blur-md border border-zinc-800 text-zinc-300 font-mono text-xs shadow-xl z-[99] transition-opacity duration-300 ${
            isIdleFade ? 'opacity-40 hover:opacity-100' : 'opacity-100'
          }`}
          {...interactiveProps}
        >
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-300 text-[11px] rounded-sm">
            <span className="w-1.5 h-1.5 rounded-none bg-emerald-400" />
            <Monitor size={11} />
            <span>VISIÓN_ACTIVA</span>
          </div>
        </div>
      )}

      {/* Barra de Herramientas Principal Flotante (Dock) */}
      <div
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-[99] select-none transition-opacity duration-300 ${
          isIdleFade ? 'opacity-40 hover:opacity-100 hud-idle-faded' : 'opacity-100'
        }`}
        {...interactiveProps}
        onMouseEnter={(e) => {
          setIsHovered(true);
          setIsIdleFade(false);
          onWakeUi?.();
          interactiveProps.onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          setIsHovered(false);
          interactiveProps.onMouseLeave?.(e);
        }}
      >
        <div
          ref={dockRef}
          className="flex items-center gap-1 px-2 py-1.5 rounded-sm bg-zinc-950/95 backdrop-blur-md border border-zinc-800 shadow-2xl font-mono text-xs"
        >
          {/* Botón Maestro: Conectar / Hablar con Gemini Live */}
          <button
            type="button"
            onClick={handleConnectionClick}
            disabled={isConnecting}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-sm border transition-colors ${
              isConnected
                ? 'bg-zinc-800 text-emerald-300 border-emerald-700/60 hover:bg-zinc-700'
                : isConnecting
                ? 'bg-zinc-900 text-amber-300 border-zinc-700'
                : 'bg-zinc-100 text-zinc-950 border-zinc-300 hover:bg-white'
            }`}
            title={isConnected ? 'Desconectar llamada en vivo' : 'Iniciar llamada con Cristi en vivo'}
          >
            {isConnected ? (
              <>
                <PhoneOff size={13} />
                <span>DESCONECTAR</span>
              </>
            ) : isConnecting ? (
              <>
                <div className="w-2.5 h-2.5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                <span>ENLAZANDO...</span>
              </>
            ) : (
              <>
                <PhoneCall size={13} />
                <span>HABLAR EN VIVO</span>
              </>
            )}
          </button>

          <div className="w-px h-5 bg-zinc-800 mx-1" />

          {/* Micrófono / Silenciar */}
          <button
            type="button"
            onClick={handleMuteClick}
            className={`p-1.5 rounded-sm border transition-colors ${
              isMuted
                ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title={isMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
          >
            {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
          </button>

          {/* Visión por Cámara */}
          <button
            type="button"
            onClick={handleCameraClick}
            className={`p-1.5 rounded-sm border transition-colors ${
              isCameraActive
                ? 'bg-zinc-800 text-white border-zinc-600'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title={isCameraActive ? 'Desactivar cámara' : 'Activar visión por cámara web'}
          >
            {isCameraActive ? <Video size={13} /> : <VideoOff size={13} />}
          </button>

          {/* Visión de Pantalla Completa (Mutuamente Exclusiva con Región) */}
          <button
            type="button"
            onClick={handleScreenWatchClick}
            className={`p-1.5 rounded-sm border transition-colors ${
              isScreenWatchActive && !hasScreenRegion
                ? 'bg-zinc-800 text-white border-zinc-600'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title={isScreenWatchActive && !hasScreenRegion ? 'Detener transmisión de pantalla completa' : 'Transmitir pantalla completa a Cristi'}
          >
            {isScreenWatchActive && !hasScreenRegion ? <Monitor size={13} /> : <MonitorOff size={13} />}
          </button>

          {/* Recorte de Región de Pantalla (Mutuamente Exclusiva con Pantalla Completa) */}
          <button
            type="button"
            onClick={() => {
              soundFxService.playClick();
              onOpenRegionPicker?.();
            }}
            className={`p-1.5 rounded-sm border transition-colors ${
              hasScreenRegion
                ? 'bg-zinc-800 text-white border-zinc-600'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title={hasScreenRegion ? 'Región recortada activa (clic para redefinir)' : 'Seleccionar región específica de la pantalla'}
          >
            <Crosshair size={13} />
          </button>

          {hasScreenRegion && (
            <button
              type="button"
              onClick={() => {
                soundFxService.playClick();
                onClearScreenRegion?.();
              }}
              className="p-1.5 rounded-sm border bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-800 transition-colors"
              title="Limpiar región y detener visión"
            >
              <Trash2 size={13} />
            </button>
          )}

          <div className="w-px h-5 bg-zinc-800 mx-1" />

          {/* Encuadre de Vista (Torso / Completo) */}
          <button
            type="button"
            onClick={() => {
              soundFxService.playClick();
              onToggleViewMode?.();
            }}
            className="p-1.5 rounded-sm border bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            title={`Encuadre: ${viewMode === 'torso' ? 'Torso' : 'Completo'}`}
          >
            {viewMode === 'torso' ? <User size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Fondo Solido / Transparente */}
          <button
            type="button"
            onClick={onToggleBackdrop}
            className={`p-1.5 rounded-sm border transition-colors ${
              isSolidBackdrop
                ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title={isSolidBackdrop ? 'Fondo de escena activo (Click para modo transparente)' : 'Fondo transparente activo (Click para mostrar escena)'}
          >
            <Frame size={13} />
          </button>

          {/* Telemetría & FPS (F3) */}
          <button
            type="button"
            onClick={() => {
              soundFxService.playClick();
              onTogglePerformanceHUD?.();
            }}
            className="p-1.5 rounded-sm border bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            title="Telemetría y Rendimiento (F3)"
          >
            <Activity size={13} />
          </button>

          {/* Panel de Ajustes */}
          <button
            type="button"
            onClick={handleSettingsClick}
            className="p-1.5 rounded-sm border bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            title="Abrir Panel de Configuración"
          >
            <Settings size={13} />
          </button>
        </div>
      </div>
    </>
  );
}

export default React.memo(FloatingHUD);
