import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Settings,
  Camera,
  Layers,
  Minimize2,
  X,
  Pin,
  Sparkles,
  User,
  EyeOff,
  Eye,
  Inbox
} from 'lucide-react';

/**
 * Cristi AI - Right-Click Desktop Context Menu
 * Provides native frameless window management and quick companion toggles.
 * Features smart edge-awareness (flips to left side if avatar is near the right edge).
 */
export function ContextMenu({
  position,
  isOpen,
  onClose,
  onOpenSettings,
  onToggleCamera,
  isCameraActive,
  onToggleBackdrop,
  isSolidBackdrop,
  onTriggerRandomGesture,
  onToggleAlwaysOnTop,
  isAlwaysOnTop,
  viewMode = 'torso',
  onToggleViewMode,
  isZenMode = false,
  onToggleZenMode,
  onMinimizeToTray
}) {
  const menuRef = useRef(null);
  const [coords, setCoords] = useState({
    left: position?.x || 100,
    top: position?.y || 100,
    placement: 'right'
  });

  useLayoutEffect(() => {
    if (!isOpen) return;

    const el = menuRef.current;
    const menuW = el?.offsetWidth || 230;
    const menuH = el?.offsetHeight || 380;
    const MARGIN = 14;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const posX = position?.x ?? (vw / 2);
    const posY = position?.y ?? (vh / 2);
    const bounds = position?.modelBounds;

    // Edge Detection: Check if model or cursor is near right edge
    const isNearRightEdge = bounds
      ? (bounds.x + bounds.width + menuW + MARGIN > vw || posX + menuW + MARGIN > vw)
      : (posX + menuW + MARGIN > vw);

    let finalLeft;
    let placement = 'right';

    if (isNearRightEdge) {
      placement = 'left';
      finalLeft = bounds ? (bounds.x - menuW - 8) : (posX - menuW - 8);
    } else {
      placement = 'right';
      finalLeft = bounds ? (bounds.x + bounds.width + 8) : (posX + 8);
    }

    // Safety clamp within viewport margins
    finalLeft = Math.max(MARGIN, Math.min(finalLeft, vw - menuW - MARGIN));

    // Vertical positioning with overflow protection
    let finalTop = posY - 16;
    if (finalTop + menuH + MARGIN > vh) {
      finalTop = Math.max(MARGIN, vh - menuH - MARGIN);
    }
    if (finalTop < MARGIN) {
      finalTop = MARGIN;
    }

    setCoords({ left: finalLeft, top: finalTop, placement });
  }, [isOpen, position]);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (isOpen && !e.target.closest('.custom-context-menu')) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCloseApp = () => {
    onClose();
    if (window.Neutralino?.app) {
      window.Neutralino.app.exit();
    } else {
      window.close();
    }
  };

  return (
    <div
      ref={menuRef}
      className={`custom-context-menu placement-${coords.placement}`}
      style={{
        left: `${coords.left}px`,
        top: `${coords.top}px`
      }}
    >
      <div className="context-menu-header">Cristi AI Companion</div>

      {/* Settings */}
      <button
        className="context-menu-item"
        onClick={() => {
          onOpenSettings();
          onClose();
        }}
      >
        <Settings size={15} />
        <span>Ajustes y Voces</span>
      </button>

      {/* Torso vs Full body framing */}
      <button
        className="context-menu-item"
        onClick={() => {
          if (onToggleViewMode) onToggleViewMode();
          onClose();
        }}
      >
        <User size={15} />
        <span>{viewMode === 'torso' ? 'Ver Cuerpo Completo' : 'Modo Torso (Busto)'}</span>
      </button>

      {/* Zen UI auto-hide toggle */}
      <button
        className="context-menu-item"
        onClick={() => {
          if (onToggleZenMode) onToggleZenMode();
          onClose();
        }}
      >
        {isZenMode ? <Eye size={15} /> : <EyeOff size={15} />}
        <span>{isZenMode ? 'Mostrar Interfaz Completa' : 'Ocultar UI (Modo Zen)'}</span>
      </button>

      {/* Camera Sensor */}
      <button
        className="context-menu-item"
        onClick={() => {
          onToggleCamera();
          onClose();
        }}
      >
        <Camera size={15} />
        <span>{isCameraActive ? 'Ocultar Cámara' : 'Activar Visión por Cámara'}</span>
      </button>

      {/* Transparent vs Solid backdrop */}
      <button
        className="context-menu-item"
        onClick={() => {
          onToggleBackdrop();
          onClose();
        }}
      >
        <Layers size={15} />
        <span>{isSolidBackdrop ? 'Modo Transparente (VTuber)' : 'Modo Fondo Sólido'}</span>
      </button>

      {/* Always on top pin */}
      <button
        className="context-menu-item"
        onClick={() => {
          onToggleAlwaysOnTop();
          onClose();
        }}
      >
        <Pin size={15} />
        <span>{isAlwaysOnTop ? 'Desfijar de Pantalla' : 'Fijar Siempre Visible'}</span>
      </button>

      {/* Random gesture */}
      <button
        className="context-menu-item"
        onClick={() => {
          onTriggerRandomGesture();
          onClose();
        }}
      >
        <Sparkles size={15} />
        <span>Probar Gesto de Avatar</span>
      </button>

      <div className="context-menu-divider" />

      {/* Minimize to Tray */}
      <button
        className="context-menu-item"
        onClick={() => {
          if (onMinimizeToTray) onMinimizeToTray();
          onClose();
        }}
      >
        <Inbox size={15} />
        <span>Minimizar al System Tray</span>
      </button>

      {/* Close app */}
      <button className="context-menu-item danger" onClick={handleCloseApp}>
        <X size={15} />
        <span>Cerrar Cristi AI</span>
      </button>
    </div>
  );
}
