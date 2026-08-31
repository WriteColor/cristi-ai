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
  Image as ImageIcon,
  FolderPlus
} from 'lucide-react';
import { live2dModelRegistry } from '../services/live2d/index.js';
import { GEMINI_MODELS, GEMINI_MODELS_LIST } from '../config/models.js';
import { GEMINI_STANDARD_VOICES } from '../config/voices.js';
import { BACKGROUND_SCENES } from '../config/scenes.js';
import { sceneManager } from '../services/sceneManager.js';
import { useClickThrough } from '../hooks/useClickThrough.js';
import { electronBridge } from '../services/desktop/ElectronBridge.js';
import { soundFxService } from '../services/soundFxService.js';
import { TacticalDropdown } from './TacticalDropdown.jsx';

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
  const [availableScenes, setAvailableScenes] = useState(sceneManager.getAvailableScenes());
  const [currentActiveExpr, setCurrentActiveExpr] = useState(null);

  const posX = coords?.x ?? position?.x ?? 60;
  const posY = coords?.y ?? position?.y ?? 60;

  const { interactiveProps } = useClickThrough();

  useEffect(() => {
    return sceneManager.onSceneChange((s) => {
      setActiveScene(s.sceneId);
      setAvailableScenes(sceneManager.getAvailableScenes());
    });
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

  const handleImportCustomSceneFile = async (e) => {
    e.stopPropagation();
    soundFxService.playClick();
    if (typeof window !== 'undefined' && window.electronAPI?.importCustomSceneFile) {
      const res = await window.electronAPI.importCustomSceneFile();
      if (!res.canceled && res.filePath) {
        sceneManager.addCustomScene({
          id: `custom_${Date.now()}`,
          name: res.name || 'Fondo Importado',
          url: res.fileUrl || res.filePath,
          type: res.type
        });
        setActiveScene(sceneManager.getScene().sceneId);
        setAvailableScenes(sceneManager.getAvailableScenes());
      }
    }
  };

  const handleCloseApp = () => {
    soundFxService.playClick();
    onClose();
    electronBridge.quitApp();
  };

  // Prepare options for TacticalDropdowns
  const modelOptions = allLive2dModels.map((m) => ({
    value: m.id,
    label: m.name,
    badge: m.badge || '2D',
    subtitle: m.theme
  }));

  const sceneOptions = availableScenes.map((s) => ({
    value: s.id,
    label: s.name,
    badge: s.category === 'custom' ? 'CUSTOM' : s.category?.toUpperCase(),
    subtitle: s.description
  }));

  const aiModelsList = Array.isArray(GEMINI_MODELS_LIST) && GEMINI_MODELS_LIST.length > 0
    ? GEMINI_MODELS_LIST
    : Object.values(GEMINI_MODELS || {});

  const aiModelOptions = aiModelsList.map((m) => ({
    value: m.id,
    label: m.displayName || m.name || m.id,
    badge: m.badge || 'IA',
    subtitle: m.description
  }));

  const voiceOptions = GEMINI_STANDARD_VOICES.map((v) => ({
    value: v.name,
    label: v.name,
    badge: v.gender || '24kHz',
    subtitle: v.trait
  }));

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
            {/* Tactical Model Selector Dropdown */}
            <TacticalDropdown
              options={modelOptions}
              value={activeModelId}
              onChange={(val) => onSwitchLive2DModel?.(val)}
              placeholder="Elegir personaje..."
              icon={Smile}
            />

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
            {/* Tactical Scene Selector Dropdown */}
            <TacticalDropdown
              options={sceneOptions}
              value={activeScene}
              onChange={(val) => {
                sceneManager.setScene(val);
                setActiveScene(val);
              }}
              placeholder="Elegir escena..."
              icon={ImageIcon}
            />

            {typeof window !== 'undefined' && window.electronAPI?.importCustomSceneFile && (
              <button
                type="button"
                className="ctx-action-item"
                onClick={handleImportCustomSceneFile}
              >
                <FolderPlus size={11} />
                <span>Importar Archivo Local</span>
              </button>
            )}
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
            {/* Tactical AI Model Selector */}
            <TacticalDropdown
              options={aiModelOptions}
              value={activeAiModelId}
              onChange={(val) => onSwitchAiModel?.(val)}
              placeholder="Elegir modelo IA..."
              icon={Zap}
            />

            {/* Tactical Voice Selector */}
            <TacticalDropdown
              options={voiceOptions}
              value={activeVoiceName}
              onChange={(val) => onSwitchVoice?.(val)}
              placeholder="Elegir voz..."
              icon={Volume2}
            />
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
