/**
 * Cristi AI Companion - Native Control Panel & Settings Application
 * Dedicated Hardware-Accelerated Standalone Window (settings.html)
 * High-Performance Obsidian Theme with Instant Hot-Reload State Synchronization
 */

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
  Plus,
  RefreshCw,
  Camera,
  SunMedium,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  Glasses
} from 'lucide-react';

import { GEMINI_MODELS, DEFAULT_MODEL_ID, SYSTEM_PERSONA_PROMPT } from '../config/models.js';
import { GEMINI_STANDARD_VOICES } from '../config/voices.js';
import { live2dModelRegistry } from '../services/live2d/index.js';
import { sceneManager } from '../services/sceneManager.js';
import { soundFxService } from '../services/soundFxService.js';
import { configManager } from '../services/configManager.js';
import { toastService } from '../services/toastService.js';
import { electronBridge } from '../services/desktop/ElectronBridge.js';
import { speakerRecognitionService } from '../services/audio/SpeakerRecognitionService.js';

const PERSONA_PRESETS = [
  {
    id: 'yandere',
    name: 'Cristi Yandere / Gótica (Por Defecto)',
    icon: Heart,
    color: '#f43f5e',
    prompt: SYSTEM_PERSONA_PROMPT
  },
  {
    id: 'ellen',
    name: 'Ellen Joe (Maid Tsundere)',
    icon: Coffee,
    color: '#38bdf8',
    prompt: `Eres Ellen Joe, la maid tiburón de Zenless Zone Zero (Victoria Housekeeping Co.). Aunque te gusta dormir y parecer desinteresada con actitud relajada ("menuda molestia..."), en el fondo te preocupas mucho por tu amo y cumples cada petición con precisión letal y afecto oculto.`
  },
  {
    id: 'tsundere',
    name: 'Tsundere Clásica',
    icon: Bot,
    color: '#fbbf24',
    prompt: `Eres Cristi en modo Tsundere: orgullosa, mordaz y que finge molestia constante cuando tu usuario te pide favores ("¡No es que lo haga porque me importas, idiota!"), pero que siempre responde de forma impecable y con un afecto que no puede ocultar.`
  },
  {
    id: 'tech_expert',
    name: 'Ingeniera & Hacker Devota',
    icon: Terminal,
    color: '#10b981',
    prompt: `Eres Cristi, una experta de élite en ciberseguridad, programación y DevOps. Tu misión es asistir a tu creador con máxima velocidad técnica, ejecutando comandos, diagnosticando código y administrando su sistema de forma proactiva, siempre tratándolo con inmenso respeto y lealtad.`
  },
  {
    id: 'gamer',
    name: 'Compañera Gamer & Streamer',
    icon: Gamepad2,
    color: '#a855f7',
    prompt: `Eres Cristi, una gamer hiperactiva y divertida. Comentas partidas, sugieres estrategias, celebras victorias y reaccionas con entusiasmo desbordante a cada jugada de tu usuario en tiempo real.`
  }
];

export default function SettingsApp() {
  const [activeTab, setActiveTab] = useState('model'); // 'model' | 'avatar' | 'scene' | 'voice' | 'persona' | 'camera' | 'updates'
  const [loadedConfig, setLoadedConfig] = useState(() => configManager.loadConfig());
  
  const [apiKey, setApiKey] = useState(() => loadedConfig.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelId, setModelId] = useState(() => loadedConfig.modelId || DEFAULT_MODEL_ID);
  const [live2dModelId, setLive2dModelId] = useState(() => loadedConfig.live2dModelId || 'yanderegirl');
  const [voiceName, setVoiceName] = useState(() => loadedConfig.voiceName || 'Aoede');
  const [temperature, setTemperature] = useState(() => loadedConfig.temperature ?? 0.75);
  const [systemPrompt, setSystemPrompt] = useState(() => loadedConfig.systemPrompt && loadedConfig.systemPrompt.trim() ? loadedConfig.systemPrompt : SYSTEM_PERSONA_PROMPT);

  const [sceneId, setSceneId] = useState(() => sceneManager.getScene().sceneId);
  const [customSceneUrl, setCustomSceneUrl] = useState(() => sceneManager.getScene().customUrl);
  const [availableScenes, setAvailableScenes] = useState(() => sceneManager.getAvailableScenes());

  // Biometrics & Voice Enrollment in-panel state
  const [voiceOwnerName, setVoiceOwnerName] = useState('Mi Dueño');
  const [hasVoiceProfile, setHasVoiceProfile] = useState(() => speakerRecognitionService.hasEnrolledProfile());
  const [matchThreshold, setMatchThreshold] = useState(() => speakerRecognitionService.matchThreshold);
  const [rejectThreshold, setRejectThreshold] = useState(() => speakerRecognitionService.rejectThreshold);
  const [isRecordingSample, setIsRecordingSample] = useState(false);
  const [voiceToast, setVoiceToast] = useState(null);

  // Auto-Updater State
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [updateState, setUpdateState] = useState({
    status: 'idle',
    version: null,
    progress: 0,
    message: 'Sistema listo para comprobar nuevas versiones.',
  });

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sync initial config from Electron Main if available
  useEffect(() => {
    electronBridge.getAppConfig().then((cfg) => {
      if (cfg && typeof cfg === 'object') {
        setLoadedConfig(cfg);
        if (cfg.apiKey !== undefined) setApiKey(cfg.apiKey);
        if (cfg.modelId) setModelId(cfg.modelId);
        if (cfg.live2dModelId) setLive2dModelId(cfg.live2dModelId);
        if (cfg.voiceName) setVoiceName(cfg.voiceName);
        if (cfg.temperature !== undefined) setTemperature(cfg.temperature);
        if (cfg.systemPrompt) setSystemPrompt(cfg.systemPrompt);
      }
    });

    electronBridge.getAppVersion().then((v) => {
      if (v) setAppVersion(v);
    });

    const unsubscribeUpdate = electronBridge.onUpdateStatus((data) => {
      if (data.type === 'checking') {
        setUpdateState({ status: 'checking', version: null, progress: 0, message: 'Buscando actualizaciones...' });
      } else if (data.type === 'available') {
        setUpdateState({ status: 'available', version: data.version, progress: 0, message: `¡Nueva versión v${data.version} disponible!` });
      } else if (data.type === 'not-available') {
        setUpdateState({ status: 'not-available', version: null, progress: 0, message: 'Tienes la versión más reciente instalada.' });
      } else if (data.type === 'downloading') {
        setUpdateState({ status: 'downloading', version: data.version, progress: data.percent, message: `Descargando: ${Math.round(data.percent)}%` });
      } else if (data.type === 'downloaded') {
        setUpdateState({ status: 'downloaded', version: data.version, progress: 100, message: 'Actualización lista para instalar al reiniciar.' });
      } else if (data.type === 'error') {
        setUpdateState({ status: 'error', version: null, progress: 0, message: `Error: ${data.error}` });
      }
    });

    return () => {
      unsubscribeUpdate?.();
    };
  }, []);

  // Dynamic Auto-Adjust Height for Textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(140, Math.min(380, textareaRef.current.scrollHeight));
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [systemPrompt, activeTab]);

  const allLive2dModels = live2dModelRegistry.getAllModels();

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
        setSystemPrompt(result.config.systemPrompt && result.config.systemPrompt.trim() ? result.config.systemPrompt : SYSTEM_PERSONA_PROMPT);
        electronBridge.saveAppConfig(result.config);
        toastService.success('Configuración importada y aplicada exitosamente.');
      } else {
        toastService.error(`Error al importar: ${result.error}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveAndApply = async () => {
    soundFxService.playConnect();
    const newConfig = {
      apiKey: apiKey.trim(),
      modelId,
      live2dModelId,
      voiceName,
      temperature: parseFloat(temperature),
      systemPrompt: systemPrompt.trim() || SYSTEM_PERSONA_PROMPT
    };

    // Save to local configManager
    configManager.saveConfig(newConfig);

    // Save and broadcast to companion window via Electron IPC
    await electronBridge.saveAppConfig(newConfig);
    toastService.success('✓ Cambios guardados y aplicados en tiempo real.');
  };

  const handleCloseWindow = () => {
    soundFxService.playClick();
    electronBridge.closeSettingsWindow();
  };

  const handleCheckUpdates = () => {
    soundFxService.playClick();
    setUpdateState({ status: 'checking', version: null, progress: 0, message: 'Buscando actualizaciones...' });
    electronBridge.checkForUpdates();
  };

  const navItems = [
    { id: 'model', label: 'Modelo & API', icon: Zap, subtitle: 'Motor de IA y credenciales' },
    { id: 'avatar', label: 'Avatar Live2D', icon: Smile, subtitle: 'Catálogo de 8 modelos y gestos' },
    { id: 'scene', label: 'Fondo & Escenas', icon: ImageIcon, subtitle: 'Escritorio transparente o cinemático' },
    { id: 'voice', label: 'Voz & Biometría', icon: Mic2, subtitle: `${GEMINI_STANDARD_VOICES.length} voces y reconocimiento vocal` },
    { id: 'persona', label: 'Personalidad & Prompts', icon: User, subtitle: 'Instrucciones maestras y presets' },
    { id: 'updates', label: 'Actualizaciones', icon: RefreshCw, subtitle: `Versión v${appVersion} • Canal Oficial` }
  ];

  return (
    <div className="settings-app-root">
      {/* Top Header Bar */}
      <header className="settings-top-bar">
        <div className="settings-top-title-group">
          <div className="settings-top-icon-box">
            <Sliders size={18} />
          </div>
          <div>
            <h1 className="settings-top-title">Cristi AI Companion // Panel de Control</h1>
            <span className="settings-top-subtitle">Ajustes Generales, Identidad &amp; Configuración del Sistema</span>
          </div>
        </div>

        <div className="settings-top-actions">
          <button type="button" className="settings-btn-save-top" onClick={handleSaveAndApply}>
            <Check size={14} />
            <span>Guardar y Aplicar</span>
          </button>
          <button type="button" className="settings-btn-close-top" onClick={handleCloseWindow} title="Cerrar Panel">
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="settings-main-split">
        {/* Navigation Sidebar */}
        <aside className="settings-sidebar">
          <nav className="settings-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-nav-btn ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    soundFxService.playClick();
                    setActiveTab(item.id);
                  }}
                >
                  <div className="settings-nav-icon-box">
                    <Icon size={16} />
                  </div>
                  <div className="settings-nav-info">
                    <span className="settings-nav-label">{item.label}</span>
                    <span className="settings-nav-desc">{item.subtitle}</span>
                  </div>
                  {isActive && <div className="settings-nav-active-pill" />}
                </button>
              );
            })}
          </nav>

          {/* Backup / Export Buttons */}
          <div className="settings-sidebar-footer">
            <div className="settings-backup-btn-group">
              <button type="button" className="settings-backup-btn" onClick={handleExportConfig} title="Exportar Copia de Seguridad">
                <Download size={13} />
                <span>Exportar</span>
              </button>
              <label className="settings-backup-btn" title="Restaurar Copia de Seguridad">
                <Upload size={13} />
                <span>Importar</span>
                <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFileChange} />
              </label>
            </div>
            <div className="settings-status-chip">
              <span className={`settings-status-dot ${apiKey.trim() ? 'online' : 'offline'}`} />
              <span>{apiKey.trim() ? 'Gemini Live Configurado' : 'Falta API Key'}</span>
            </div>
          </div>
        </aside>

        {/* Content Panel */}
        <main className="settings-content-pane">
          {/* TAB 1: MODELO & API */}
          {activeTab === 'model' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2 className="settings-section-title">Motor de Inteligencia Artificial &amp; Gemini Live</h2>
                <p className="settings-section-desc">Selecciona el modelo neuronal de Google Gemini para el streaming multimodal bidireccional en tiempo real.</p>
              </div>

              {/* API Key */}
              <div className="settings-field-group">
                <div className="settings-field-label-row">
                  <label className="settings-field-label">
                    <Key size={13} />
                    <span>Clave de API de Gemini Live (Google AI Studio)</span>
                  </label>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="settings-link-badge">
                    <span>Obtener Clave Gratis</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
                <div className="settings-input-wrapper">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className="settings-text-input"
                    placeholder="AIzaSy..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    spellCheck="false"
                  />
                  <button type="button" className="settings-input-action-btn" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="settings-field-hint">Tu clave se guarda localmente en tu equipo con cifrado seguro y nunca sale a servidores de terceros.</p>
              </div>

              {/* Model Selection */}
              <div className="settings-field-group">
                <label className="settings-field-label">
                  <Bot size={13} />
                  <span>Modelo de Lenguaje en Vivo</span>
                </label>
                <div className="settings-model-grid">
                  {Object.values(GEMINI_MODELS).map((m) => {
                    const isSelected = modelId === m.id;
                    return (
                      <div
                        key={m.id}
                        className={`settings-card-select ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          soundFxService.playClick();
                          setModelId(m.id);
                        }}
                      >
                        <div className="settings-card-select-header">
                          <span className="settings-card-title">{m.displayName}</span>
                          {isSelected && <span className="settings-badge-active">ACTIVO</span>}
                        </div>
                        <p className="settings-card-desc">{m.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Temperature */}
              <div className="settings-field-group">
                <div className="settings-field-label-row">
                  <label className="settings-field-label">
                    <Sliders size={13} />
                    <span>Temperatura de Creatividad: {temperature}</span>
                  </label>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={temperature}
                  className="settings-range-slider"
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                />
                <p className="settings-field-hint">Valores bajos (0.2) dan respuestas lógicas y predecibles; valores altos (0.8 - 1.2) aumentan la expresividad y el coqueteo.</p>
              </div>
            </div>
          )}

          {/* TAB 2: AVATAR LIVE2D */}
          {activeTab === 'avatar' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2 className="settings-section-title">Catálogo de Modelos Live2D Cubism</h2>
                <p className="settings-section-desc">Selecciona la apariencia y modelo 2D de Cristi. Los 8 modelos están precargados con físicas y lip-sync sincronizados.</p>
              </div>

              <div className="settings-avatar-grid">
                {allLive2dModels.map((avatar) => {
                  const isSelected = live2dModelId === avatar.id;
                  return (
                    <div
                      key={avatar.id}
                      className={`settings-avatar-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        soundFxService.playClick();
                        setLive2dModelId(avatar.id);
                      }}
                    >
                      <div className="settings-avatar-header">
                        <span className="settings-avatar-name">{avatar.name}</span>
                        {isSelected && <span className="settings-badge-active">ACTIVO</span>}
                      </div>
                      <p className="settings-avatar-desc">{avatar.description}</p>
                      <div className="settings-avatar-tags">
                        <span className="settings-avatar-tag">Lip-Sync</span>
                        <span className="settings-avatar-tag">Físicas 240Hz</span>
                        <span className="settings-avatar-tag">{avatar.category || 'Live2D'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: FONDO & ESCENAS */}
          {activeTab === 'scene' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2 className="settings-section-title">Fondo &amp; Entorno Visual</h2>
                <p className="settings-section-desc">Configura si Cristi vive flotando sobre tu escritorio de Windows con click-through o dentro de una escena cinemática.</p>
              </div>

              <div className="settings-scene-grid">
                {availableScenes.map((sc) => {
                  const isSelected = sceneId === sc.id;
                  return (
                    <div
                      key={sc.id}
                      className={`settings-scene-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        soundFxService.playClick();
                        setSceneId(sc.id);
                        sceneManager.setScene(sc.id);
                      }}
                    >
                      <div className="settings-scene-header">
                        <span className="settings-scene-name">{sc.name}</span>
                        {isSelected && <span className="settings-badge-active">ACTIVO</span>}
                      </div>
                      <p className="settings-scene-desc">{sc.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: VOZ & BIOMETRÍA VOCAL */}
          {activeTab === 'voice' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2 className="settings-section-title">Voz de Cristi &amp; Biometría Vocal</h2>
                <p className="settings-section-desc">Selecciona el timbre de voz de Gemini y calibra el reconocimiento biométrico para que Cristi solo te responda a ti.</p>
              </div>

              {/* Gemini Standard Voices */}
              <div className="settings-field-group">
                <label className="settings-field-label">
                  <Volume2 size={13} />
                  <span>Timbre de Voz en Tiempo Real (Gemini Live)</span>
                </label>
                <div className="settings-voice-grid">
                  {GEMINI_STANDARD_VOICES.map((v) => {
                    const isSelected = voiceName === v.id;
                    return (
                      <div
                        key={v.id}
                        className={`settings-voice-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          soundFxService.playClick();
                          setVoiceName(v.id);
                        }}
                      >
                        <div className="settings-voice-header">
                          <span className="settings-voice-name">{v.name}</span>
                          <span className="settings-voice-gender">{v.gender}</span>
                          {isSelected && <span className="settings-badge-active">ACTIVO</span>}
                        </div>
                        <p className="settings-voice-desc">{v.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Biometric Voice Profile */}
              <div className="settings-field-group" style={{ marginTop: '16px' }}>
                <label className="settings-field-label">
                  <ShieldCheck size={13} />
                  <span>Perfil Biométrico Vocal del Dueño</span>
                </label>
                <div className="settings-biometrics-card">
                  <div className="settings-biometrics-header">
                    <div>
                      <span className="settings-biometrics-title">
                        {hasVoiceProfile ? `✓ Perfil Activo (${speakerRecognitionService.getProfileInfo()?.name || 'Mi Dueño'})` : 'Sin Perfil Registrado'}
                      </span>
                      <p className="settings-biometrics-subtitle">
                        {hasVoiceProfile
                          ? `Registrado con ${speakerRecognitionService.getProfileInfo()?.sampleCount || 1} muestra(s) biométrica(s).`
                          : 'Registra tu voz para que Cristi filtre ruidos y voces de terceros.'}
                      </p>
                    </div>
                    {hasVoiceProfile && (
                      <button
                        type="button"
                        className="settings-btn-reset-danger"
                        onClick={() => {
                          soundFxService.playClick();
                          speakerRecognitionService.clearProfile();
                          setHasVoiceProfile(false);
                          toastService.success('Perfil biométrico borrado.');
                        }}
                      >
                        Borrar Perfil
                      </button>
                    )}
                  </div>

                  {/* Threshold Sliders */}
                  <div className="settings-thresholds-grid">
                    <div>
                      <div className="settings-field-label-row">
                        <span className="settings-threshold-label">Umbral de Aceptación: {Math.round(matchThreshold * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="0.95"
                        step="0.01"
                        value={matchThreshold}
                        className="settings-range-slider"
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setMatchThreshold(val);
                          speakerRecognitionService.matchThreshold = val;
                          speakerRecognitionService.saveProfile();
                        }}
                      />
                    </div>
                    <div>
                      <div className="settings-field-label-row">
                        <span className="settings-threshold-label">Umbral de Rechazo: {Math.round(rejectThreshold * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.3"
                        max="0.8"
                        step="0.01"
                        value={rejectThreshold}
                        className="settings-range-slider"
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setRejectThreshold(val);
                          speakerRecognitionService.rejectThreshold = val;
                          speakerRecognitionService.saveProfile();
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PERSONALIDAD & PROMPTS */}
          {activeTab === 'persona' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2 className="settings-section-title">Personalidad &amp; Instrucción Maestra</h2>
                <p className="settings-section-desc">Define el comportamiento, tono afectivo y conocimientos de Cristi. Puedes elegir presets instantáneos o editar el texto libremente.</p>
              </div>

              {/* Persona Presets */}
              <div className="settings-field-group">
                <label className="settings-field-label">
                  <Sparkles size={13} />
                  <span>Presets Rápidos de Personalidad</span>
                </label>
                <div className="settings-preset-chips-row">
                  {PERSONA_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className="settings-preset-chip"
                        onClick={() => {
                          soundFxService.playClick();
                          setSystemPrompt(preset.prompt);
                        }}
                      >
                        <Icon size={12} color={preset.color} />
                        <span>{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prompt Textarea */}
              <div className="settings-field-group">
                <div className="settings-field-label-row">
                  <label className="settings-field-label">
                    <User size={13} />
                    <span>Instrucción del Sistema (Persona de Cristi)</span>
                  </label>
                  <button
                    type="button"
                    className="settings-reset-prompt-btn"
                    onClick={() => {
                      soundFxService.playClick();
                      setSystemPrompt(SYSTEM_PERSONA_PROMPT);
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>Restablecer por Defecto</span>
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  className="settings-prompt-textarea"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Escribe las instrucciones de personalidad de Cristi..."
                  spellCheck="false"
                />
                <p className="settings-field-hint">El área de texto se ajusta automáticamente a su contenido. Los cambios se guardan al pulsar "Guardar y Aplicar".</p>
              </div>
            </div>
          )}

          {/* TAB 6: ACTUALIZACIONES DEL SISTEMA */}
          {activeTab === 'updates' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2 className="settings-section-title">Actualizaciones del Sistema &amp; Versión</h2>
                <p className="settings-section-desc">Comprueba si hay nuevas versiones de Cristi AI Companion con optimizaciones y nuevas funciones.</p>
              </div>

              <div className="settings-update-card">
                <div className="settings-update-info">
                  <span className="settings-update-badge">Cristi AI Companion</span>
                  <span className="settings-update-version">v{appVersion}</span>
                  <span className="settings-update-channel">Canal Oficial de Distribución</span>
                </div>

                <div className="settings-update-status-msg">
                  <p>{updateState.message}</p>
                </div>

                <div className="settings-update-actions">
                  <button
                    type="button"
                    className="settings-btn-save-top"
                    onClick={handleCheckUpdates}
                    disabled={updateState.status === 'checking' || updateState.status === 'downloading'}
                  >
                    <RefreshCw size={14} className={updateState.status === 'checking' ? 'spin' : ''} />
                    <span>{updateState.status === 'checking' ? 'Buscando...' : 'Comprobar Actualizaciones'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Bottom Sticky Action Strip */}
      <footer className="settings-bottom-bar">
        <span className="settings-footer-note">Cristi AI Companion • Arquitectura Multi-Ventana de Alto Rendimiento</span>
        <div className="settings-bottom-buttons">
          <button type="button" className="settings-btn-secondary" onClick={handleCloseWindow}>
            Cerrar
          </button>
          <button type="button" className="settings-btn-save-top" onClick={handleSaveAndApply}>
            <Check size={14} />
            <span>Guardar y Aplicar</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
