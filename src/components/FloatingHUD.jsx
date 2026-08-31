import React, { useEffect, useRef, useState } from 'react';
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
import { getModelDisplayName } from '../config/models.js';
import { useClickThrough } from '../hooks/useClickThrough.js';
import { soundFxService } from '../services/soundFxService.js';

/**
 * Cristi AI - Cyberpunk Tactical HUD Dock & Status Bar
 * Square/chamfered sharp corners, micro-crosshairs, hairline dotted frames.
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
  const topBarRef = useRef(null);
  const dockRef = useRef(null);
  const [isIdleFade, setIsIdleFade] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { interactiveProps } = useClickThrough();

  // Auto-idle Zen Mode: Softly fade HUD after 4.0s of inactivity
  useEffect(() => {
    let idleTimer = null;

    const resetIdle = () => {
      setIsIdleFade(false);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!isHovered && !isConnecting && !isSpeaking) {
          setIsIdleFade(true);
        }
      }, 4000);
    };

    window.addEventListener('mousemove', resetIdle, { passive: true });
    window.addEventListener('pointermove', resetIdle, { passive: true });
    resetIdle();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('pointermove', resetIdle);
    };
  }, [isHovered, isConnecting, isSpeaking]);


  const modelShortName = getModelDisplayName(modelId);

  let statusClass = 'hud-status-standby';
  if (isConnecting) {
    statusClass = 'hud-status-connecting';
  } else if (isConnected) {
    if (isSpeaking) {
      statusClass = 'hud-status-speaking';
    } else if (isListening) {
      statusClass = 'hud-status-listening';
    } else {
      statusClass = 'hud-status-live';
    }
  }

  const hiddenClass = !isUiVisible ? 'zen-ui-hidden' : isIdleFade ? 'hud-idle-faded' : '';

  const handleConnectionClick = () => {
    if (isConnected) {
      soundFxService.playDisconnect();
    } else {
      soundFxService.playConnect();
    }
    onToggleConnection();
  };

  const handleMuteClick = () => {
    soundFxService.playMuteToggle(!isMuted);
    onToggleMute();
  };

  const handleGenericClick = (callback) => {
    soundFxService.playClick();
    callback?.();
  };

  return (
    <>
      {/* Top Left Floating Dynamic Badges (Only shown when tool or screen watch is active) */}
      {(activeToolName || isScreenWatchActive) && (
        <div
          ref={topBarRef}
          className={`hud-top-bar zen-fadeable-ui ${hiddenClass}`}
          {...interactiveProps}
          onMouseEnter={(e) => {
            setIsHovered(true);
            setIsIdleFade(false);
            interactiveProps.onMouseEnter?.(e);
          }}
          onMouseLeave={(e) => {
            setIsHovered(false);
            interactiveProps.onMouseLeave?.(e);
          }}
        >
          {activeToolName && (
            <div className="hud-tool-badge">
              <span className="hud-corner hud-corner-tl" />
              <span className="hud-corner hud-corner-br" />
              <Sparkles size={11} className="hud-spin-icon" />
              <span>{activeToolName}</span>
            </div>
          )}

          {/* Screen Watch Indicator */}
          {isScreenWatchActive && (
            <div className="hud-screen-watch-badge">
              <span className="hud-corner hud-corner-tl" />
              <span className="hud-corner hud-corner-br" />
              <span className="hud-screen-watch-dot" />
              <Monitor size={11} />
              <span>VISION_DESKTOP</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom Floating Tactical Control Dock */}
      <div
        className={`hud-bottom-dock-wrapper zen-fadeable-ui ${hiddenClass}`}
        {...interactiveProps}
        onMouseEnter={(e) => {
          setIsHovered(true);
          setIsIdleFade(false);
          interactiveProps.onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          setIsHovered(false);
          interactiveProps.onMouseLeave?.(e);
        }}
      >
        <div ref={dockRef} className="hud-dock">
          <span className="hud-corner hud-corner-tl" />
          <span className="hud-corner hud-corner-tr" />
          <span className="hud-corner hud-corner-bl" />
          <span className="hud-corner hud-corner-br" />

          {/* Main Action: Start / Stop Voice Call */}
          <button
            type="button"
            className={`hud-call-btn ${isConnected ? 'active' : ''} ${isConnecting ? 'connecting' : ''}`}
            onClick={handleConnectionClick}
            disabled={isConnecting}
            title={isConnected ? 'Terminar Enlace de Voz' : 'Iniciar Enlace Neuronal en Vivo'}
          >
            <span className="hud-corner hud-corner-tl" />
            <span className="hud-corner hud-corner-br" />
            {isConnected ? (
              <>
                <PhoneOff size={15} />
                <span>DESCONECTAR</span>
              </>
            ) : isConnecting ? (
              <>
                <div className="hud-spinner-mini" />
                <span>ENLAZANDO...</span>
              </>
            ) : (
              <>
                <PhoneCall size={15} />
                <span>HABLAR EN VIVO</span>
              </>
            )}
          </button>

          <div className="hud-dock-divider" />

          {/* Mute Toggle */}
          <button
            type="button"
            className={`hud-icon-btn ${isMuted ? 'muted' : ''}`}
            onClick={handleMuteClick}
            disabled={!isConnected}
            title={isMuted ? 'Activar Micrófono' : 'Silenciar Micrófono'}
          >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          {/* Camera Sensor Toggle */}
          <button
            type="button"
            className={`hud-icon-btn ${isCameraActive ? 'active' : ''}`}
            onClick={() => handleGenericClick(onToggleCamera)}
            title={isCameraActive ? 'Desactivar Sensor Cámara' : 'Activar Visión por Cámara'}
          >
            {isCameraActive ? <Video size={16} /> : <VideoOff size={16} />}
          </button>

          {/* Screen Watch Toggle */}
          <button
            type="button"
            className={`hud-icon-btn ${isScreenWatchActive ? 'active screen-watch' : ''}`}
            onClick={() => handleGenericClick(onToggleScreenWatch)}
            title={isScreenWatchActive ? 'Desactivar Vigilancia de Pantalla' : 'Activar Vigilancia de Pantalla (Cristi ve tu escritorio)'}
          >
            {isScreenWatchActive ? <Monitor size={16} /> : <MonitorOff size={16} />}
          </button>

          {/* Region Picker */}
          <button
            type="button"
            className={`hud-icon-btn ${hasScreenRegion ? 'active' : ''}`}
            onClick={() => handleGenericClick(onOpenRegionPicker)}
            title="Definir Región de Visión (arrastra para seleccionar)"
          >
            <Crosshair size={16} />
          </button>

          {/* Clear Region Button */}
          {hasScreenRegion && (
            <button
              type="button"
              className="hud-icon-btn danger"
              onClick={() => handleGenericClick(onClearScreenRegion)}
              title="Restablecer a Pantalla Completa"
            >
              <Trash2 size={14} />
            </button>
          )}

          <div className="hud-dock-divider" />

          {/* Torso vs Full body framing */}
          <button
            type="button"
            className={`hud-icon-btn ${viewMode === 'torso' ? 'active' : ''}`}
            onClick={() => handleGenericClick(onToggleViewMode)}
            title={viewMode === 'torso' ? 'Modo Busto Activo (Clic para ver cuerpo completo)' : 'Modo Cuerpo Completo (Clic para encuadrar torso)'}
          >
            <User size={16} />
          </button>

          {/* Transparent Backdrop (VTuber mode) Toggle */}
          <button
            type="button"
            className={`hud-icon-btn ${!isSolidBackdrop ? 'active' : ''}`}
            onClick={() => handleGenericClick(onToggleBackdrop)}
            title={isSolidBackdrop ? 'Fondo Transparente (Modo VTuber)' : 'Fondo Sólido'}
          >
            <Layers size={16} />
          </button>

          {/* Zen Mode / Hide UI Toggle */}
          <button
            type="button"
            className="hud-icon-btn"
            onClick={() => handleGenericClick(onToggleZenMode)}
            title="Modo Zen: Ocultar controles (Presiona tecla 'H' para alternar)"
          >
            <EyeOff size={16} />
          </button>

          {/* Settings Modal Toggle */}
          <button
            type="button"
            className="hud-icon-btn"
            onClick={() => handleGenericClick(onOpenSettings)}
            title="Ajustes (Modelo, Voces, API Key)"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

export default FloatingHUD;

