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
  Coffee
} from 'lucide-react';
import { GEMINI_MODELS, DEFAULT_MODEL_ID } from '../config/models';
import { GEMINI_STANDARD_VOICES } from '../config/voices';
import { live2dModelRegistry } from '../services/live2d';

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

  const textareaRef = useRef(null);

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

  const handleSave = () => {
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
    { id: 'voice', label: 'Voz de Cristi', icon: Mic2, subtitle: '30 timbres vocales de Gemini' },
    { id: 'persona', label: 'Personalidad', icon: User, subtitle: 'Temperatura y prompt dinámico' },
  ];

  return (
    <div
      className="sm-backdrop"
      onClick={(e) => e.target.classList.contains('sm-backdrop') && onClose()}
    >
      <div className="sm-card" role="dialog" aria-modal="true" aria-labelledby="sm-modal-title">
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
                    {GEMINI_MODELS.map((m) => {
                      const isSelected = modelId === m.id;
                      return (
                        <div
                          key={m.id}
                          onClick={() => setModelId(m.id)}
                          className={`sm-model-card ${isSelected ? 'selected' : ''}`}
                        >
                          <div className="sm-model-card-header">
                            <div className="sm-model-info-row">
                              <span className="sm-model-name">{m.name}</span>
                              <span className="sm-badge sm-badge-tag">{m.tag}</span>
                              {m.isLivePreview && (
                                <span className="sm-badge sm-badge-live">
                                  <Sparkles size={10} /> Live WebSocket
                                </span>
                              )}
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
                              <strong>Voces:</strong> {m.voicesSupported}
                            </span>
                            <span className="sm-meta-item">
                              <strong>Protocolo:</strong> {m.bidiProtocol}
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

            {/* TAB 3: VOICE */}
            {activeTab === 'voice' && (
              <div className="sm-tab-pane">
                <div className="sm-section-header">
                  <h3 className="sm-section-title">Timbre y Voz de Cristi</h3>
                  <p className="sm-section-desc">
                    Selecciona entre las 30 voces neuronales de alta fidelidad generadas por Gemini Live a 24kHz.
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
          <button type="button" className="sm-btn sm-btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="sm-btn sm-btn-primary" onClick={handleSave}>
            <Check size={14} />
            <span>Guardar Cambios</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

export default SettingsModal;
