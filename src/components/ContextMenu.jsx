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
  Inbox,
  Smile,
  Heart,
  Zap,
  Activity,
  Volume2,
  Tv,
  Monitor
} from 'lucide-react';
import { live2dModelRegistry } from '../services/live2d';

/**
 * Cristi AI - Modern Obsidian Right-Click Desktop Context Menu
 * Intuitive, ultra-responsive, and packed with quick companion gestures,
 * model shortcuts, camera vision toggles, and window management.
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
  onMinimizeToTray,
  activeModelId = 'yanderegirl'
}) {
  const menuRef = useRef(null);
  const [coords, setCoords] = useState({
    left: position?.x || 100,
    top: position?.y || 100,
    placement: 'right'
  });

  const activeModel = live2dModelRegistry.getModel(activeModelId);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const el = menuRef.current;
    const menuW = el?.offsetWidth || 260;
    const menuH = el?.offsetHeight || 440;
    const MARGIN = 16;

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
      finalLeft = bounds ? (bounds.x - menuW - 10) : (posX - menuW - 10);
    } else {
      placement = 'right';
      finalLeft = bounds ? (bounds.x + bounds.width + 10) : (posX + 10);
    }

    // Safety clamp within viewport margins
    finalLeft = Math.max(MARGIN, Math.min(finalLeft, vw - menuW - MARGIN));

    // Vertical positioning with overflow protection
    let finalTop = posY - 20;
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

  const handleTriggerExpression = (exprName) => {
    if (window.__cristiAvatar?.setEmotion) {
      window.__cristiAvatar.setEmotion(exprName);
    } else if (onTriggerRandomGesture) {
      onTriggerRandomGesture();
    }
    onClose();
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
      {/* Header with Active Model Info */}
      <div className="context-menu-header-box">
        <div className="context-menu-header-title">Cristi AI Companion</div>
        {activeModel && (
          <div className="context-menu-header-badge">
            <Sparkles size={10} /> {activeModel.name}
          </div>
        )}
      </div>

      {/* Quick Emotions & Gesture Strip */}
      <div className="context-menu-section-label">Expresiones Rápidas</div>
      <div className="context-menu-emotions-strip">
        <button
          type="button"
          className="context-emotion-btn"
          title="Sonrojo"
          onClick={() => handleTriggerExpression('blush')}
        >
          ❤️
        </button>
        <button
          type="button"
          className="context-emotion-btn"
          title="Feliz"
          onClick={() => handleTriggerExpression('happy')}
        >
          🌸
        </button>
        <button
          type="button"
          className="context-emotion-btn"
          title="Sorpresa"
          onClick={() => handleTriggerExpression('surprised')}
        >
          ⚡
        </button>
        <button
          type="button"
          className="context-emotion-btn"
          title="Guiño"
          onClick={() => handleTriggerExpression('wink')}
        >
          😉
        </button>
        <button
          type="button"
          className="context-emotion-btn"
          title="Bailar"
          onClick={() => handleTriggerExpression('dance')}
        >
          💃
        </button>
        <button
          type="button"
          className="context-emotion-btn"
          title="Yandere / Intensa"
          onClick={() => handleTriggerExpression('yandere')}
        >
          🖤
        </button>
      </div>

      <div className="context-menu-divider" />

      {/* Primary Actions */}
      <button
        className="context-menu-item"
        onClick={() => {
          onOpenSettings();
          onClose();
        }}
      >
        <Settings size={15} />
        <div className="context-item-info">
          <span>Ajustes & Avatares Live2D</span>
          <span className="context-item-hint">8 modelos, 30 voces, API</span>
        </div>
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
        <div className="context-item-info">
          <span>{viewMode === 'torso' ? 'Ver Cuerpo Completo' : 'Modo Torso (Busto)'}</span>
          <span className="context-item-hint">{viewMode === 'torso' ? 'Encuadre 100%' : 'Encuadre 40%'}</span>
        </div>
      </button>

      {/* Camera Sensor & Vision AI */}
      <button
        className="context-menu-item"
        onClick={() => {
          onToggleCamera();
          onClose();
        }}
      >
        <Camera size={15} />
        <div className="context-item-info">
          <span>{isCameraActive ? 'Desactivar Cámara' : 'Activar Visión por Cámara'}</span>
          <span className="context-item-hint">{isCameraActive ? 'Sensor encendido' : 'Face-API + YOLO'}</span>
        </div>
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
        <div className="context-item-info">
          <span>{isZenMode ? 'Mostrar Controles (HUD)' : 'Ocultar Controles (Modo Zen)'}</span>
          <span className="context-item-hint">{isZenMode ? 'HUD visible' : 'Avatar puro'}</span>
        </div>
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
        <div className="context-item-info">
          <span>{isSolidBackdrop ? 'Modo Transparente (VTuber)' : 'Modo Fondo Sólido'}</span>
          <span className="context-item-hint">{isSolidBackdrop ? 'Fondo transparente' : 'Obsidian dark'}</span>
        </div>
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
        <div className="context-item-info">
          <span>{isAlwaysOnTop ? 'Desfijar de Pantalla' : 'Fijar Siempre Visible (Top)'}</span>
          <span className="context-item-hint">{isAlwaysOnTop ? 'Capa normal' : 'Always on Top'}</span>
        </div>
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
        <div className="context-item-info">
          <span>Minimizar al System Tray</span>
          <span className="context-item-hint">Segundo plano</span>
        </div>
      </button>

      {/* Close app */}
      <button className="context-menu-item danger" onClick={handleCloseApp}>
        <X size={15} />
        <div className="context-item-info">
          <span>Cerrar Cristi AI</span>
        </div>
      </button>
    </div>
  );
}

export default ContextMenu;
