import React, { useEffect } from 'react';
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
      className="custom-context-menu"
      style={{
        left: Math.min(position.x, window.innerWidth - 240),
        top: Math.min(position.y, window.innerHeight - 380)
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
