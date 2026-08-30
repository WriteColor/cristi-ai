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
  Monitor,
  ChevronDown,
  Brain,
  RotateCcw,
  Play
} from 'lucide-react';
import { live2dModelRegistry } from '../services/live2d';
import { GEMINI_MODELS } from '../config/models';

/**
 * Human-friendly metadata dictionary for Live2D expressions
 */
const EXPRESSION_LABELS = {
  // Yandere Girl
  'Crazy': { label: 'Locura', icon: '🤪' },
  'Mad': { label: 'Enfadada', icon: '💢' },
  'Scared': { label: 'Asustada', icon: '😨' },
  'Yandere': { label: 'Yandere', icon: '🖤' },

  // Ellen Joe
  'black': { label: 'Sombra Oscura', icon: '😈' },
  'red': { label: 'Sonrojo', icon: '😳' },
  'shock': { label: 'Impacto / Shock', icon: '⚡' },
  'shou': { label: 'Mano en Rostro', icon: '🤦‍♀️' },
  'tang': { label: 'Paleta Dulce', icon: '🍭' },

  // Ice Girl
  '←歪嘴': { label: 'Mueca Izq', icon: '😏' },
  '歪嘴→': { label: 'Mueca Der', icon: '😏' },
  '惊诧': { label: 'Sorprendida', icon: '😲' },
  '手柄': { label: 'Modo Gamer', icon: '🎮' },
  '披发': { label: 'Cabello Suelto', icon: '💇‍♀️' },
  '星星眼': { label: 'Ojos Estrella', icon: '⭐' },
  '流泪': { label: 'Lágrimas', icon: '😭' },
  '爱心眼': { label: 'Ojos Corazón', icon: '😍' },
  '猫耳': { label: 'Orejas de Gato', icon: '🐱' },
  '王冠': { label: 'Corona', icon: '👑' },
  '生气': { label: 'Enojada', icon: '😡' },
  '疑惑': { label: 'Confundida', icon: '❓' },
  '白眼': { label: 'Mirada en Blanco', icon: '🙄' },
  '直播套装': { label: 'Modo Streaming', icon: '🎙️' },
  '翅膀': { label: 'Alas de Hada', icon: '🪽' },
  '脸红': { label: 'Sonrojo', icon: '😳' },
  '脸黑': { label: 'Sombra', icon: '😈' },
  '舌头': { label: 'Sacar Lengua', icon: '👅' },
  '金钱眼': { label: 'Ojos Dinero', icon: '🤑' },
  '马尾': { label: 'Coleta', icon: '👱‍♀️' },

  // Jane Doe
  '右手': { label: 'Mano Derecha', icon: '✋' },
  '左手': { label: 'Mano Izquierda', icon: '🤚' },
  '泪': { label: 'Lágrima', icon: '💧' },
  '血': { label: 'Marca Batalla', icon: '🩸' }
};

/**
 * Motion label overrides for named motion groups (string-based legacy format)
 */
const MOTION_GROUP_LABELS = {
  // Hiyori
  'hiyori_m01': { label: 'Idle 1',          icon: '🌸' },
  'hiyori_m02': { label: 'Idle 2',          icon: '🌸' },
  'hiyori_m03': { label: 'Giro (Flick)',    icon: '🌀' },
  'hiyori_m04': { label: 'Bajar',           icon: '👇' },
  'hiyori_m05': { label: 'Idle 3',          icon: '🌸' },
  'hiyori_m06': { label: 'Tap Cabeza',      icon: '🫳' },
  'hiyori_m07': { label: 'Tap Cuerpo',      icon: '👆' },
  'hiyori_m08': { label: 'Flick Cuerpo',    icon: '💫' },
  // Miara
  'Scene1': { label: 'Idle',                icon: '🌙' },
  'Scene2': { label: 'Reacción (Tap)',       icon: '🫳' },
  'Scene3': { label: 'Barrido (Flick)',      icon: '💫' },
  // IceGirl
  'DaiJi':   { label: 'Postura Idle',       icon: '❄️' },
  'HuiShou': { label: 'Giro de Cabeza',     icon: '🌀' },
  'MeiYan':  { label: 'Ojo Bonito',         icon: '😍' },
  // Generic
  'idle':    { label: 'Idle',               icon: '🌟' },
  'idle2':   { label: 'Idle 2',             icon: '🌟' },
};

/**
 * Format expression name into human readable label and emoji
 */
function getExpressionMeta(exprName) {
  if (EXPRESSION_LABELS[exprName]) {
    return EXPRESSION_LABELS[exprName];
  }
  return { label: exprName, icon: '✨' };
}

/**
 * Cristi AI - Modern Obsidian Right-Click Desktop Context Menu
 * Features individual Live2D expressions per active model, instant model and brain switchers.
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
  activeModelId = 'yanderegirl',
  activeAiModelId,
  onSwitchLive2DModel,
  onSwitchAiModel
}) {
  const menuRef = useRef(null);
  const [currentActiveExpr, setCurrentActiveExpr] = useState(null);
  const [coords, setCoords] = useState({
    left: position?.x || 100,
    top: position?.y || 100,
    placement: 'right'
  });

  const allLive2dModels = live2dModelRegistry.getAllModels();
  const activeModel = live2dModelRegistry.getModel(activeModelId);
  const customExpressions = activeModel?.capabilities?.customExpressions || [];
  const modelMotions = activeModel?.capabilities?.motions || [];

  const aiModelsList = Array.isArray(GEMINI_MODELS)
    ? GEMINI_MODELS
    : Object.values(GEMINI_MODELS);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const el = menuRef.current;
    const menuW = el?.offsetWidth || 280;
    const menuH = el?.offsetHeight || 500;
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
  }, [isOpen, position, activeModelId]);

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

  const handleTriggerCustomExpression = (exprName) => {
    if (window.__cristiAvatar?.setExpression) {
      if (currentActiveExpr === exprName) {
        window.__cristiAvatar.setExpression('none');
        setCurrentActiveExpr(null);
      } else {
        window.__cristiAvatar.setExpression(exprName);
        setCurrentActiveExpr(exprName);
      }
    }
  };

  const handleResetExpression = () => {
    if (window.__cristiAvatar?.setExpression) {
      window.__cristiAvatar.setExpression('none');
      setCurrentActiveExpr(null);
    }
  };

  const handleTriggerMotion = (motionEntry) => {
    if (!window.__cristiAvatar) return;
    // Support both structured format {group, index} and legacy string format
    if (typeof motionEntry === 'object' && motionEntry.group !== undefined) {
      // New structured format from profile.motions
      if (window.__cristiAvatar.setMotionByGroup) {
        window.__cristiAvatar.setMotionByGroup(motionEntry.group, motionEntry.index ?? 0);
      } else {
        window.__cristiAvatar.setMotion(motionEntry.group, motionEntry.index ?? 0);
      }
    } else {
      // Legacy string format — use as group name with index 0
      if (window.__cristiAvatar.setMotionByGroup) {
        window.__cristiAvatar.setMotionByGroup(String(motionEntry), 0);
      } else {
        window.__cristiAvatar.setMotion(String(motionEntry), 0);
      }
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
      {/* Header with Active Model Info */}
      <div className="context-menu-header-box">
        <div className="context-menu-header-title">Cristi AI Companion</div>
        {activeModel && (
          <div className="context-menu-header-badge">
            <Sparkles size={10} /> {activeModel.badge || activeModel.name}
          </div>
        )}
      </div>

      {/* QUICK SELECTOR 1: Live2D Avatar Switcher */}
      <div className="context-menu-dropdown-group">
        <label className="context-dropdown-label">
          <Smile size={12} className="context-label-icon" />
          <span>Avatar Live2D</span>
        </label>
        <div className="context-select-wrapper">
          <select
            className="context-select"
            value={activeModelId}
            onChange={(e) => {
              if (onSwitchLive2DModel) onSwitchLive2DModel(e.target.value);
            }}
          >
            {allLive2dModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.badge || m.theme})
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="context-select-arrow" />
        </div>
      </div>

      {/* QUICK SELECTOR 2: AI Brain / Cerebro Switcher */}
      <div className="context-menu-dropdown-group">
        <label className="context-dropdown-label">
          <Brain size={12} className="context-label-icon" />
          <span>Cerebro de IA (Gemini)</span>
        </label>
        <div className="context-select-wrapper">
          <select
            className="context-select"
            value={activeAiModelId}
            onChange={(e) => {
              if (onSwitchAiModel) onSwitchAiModel(e.target.value);
            }}
          >
            {aiModelsList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName || m.name}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="context-select-arrow" />
        </div>
      </div>

      <div className="context-menu-divider" />

      {/* MODEL SPECIFIC INDIVIDUAL CUSTOM EXPRESSIONS */}
      <div className="context-menu-section-row">
        <span className="context-menu-section-label">
          Expresiones de {activeModel?.character || activeModel?.name || 'Modelo'}
        </span>
        {currentActiveExpr && (
          <button
            type="button"
            className="context-expr-reset-btn"
            onClick={handleResetExpression}
            title="Restablecer a expresión normal"
          >
            <RotateCcw size={10} />
            <span>Normal</span>
          </button>
        )}
      </div>

      {customExpressions.length > 0 ? (
        <div className="context-model-expressions-grid">
          {customExpressions.map((exprName) => {
            const meta = getExpressionMeta(exprName);
            const isActive = currentActiveExpr === exprName;
            return (
              <button
                key={exprName}
                type="button"
                className={`context-model-expr-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleTriggerCustomExpression(exprName)}
                title={`Expresión: ${exprName}`}
              >
                <span className="context-expr-icon">{meta.icon}</span>
                <span className="context-expr-name">{meta.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="context-menu-empty-hint">
          <span>Este modelo utiliza expresiones faciales orgánicas automáticas.</span>
        </div>
      )}

      {/* MODEL MOTIONS (If Available) */}
      {modelMotions.length > 0 && (
        <>
          <div className="context-menu-section-label" style={{ marginTop: '6px' }}>
            Animaciones &amp; Poses
          </div>
          <div className="context-model-motions-row">
            {modelMotions.map((motionEntry, idx) => {
              // Support both structured {group, index, label, icon} and legacy string
              const isStructured = typeof motionEntry === 'object' && motionEntry.group;
              const label = isStructured
                ? motionEntry.label
                : (MOTION_GROUP_LABELS[String(motionEntry)]?.label || String(motionEntry));
              const icon = isStructured
                ? motionEntry.icon
                : (MOTION_GROUP_LABELS[String(motionEntry)]?.icon || '▶');
              return (
                <button
                  key={isStructured ? `${motionEntry.group}-${motionEntry.index}` : `${motionEntry}-${idx}`}
                  type="button"
                  className="context-motion-btn"
                  onClick={() => handleTriggerMotion(motionEntry)}
                  title={isStructured ? `${motionEntry.group}[${motionEntry.index}]` : `Motion: ${motionEntry}`}
                >
                  <span className="context-motion-icon">{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="context-menu-divider" />

      {/* Primary Actions */}
      <button
        className="context-menu-item"
        onClick={() => {
          onOpenSettings();
          onClose();
        }}
      >
        <Settings size={14} />
        <div className="context-item-info">
          <span>Ajustes Completos</span>
          <span className="context-item-hint">30 voces, API Key, personalidad</span>
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
        <User size={14} />
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
        <Camera size={14} />
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
        {isZenMode ? <Eye size={14} /> : <EyeOff size={14} />}
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
        <Layers size={14} />
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
        <Pin size={14} />
        <div className="context-item-info">
          <span>{isAlwaysOnTop ? 'Desfijar de Pantalla' : 'Fijar Siempre Visible'}</span>
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
        <Inbox size={14} />
        <div className="context-item-info">
          <span>Minimizar al System Tray</span>
          <span className="context-item-hint">Segundo plano</span>
        </div>
      </button>

      {/* Close app */}
      <button className="context-menu-item danger" onClick={handleCloseApp}>
        <X size={14} />
        <div className="context-item-info">
          <span>Cerrar Cristi AI</span>
        </div>
      </button>
    </div>
  );
}

export default ContextMenu;
