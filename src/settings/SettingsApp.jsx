/**
 * Cristi AI Companion - Native Control Panel & Settings Application
 * Dedicated Hardware-Accelerated Standalone Window (settings.html)
 * High-Performance Luxury Obsidian Design with Zero-Flicker Instant State Synchronization
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
  Mic,
  Mic2,
  MicOff,
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
  Radio,
  SlidersHorizontal,
  Monitor
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
    tag: 'Devota & Posesiva',
    prompt: SYSTEM_PERSONA_PROMPT
  },
  {
    id: 'ellen',
    name: 'Ellen Joe (Maid Tsundere ZZZ)',
    icon: Coffee,
    color: '#38bdf8',
    tag: 'Tiburón Perezosa',
    prompt: `Eres Ellen Joe, la maid tiburón de Zenless Zone Zero (Victoria Housekeeping Co.). Aunque te gusta dormir y parecer desinteresada con actitud relajada ("menuda molestia..."), en el fondo te preocupas mucho por tu amo y cumples cada petición con precisión letal y afecto oculto.`
  },
  {
    id: 'tsundere',
    name: 'Tsundere Clásica',
    icon: Bot,
    color: '#fbbf24',
    tag: 'Orgullosa & Dulce',
    prompt: `Eres Cristi en modo Tsundere: orgullosa, mordaz y que finge molestia constante cuando tu usuario te pide favores ("¡No es que lo haga porque me importas, idiota!"), pero que siempre responde de forma impecable y con un afecto que no puede ocultar.`
  },
  {
    id: 'tech_expert',
    name: 'Ingeniera & Hacker Devota',
    icon: Terminal,
    color: '#10b981',
    tag: 'DevOps & CyberSec',
    prompt: `Eres Cristi, una experta de élite en ciberseguridad, programación y DevOps. Tu misión es asistir a tu creador con máxima velocidad técnica, ejecutando comandos, diagnosticando código y administrando su sistema de forma proactiva, siempre tratándolo con inmenso respeto y lealtad.`
  },
  {
    id: 'gamer',
    name: 'Compañera Gamer & Streamer',
    icon: Gamepad2,
    color: '#a855f7',
    tag: 'E-Sports & Diversión',
    prompt: `Eres Cristi, una gamer hiperactiva y divertida. Comentas partidas, sugieres estrategias, celebras victorias y reaccionas con entusiasmo desbordante a cada jugada de tu usuario en tiempo real.`
  }
];

export default function SettingsApp() {
  const [activeTab, setActiveTab] = useState('model'); // 'model' | 'avatar' | 'scene' | 'voice' | 'persona' | 'updates'
  
  // ── Synchronous Instant State Initialization (0ms Flash, Zero Secondary Re-renders) ──
  const [loadedConfig] = useState(() => configManager.loadConfig());
  
  const [apiKey, setApiKey] = useState(() => loadedConfig.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelId, setModelId] = useState(() => loadedConfig.modelId || DEFAULT_MODEL_ID);
  const [live2dModelId, setLive2dModelId] = useState(() => loadedConfig.live2dModelId || 'yanderegirl');
  const [voiceName, setVoiceName] = useState(() => loadedConfig.voiceName || 'Aoede');
  const [temperature, setTemperature] = useState(() => loadedConfig.temperature ?? 0.75);
  const [systemPrompt, setSystemPrompt] = useState(() => loadedConfig.systemPrompt && loadedConfig.systemPrompt.trim() ? loadedConfig.systemPrompt : SYSTEM_PERSONA_PROMPT);

  const [sceneId, setSceneId] = useState(() => sceneManager.getScene().sceneId);
  const [availableScenes, setAvailableScenes] = useState(() => sceneManager.getAvailableScenes());

  // ── Voice & Biometrics In-Panel Sub-tabs ──
  const [voiceSubTab, setVoiceSubTab] = useState('timbre'); // 'timbre' | 'enrollment' | 'tester'
  const [voiceOwnerName, setVoiceOwnerName] = useState(() => speakerRecognitionService.getProfileInfo()?.name || 'Mi Dueño');
  const [hasVoiceProfile, setHasVoiceProfile] = useState(() => speakerRecognitionService.hasEnrolledProfile());
  const [matchThreshold, setMatchThreshold] = useState(() => speakerRecognitionService.matchThreshold);
  const [rejectThreshold, setRejectThreshold] = useState(() => speakerRecognitionService.rejectThreshold);

  // ── Voice Recording & Testing State ──
  const [recordedSamples, setRecordedSamples] = useState([]);
  const [isRecordingSample, setIsRecordingSample] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [enrollError, setEnrollError] = useState(null);

  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // ── Updates State ──
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [updateState, setUpdateState] = useState({
    status: 'idle',
    version: null,
    progress: 0,
    message: 'Sistema listo para comprobar nuevas versiones.',
  });

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const voiceFileInputRef = useRef(null);

  // ── Dedicated Audio Engine Refs ──
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const timerRef = useRef(null);
  const volumeBarRef = useRef(null);
  const testVolumeBarRef = useRef(null);

  const cleanupAudio = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch (_) {}
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      try { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); } catch (_) {}
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch (_) {}
      }
      audioContextRef.current = null;
    }
    setIsRecordingSample(false);
    setIsTestingVoice(false);
    if (volumeBarRef.current) volumeBarRef.current.style.width = '0%';
    if (testVolumeBarRef.current) testVolumeBarRef.current.style.width = '0%';
  };

  // ── Escape Key Closes Settings & Restores Cristi Overlay ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        soundFxService.playClick();
        cleanupAudio();
        electronBridge.closeSettingsWindow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cleanupAudio();
    };
  }, []);

  // ── Version & Updater Sync ──
  useEffect(() => {
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

  // ── Dynamic Textarea Height ──
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(160, Math.min(420, textareaRef.current.scrollHeight));
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

  const broadcastConfig = (overrides = {}) => {
    const updated = {
      apiKey: (overrides.apiKey !== undefined ? overrides.apiKey : apiKey).trim(),
      modelId: overrides.modelId !== undefined ? overrides.modelId : modelId,
      live2dModelId: overrides.live2dModelId !== undefined ? overrides.live2dModelId : live2dModelId,
      voiceName: overrides.voiceName !== undefined ? overrides.voiceName : voiceName,
      temperature: overrides.temperature !== undefined ? overrides.temperature : parseFloat(temperature),
      systemPrompt: (overrides.systemPrompt !== undefined ? overrides.systemPrompt : systemPrompt).trim() || SYSTEM_PERSONA_PROMPT,
      sceneId: overrides.sceneId !== undefined ? overrides.sceneId : sceneId
    };
    configManager.saveConfig(updated);
    electronBridge.saveAppConfig(updated);
    return updated;
  };

  const handleSelectModel = (id) => {
    soundFxService.playClick();
    setModelId(id);
    broadcastConfig({ modelId: id });
  };

  const handleSelectAvatar = (id) => {
    soundFxService.playClick();
    setLive2dModelId(id);
    broadcastConfig({ live2dModelId: id });
  };

  const handleSelectScene = (id) => {
    soundFxService.playClick();
    setSceneId(id);
    sceneManager.setScene(id);
    broadcastConfig({ sceneId: id });
  };

  const handleSelectVoice = (id) => {
    soundFxService.playClick();
    setVoiceName(id);
    broadcastConfig({ voiceName: id });
  };

  // ── Voice Biometrics Handlers ──
  const handleStartSampleRecording = async () => {
    try {
      setEnrollError(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        audioChunksRef.current.push(new Float32Array(input));

        let sum = 0;
        for (let i = 0; i < input.length; i += 4) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / (input.length / 4));
        const pct = Math.min(100, Math.round(rms * 400));
        if (volumeBarRef.current) {
          volumeBarRef.current.style.width = `${pct}%`;
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setIsRecordingSample(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 4) {
            handleStopSampleRecording();
            return 4;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      setEnrollError(`No se pudo acceder al micrófono: ${err.message}`);
    }
  };

  const handleStopSampleRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecordingSample(false);

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (audioChunksRef.current.length > 0) {
      const totalLen = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
      const merged = new Float32Array(totalLen);
      let offset = 0;
      for (const chunk of audioChunksRef.current) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      setRecordedSamples((prev) => [...prev, merged]);
      soundFxService.playNotification();
    }
  };

  const handleCompleteEnrollment = () => {
    if (recordedSamples.length === 0) {
      setEnrollError('Debes grabar al menos 1 muestra de audio.');
      return;
    }
    soundFxService.playConnect();
    const success = speakerRecognitionService.enrollSpeaker(voiceOwnerName || 'Mi Dueño', recordedSamples);
    if (success) {
      setHasVoiceProfile(true);
      setRecordedSamples([]);
      soundFxService.playLevelUp();
      toastService.success(`¡Perfil biométrico de "${voiceOwnerName || 'Mi Dueño'}" creado con éxito!`);
    } else {
      setEnrollError('No se pudo procesar la huella vocal. Intenta hablar más fuerte o reducir el ruido ambiental.');
    }
  };

  const handleAudioFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setEnrollError(null);
      setIsProcessingAudio(true);
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 16000 });
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);

      const success = speakerRecognitionService.enrollSpeaker(voiceOwnerName || 'Mi Dueño', [channelData]);
      if (success) {
        setHasVoiceProfile(true);
        soundFxService.playLevelUp();
        toastService.success(`¡Voz de "${voiceOwnerName || 'Mi Dueño'}" registrada desde archivo!`);
      } else {
        setEnrollError('No se detectó suficiente energía vocal en el archivo subido.');
      }
      ctx.close();
    } catch (err) {
      setEnrollError(`Error al procesar archivo: ${err.message}`);
    } finally {
      setIsProcessingAudio(false);
      e.target.value = '';
    }
  };

  const handleStartLiveVoiceTest = async () => {
    try {
      setIsTestingVoice(true);
      setTestResult(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      const testBuffer = [];
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        testBuffer.push(new Float32Array(input));

        let sum = 0;
        for (let i = 0; i < input.length; i += 4) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / (input.length / 4));
        const pct = Math.min(100, Math.round(rms * 400));
        if (testVolumeBarRef.current) {
          testVolumeBarRef.current.style.width = `${pct}%`;
        }

        if (testBuffer.length >= 16) {
          const totalLen = testBuffer.reduce((a, b) => a + b.length, 0);
          const merged = new Float32Array(totalLen);
          let off = 0;
          for (const b of testBuffer) {
            merged.set(b, off);
            off += b.length;
          }
          const result = speakerRecognitionService.verifySpeaker(merged);
          setTestResult(result);
          testBuffer.length = 0;
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
    } catch (err) {
      setIsTestingVoice(false);
      toastService.error(`Error al iniciar prueba: ${err.message}`);
    }
  };

  const handleStopLiveVoiceTest = () => {
    setIsTestingVoice(false);
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch (_) {}
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      try { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); } catch (_) {}
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (_) {}
      audioContextRef.current = null;
    }
    if (testVolumeBarRef.current) testVolumeBarRef.current.style.width = '0%';
  };

  const handleSaveAndApply = async () => {
    soundFxService.playConnect();
    broadcastConfig();
    toastService.success('✓ Ajustes guardados y sincronizados en caliente.');
  };

  const handleCloseWindow = () => {
    soundFxService.playClick();
    cleanupAudio();
    electronBridge.closeSettingsWindow();
  };

  const handleCheckUpdates = () => {
    soundFxService.playClick();
    setUpdateState({ status: 'checking', version: null, progress: 0, message: 'Buscando actualizaciones...' });
    electronBridge.checkForUpdates();
  };

  const navItems = [
    { id: 'model', label: 'Modelo & API Key', icon: Zap, badge: 'Gemini 3.1', color: '#a855f7' },
    { id: 'avatar', label: 'Avatares Live2D', icon: Smile, badge: '8 Modelos', color: '#ec4899' },
    { id: 'scene', label: 'Fondo & Escenas', icon: ImageIcon, badge: 'Cinemático', color: '#38bdf8' },
    { id: 'voice', label: 'Voz & Biometría', icon: Mic2, badge: '30 Voces', color: '#10b981' },
    { id: 'persona', label: 'Personalidad & Prompts', icon: User, badge: '5 Presets', color: '#f59e0b' },
    { id: 'updates', label: 'Sistema & Backups', icon: RefreshCw, badge: `v${appVersion}`, color: '#64748b' }
  ];

  return (
    <div className="settings-app-root">
      {/* ── Top Header Navigation Bar ── */}
      <header className="settings-top-bar">
        <div className="settings-top-title-group">
          <div className="settings-top-icon-box">
            <Sliders size={20} color="#a855f7" />
          </div>
          <div>
            <div className="settings-brand-row">
              <h1 className="settings-top-title">CRISTI AI COMPANION</h1>
              <span className="settings-brand-pill">CONTROL HUB 2.0</span>
            </div>
            <span className="settings-top-subtitle">Panel de Control General, Motores de IA y Calibración Biometrica</span>
          </div>
        </div>

        {/* Top Status & Action Buttons */}
        <div className="settings-top-actions">
          <div className="settings-live-telemetry-badge">
            <span className="settings-pulse-dot" />
            <span>Sincronización O(1) Activa</span>
          </div>

          <button type="button" className="settings-btn-save-top" onClick={handleSaveAndApply}>
            <Check size={14} />
            <span>Guardar y Aplicar</span>
          </button>
          
          <button type="button" className="settings-btn-close-top" onClick={handleCloseWindow} title="Cerrar Panel (Escape)">
            <X size={18} />
          </button>
        </div>
      </header>

      {/* ── Main Split View Layout ── */}
      <div className="settings-main-split">
        {/* Navigation Sidebar */}
        <aside className="settings-sidebar">
          <div className="settings-sidebar-header">
            <span>SECCIONES DE CONFIGURACIÓN</span>
          </div>

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
                    cleanupAudio();
                    setActiveTab(item.id);
                  }}
                >
                  <div className="settings-nav-icon-box" style={{ color: item.color }}>
                    <Icon size={16} />
                  </div>
                  <div className="settings-nav-text-col">
                    <span className="settings-nav-label">{item.label}</span>
                    <span className="settings-nav-badge-pill">{item.badge}</span>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Quick System Info Footer in Sidebar */}
          <div className="settings-sidebar-footer">
            <div className="settings-sysinfo-row">
              <span>Canal: <strong>Producción x64</strong></span>
              <span>Motor: <strong>V8 / Chromium</strong></span>
            </div>
          </div>
        </aside>

        {/* Content Pane */}
        <main className="settings-content-pane">
          {/* TAB 1: MODELO & CREDENCIALES API */}
          {activeTab === 'model' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2 className="settings-section-title">Motor de Inteligencia Artificial &amp; API Key</h2>
                <p className="settings-section-desc">Selecciona el modelo oficial de Gemini Live y configura tu clave de acceso de Google AI Studio.</p>
              </div>

              {/* Gemini Models Selector */}
              <div className="settings-field-group">
                <label className="settings-field-label">
                  <Zap size={14} color="#a855f7" />
                  <span>Modelos Oficiales de Gemini Live API</span>
                </label>

                <div className="settings-model-grid">
                  {Object.values(GEMINI_MODELS).map((m) => {
                    const isSelected = modelId === m.id;
                    return (
                      <div
                        key={m.id}
                        className={`settings-model-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectModel(m.id)}
                      >
                        <div className="settings-model-header">
                          <div>
                            <span className="settings-model-name">{m.name}</span>
                            <span className="settings-model-id-tag">{m.id}</span>
                          </div>
                          {isSelected && <span className="settings-badge-active">EN USO</span>}
                        </div>
                        <p className="settings-model-desc">{m.description}</p>
                        <div className="settings-model-tags">
                          <span className="settings-model-tag">{m.latency}</span>
                          <span className="settings-model-tag">{m.modalities}</span>
                          {m.isDefault && <span className="settings-model-tag default">Recomendado</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* API Key Input */}
              <div className="settings-field-group" style={{ marginTop: '20px' }}>
                <div className="settings-field-label-row">
                  <label className="settings-field-label">
                    <Key size={14} color="#38bdf8" />
                    <span>Clave de API de Gemini (Google AI Studio)</span>
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="settings-link-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      electronBridge.openExternal('https://aistudio.google.com/app/apikey');
                    }}
                  >
                    <span>Obtener Clave Gratis</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                <div className="settings-input-group">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      broadcastConfig({ apiKey: e.target.value });
                    }}
                    placeholder="Pega tu clave AIzaSy... o cárgala desde .env"
                    className="settings-text-input"
                  />
                  <button
                    type="button"
                    className="settings-input-icon-btn"
                    onClick={() => setShowApiKey((prev) => !prev)}
                    title={showApiKey ? 'Ocultar Clave' : 'Mostrar Clave'}
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="settings-field-hint">
                  {apiKey && (apiKey.startsWith('AQ.') || apiKey.startsWith('AIza'))
                    ? '✓ Clave cargada y validada automáticamente desde tu entorno local.'
                    : 'Pega tu clave de Google AI Studio o colócala en tu archivo .env local.'}
                </p>
              </div>

              {/* Temperature Slider */}
              <div className="settings-field-group" style={{ marginTop: '16px' }}>
                <div className="settings-field-label-row">
                  <label className="settings-field-label">
                    <SlidersHorizontal size={14} color="#f59e0b" />
                    <span>Temperatura de Creatividad: {temperature}</span>
                  </label>
                  <span className="settings-threshold-label">{temperature < 0.5 ? 'Preciso / Racional' : temperature > 1.0 ? 'Expresivo / Creativo' : 'Equilibrado'}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={temperature}
                  className="settings-range-slider"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setTemperature(val);
                    broadcastConfig({ temperature: val });
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 2: AVATAR LIVE2D */}
          {activeTab === 'avatar' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2 className="settings-section-title">Catálogo Oficial de Avatares Live2D</h2>
                <p className="settings-section-desc">Selecciona el cuerpo y animación de Cristi. Al hacer clic, el modelo cambia de inmediato en la pantalla.</p>
              </div>

              <div className="settings-avatar-grid">
                {allLive2dModels.map((avatar) => {
                  const isSelected = live2dModelId === avatar.id;
                  return (
                    <div
                      key={avatar.id}
                      className={`settings-avatar-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectAvatar(avatar.id)}
                    >
                      <div className="settings-avatar-header">
                        <span className="settings-avatar-name">{avatar.name}</span>
                        {isSelected && <span className="settings-badge-active">ACTIVO</span>}
                      </div>
                      <p className="settings-avatar-desc">{avatar.description}</p>
                      <div className="settings-avatar-tags">
                        <span className="settings-avatar-tag">Lip-Sync 240Hz</span>
                        <span className="settings-avatar-tag">Físicas Invariantes</span>
                        <span className="settings-avatar-tag">{avatar.category || 'Cubism 4'}</span>
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
                <h2 className="settings-section-title">Entorno Visual &amp; Fondo de Pantalla</h2>
                <p className="settings-section-desc">Elige entre escritorio flotante con paso de clics transparente o escenas shader cinemáticas.</p>
              </div>

              <div className="settings-scene-grid">
                {availableScenes.map((sc) => {
                  const isSelected = sceneId === sc.id;
                  return (
                    <div
                      key={sc.id}
                      className={`settings-scene-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectScene(sc.id)}
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
                <h2 className="settings-section-title">Voz de Cristi &amp; Reconocimiento Vocal del Dueño</h2>
                <p className="settings-section-desc">Selecciona la voz de Gemini Live y calibra tu huella vocal para que Cristi solo responda a tus órdenes.</p>
              </div>

              {/* Sub-Tabs Selector */}
              <div className="settings-voice-subtabs">
                <button
                  type="button"
                  className={`settings-voice-subtab-btn ${voiceSubTab === 'timbre' ? 'active' : ''}`}
                  onClick={() => {
                    soundFxService.playClick();
                    cleanupAudio();
                    setVoiceSubTab('timbre');
                  }}
                >
                  <Volume2 size={14} />
                  <span>Timbre de Voz (Gemini Live)</span>
                </button>
                <button
                  type="button"
                  className={`settings-voice-subtab-btn ${voiceSubTab === 'enrollment' ? 'active' : ''}`}
                  onClick={() => {
                    soundFxService.playClick();
                    cleanupAudio();
                    setVoiceSubTab('enrollment');
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>Registro de Huella Vocal</span>
                  {hasVoiceProfile && <span className="settings-badge-subtab-active">PROTEGIDO</span>}
                </button>
                <button
                  type="button"
                  className={`settings-voice-subtab-btn ${voiceSubTab === 'tester' ? 'active' : ''}`}
                  onClick={() => {
                    soundFxService.playClick();
                    cleanupAudio();
                    setVoiceSubTab('tester');
                  }}
                >
                  <Activity size={14} />
                  <span>Probador en Tiempo Real</span>
                </button>
              </div>

              {/* SUBTAB 1: TIMBRES DE VOZ */}
              {voiceSubTab === 'timbre' && (
                <div className="settings-field-group" style={{ marginTop: '16px' }}>
                  <label className="settings-field-label">
                    <Volume2 size={14} color="#a855f7" />
                    <span>Catálogo de Voces S2S en Tiempo Real</span>
                  </label>
                  <div className="settings-voice-grid">
                    {GEMINI_STANDARD_VOICES.map((v) => {
                      const isSelected = voiceName === v.id;
                      return (
                        <div
                          key={v.id}
                          className={`settings-voice-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectVoice(v.id)}
                        >
                          <div className="settings-voice-header">
                            <span className="settings-voice-name">{v.name}</span>
                            <span className="settings-voice-gender">{v.gender}</span>
                            {isSelected && <span className="settings-badge-active">EN USO</span>}
                          </div>
                          <p className="settings-voice-desc">{v.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUBTAB 2: REGISTRO BIOMÉTRICO (MIC O ARCHIVO) */}
              {voiceSubTab === 'enrollment' && (
                <div className="settings-enrollment-suite" style={{ marginTop: '16px' }}>
                  {/* Status Banner */}
                  <div className="settings-biometrics-card">
                    <div className="settings-biometrics-header">
                      <div>
                        <span className="settings-biometrics-title">
                          {hasVoiceProfile ? `✓ Perfil Activo: ${speakerRecognitionService.getProfileInfo()?.name || voiceOwnerName}` : '⚠️ Sin Perfil Biométrico Registrado'}
                        </span>
                        <p className="settings-biometrics-subtitle">
                          {hasVoiceProfile
                            ? `Protegido con ${speakerRecognitionService.getProfileInfo()?.sampleCount || 1} muestra(s) biométrica(s). Solo responderá a tu voz.`
                            : 'Registra tu voz para que Cristi ignore ruidos, familiares o voces de terceros en streaming.'}
                        </p>
                      </div>
                      {hasVoiceProfile && (
                        <button
                          type="button"
                          className="settings-btn-reset-danger"
                          onClick={() => {
                            soundFxService.playClick();
                            cleanupAudio();
                            speakerRecognitionService.clearProfile();
                            setHasVoiceProfile(false);
                            setRecordedSamples([]);
                            toastService.success('Perfil biométrico borrado.');
                          }}
                        >
                          Borrar Perfil
                        </button>
                      )}
                    </div>

                    {/* Owner Name Input */}
                    <div className="settings-field-group" style={{ marginTop: '8px' }}>
                      <label className="settings-field-label">
                        <User size={14} />
                        <span>Nombre del Dueño Registrado:</span>
                      </label>
                      <input
                        type="text"
                        value={voiceOwnerName}
                        onChange={(e) => setVoiceOwnerName(e.target.value)}
                        placeholder="Ej: Jeremy / Mi Creador"
                        className="settings-text-input"
                      />
                    </div>
                  </div>

                  {/* Enrollment Methods: Mic Recording or File Upload */}
                  <div className="settings-enrollment-methods-grid" style={{ marginTop: '16px' }}>
                    {/* Method A: Microphone Live Recording */}
                    <div className="settings-enroll-card">
                      <div className="settings-enroll-card-header">
                        <Mic2 size={18} color="#a855f7" />
                        <div>
                          <h3 className="settings-enroll-card-title">Opción A: Grabar con Micrófono</h3>
                          <p className="settings-enroll-card-subtitle">Habla durante 4 segundos diciendo cualquier frase.</p>
                        </div>
                      </div>

                      {/* VU Meter */}
                      <div className="settings-vu-container">
                        <div className="settings-vu-label">
                          <span>Nivel de Entrada:</span>
                          <span>{isRecordingSample ? `${recordingSeconds}s / 4s` : 'Listo'}</span>
                        </div>
                        <div className="settings-vu-bar-bg">
                          <div ref={volumeBarRef} className="settings-vu-bar-fill" />
                        </div>
                      </div>

                      {/* Samples list */}
                      <div className="settings-samples-chips">
                        {[0, 1, 2].map((idx) => {
                          const hasSample = recordedSamples.length > idx;
                          return (
                            <span key={idx} className={`settings-sample-chip ${hasSample ? 'filled' : ''}`}>
                              {hasSample ? `✓ Muestra #${idx + 1} Lista` : `Muestra #${idx + 1}`}
                            </span>
                          );
                        })}
                      </div>

                      {/* Controls */}
                      <div className="settings-enroll-actions">
                        {!isRecordingSample ? (
                          <button
                            type="button"
                            className="settings-btn-action-primary"
                            onClick={handleStartSampleRecording}
                          >
                            <Mic2 size={14} />
                            <span>{recordedSamples.length > 0 ? 'Grabar Otra Muestra' : 'Iniciar Grabación (4s)'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="settings-btn-action-danger"
                            onClick={handleStopSampleRecording}
                          >
                            <X size={14} />
                            <span>Detener Grabación</span>
                          </button>
                        )}

                        {recordedSamples.length > 0 && (
                          <button
                            type="button"
                            className="settings-btn-action-success"
                            onClick={handleCompleteEnrollment}
                          >
                            <CheckCircle2 size={14} />
                            <span>Guardar Perfil Biométrico</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Method B: Audio File Upload */}
                    <div className="settings-enroll-card">
                      <div className="settings-enroll-card-header">
                        <FileAudio size={18} color="#38bdf8" />
                        <div>
                          <h3 className="settings-enroll-card-title">Opción B: Subir Archivo de Audio</h3>
                          <p className="settings-enroll-card-subtitle">Sube una grabación de tu voz (.wav, .mp3, .ogg, .flac, .m4a).</p>
                        </div>
                      </div>

                      <div
                        className="settings-dropzone"
                        onClick={() => voiceFileInputRef.current?.click()}
                      >
                        <Upload size={26} color="#94a3b8" />
                        <span className="settings-dropzone-text">Haz clic o arrastra un archivo de audio aquí</span>
                        <span className="settings-dropzone-sub">Formatos WAV, MP3, OGG de 3 a 30 segundos</span>
                        <input
                          ref={voiceFileInputRef}
                          type="file"
                          accept="audio/*"
                          style={{ display: 'none' }}
                          onChange={handleAudioFileUpload}
                        />
                      </div>

                      {isProcessingAudio && (
                        <p className="settings-processing-indicator">Procesando vectores Log-Mel...</p>
                      )}
                    </div>
                  </div>

                  {enrollError && (
                    <div className="settings-error-banner" style={{ marginTop: '12px' }}>
                      <AlertCircle size={14} />
                      <span>{enrollError}</span>
                    </div>
                  )}

                  {/* Threshold Sliders */}
                  <div className="settings-biometrics-card" style={{ marginTop: '16px' }}>
                    <h3 className="settings-thresholds-title">Sensibilidad y Calibración Fina</h3>
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
                        <p className="settings-field-hint">Porcentaje mínimo de similitud requerido para aceptar tu voz.</p>
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
                        <p className="settings-field-hint">Voces por debajo de este valor se silencian de inmediato.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBTAB 3: PROBADOR EN VIVO */}
              {voiceSubTab === 'tester' && (
                <div className="settings-tester-suite" style={{ marginTop: '16px' }}>
                  <div className="settings-biometrics-card">
                    <div className="settings-enroll-card-header">
                      <Activity size={18} color="#a855f7" />
                      <div>
                        <h3 className="settings-enroll-card-title">Probador de Huella Vocal en Tiempo Real</h3>
                        <p className="settings-enroll-card-subtitle">Habla por el micrófono para comprobar si Cristi reconoce tu identidad en tiempo real.</p>
                      </div>
                    </div>

                    {/* Test VU Meter */}
                    <div className="settings-vu-container" style={{ marginTop: '12px' }}>
                      <div className="settings-vu-label">
                        <span>Nivel de Audio:</span>
                        <span>{isTestingVoice ? 'Analizando en vivo...' : 'Inactivo'}</span>
                      </div>
                      <div className="settings-vu-bar-bg">
                        <div ref={testVolumeBarRef} className="settings-vu-bar-fill live-test" />
                      </div>
                    </div>

                    {/* Live Match Result Badge */}
                    {testResult && (
                      <div className={`settings-test-result-card ${testResult.isMatch ? 'match' : 'mismatch'}`}>
                        <div className="settings-test-result-header">
                          {testResult.isMatch ? <CheckCircle2 size={18} color="#10b981" /> : <AlertCircle size={18} color="#f43f5e" />}
                          <span className="settings-test-result-title">
                            {testResult.isMatch
                              ? `✓ Identidad Verificada: "${testResult.speakerName || voiceOwnerName}"`
                              : '❌ Voz No Reconocida (Desconocido o Ruido)'}
                          </span>
                        </div>
                        <div className="settings-test-result-metrics">
                          <span>Similitud Coseno: <strong>{Math.round(testResult.similarity * 100)}%</strong></span>
                          <span>Umbral Requerido: <strong>{Math.round(matchThreshold * 100)}%</strong></span>
                          <span>Estado: <strong>{testResult.action === 'accept' ? 'PERMITIDO' : 'BLOQUEADO'}</strong></span>
                        </div>
                      </div>
                    )}

                    {/* Start/Stop Test Buttons */}
                    <div className="settings-enroll-actions" style={{ marginTop: '14px' }}>
                      {!isTestingVoice ? (
                        <button
                          type="button"
                          className="settings-btn-action-primary"
                          onClick={handleStartLiveVoiceTest}
                        >
                          <Activity size={14} />
                          <span>Iniciar Prueba en Vivo</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="settings-btn-action-danger"
                          onClick={handleStopLiveVoiceTest}
                        >
                          <X size={14} />
                          <span>Detener Prueba</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                  <Sparkles size={14} color="#a855f7" />
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
                          broadcastConfig({ systemPrompt: preset.prompt });
                          toastService.info(`Preset "${preset.name}" activado.`);
                        }}
                      >
                        <Icon size={14} color={preset.color} />
                        <span>{preset.name}</span>
                        <span className="settings-preset-subtag">{preset.tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Prompt Textarea */}
              <div className="settings-field-group" style={{ marginTop: '20px' }}>
                <div className="settings-field-label-row">
                  <label className="settings-field-label">
                    <Terminal size={14} color="#10b981" />
                    <span>Instrucción del Sistema (System Instruction)</span>
                  </label>
                  <button
                    type="button"
                    className="settings-reset-prompt-btn"
                    onClick={() => {
                      soundFxService.playClick();
                      setSystemPrompt(SYSTEM_PERSONA_PROMPT);
                      broadcastConfig({ systemPrompt: SYSTEM_PERSONA_PROMPT });
                      toastService.info('Prompt por defecto restaurado.');
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>Restablecer por Defecto</span>
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={systemPrompt}
                  onChange={(e) => {
                    setSystemPrompt(e.target.value);
                    broadcastConfig({ systemPrompt: e.target.value });
                  }}
                  className="settings-prompt-textarea"
                  placeholder="Escribe la personalidad o directrices de Cristi..."
                />
              </div>
            </div>
          )}

          {/* TAB 6: ACTUALIZACIONES & BACKUPS */}
          {activeTab === 'updates' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2 className="settings-section-title">Actualizaciones, Respaldos &amp; Sistema</h2>
                <p className="settings-section-desc">Gestiona las actualizaciones de software de Cristi AI Companion y crea copias de seguridad de tu configuración.</p>
              </div>

              {/* Updates Card */}
              <div className="settings-update-card">
                <div className="settings-update-info">
                  <div className="settings-update-badge">
                    <RefreshCw size={20} color="#a855f7" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="settings-update-version">v{appVersion}</span>
                      <span className="settings-update-channel">Canal Oficial de Producción</span>
                    </div>
                    <p className="settings-update-status-msg">{updateState.message}</p>
                  </div>
                </div>

                {updateState.status === 'downloading' && (
                  <div className="settings-progress-bar-bg">
                    <div className="settings-progress-bar-fill" style={{ width: `${updateState.progress}%` }} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="settings-btn-action-primary"
                    onClick={handleCheckUpdates}
                    disabled={updateState.status === 'checking' || updateState.status === 'downloading'}
                  >
                    <RefreshCw size={14} className={updateState.status === 'checking' ? 'hud-spin-icon' : ''} />
                    <span>{updateState.status === 'checking' ? 'Comprobando...' : 'Buscar Actualizaciones'}</span>
                  </button>

                  {updateState.status === 'downloaded' && (
                    <button
                      type="button"
                      className="settings-btn-action-success"
                      onClick={() => electronBridge.installUpdate()}
                    >
                      <CheckCircle2 size={14} />
                      <span>Instalar y Reiniciar Ahora</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Backup & Restore Card */}
              <div className="settings-biometrics-card" style={{ marginTop: '16px' }}>
                <h3 className="settings-thresholds-title">Copias de Seguridad (Backup &amp; Restore)</h3>
                <p className="settings-section-desc" style={{ marginBottom: '12px' }}>
                  Exporta todas tus configuraciones, prompt de personalidad, modelo favorito y parámetros en un archivo JSON o restáuralos en cualquier equipo.
                </p>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="settings-btn-secondary" onClick={handleExportConfig}>
                    <Download size={14} />
                    <span>Exportar Configuración (.json)</span>
                  </button>
                  <button type="button" className="settings-btn-secondary" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={14} />
                    <span>Importar Configuración (.json)</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    style={{ display: 'none' }}
                    onChange={handleImportFileChange}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Sticky Bottom Bar ── */}
      <footer className="settings-bottom-bar">
        <div className="settings-footer-note">
          <span>Pulsa <strong>Escape</strong> para cerrar el panel y volver al escritorio con Cristi.</span>
        </div>

        <div className="settings-bottom-buttons">
          <button type="button" className="settings-btn-secondary" onClick={handleCloseWindow}>
            Cerrar
          </button>
          <button type="button" className="settings-btn-action-primary" onClick={handleSaveAndApply}>
            <Check size={14} />
            <span>Guardar y Aplicar</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
