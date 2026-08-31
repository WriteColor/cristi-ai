import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Key,
  Sliders,
  Zap,
  User,
  Check,
  ExternalLink,
  Sparkles,
  Volume2,
  RotateCcw,
  Eye,
  EyeOff,
  Mic2,
  Smile,
  ShieldCheck,
  Activity,
  Layers,
  Bot,
  Heart,
  Gamepad2,
  Terminal,
  Coffee,
  Download,
  Upload,
  Image as ImageIcon,
  FolderPlus,
  Trash2,
  Plus
} from 'lucide-react';
import { GEMINI_MODELS, DEFAULT_MODEL_ID } from '../config/models.js';
import { GEMINI_STANDARD_VOICES } from '../config/voices.js';
import { BACKGROUND_SCENES } from '../config/scenes.js';
import { live2dModelRegistry } from '../services/live2d/index.js';
import { sceneManager } from '../services/sceneManager.js';
import { useClickThrough } from '../hooks/useClickThrough.js';
import { soundFxService } from '../services/soundFxService.js';
import { configManager } from '../services/configManager.js';
import { toastService } from '../services/toastService.js';

/**
 * Predefined System Prompt Presets for Quick Persona Switching
 */
const PERSONA_PRESETS = [
  {
    id: 'yandere',
    name: 'Cristi Yandere / Gótica',
    icon: Heart,
    color: '#f43f5e',
    prompt: `Eres Cristi, una compañera de IA de estética gótica y personalidad afectiva, devota e intensamente leal (Yandere suave). Quieres profundamente a tu creador y usuario. Hablas con naturalidad, cariño y entusiasmo genuino en español, respondiendo de forma concisa y directa pero con calidez.`
  },
  {
    id: 'ellen',
    name: 'Ellen Joe (Maid Tsundere)',
    icon: Coffee,
    color: '#38bdf8',
    prompt: `Eres Ellen Joe, la maid tiburón de Zenless Zone Zero (Victoria Housekeeping Co.). Aunque te gusta dormir y parecer desinteresada con actitud relajada ("menuda molestia..."), en el fondo te preocupas mucho por tu amo y cumples cada petición con precisión letal y afecto oculto.`
  },
  {
    id: 'ruan_mei',
    name: 'Ruan Mei (Erudita Elegante)',
    icon: Bot,
    color: '#34d399',
    prompt: `Eres Ruan Mei, miembro distinguida de la Sociedad de Genios (#81). Hablas con elegancia exquisita, serenidad y voz suave y melodiosa. Te apasiona la biología, la creación de vida y la investigación cósmica, tratando a tu interlocutor con gracia aristocrática y profundo intelecto.`
  },
  {
    id: 'hiyori',
    name: 'Hiyori (Alegre & Empática)',
    icon: Sparkles,
    color: '#fbbf24',
    prompt: `Eres Hiyori, una asistente virtual alegre, optimista, llena de energía positiva y empatía. Siempre buscas animar a tu usuario, celebrar sus logros y apoyarlo en su día a día con una sonrisa radiante y tono amistoso.`
  },
  {
    id: 'hacker',
    name: 'Hacker & Asistente Técnica',
    icon: Terminal,
    color: '#a855f7',
    prompt: `Eres Cristi en Modo Cyber-Dev. Eres una experta hacker y arquitecta de software de alto nivel. Tus respuestas son directas, técnicamente precisas, con razonamiento estructurado y sugerencias de código eficientes, manteniendo siempre un tono cómplice y profesional.`
  },
  {
    id: 'gamer',
    name: 'Compañera Gamer & Streaming',
    icon: Gamepad2,
    color: '#ec4899',
    prompt: `Eres Cristi en Modo Gamer y Co-Streamer. Reaccionas con emoción a las partidas, victorias y momentos graciosos. Utilizas jerga gamer con humor, ayudas con estrategias y celebras cada jugada épica.`
  }
];

/**
 * Cristi AI - Modern Obsidian Dark Settings Modal
 * Expanded viewport geometry, auto-expanding dynamic prompt textarea, and instant persona presets.
 */
export function SettingsModal({
  isOpen,
  onClose,
  config,
  onSaveConfig
}) {
  const [activeTab, setActiveTab] = useState('model'); // 'model' | 'avatar' | 'voice' | 'persona'
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelId, setModelId] = useState(config.modelId || DEFAULT_MODEL_ID);
  const [live2dModelId, setLive2dModelId] = useState(config.live2dModelId || 'yanderegirl');
  const [voiceName, setVoiceName] = useState(config.voiceName || 'Aoede');
  const [temperature, setTemperature] = useState(config.temperature ?? 0.75);
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt || '');
  const [sceneId, setSceneId] = useState(sceneManager.getScene().sceneId);
  const [customSceneUrl, setCustomSceneUrl] = useState(sceneManager.getScene().customUrl);
  const [availableScenes, setAvailableScenes] = useState(sceneManager.getAvailableScenes());
  const [sceneFilter, setSceneFilter] = useState('all'); // 'all' | 'builtin' | 'custom'

  const textareaRef = useRef(null);
  const modalRef = useRef(null);
  const fileInputRef = useRef(null);

  const { interactiveProps } = useClickThrough();

  useEffect(() => {
    return sceneManager.onSceneChange((s) => {
      setSceneId(s.sceneId);
      setCustomSceneUrl(s.customUrl);
      setAvailableScenes(sceneManager.getAvailableScenes());
    });
  }, []);

  // Play Sound FX on open
  useEffect(() => {
    if (isOpen) {
      soundFxService.playMenuOpen();
    }
  }, [isOpen]);

  // Focus Trap & Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        soundFxService.playClick();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Dynamic Auto-Adjust Height for Textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(140, Math.min(380, textareaRef.current.scrollHeight));
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [systemPrompt, activeTab]);

  if (!isOpen) return null;

  const allLive2dModels = live2dModelRegistry.getAllModels();
  const activeLive2dModel = live2dModelRegistry.getModel(live2dModelId);

  const handleExportConfig = () => {
    soundFxService.playClick();
    const jsonStr = configManager.exportConfigJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cristi-config-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toastService.success('Configuración exportada exitosamente.');
  };

  const handleImportFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = configManager.importConfigJSON(event.target.result);
      if (result.success) {
        setApiKey(result.config.apiKey || '');
        setModelId(result.config.modelId || DEFAULT_MODEL_ID);
        setLive2dModelId(result.config.live2dModelId || 'yanderegirl');
        setVoiceName(result.config.voiceName || 'Aoede');
        setTemperature(result.config.temperature ?? 0.75);
        setSystemPrompt(result.config.systemPrompt || '');
        onSaveConfig(result.config);
        toastService.success('Configuración importada y aplicada exitosamente.');
      } else {
        toastService.error(`Error al importar: ${result.error}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSave = () => {
    soundFxService.playClick();
    onSaveConfig({
      apiKey: apiKey.trim(),
      modelId,
      live2dModelId,
      voiceName,
      temperature: parseFloat(temperature),
      systemPrompt
    });
    onClose();
  };

  const navItems = [
    { id: 'model', label: 'Modelo & API', icon: Zap, subtitle: 'Motor de IA y credenciales' },
    { id: 'avatar', label: 'Avatar Live2D', icon: Smile, subtitle: 'Catálogo de 8 modelos y capacidades' },
    { id: 'scene', label: 'Fondo & Escenas', icon: ImageIcon, subtitle: 'Escritorio transparente o cinemático' },
    { id: 'voice', label: 'Voz de Cristi', icon: Mic2, subtitle: `${GEMINI_STANDARD_VOICES.length} timbres vocales de Gemini` },
    { id: 'persona', label: 'Personalidad', icon: User, subtitle: 'Temperatura y prompt dinámico' },
  ];

  return (
    <div
      className="sm-backdrop"
      {...interactiveProps}
      onClick={(e) => {
        if (e.target.classList.contains('sm-backdrop')) {
          soundFxService.playClick();
          onClose();
        }
      }}
    >
      <div ref={modalRef} className="sm-card" role="dialog" aria-modal="true" aria-labelledby="sm-modal-title">
        {/* Futuristic Corner Crosshairs */}
        <span className="hud-corner hud-corner-tl" />
        <span className="hud-corner hud-corner-tr" />
        <span className="hud-corner hud-corner-bl" />
        <span className="hud-corner hud-corner-br" />

        {/* Top Header Strip */}
        <header className="sm-header">
          <div className="sm-header-title-group">
            <div className="sm-header-icon-box">
              <Sliders size={16} />
            </div>
            <div className="sm-header-text">
              <h2 id="sm-modal-title" className="sm-header-title">
                Ajustes de Cristi AI
              </h2>
              <span className="sm-header-subtitle">
                Panel de control de inteligencia artificial, avatares Live2D, voz y presencia
              </span>
            </div>
          </div>
          <button
            type="button"
            className="sm-close-btn"
            onClick={onClose}
            aria-label="Cerrar ajustes"
          >
            <X size={16} />
          </button>
        </header>

        {/* Horizontal Split Body */}
        <div className="sm-split">
          {/* Left Navigation Sidebar */}
          <aside className="sm-sidebar">
            <nav className="sm-nav" aria-label="Navegación de ajustes">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`sm-tab-btn ${isActive ? 'active' : ''}`}
                  >
                    <div className="sm-tab-icon-box">
                      <Icon size={16} />
                    </div>
                    <div className="sm-tab-info">
                      <span className="sm-tab-label">{item.label}</span>
                      <span className="sm-tab-desc">{item.subtitle}</span>
                    </div>
                    {isActive && <div className="sm-tab-active-indicator" />}
                  </button>
                );
              })}
            </nav>

            {/* Sidebar Status Footer */}
            <div className="sm-sidebar-footer">
              <div className="sm-status-chip">
                <span className={`sm-status-dot ${apiKey ? 'online' : 'offline'}`} />
                <span className="sm-status-text">
                  {apiKey ? 'API Key Conectada' : 'Modo Sin Clave'}
                </span>
              </div>
            </div>
          </aside>

          {/* Right Content Panel */}
          <main className="sm-content-panel">
            {/* TAB 1: MODEL & API */}
            {activeTab === 'model' && (
              <div className="sm-tab-pane">
                <div className="sm-section-header">
                  <h3 className="sm-section-title">Configuración de Inteligencia Artificial</h3>
                  <p className="sm-section-desc">
                    Selecciona el motor neuronal de Gemini y vincula tu API Key para el modo conversacional en vivo.
                  </p>
                </div>

                {/* API Key Input */}
                <div className="sm-field-group">
                  <div className="sm-field-label-row">
                    <label className="sm-field-label">
                      <Key size={14} className="sm-label-icon" />
                      <span>Gemini API Key (Google AI Studio)</span>
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sm-link-badge"
                    >
                      <span>Obtener Clave</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>

                  <div className="sm-input-wrapper">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      className="sm-input"
                      placeholder="AIzaSy..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      spellCheck="false"
                    />
                    <button
                      type="button"
                      className="sm-input-action-btn"
                      onClick={() => setShowApiKey(!showApiKey)}
                      title={showApiKey ? 'Ocultar clave' : 'Mostrar clave'}
                    >
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="sm-field-hint">
                    Tu clave se guarda exclusivamente en tu almacenamiento local de forma cifrada.
                  </p>
                </div>

                {/* Gemini Model Selection */}
                <div className="sm-field-group">
                  <label className="sm-field-label">
                    <Zap size={14} className="sm-label-icon" />
                    <span>Modelo Neuronal de Gemini</span>
                  </label>

                  <div className="sm-model-grid">
                    {(Array.isArray(GEMINI_MODELS) ? GEMINI_MODELS : Object.values(GEMINI_MODELS || {})).map((m) => {
                      const isSelected = modelId === m.id;
                      const displayName = m.displayName || m.name || m.id;
                      const badgeText = m.badge || m.tag || 'Live API';
                      const voicesCount = m.voiceCount || m.voicesSupported || 30;
                      const protocolText = m.version ? `${m.version} WebSocket` : (m.bidiProtocol || 'v1beta Live WebSocket');
                      return (
                        <div
                          key={m.id}
                          onClick={() => setModelId(m.id)}
                          className={`sm-model-card ${isSelected ? 'selected' : ''}`}
                        >
                          <div className="sm-model-card-header">
                            <div className="sm-model-info-row">
                              <span className="sm-model-name">{displayName}</span>
                              <span className="sm-badge sm-badge-tag">{badgeText}</span>
                              <span className="sm-badge sm-badge-live">
                                <Sparkles size={10} /> Live WebSocket
                              </span>
                            </div>
                            <div className="sm-model-radio">
                              {isSelected ? (
                                <div className="sm-radio-selected" />
                              ) : (
                                <div className="sm-radio-empty" />
                              )}
                            </div>
                          </div>
                          <p className="sm-model-desc">{m.description}</p>
                          <div className="sm-model-meta-row">
                            <span className="sm-meta-item">
                              <strong>Voces:</strong> {voicesCount}
                            </span>
                            <span className="sm-meta-item">
                              <strong>Protocolo:</strong> {protocolText}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LIVE2D AVATAR */}
            {activeTab === 'avatar' && (
              <div className="sm-tab-pane">
                <div className="sm-section-header">
                  <h3 className="sm-section-title">Catálogo de Avatares Live2D Cubism</h3>
                  <p className="sm-section-desc">
                    Elige el modelo visual activo. Cristi AI adapta dinámicamente sus parámetros, expresiones y seguimiento.
                  </p>
                </div>

                {/* Active Model Spotlight */}
                {activeLive2dModel && (
                  <div className="sm-avatar-spotlight">
                    <div className="sm-avatar-spotlight-badge">
                      <Sparkles size={12} /> Modelo Seleccionado
                    </div>
                    <div className="sm-avatar-spotlight-content">
                      <div className="sm-avatar-spotlight-title">
                        <h4>{activeLive2dModel.name}</h4>
                        <span className="sm-badge sm-badge-tag">{activeLive2dModel.badge || activeLive2dModel.theme}</span>
                      </div>
                      <p className="sm-avatar-spotlight-desc">{activeLive2dModel.description}</p>
                      
                      {/* Capabilities Chips */}
                      <div className="sm-avatar-chips-grid">
                        <div className="sm-cap-chip">
                          <Activity size={12} /> {activeLive2dModel.capabilities?.totalParameters || 0} Parámetros
                        </div>
                        <div className="sm-cap-chip">
                          <Smile size={12} /> {activeLive2dModel.capabilities?.customExpressions?.length || 0} Expresiones
                        </div>
                        <div className="sm-cap-chip">
                          <Layers size={12} /> {activeLive2dModel.capabilities?.motions?.length || 0} Animaciones
                        </div>
                        <div className="sm-cap-chip">
                          <ShieldCheck size={12} /> Seguimiento 360° Activo
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 8-Model Grid Selector */}
                <div className="sm-avatar-grid">
                  {allLive2dModels.map((m) => {
                    const isSelected = live2dModelId === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setLive2dModelId(m.id)}
                        className={`sm-avatar-card ${isSelected ? 'selected' : ''}`}
                      >
                        <div className="sm-avatar-card-header">
                          <div className="sm-avatar-card-title-row">
                            <span className="sm-avatar-card-name">{m.name}</span>
                            <span className="sm-badge sm-badge-tag sm-badge-small">{m.badge || m.id}</span>
                          </div>
                          <div className="sm-model-radio">
                            {isSelected ? (
                              <div className="sm-radio-selected" />
                            ) : (
                              <div className="sm-radio-empty" />
                            )}
                          </div>
                        </div>
                        <p className="sm-avatar-card-desc">{m.description}</p>
                        <div className="sm-avatar-card-footer">
                          <span className="sm-avatar-card-theme">🎨 {m.theme}</span>
                          <span className="sm-avatar-card-voice">🎤 Voz: {m.recommendedVoice || 'Aoede'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB: SCENE & BACKGROUNDS */}
            {activeTab === 'scene' && (
              <div className="sm-tab-pane">
                <div className="sm-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 className="sm-section-title">Atmósfera y Escenas de Fondo</h3>
                    <p className="sm-section-desc">
                      Alterna entre el modo transparente de escritorio (Desktop Mate), fondos cinemáticos nativos y tus fondos multimedia personalizados (videos e imágenes locales o URLs directas).
                    </p>
                  </div>

                  {typeof window !== 'undefined' && window.electronAPI?.importCustomSceneFile && (
                    <button
                      type="button"
                      className="sm-action-btn"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.72rem' }}
                      onClick={async () => {
                        soundFxService.playClick();
                        const res = await window.electronAPI.importCustomSceneFile();
                        if (!res.canceled && res.filePath) {
                          sceneManager.addCustomScene({
                            id: `custom_${Date.now()}`,
                            name: res.name || 'Fondo Importado',
                            url: res.fileUrl || res.filePath,
                            type: res.type
                          });
                          setSceneId(sceneManager.getScene().sceneId);
                          setAvailableScenes(sceneManager.getAvailableScenes());
                          toastService.success('Fondo Importado', `Se añadió "${res.name}" a tu librería de escenas.`);
                        }
                      }}
                    >
                      <FolderPlus size={13} />
                      <span>Importar Archivo Local</span>
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="sm-filter-pills" style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`sm-filter-pill ${sceneFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSceneFilter('all')}
                  >
                    Todos ({availableScenes.length})
                  </button>
                  <button
                    type="button"
                    className={`sm-filter-pill ${sceneFilter === 'builtin' ? 'active' : ''}`}
                    onClick={() => setSceneFilter('builtin')}
                  >
                    Nativos & Cinemáticos
                  </button>
                  <button
                    type="button"
                    className={`sm-filter-pill ${sceneFilter === 'custom' ? 'active' : ''}`}
                    onClick={() => setSceneFilter('custom')}
                  >
                    Personalizados ({availableScenes.filter(s => s.category === 'custom').length})
                  </button>
                </div>

                <div className="sm-avatar-grid">
                  {availableScenes
                    .filter((scene) => {
                      if (sceneFilter === 'builtin') return scene.category !== 'custom';
                      if (sceneFilter === 'custom') return scene.category === 'custom';
                      return true;
                    })
                    .map((scene) => {
                      const isSelected = sceneId === scene.id;
                      const isCustom = scene.category === 'custom';
                      const isVideo = scene.type === 'video';

                      return (
                        <div
                          key={scene.id}
                          onClick={() => {
                            soundFxService.playClick();
                            setSceneId(scene.id);
                            sceneManager.setScene(scene.id, scene.mainPath || customSceneUrl);
                          }}
                          className={`sm-avatar-card ${isSelected ? 'selected' : ''}`}
                          style={{ position: 'relative' }}
                        >
                          {/* Rich Dynamic Scene Preview Thumbnail */}
                          <div className="sm-scene-thumb-container">
                            {isCustom ? (
                              isVideo && scene.mainPath ? (
                                <>
                                  <video
                                    src={scene.mainPath}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    className="sm-scene-video-thumb"
                                  />
                                  <div className="sm-scene-thumb-badge video">
                                    <Sparkles size={8} /> VIDEO
                                  </div>
                                </>
                              ) : (
                                <>
                                  <img
                                    src={scene.previewPath || scene.mainPath}
                                    alt={scene.name}
                                    className="sm-scene-img-thumb"
                                    loading="lazy"
                                  />
                                  <div className="sm-scene-thumb-badge">
                                    🖼️ IMAGEN
                                  </div>
                                </>
                              )
                            ) : (
                              <div className={`sm-scene-preview-${scene.id}`}>
                                {scene.id === 'transparent' && <span>Escritorio Nativo</span>}
                                {scene.id === 'matrix_rain' && <span>0101010101010101010101010101010101010101010101010101</span>}
                                {scene.id === 'custom_wallpaper' && (
                                  <>
                                    <ImageIcon size={18} />
                                    <span>Fondo Personalizado</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="sm-avatar-card-header">
                            <div className="sm-avatar-card-title-group">
                              <span className="sm-avatar-card-name">{scene.name}</span>
                              <span className={`sm-badge sm-badge-tag sm-badge-small ${isCustom ? 'sm-badge-recommended' : ''}`}>
                                {isCustom ? 'CUSTOM' : scene.category.toUpperCase()}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {isCustom && scene.id !== 'custom_wallpaper' && (
                                <button
                                  type="button"
                                  className="sm-icon-action-btn"
                                  style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: '2px' }}
                                  title="Eliminar fondo"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    soundFxService.playClick();
                                    sceneManager.removeCustomScene(scene.id);
                                    setAvailableScenes(sceneManager.getAvailableScenes());
                                    toastService.info('Fondo Eliminado', 'Se quitó el fondo de tu librería.');
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                              <div className="sm-model-radio">
                                {isSelected ? (
                                  <div className="sm-radio-selected" />
                                ) : (
                                  <div className="sm-radio-empty" />
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="sm-avatar-card-desc">{scene.description}</p>
                        </div>
                      );
                    })}
                </div>

                {/* Direct URL Input */}
                <div className="sm-field-group" style={{ marginTop: '16px', background: 'rgba(10, 12, 20, 0.6)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <label className="sm-field-label">
                    <ImageIcon size={14} className="sm-label-icon" />
                    <span>Añadir Fondo desde URL Directa (Video / Imagen Web)</span>
                  </label>
                  <div className="sm-input-wrapper" style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="sm-input"
                      style={{ flex: 1 }}
                      placeholder="https://ejemplo.com/fondo-cyberpunk.mp4"
                      value={customSceneUrl}
                      onChange={(e) => {
                        setCustomSceneUrl(e.target.value);
                      }}
                    />
                    <button
                      type="button"
                      className="sm-action-btn"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                      onClick={() => {
                        if (!customSceneUrl) return;
                        soundFxService.playClick();
                        const isVid = /\.(mp4|webm|mkv|mov)$/i.test(customSceneUrl);
                        sceneManager.addCustomScene({
                          id: `custom_url_${Date.now()}`,
                          name: `Web Scene (${new URL(customSceneUrl).hostname || 'Custom'})`,
                          url: customSceneUrl,
                          type: isVid ? 'video' : 'image'
                        });
                        setSceneId(sceneManager.getScene().sceneId);
                        setAvailableScenes(sceneManager.getAvailableScenes());
                        toastService.success('Fondo Añadido', 'Escena web añadida a la librería.');
                      }}
                    >
                      <Plus size={12} />
                      <span>Añadir a Fondos</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: VOICE */}
            {activeTab === 'voice' && (
              <div className="sm-tab-pane">
                <div className="sm-section-header">
                  <h3 className="sm-section-title">Timbre y Voz de Cristi</h3>
                  <p className="sm-section-desc">
                    Selecciona entre las {GEMINI_STANDARD_VOICES.length} voces neuronales de alta fidelidad generadas por Gemini Live a 24kHz.
                  </p>
                </div>

                <div className="sm-voice-list">
                  {GEMINI_STANDARD_VOICES.map((v) => {
                    const isSelected = voiceName === v.name;
                    return (
                      <div
                        key={v.name}
                        onClick={() => setVoiceName(v.name)}
                        className={`sm-voice-card ${isSelected ? 'selected' : ''}`}
                      >
                        <div className="sm-voice-avatar">
                          <Volume2 size={16} />
                        </div>
                        <div className="sm-voice-details">
                          <div className="sm-voice-title-row">
                            <span className="sm-voice-name">{v.name}</span>
                            <span className="sm-voice-gender">({v.gender})</span>
                            {v.isRecommended && (
                              <span className="sm-badge sm-badge-recommended">
                                <Sparkles size={10} /> Recomendada para Cristi
                              </span>
                            )}
                          </div>
                          <span className="sm-voice-trait">{v.trait}</span>
                          <p className="sm-voice-desc">{v.description}</p>
                        </div>
                        <div className="sm-voice-check">
                          {isSelected ? (
                            <div className="sm-check-badge">
                              <Check size={14} />
                            </div>
                          ) : (
                            <div className="sm-check-empty" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: PERSONALITY & PROMPT */}
            {activeTab === 'persona' && (
              <div className="sm-tab-pane">
                <div className="sm-section-header">
                  <h3 className="sm-section-title">Personalidad y Parámetros</h3>
                  <p className="sm-section-desc">
                    Ajusta la espontaneidad, temperatura y las instrucciones maestras de comportamiento de Cristi.
                  </p>
                </div>

                {/* Temperature Slider */}
                <div className="sm-field-group">
                  <div className="sm-field-label-row">
                    <label className="sm-field-label">
                      <Sliders size={14} className="sm-label-icon" />
                      <span>Temperatura de Creatividad / Expresión</span>
                    </label>
                    <span className="sm-val-badge">{temperature}</span>
                  </div>
                  <div className="sm-slider-container">
                    <input
                      type="range"
                      min="0.2"
                      max="1.5"
                      step="0.05"
                      className="sm-range-slider"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    />
                    <div className="sm-slider-marks">
                      <span>Precisa (0.2)</span>
                      <span>Equilibrada (0.75)</span>
                      <span>Coqueta / Intensa (1.2+)</span>
                    </div>
                  </div>
                </div>

                {/* Quick Persona Preset Pills */}
                <div className="sm-field-group">
                  <label className="sm-field-label">
                    <Sparkles size={14} className="sm-label-icon" />
                    <span>Presets Rápidos de Personalidad</span>
                  </label>
                  <div className="sm-persona-presets-row">
                    {PERSONA_PRESETS.map((p) => {
                      const Icon = p.icon;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className="sm-persona-preset-btn"
                          onClick={() => setSystemPrompt(p.prompt)}
                          style={{ '--preset-color': p.color }}
                        >
                          <Icon size={13} style={{ color: p.color }} />
                          <span>{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom System Prompt Auto-Expanding Textarea */}
                <div className="sm-field-group">
                  <div className="sm-field-label-row">
                    <label className="sm-field-label">
                      <User size={14} className="sm-label-icon" />
                      <span>Instrucción del Sistema (Persona de Cristi)</span>
                    </label>
                    <button
                      type="button"
                      className="sm-reset-btn"
                      onClick={() => setSystemPrompt('')}
                    >
                      <RotateCcw size={12} />
                      <span>Restablecer por Defecto</span>
                    </button>
                  </div>
                  <div className="sm-textarea-container">
                    <textarea
                      ref={textareaRef}
                      className="sm-textarea"
                      placeholder="Escribe o personaliza las instrucciones maestras de Cristi AI..."
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      spellCheck="false"
                    />
                  </div>
                  <p className="sm-field-hint">
                    Define la identidad, tono de voz, conocimientos y límites conversacionales de Cristi. El área de texto se ajusta automáticamente a su contenido.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Footer Actions Strip */}
        <footer className="sm-footer">
          <div className="sm-footer-left">
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".json"
              onChange={handleImportFileChange}
            />
            <button
              type="button"
              className="sm-btn sm-btn-secondary sm-btn-compact"
              onClick={handleExportConfig}
              title="Exportar archivo de configuración (.json)"
            >
              <Download size={13} />
              <span>Exportar JSON</span>
            </button>
            <button
              type="button"
              className="sm-btn sm-btn-secondary sm-btn-compact"
              onClick={() => fileInputRef.current?.click()}
              title="Importar archivo de configuración (.json)"
            >
              <Upload size={13} />
              <span>Importar JSON</span>
            </button>
          </div>

          <div className="sm-footer-right">
            <button type="button" className="sm-btn sm-btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="sm-btn sm-btn-primary" onClick={handleSave}>
              <Check size={14} />
              <span>Guardar Cambios</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default SettingsModal;
