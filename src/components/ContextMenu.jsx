import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Settings,
  X,
  Pin,
  Sparkles,
  Smile,
  Zap,
  Volume2,
  Tv,
  Monitor,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Eye,
  Sliders,
  Image as ImageIcon
} from 'lucide-react';
import { live2dModelRegistry } from '../services/live2d/index.js';
import { GEMINI_MODELS } from '../config/models.js';
import { GEMINI_STANDARD_VOICES } from '../config/voices.js';
import { BACKGROUND_SCENES } from '../config/scenes.js';
import { sceneManager } from '../services/sceneManager.js';
import { useClickThrough } from '../hooks/useClickThrough.js';
import { electronBridge } from '../services/desktop/ElectronBridge.js';
import { soundFxService } from '../services/soundFxService.js';

export function ContextMenu({
  isOpen,
  position,
  coords,
  onClose,
  activeModelId,
  onSwitchLive2DModel,
  activeAiModelId,
  onSwitchAiModel,
  activeVoiceName,
  onSwitchVoice,
  isCameraActive,
  onToggleCamera,
  isAlwaysOnTop,
  onToggleAlwaysOnTop,
  isMuted,
  onToggleMute,
  isScreenWatchActive,
  onToggleScreenWatch,
  onOpenSettings,
  onOpenRegionPicker,
  onOpenLockSandbox,
  onOpenVoiceEnrollment,
  onOpenSpeakerHUD,
  isZenMode,
  onToggleZenMode
}) {
  const menuRef = useRef(null);
  const [activeSection, setActiveSection] = useState(null); // 'avatar' | 'scene' | 'ai' | 'tools' | 'system'
  const [activeScene, setActiveScene] = useState(sceneManager.getScene().sceneId);
  const [currentActiveExpr, setCurrentActiveExpr] = useState(null);

  const posX = coords?.x ?? position?.x ?? 60;
  const posY = coords?.y ?? position?.y ?? 60;

  const { interactiveProps } = useClickThrough();

  useEffect(() => {
    return sceneManager.onSceneChange((s) => setActiveScene(s.sceneId));
  }, []);

  // Collapse section and play sound on open
  useEffect(() => {
    if (isOpen) {
      soundFxService.playMenuOpen();
      setActiveSection(null);
    }
  }, [isOpen]);

  // Adjust menu position so it never overflows screen bounds
  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const menuEl = menuRef.current;
    const rect = menuEl.getBoundingClientRect();
    const padding = 12;

    let targetLeft = posX;
    let targetTop = posY;

    if (targetLeft + rect.width > window.innerWidth - padding) {
      targetLeft = window.innerWidth - rect.width - padding;
    }
    if (targetLeft < padding) targetLeft = padding;

    if (targetTop + rect.height > window.innerHeight - padding) {
      targetTop = window.innerHeight - rect.height - padding;
    }
    if (targetTop < padding) targetTop = padding;

    menuEl.style.left = `${Math.round(targetLeft)}px`;
    menuEl.style.top = `${Math.round(targetTop)}px`;
  }, [isOpen, posX, posY, activeSection]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        soundFxService.playClick();
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        soundFxService.playClick();
        onClose();
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleSection = (sectionKey) => {
    soundFxService.playClick();
    setActiveSection((prev) => (prev === sectionKey ? null : sectionKey));
  };

  const allLive2dModels = live2dModelRegistry.getAllModels();
  const activeModel = live2dModelRegistry.getModel(activeModelId);

  const handleExpressionClick = (expr) => {
    soundFxService.playClick();
    if (!window.__cristiAvatar) return;
    const av = window.__cristiAvatar;
    if (currentActiveExpr === expr) {
      if (av.controller?.setEmotion) av.controller.setEmotion('idle');
      else if (av.setExpression) av.setExpression('none');
      setCurrentActiveExpr(null);
    } else {
      if (av.controller?.setEmotion) av.controller.setEmotion(expr);
      else if (av.setExpression) av.setExpression(expr);
      setCurrentActiveExpr(expr);
    }
  };

  const handleCloseApp = () => {
    soundFxService.playClick();
    onClose();
    electronBridge.quitApp();
  };

  return (
    <div
      ref={menuRef}
      className="custom-context-menu-minimal"
      {...interactiveProps}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <span className="hud-corner hud-corner-tl" />
      <span className="hud-corner hud-corner-tr" />
      <span className="hud-corner hud-corner-bl" />
      <span className="hud-corner hud-corner-br" />

      {/* Ultra-Compact Tactical Header */}
      <div className="ctx-mini-header">
        <div className="ctx-mini-title">CRISTI AI</div>
        <div className="ctx-mini-badge">
          <Sparkles size={10} /> {activeModel?.badge || 'V2.0'}
        </div>
      </div>

      {/* ── 1. CATEGORÍA: AVATAR LIVE2D ──────────────────────────────────────── */}
      <div className={`ctx-mini-category ${activeSection === 'avatar' ? 'open' : ''}`}>
        <button
          type="button"
          className="ctx-mini-category-btn"
          onClick={() => toggleSection('avatar')}
        >
          <div className="ctx-mini-category-left">
            <Smile size={13} className="ctx-icon" />
            <span>Personaje</span>
          </div>
          {activeSection === 'avatar' ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {activeSection === 'avatar' && (
          <div className="ctx-mini-drawer">
            {/* Model Selector Dropdown */}
            <div className="ctx-drawer-select-row">
              <select
                className="ctx-drawer-select"
                value={activeModelId}
                onChange={(e) => {
                  soundFxService.playClick();
                  if (onSwitchLive2DModel) onSwitchLive2DModel(e.target.value);
                }}
              >
                {allLive2dModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={11} className="ctx-select-icon" />
            </div>

            {/* Quick Expressions Chips */}
            {activeModel?.expressions && activeModel.expressions.length > 0 && (
              <div className="ctx-chips-grid">
                {activeModel.expressions.slice(0, 6).map((expr) => (
                  <button
                    key={expr}
                    type="button"
                    className={`ctx-chip-btn ${currentActiveExpr === expr ? 'active' : ''}`}
                    onClick={() => handleExpressionClick(expr)}
                  >
                    {expr}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 2. CATEGORÍA: ESCENA & FONDO ─────────────────────────────────────── */}
      <div className={`ctx-mini-category ${activeSection === 'scene' ? 'open' : ''}`}>
        <button
          type="button"
          className="ctx-mini-category-btn"
          onClick={() => toggleSection('scene')}
        >
          <div className="ctx-mini-category-left">
            <ImageIcon size={13} className="ctx-icon" />
            <span>Fondo & Escena</span>
          </div>
          {activeSection === 'scene' ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {activeSection === 'scene' && (
          <div className="ctx-mini-drawer">
            <div className="ctx-drawer-select-row">
              <select
                className="ctx-drawer-select"
                value={activeScene}
                onChange={(e) => {
                  soundFxService.playClick();
                  sceneManager.setScene(e.target.value);
                  setActiveScene(e.target.value);
                }}
              >
                {BACKGROUND_SCENES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={11} className="ctx-select-icon" />
            </div>
          </div>
        )}
      </div>

      {/* ── 3. CATEGORÍA: IA & VOZ ───────────────────────────────────────────── */}
      <div className={`ctx-mini-category ${activeSection === 'ai' ? 'open' : ''}`}>
        <button
          type="button"
          className="ctx-mini-category-btn"
          onClick={() => toggleSection('ai')}
        >
          <div className="ctx-mini-category-left">
            <Zap size={13} className="ctx-icon" />
            <span>Modelo & Voz</span>
          </div>
          {activeSection === 'ai' ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {activeSection === 'ai' && (
          <div className="ctx-mini-drawer">
            <div className="ctx-drawer-select-row">
              <select
                className="ctx-drawer-select"
                value={activeAiModelId}
                onChange={(e) => {
                  soundFxService.playClick();
                  if (onSwitchAiModel) onSwitchAiModel(e.target.value);
                }}
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={11} className="ctx-select-icon" />
            </div>

            <div className="ctx-drawer-select-row" style={{ marginTop: '5px' }}>
              <select
                className="ctx-drawer-select"
                value={activeVoiceName}
                onChange={(e) => {
                  soundFxService.playClick();
                  if (onSwitchVoice) onSwitchVoice(e.target.value);
                }}
              >
                {GEMINI_STANDARD_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.tone})
                  </option>
                ))}
              </select>
              <ChevronDown size={11} className="ctx-select-icon" />
            </div>
          </div>
        )}
      </div>

      {/* ── 4. CATEGORÍA: HERRAMIENTAS TÁCTICAS ───────────────────────────────── */}
      <div className={`ctx-mini-category ${activeSection === 'tools' ? 'open' : ''}`}>
        <button
          type="button"
          className="ctx-mini-category-btn"
          onClick={() => toggleSection('tools')}
        >
          <div className="ctx-mini-category-left">
            <Sliders size={13} className="ctx-icon" />
            <span>Herramientas</span>
          </div>
          {activeSection === 'tools' ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {activeSection === 'tools' && (
          <div className="ctx-mini-drawer ctx-actions-list">
            <button
              type="button"
              className="ctx-action-item"
              onClick={() => {
                soundFxService.playClick();
                onOpenRegionPicker?.();
                onClose();
              }}
            >
              <Monitor size={12} />
              <span>Capturar Región</span>
            </button>

            <button
              type="button"
              className="ctx-action-item"
              onClick={() => {
                soundFxService.playClick();
                onOpenLockSandbox?.();
                onClose();
              }}
            >
              <ShieldCheck size={12} />
              <span>Sandbox Bloqueo</span>
            </button>

            <button
              type="button"
              className="ctx-action-item"
              onClick={() => {
                soundFxService.playClick();
                onOpenVoiceEnrollment?.();
                onClose();
              }}
            >
              <Volume2 size={12} />
              <span>Biometría Vocal</span>
            </button>

            <button
              type="button"
              className="ctx-action-item"
              onClick={() => {
                soundFxService.playClick();
                onOpenSpeakerHUD?.();
                onClose();
              }}
            >
              <Tv size={12} />
              <span>Diagnóstico Audio</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 5. CATEGORÍA: SISTEMA & ACCIONES DIRECTAS ────────────────────────── */}
      <div className="ctx-mini-footer">
        <button
          type="button"
          className="ctx-footer-action"
          onClick={() => {
            soundFxService.playClick();
            onToggleAlwaysOnTop?.();
          }}
          title="Fijar siempre visible"
        >
          <Pin size={12} className={isAlwaysOnTop ? 'text-cyan' : ''} />
          <span>{isAlwaysOnTop ? 'Fijado' : 'Flotante'}</span>
        </button>

        <button
          type="button"
          className="ctx-footer-action"
          onClick={() => {
            soundFxService.playClick();
            onOpenSettings?.();
            onClose();
          }}
          title="Abrir Ajustes"
        >
          <Settings size={12} />
          <span>Ajustes</span>
        </button>

        <button
          type="button"
          className="ctx-footer-action ctx-footer-danger"
          onClick={handleCloseApp}
          title="Salir de la aplicación"
        >
          <X size={12} />
          <span>Salir</span>
        </button>
      </div>
    </div>
  );
}

export default ContextMenu;
