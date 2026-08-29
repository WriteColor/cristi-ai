import React, { useState } from 'react';
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
  Mic2
} from 'lucide-react';
import { GEMINI_MODELS, DEFAULT_MODEL_ID } from '../config/models';
import { GEMINI_STANDARD_VOICES } from '../config/voices';

/**
 * Cristi AI - Modern Obsidian Dark Settings Modal
 * Pure Vanilla CSS with glassmorphism, precise geometry, and rich typography.
 */
export function SettingsModal({
  isOpen,
  onClose,
  config,
  onSaveConfig
}) {
  const [activeTab, setActiveTab] = useState('model'); // 'model' | 'voice' | 'persona'
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelId, setModelId] = useState(config.modelId || DEFAULT_MODEL_ID);
  const [voiceName, setVoiceName] = useState(config.voiceName || 'Aoede');
  const [temperature, setTemperature] = useState(config.temperature ?? 0.75);
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt || '');

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig({
      apiKey: apiKey.trim(),
      modelId,
      voiceName,
      temperature: parseFloat(temperature),
      systemPrompt
    });
    onClose();
  };

  const navItems = [
    { id: 'model', label: 'Modelo & API', icon: Zap, subtitle: 'Motor de IA y credenciales' },
    { id: 'voice', label: 'Voz de Cristi', icon: Mic2, subtitle: 'Timbre vocal de Gemini' },
    { id: 'persona', label: 'Personalidad', icon: User, subtitle: 'Temperatura y prompt' },
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
                Panel de control de inteligencia, voz y presencia
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
                  {apiKey ? 'API Conectada' : 'Modo Sin Clave'}
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
                      <span>Gemini API Key</span>
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="sm-link-badge"
                    >
                      <span>Obtener gratis en AI Studio</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                  <div className="sm-input-wrapper">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      className="sm-input"
                      placeholder="Pega tu clave AI Studio (AIzaSy...)"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      autoComplete="off"
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
                    Tu clave se almacena exclusivamente de forma local en tu navegador.
                  </p>
                </div>

                {/* Model Selector Cards */}
                <div className="sm-field-group">
                  <label className="sm-field-label">
                    <Zap size={14} className="sm-label-icon" />
                    <span>Modelo de Conversación de Voz en Tiempo Real</span>
                  </label>
                  <div className="sm-model-grid">
                    {Object.values(GEMINI_MODELS).map((m) => {
                      const isSelected = modelId === m.id;
                      return (
                        <div
                          key={m.id}
                          onClick={() => setModelId(m.id)}
                          className={`sm-model-card ${isSelected ? 'selected' : ''}`}
                        >
                          <div className="sm-model-card-header">
                            <div className="sm-model-title-group">
                              <span className="sm-model-name">{m.displayName}</span>
                              <code className="sm-model-id-badge">{m.id}</code>
                              {m.badge && (
                                <span className={`sm-badge sm-badge-${m.badgeType || 'stable'}`}>
                                  {m.badge}
                                </span>
                              )}
                            </div>
                            <div className={`sm-radio ${isSelected ? 'checked' : ''}`}>
                              {isSelected && <div className="sm-radio-dot" />}
                            </div>
                          </div>
                          <p className="sm-model-desc">{m.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: VOICES */}
            {activeTab === 'voice' && (
              <div className="sm-tab-pane">
                <div className="sm-section-header">
                  <h3 className="sm-section-title">Catálogo de Voces Nativas de Gemini</h3>
                  <p className="sm-section-desc">
                    Selecciona el timbre vocal para la síntesis de audio en vivo de Cristi.
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

            {/* TAB 3: PERSONALITY & PROMPT */}
            {activeTab === 'persona' && (
              <div className="sm-tab-pane">
                <div className="sm-section-header">
                  <h3 className="sm-section-title">Personalidad y Parámetros</h3>
                  <p className="sm-section-desc">
                    Ajusta la espontaneidad y las instrucciones maestras de comportamiento de Cristi.
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

                {/* Custom System Prompt Override */}
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
                  <textarea
                    className="sm-textarea"
                    rows={6}
                    placeholder="Deja en blanco para usar la personalidad oficial Yandere/Gótica..."
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    spellCheck="false"
                  />
                  <p className="sm-field-hint">
                    Define la identidad, tono de voz y límites conversacionales de Cristi.
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
