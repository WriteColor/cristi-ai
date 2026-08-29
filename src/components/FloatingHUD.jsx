import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneCall,
  PhoneOff,
  Settings,
  Layers,
  Sparkles,
  Monitor,
  MonitorOff,
  Crosshair,
  Trash2,
  User,
  EyeOff
} from 'lucide-react';
import { getModelDisplayName } from '../config/models';

/**
 * Cristi AI - Minimalist Non-Blocking Floating Dock & Top Bar
 */
export function FloatingHUD({
  isConnected = false,
  isConnecting = false,
  isMuted = false,
  isCameraActive = false,
  isSpeaking = false,
  isListening = false,
  isScreenWatchActive = false,
  hasScreenRegion = false,
  modelId,
  voiceName = 'Aoede',
  activeToolName = null,
  isSolidBackdrop = true,
  viewMode = 'torso',
  isZenMode = false,
  isUiVisible = true,
  onToggleConnection,
  onToggleMute,
  onToggleCamera,
  onToggleBackdrop,
  onOpenSettings,
  onToggleScreenWatch,
  onOpenRegionPicker,
  onClearScreenRegion,
  onToggleViewMode,
  onToggleZenMode
}) {
  const modelShortName = getModelDisplayName(modelId);

  let statusColor = 'bg-zinc-500';
  let statusText = 'En Espera';

  if (isConnecting) {
    statusColor = 'bg-amber-400 animate-pulse';
    statusText = 'Conectando...';
  } else if (isConnected) {
    if (isSpeaking) {
      statusColor = 'bg-purple-400 shadow-[0_0_12px_#c084fc]';
      statusText = 'Cristi hablando';
    } else if (isListening) {
      statusColor = 'bg-emerald-400 shadow-[0_0_12px_#34d399]';
      statusText = 'Escuchándote';
    } else {
      statusColor = 'bg-emerald-500';
      statusText = 'En Vivo';
    }
  }

  const hiddenClass = !isUiVisible ? 'zen-ui-hidden' : '';

  return (
    <>
      {/* Top Left Minimalist Brand / Status Pill */}
      <div className={`shadcn-top-bar zen-fadeable-ui ${hiddenClass}`}>
        <div className="shadcn-status-pill">
          <span className={`status-dot ${statusColor}`} />
          <span className="font-semibold text-zinc-100 text-xs tracking-wide">CRISTI AI</span>
          <span className="text-zinc-500 text-[10px]">|</span>
          <span className="text-zinc-400 text-xs">{modelShortName}</span>
          <span className="text-zinc-500 text-[10px]">({voiceName})</span>
        </div>

        {activeToolName && (
          <div className="shadcn-tool-badge">
            <Sparkles size={11} className="text-purple-400 animate-spin" />
            <span>{activeToolName}</span>
          </div>
        )}

        {/* Screen Watch Indicator (top bar pill) */}
        {isScreenWatchActive && (
          <div className="shadcn-screen-watch-pill">
            <span className="screen-watch-dot" />
            <Monitor size={11} />
            <span>Viendo pantalla</span>
          </div>
        )}
      </div>

      {/* Bottom Floating Minimalist Control Dock */}
      <div className={`shadcn-bottom-dock-wrapper zen-fadeable-ui ${hiddenClass}`}>
        <div className="shadcn-dock">
          {/* Main Action: Start / Stop Voice Call */}
          <button
            className={`shadcn-call-btn ${isConnected ? 'active' : ''}`}
            onClick={onToggleConnection}
            disabled={isConnecting}
            title={isConnected ? 'Terminar Llamada en Vivo' : 'Iniciar Conversación de Voz'}
          >
            {isConnected ? (
              <>
                <PhoneOff size={15} />
                <span>Colgar</span>
              </>
            ) : isConnecting ? (
              <>
                <div className="shadcn-spinner-mini" />
                <span>Conectando...</span>
              </>
            ) : (
              <>
                <PhoneCall size={15} />
                <span>Hablar en Vivo</span>
              </>
            )}
          </button>

          <div className="shadcn-divider" />

          {/* Mute Toggle */}
          <button
            className={`shadcn-icon-btn ${isMuted ? 'text-rose-400 bg-rose-950/30' : ''}`}
            onClick={onToggleMute}
            disabled={!isConnected}
            title={isMuted ? 'Activar Micrófono' : 'Silenciar Micrófono'}
          >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          {/* Camera Sensor Toggle */}
          <button
            className={`shadcn-icon-btn ${isCameraActive ? 'active' : ''}`}
            onClick={onToggleCamera}
            title={isCameraActive ? 'Desactivar Cámara' : 'Activar Visión por Cámara'}
          >
            {isCameraActive ? <Video size={16} /> : <VideoOff size={16} />}
          </button>

          {/* Screen Watch Toggle */}
          <button
            className={`shadcn-icon-btn ${isScreenWatchActive ? 'active screen-watch-active' : ''}`}
            onClick={onToggleScreenWatch}
            title={isScreenWatchActive ? 'Desactivar Vigilancia de Pantalla' : 'Activar Vigilancia de Pantalla (Cristi ve tu escritorio)'}
          >
            {isScreenWatchActive ? <Monitor size={16} /> : <MonitorOff size={16} />}
          </button>

          {/* Region Picker */}
          <button
            className={`shadcn-icon-btn ${hasScreenRegion ? 'active' : ''}`}
            onClick={onOpenRegionPicker}
            title="Definir Área de Visión de Cristi (arrastra para seleccionar)"
          >
            <Crosshair size={16} />
          </button>

          {/* Clear Region Button (only shown when region is set) */}
          {hasScreenRegion && (
            <button
              className="shadcn-icon-btn text-rose-400"
              onClick={onClearScreenRegion}
              title="Limpiar región de visión (pantalla completa)"
            >
              <Trash2 size={14} />
            </button>
          )}

          <div className="shadcn-divider" />

          {/* Torso vs Full body view framing toggle */}
          <button
            className={`shadcn-icon-btn ${viewMode === 'torso' ? 'active' : ''}`}
            onClick={onToggleViewMode}
            title={viewMode === 'torso' ? 'Modo Busto Activo (Clic para ver cuerpo completo)' : 'Modo Cuerpo Completo (Clic para encuadrar torso)'}
          >
            <User size={16} />
          </button>

          {/* Transparent Backdrop (VTuber mode) Toggle */}
          <button
            className={`shadcn-icon-btn ${!isSolidBackdrop ? 'active' : ''}`}
            onClick={onToggleBackdrop}
            title={isSolidBackdrop ? 'Fondo Transparente (Modo VTuber)' : 'Fondo Oscuro'}
          >
            <Layers size={16} />
          </button>

          {/* Zen Mode / Hide UI Toggle */}
          <button
            className="shadcn-icon-btn"
            onClick={onToggleZenMode}
            title="Modo Zen: Ocultar controles (Presiona tecla 'H' para alternar)"
          >
            <EyeOff size={16} />
          </button>

          {/* Settings Modal Toggle */}
          <button
            className="shadcn-icon-btn"
            onClick={onOpenSettings}
            title="Ajustes (Modelo, Voces, API Key)"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
