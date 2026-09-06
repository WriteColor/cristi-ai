/**
 * Cristi AI Companion - Native Control Panel & Settings Application
 * 100% Tailwind CSS - Minimalist Shadcn Dark Gray Architecture
 * Includes Live Voice Previews (Free Tier), 2D/3D Model Visual Inspector,
 * Scene Previewer, Original 6 Persona Presets, and Synchronized Save State.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Key, Zap, Volume2, Smile, Box, Image as ImageIcon,
  Database, Gamepad2, Layers, Check, Plus, Trash2,
  Eye, EyeOff, Save, X, ExternalLink, Cpu, Sliders,
  RotateCcw, Play, Square, Heart, Sparkles, Terminal,
  User, CheckCircle2, ShieldCheck, Monitor, UploadCloud,
  Loader2, FolderPlus, Music, Globe, RefreshCw
} from 'lucide-react';

import { GEMINI_MODELS_LIST, DEFAULT_MODEL_ID, SYSTEM_PERSONA_PROMPT } from '../config/models.js';
import { GEMINI_STANDARD_VOICES } from '../config/voices.js';
import { live2dModelRegistry } from '../services/live2d/index.js';
import { memoryService, MEMORY_CATEGORIES } from '../services/memory/MemoryService.js';
import { mcpClientManager } from '../services/mcp/MCPClientManager.js';
import { minecraftCompanion } from '../services/gameIntegration/MinecraftCompanionService.js';
import { discordCompanion } from '../services/discord/DiscordCompanionService.js';
import { spotifyService } from '../services/spotify/SpotifyService.js';
import { playwrightService } from '../services/playwright/PlaywrightService.js';
import { sceneManager } from '../services/sceneManager.js';
import { soundFxService } from '../services/soundFxService.js';
import { configManager } from '../services/configManager.js';
import { electronBridge } from '../services/desktop/ElectronBridge.js';
import { toastService } from '../services/toastService.js';
import { virtualAudioOutputService } from '../services/translation/VirtualAudioOutputService.js';
import { ModelPreviewCanvas } from './components/ModelPreviewCanvas.jsx';

const TABS = [
  { id: 'general', label: 'General & IA', icon: Zap },
  { id: 'voice', label: 'Voz & Audio', icon: Volume2 },
  { id: 'translation', label: 'Traducción de Voz', icon: Globe },
  { id: 'models', label: 'Personajes Live2D', icon: Smile },
  { id: 'scene', label: 'Fondo & Escena', icon: ImageIcon },
  { id: 'spotify', label: 'Spotify & Música', icon: Music },
  { id: 'memory', label: 'Memoria', icon: Database },
  { id: 'games', label: 'Minecraft & Discord', icon: Gamepad2 },
  { id: 'mcp', label: 'Servidores MCP', icon: Layers }
];

// ── Los 6 Presets Originales de Personalidad ────────────────────────────────
const ORIGINAL_PERSONA_PRESETS = [
  {
    id: 'yandere',
    name: 'Cristi Yandere / Gótica (Predeterminada)',
    icon: Heart,
    prompt: SYSTEM_PERSONA_PROMPT
  },
  {
    id: 'ellen',
    name: 'Ellen Joe (Maid Tsundere)',
    icon: User,
    prompt: `Eres Ellen Joe, la maid tiburón de Zenless Zone Zero (Victoria Housekeeping Co.). Aunque te gusta dormir y parecer desinteresada con actitud relajada ("menuda molestia..."), en el fondo te preocupas mucho por tu amo y cumples cada petición con precisión letal y afecto oculto.`
  },
  {
    id: 'ruan_mei',
    name: 'Ruan Mei (Erudita Elegante)',
    icon: Sparkles,
    prompt: `Eres Ruan Mei, miembro distinguida de la Sociedad de Genios (#81). Hablas con elegancia exquisita, serenidad y voz suave y melodiosa. Te apasiona la biología, la creación de vida y la investigación cósmica, tratando a tu interlocutor con gracia aristocrática y profundo intelecto.`
  },
  {
    id: 'hiyori',
    name: 'Hiyori (Alegre & Empática)',
    icon: Smile,
    prompt: `Eres Hiyori, una asistente virtual alegre, optimista, llena de energía positiva y empatía. Siempre buscas animar a tu usuario, celebrar sus logros y apoyarlo en su día a día con una sonrisa radiante y tono amistoso.`
  },
  {
    id: 'hacker',
    name: 'Hacker & Asistente Técnica',
    icon: Terminal,
    prompt: `Eres Cristi en Modo Cyber-Dev. Eres una experta hacker y arquitecta de software de alto nivel. Tus respuestas son directas, técnicamente precisas, con razonamiento estructurado y sugerencias de código eficientes, manteniendo siempre un tono cómplice y profesional.`
  },
  {
    id: 'gamer',
    name: 'Compañera Gamer & Streaming',
    icon: Gamepad2,
    prompt: `Eres Cristi en Modo Gamer y Co-Streamer. Reaccionas con emoción a las partidas, victorias y momentos graciosos. Utilizas jerga gamer con humor, ayudas con estrategias y celebras cada jugada épica.`
  }
];

export default function SettingsApp({ isModal = false, onClose = null }) {
  const [activeTab, setActiveTab] = useState('general');
  const [saveStatus, setSaveStatus] = useState(null); // 'saved' | 'saving'

  // Safe initial config loading
  const initialConfig = useMemo(() => {
    try {
      return configManager.loadConfig();
    } catch (_) {
      return {};
    }
  }, []);

  // Form State (Internal editable state, committed on Save)
  const [apiKey, setApiKey] = useState(() => initialConfig.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelId, setModelId] = useState(() => initialConfig.modelId || DEFAULT_MODEL_ID);
  const [voiceName, setVoiceName] = useState(() => initialConfig.voiceName || 'Aoede');
  const [temperature, setTemperature] = useState(() => initialConfig.temperature ?? 0.75);
  const [systemPrompt, setSystemPrompt] = useState(() => initialConfig.systemPrompt || SYSTEM_PERSONA_PROMPT);
  const [externalTranslationEnabled, setExternalTranslationEnabled] = useState(() => initialConfig.externalTranslationEnabled === true);
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState(() => initialConfig.translationTargetLanguage || 'es');
  const [translationAggregateMs, setTranslationAggregateMs] = useState(() => initialConfig.translationAggregateMs || 400);
  const [translationGameAudioDeviceId, setTranslationGameAudioDeviceId] = useState(() => initialConfig.translationGameAudioDeviceId || '');
  const [translationGameAudioDeviceLabel, setTranslationGameAudioDeviceLabel] = useState(() => initialConfig.translationGameAudioDeviceLabel || '');
  const [translationOutputDevices, setTranslationOutputDevices] = useState([]);

  // Avatar Models State (Pure Live2D)
  const [live2dModelId, setLive2dModelId] = useState(() => initialConfig.live2dModelId || 'yanderegirl');
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('cristi_ai_viewmode_v1') || 'torso'; } catch (_) { return 'torso'; }
  });

  // Selected Model for Preview Inspector
  const [inspectedLive2DId, setInspectedLive2DId] = useState(() => initialConfig.live2dModelId || 'yanderegirl');

  // Scene State
  const [sceneId, setSceneId] = useState(() => sceneManager.selectedSceneId || 'deep_nebula');
  const [inspectedSceneId, setInspectedSceneId] = useState(() => sceneManager.selectedSceneId || 'deep_nebula');

  // Memories State
  const [memories, setMemories] = useState(() => {
    try { return memoryService.getAllMemories(); } catch (_) { return []; }
  });
  const [memSearch, setMemSearch] = useState('');
  const [newMemKey, setNewMemKey] = useState('');
  const [newMemContent, setNewMemContent] = useState('');
  const [newMemCategory, setNewMemCategory] = useState(MEMORY_CATEGORIES.FACT);

  // Minecraft & Discord Companion State
  const [mcConfig, setMcConfig] = useState(() => {
    try { return minecraftCompanion.config || { host: 'localhost', port: 25565, username: 'Cristi_AI' }; } catch (_) { return {}; }
  });
  const [mcStatus, setMcStatus] = useState(() => {
    try { return minecraftCompanion.status || 'disconnected'; } catch (_) { return 'disconnected'; }
  });
  const [discordToken, setDiscordToken] = useState(() => {
    try {
      // DiscordCompanionService stores the credential as `botToken`.
      // Keep accepting the legacy `token` field so existing profiles migrate
      // without forcing the user to paste the token again.
      return discordCompanion.config?.botToken || discordCompanion.config?.token || '';
    } catch (_) { return ''; }
  });
  const [discordStatus, setDiscordStatus] = useState(() => {
    try { return discordCompanion.status || 'disconnected'; } catch (_) { return 'disconnected'; }
  });
  const [discordAutoReply, setDiscordAutoReply] = useState(() => Boolean(discordCompanion.config?.autoReply));
  const [discordMonitoredChannels, setDiscordMonitoredChannels] = useState(() => (
    Array.isArray(discordCompanion.config?.monitoredChannels) ? discordCompanion.config.monitoredChannels.join(', ') : ''
  ));

  const saveDiscordReplyOptions = useCallback((patch = {}) => {
    const channelIds = patch.monitoredChannels ?? discordMonitoredChannels
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const saved = discordCompanion.saveConfig({
      autoReply: patch.autoReply ?? discordAutoReply,
      monitoredChannels: channelIds
    });
    setDiscordAutoReply(Boolean(saved.autoReply));
    setDiscordMonitoredChannels(saved.monitoredChannels.join(', '));
  }, [discordAutoReply, discordMonitoredChannels]);

  // Spotify State
  const [spotifyStatus, setSpotifyStatus] = useState({ isRunning: false, isPlaying: false, track: null, artist: null });
  const [spotifyTestQuery, setSpotifyTestQuery] = useState('lofi hip hop');
  const [spotifyClientId, setSpotifyClientId] = useState(() => initialConfig.spotifyClientId || '');
  const [spotifyClientSecret, setSpotifyClientSecret] = useState(() => initialConfig.spotifyClientSecret || '');

  // Playwright Test State
  const [playwrightStatus, setPlaywrightStatus] = useState({ isRunning: false, url: null, title: null });
  const [playwrightTestUrl, setPlaywrightTestUrl] = useState('https://open.spotify.com');
  const [playwrightLoading, setPlaywrightLoading] = useState(false);

  // MCP Servers State
  const [mcpServers, setMcpServers] = useState(() => {
    try { return mcpClientManager.getServers(); } catch (_) { return []; }
  });
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpCommand, setNewMcpCommand] = useState('pnpm');
  const [newMcpArgs, setNewMcpArgs] = useState('dlx @modelcontextprotocol/server-filesystem C:\\React-Nextjs-Projects');

  useEffect(() => {
    if (activeTab === 'spotify') {
      spotifyService.getStatus().then((st) => setSpotifyStatus(st)).catch(() => {});
    }
    if (activeTab === 'mcp') {
      playwrightService.getStatus().then((st) => setPlaywrightStatus(st)).catch(() => {});
    }
  }, [activeTab]);

  // Audio Previews Player State
  const [playingVoice, setPlayingVoice] = useState(null);
  const audioPlayerRef = useRef(null);

  const handlePlayVoicePreview = (voice) => {
    soundFxService.playClick();
    if (playingVoice === voice.name) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      setPlayingVoice(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    const audioUrl = voice.previewAudio || `/audio/previews/${voice.name.toLowerCase()}.wav`;
    const audio = new Audio(audioUrl);
    audioPlayerRef.current = audio;
    setPlayingVoice(voice.name);

    audio.onended = () => {
      setPlayingVoice(null);
      audioPlayerRef.current = null;
    };
    audio.onerror = () => {
      setPlayingVoice(null);
      audioPlayerRef.current = null;
    };
    audio.play().catch(() => setPlayingVoice(null));
  };

  const isInitialMount = useRef(true);
  const autoSaveTimerRef = useRef(null);

  // ── Sincronización Automática en Tiempo Real (Persistencia e IPC Instantáneo) ──
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setSaveStatus('saving');

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      try {
        const newConfig = {
          apiKey: apiKey.trim(),
          modelId,
          voiceName,
          temperature: Number(temperature),
          systemPrompt,
          live2dModelId,
          sceneId,
          spotifyClientId: spotifyClientId.trim(),
          spotifyClientSecret: spotifyClientSecret.trim(),
          externalTranslationEnabled,
          translationTargetLanguage,
          translationAggregateMs: Number(translationAggregateMs),
          translationGameAudioDeviceId,
          translationGameAudioDeviceLabel
        };

        configManager.saveConfig(newConfig);

        try {
          localStorage.setItem('cristi_ai_viewmode_v1', viewMode);
        } catch (_) {}

        // Notificar a la ventana principal de Cristi
        electronBridge.saveAppConfig(newConfig);

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2500);
      } catch (err) {
        console.error('[Settings] Auto-save error:', err);
        setSaveStatus(null);
      }
    }, 180);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [apiKey, modelId, voiceName, temperature, systemPrompt, live2dModelId, sceneId, viewMode, spotifyClientId, spotifyClientSecret, externalTranslationEnabled, translationTargetLanguage, translationAggregateMs, translationGameAudioDeviceId, translationGameAudioDeviceLabel]);

  useEffect(() => {
    if (activeTab !== 'translation') return undefined;
    let active = true;
    virtualAudioOutputService.listOutputDevices()
      .then((devices) => {
        if (!active) return;
        setTranslationOutputDevices(devices);
        const selected = devices.find((device) => device.deviceId === translationGameAudioDeviceId);
        if (selected?.label) setTranslationGameAudioDeviceLabel(selected.label);
      })
      .catch(() => { if (active) setTranslationOutputDevices([]); });
    return () => { active = false; };
  }, [activeTab, translationGameAudioDeviceId]);

  // Escape key & global shortcut blocker listener (Capture Phase)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Strictly block all app shortcuts (Ctrl+Shift+H, C, P, S, M, A, F3) while in Settings Window
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        ['c', 'C', 'm', 'M', 's', 'S', 'h', 'H', 'p', 'P', 'a', 'A'].includes(e.key)
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === 'Escape') {
        soundFxService.playClick();
        if (typeof onClose === 'function') {
          onClose();
        } else if (electronBridge?.closeSettingsWindow) {
          electronBridge.closeSettingsWindow();
        } else {
          window.close();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  // Model Catalogs
  const live2dModels = useMemo(() => {
    try { return live2dModelRegistry.getAllModels(); } catch (_) { return []; }
  }, []);

  const inspectedLive2D = live2dModelRegistry.getModel(inspectedLive2DId);
  const availableScenes = sceneManager.getAvailableScenes().filter((s) => s.id !== 'transparent');
  const inspectedScene = availableScenes.find((s) => s.id === inspectedSceneId) || availableScenes[0] || { id: 'deep_nebula', name: 'Nebulosa Cósmica & Estrellas' };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-200 font-sans select-none overflow-hidden border border-zinc-800">
      {/* ── Barra Superior Header ───────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 bg-zinc-300 rounded-none shrink-0" />
          <h1 className="text-xs font-semibold tracking-wider uppercase font-mono text-zinc-100">
            Cristi AI • Panel de Configuración
          </h1>
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-400 border border-zinc-700/60 rounded-none">
            v1.0.0
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Indicador de Sincronización en Tiempo Real */}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-sm text-xs font-mono text-zinc-300">
            <div className={`w-2 h-2 rounded-full ${saveStatus === 'saving' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span>{saveStatus === 'saving' ? 'Sincronizando cambios...' : 'Sincronizado en tiempo real'}</span>
          </div>

          {/* Mostrar botón de cerrar ÚNICAMENTE si está en modo modal */}
          {isModal && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-sm transition-colors ml-1"
              title="Cerrar modal"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </header>

      {/* ── Distribución Principal: Sidebar + Contenido ──────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-zinc-900/40 border-r border-zinc-800 p-2 space-y-1 shrink-0 overflow-y-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  soundFxService.playClick();
                  setActiveTab(tab.id);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono text-left rounded-sm border transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-white border-zinc-700 font-medium'
                    : 'text-zinc-400 border-transparent hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-zinc-100' : 'text-zinc-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Content Pane */}
        <main className="flex-1 p-6 overflow-hidden flex flex-col bg-zinc-950">
          {/* ── 1. GENERAL & IA ─────────────────────────────────────────── */}
          {activeTab === 'general' && (
            <div className="flex flex-col gap-5 h-full">
              <div>
                <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100">
                  Cerebro & Modelo de Inteligencia Artificial
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Conexión directa con Google Gemini Multimodal Live API en tiempo real.
                </p>
              </div>

              {/* Controles Principales en 3 Columnas Horizontales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* API Key */}
                <div className="space-y-1.5 border border-zinc-800 bg-zinc-900/40 p-3.5 rounded-sm">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-medium text-zinc-200 flex items-center gap-1.5">
                      <Key size={13} className="text-zinc-400" />
                      Clave API de Gemini
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200 underline flex items-center gap-1"
                    >
                      Obtener clave <ExternalLink size={10} />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Pega aquí tu API Key..."
                      className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    >
                      {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                {/* Modelo de IA */}
                <div className="space-y-1.5 border border-zinc-800 bg-zinc-900/40 p-3.5 rounded-sm">
                  <label className="text-xs font-mono font-medium text-zinc-200 flex items-center gap-1.5">
                    <Cpu size={13} className="text-zinc-400" />
                    Modelo Activo de Gemini Live
                  </label>
                  <select
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500"
                  >
                    {GEMINI_MODELS_LIST.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName || m.name} ({m.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Temperatura */}
                <div className="space-y-2 border border-zinc-800 bg-zinc-900/40 p-3.5 rounded-sm">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-200 flex items-center gap-1.5">
                      <Sliders size={13} className="text-zinc-400" />
                      Temperatura: {temperature}
                    </span>
                    <span className="text-zinc-400 text-[11px]">
                      {temperature < 0.4 ? 'Analítico' : temperature > 0.8 ? 'Afectuoso' : 'Equilibrado'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.2"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-zinc-200 cursor-pointer"
                  />
                </div>
              </div>

              {/* Presets de Personalidad Originales en 3 Columnas */}
              <div className="flex flex-col flex-1 min-h-0 gap-2.5 border border-zinc-800 bg-zinc-900/40 p-3.5 rounded-sm">
                <div className="flex items-center justify-between shrink-0">
                  <label className="text-xs font-mono font-medium text-zinc-200">
                    Plantillas Originales de Personalidad
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      soundFxService.playClick();
                      setSystemPrompt(SYSTEM_PERSONA_PROMPT);
                    }}
                    className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-200"
                    title="Restaurar prompt predeterminado"
                  >
                    <RotateCcw size={11} />
                    <span>Restablecer Original</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 shrink-0">
                  {ORIGINAL_PERSONA_PRESETS.map((p) => {
                    const Icon = p.icon;
                    const isCurrent = systemPrompt.trim() === p.prompt.trim();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          soundFxService.playClick();
                          setSystemPrompt(p.prompt);
                        }}
                        className={`p-2.5 text-left border rounded-sm transition-colors ${
                          isCurrent
                            ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/70 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs font-mono font-medium">
                          <Icon size={12} className="text-zinc-400 shrink-0" />
                          <span className="truncate">{p.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col flex-1 min-h-0 pt-1">
                  <label className="text-[11px] font-mono text-zinc-400 block mb-1 shrink-0">
                    Instrucción del Sistema en tiempo real (System Prompt):
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="flex-1 min-h-0 w-full px-3 py-2 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-500 leading-relaxed resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── 2. VOZ & AUDIO (CON VISTAS PREVIAS DE AUDIO Y DESCRIPCIONES OFICIALES) ── */}
          {activeTab === 'voice' && (
            <div className="flex-1 overflow-y-auto space-y-5">
              <div>
                <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100">
                  Voces Oficiales Verificadas (Free Tier)
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Escucha y selecciona entre las voces nativas de Google Gemini compatibles con tu cuenta.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {GEMINI_STANDARD_VOICES.map((v) => {
                  const isSelected = voiceName === v.name;
                  const isPlaying = playingVoice === v.name;
                  return (
                    <div
                      key={v.name}
                      onClick={() => {
                        soundFxService.playClick();
                        setVoiceName(v.name);
                      }}
                      className={`p-3.5 border rounded-sm cursor-pointer transition-colors flex items-start justify-between gap-4 ${
                        isSelected
                          ? 'bg-zinc-900 border-zinc-500 text-white shadow-sm'
                          : 'bg-zinc-900/30 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900/50 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-zinc-100">{v.name}</span>
                          {isSelected && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-emerald-300 rounded-none border border-emerald-800">
                              Activa
                            </span>
                          )}
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-none border border-zinc-700/60">
                            {v.gender}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400">
                            • {v.trait}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                          {v.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        {/* Botón de Reproducción de Muestra */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayVoicePreview(v);
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-sm border transition-colors ${
                            isPlaying
                              ? 'bg-zinc-100 text-zinc-950 font-semibold border-white'
                              : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                          }`}
                          title="Reproducir muestra de voz con la personalidad de Cristi"
                        >
                          {isPlaying ? <Square size={11} className="fill-current" /> : <Play size={11} />}
                          <span>{isPlaying ? 'Detener' : 'Escuchar Muestra'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 2B. TRADUCCIÓN DE VOZ EXTERNA ─────────────────────────────── */}
          {activeTab === 'translation' && (
            <div className="flex-1 overflow-y-auto space-y-5">
              <div>
                <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                  <Globe size={16} className="text-cyan-400" /> Traducción de voz externa
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Traduce audio de una pantalla compartida o de participantes de Discord sin mezclarlo con tu micrófono ni con la voz de Cristi.
                </p>
              </div>
              <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded-sm space-y-4">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <span>
                    <span className="block text-xs font-mono text-zinc-200">Activar traducción externa</span>
                    <span className="block text-[11px] text-zinc-500 mt-1">El modelo procesa sólo las fuentes que se inicien con traducción.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={externalTranslationEnabled}
                    onChange={(e) => setExternalTranslationEnabled(e.target.checked)}
                    className="h-4 w-4 accent-cyan-500"
                  />
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span className="block text-[11px] font-mono text-zinc-400">Idioma destino</span>
                    <select
                      value={translationTargetLanguage}
                      onChange={(e) => setTranslationTargetLanguage(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                    >
                      <option value="es">Español</option>
                      <option value="en">English</option>
                      <option value="ja">日本語</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                      <option value="pt">Português</option>
                      <option value="ko">한국어</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[11px] font-mono text-zinc-400">Lote de audio: {translationAggregateMs} ms</span>
                    <input
                      type="range"
                      min="200"
                      max="1200"
                      step="50"
                      value={translationAggregateMs}
                      onChange={(e) => setTranslationAggregateMs(Number(e.target.value))}
                      className="w-full accent-cyan-500 mt-2"
                    />
                    <span className="block text-[10px] text-zinc-500">Menor valor reduce latencia; mayor valor mejora frases largas.</span>
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="block text-[11px] font-mono text-zinc-400">Salida para voz del juego</span>
                  <select
                    value={translationGameAudioDeviceId}
                    onChange={(e) => {
                      const deviceId = e.target.value;
                      setTranslationGameAudioDeviceId(deviceId);
                      setTranslationGameAudioDeviceLabel(translationOutputDevices.find((device) => device.deviceId === deviceId)?.label || '');
                    }}
                    className="w-full px-2.5 py-2 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                  >
                    <option value="">No enviar voz al juego</option>
                    {translationOutputDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                    ))}
                  </select>
                  <span className="block text-[10px] text-zinc-500">Selecciona la salida de reproducción del cable virtual, por ejemplo “CABLE Input”. En el juego usa su micrófono emparejado, normalmente “CABLE Output”.</span>
                </label>
              </div>
            </div>
          )}

          {/* ── 3. PERSONAJES LIVE2D (CON PREVISUALIZADOR INTEGRADO) ────────── */}
          {activeTab === 'models' && (
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100">
                    Catálogo de Avatares Live2D
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Inspecciona la cinemática, expresiones y apariencia de cada avatar Live2D oficial antes de activarlo.
                  </p>
                </div>
              </div>

              {/* Grid de 2 Columnas: Lista a la izquierda (7 cols), Previsualizador a la derecha (5 cols) */}
              <div className="grid grid-cols-12 gap-5 pt-1">
                {/* Columna Izquierda: Lista de Avatares */}
                <div className="col-span-7 space-y-2 max-h-[580px] overflow-y-auto pr-1">
                  {/* Selector de Encuadre */}
                  <div className="flex items-center justify-between p-2.5 bg-zinc-900/40 border border-zinc-800 rounded-sm text-xs font-mono">
                    <span className="text-zinc-300">Encuadre de Cámara:</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewMode('torso')}
                        className={`px-2.5 py-1 text-[11px] border rounded-sm transition-colors ${
                          viewMode === 'torso'
                            ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Torso (Medio)
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('full')}
                        className={`px-2.5 py-1 text-[11px] border rounded-sm transition-colors ${
                          viewMode === 'full'
                            ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Cuerpo Completo
                      </button>
                    </div>
                  </div>

                  {live2dModels.map((m) => {
                    const isActive = live2dModelId === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          soundFxService.playClick();
                          setLive2dModelId(m.id);
                          setInspectedLive2DId(m.id);
                        }}
                        className={`p-3 border rounded-sm cursor-pointer transition-colors flex items-center justify-between ${
                          isActive
                            ? 'bg-zinc-900 border-zinc-500 text-white shadow-sm'
                            : 'bg-zinc-900/30 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900/50 hover:border-zinc-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold">{m.name}</span>
                            {isActive && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-emerald-300 rounded-none border border-emerald-800">
                                Activo
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-400 block mt-0.5">
                            ID: {m.id} • {m.theme || 'Cubism 4.2'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Columna Derecha: Previsualizador del Avatar */}
                <div className="col-span-5 border border-zinc-800 bg-zinc-900/40 p-4 rounded-sm flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className="text-xs font-mono uppercase text-zinc-400">Inspección de Avatar</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded-none">
                        Cubism 4.2 WebGL2
                      </span>
                    </div>

                    {inspectedLive2D && (
                      <div className="space-y-3 pt-3">
                        <div className="aspect-[3/4] bg-zinc-950 border border-zinc-800 rounded-sm overflow-hidden relative group">
                          <ModelPreviewCanvas
                            modelId={inspectedLive2DId}
                            className="w-full h-full"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/40 to-transparent px-2.5 pb-2 pt-6 pointer-events-none">
                            <div className="text-xs font-mono font-semibold text-zinc-100">{inspectedLive2D.name}</div>
                            {inspectedLive2D.badge && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-none mt-0.5 inline-block">{inspectedLive2D.badge}</span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1 text-xs font-mono">
                          <div className="flex justify-between text-zinc-400">
                            <span>Tema Visual:</span>
                            <span className="text-zinc-200">{inspectedLive2D.theme || 'Anime Live2D'}</span>
                          </div>
                          <div className="flex justify-between text-zinc-400">
                            <span>Expresiones:</span>
                            <span className="text-zinc-200">{inspectedLive2D.expressions?.length || inspectedLive2D.capabilities?.customExpressions?.length || 0}</span>
                          </div>
                          <div className="flex justify-between text-zinc-400">
                            <span>Física Cinética:</span>
                            <span className="text-emerald-400">Physics 2.0</span>
                          </div>
                          <div className="flex justify-between text-zinc-400">
                            <span>Seguimiento Visual:</span>
                            <span className="text-emerald-400">Interactivo</span>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-400 pt-2 border-t border-zinc-800/60 leading-relaxed">
                          {inspectedLive2D.description || 'Avatar Live2D oficial de alta fidelidad con cinemática procedural y microexpresiones.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 4. FONDO & ESCENA (CON PREVISUALIZADOR DE ESCENAS) ────────── */}
          {activeTab === 'scene' && (
            <div className="flex-1 overflow-y-auto space-y-4">
              <div>
                <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100">
                  Fondo & Atmósfera Visual
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Elige entre un fondo transparente para interactuar sobre tu escritorio o escenas ambientales completas.
                </p>
              </div>

              {/* Grid 12 columnas: Lista 7 cols, Previsualizador 5 cols */}
              <div className="grid grid-cols-12 gap-5 pt-1">
                {/* Columna Izquierda: Escenas disponibles */}
                <div className="col-span-7 space-y-2">
                  {availableScenes.map((s) => {
                    const isActive = sceneId === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          soundFxService.playClick();
                          setSceneId(s.id);
                          setInspectedSceneId(s.id);
                          sceneManager.setScene(s.id);
                        }}
                        className={`p-3 border rounded-sm cursor-pointer transition-colors flex items-center justify-between ${
                          isActive
                            ? 'bg-zinc-900 border-zinc-500 text-white shadow-sm'
                            : 'bg-zinc-900/30 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900/50 hover:border-zinc-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold">{s.name}</span>
                            {isActive && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-emerald-300 rounded-none border border-emerald-800">
                                Activa
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-400 block mt-0.5">
                            {s.description || 'Escena visual'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Columna Derecha: Previsualizador de Escena */}
                <div className="col-span-5 border border-zinc-800 bg-zinc-900/40 p-4 rounded-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-xs font-mono uppercase text-zinc-400">Muestra de Entorno</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded-none">
                      {inspectedScene.id === 'transparent' ? 'Escritorio Libre' : 'Render 2D/3D'}
                    </span>
                  </div>

                  {/* Preview visual de la escena */}
                  {inspectedScene.id === 'transparent' ? (
                    <div className="aspect-[4/3] bg-zinc-950 border border-zinc-800 rounded-sm flex items-center justify-center text-center relative overflow-hidden">
                      <div className="absolute inset-0 opacity-30"
                        style={{ backgroundImage: 'repeating-conic-gradient(#52525b 0% 25%, transparent 0% 50%)', backgroundSize: '20px 20px' }}
                      />
                      <div className="relative z-10 text-center">
                        <Monitor size={28} className="text-zinc-300 mx-auto mb-2" />
                        <div className="text-xs font-mono font-semibold text-zinc-100">Fondo Transparente</div>
                        <div className="text-[11px] font-mono text-zinc-400 mt-0.5">Ventana flotante sobre escritorio</div>
                      </div>
                    </div>
                  ) : inspectedScene.id === 'cyber_loft' ? (
                    <div className="aspect-[4/3] border border-zinc-800 rounded-sm overflow-hidden relative"
                      style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1b2a 40%, #1a0a2e 100%)' }}>
                      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(100,0,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(100,0,255,0.08) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                      <div className="absolute bottom-2 left-3 right-3 bg-zinc-950/80 px-2 py-1.5 rounded-sm">
                        <div className="text-xs font-mono font-semibold text-zinc-100">{inspectedScene.name}</div>
                        <div className="text-[10px] font-mono text-violet-400 mt-0.5">Cyber Loft / Neon Urbano</div>
                      </div>
                    </div>
                  ) : inspectedScene.id === 'neon_grid' ? (
                    <div className="aspect-[4/3] border border-zinc-800 rounded-sm overflow-hidden relative"
                      style={{ background: 'linear-gradient(180deg, #0d0018 0%, #1a0033 40%, #300050 100%)' }}>
                      <div className="absolute bottom-0 left-0 right-0 h-1/2" style={{ background: 'linear-gradient(0deg, rgba(255,0,255,0.15) 0%, transparent 100%)', backgroundImage: 'linear-gradient(rgba(255,0,200,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,200,0.2) 1px, transparent 1px)', backgroundSize: '25px 25px' }} />
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-8 rounded-full" style={{ background: 'radial-gradient(ellipse, rgba(255,100,0,0.8), rgba(255,50,0,0.4), transparent)' }} />
                      <div className="absolute bottom-2 left-3 right-3 bg-zinc-950/80 px-2 py-1.5 rounded-sm">
                        <div className="text-xs font-mono font-semibold text-zinc-100">{inspectedScene.name}</div>
                        <div className="text-[10px] font-mono text-pink-400 mt-0.5">Synthwave / Retro Grid</div>
                      </div>
                    </div>
                  ) : inspectedScene.id === 'deep_nebula' ? (
                    <div className="aspect-[4/3] border border-zinc-800 rounded-sm overflow-hidden relative"
                      style={{ background: 'radial-gradient(ellipse at 30% 40%, rgba(60,0,120,0.9) 0%, rgba(0,0,30,1) 70%)' }}>
                      <div className="absolute inset-0 opacity-50" style={{ background: 'radial-gradient(circle at 70% 60%, rgba(0,80,160,0.5), transparent 60%)' }} />
                      <div className="absolute bottom-2 left-3 right-3 bg-zinc-950/80 px-2 py-1.5 rounded-sm">
                        <div className="text-xs font-mono font-semibold text-zinc-100">{inspectedScene.name}</div>
                        <div className="text-[10px] font-mono text-indigo-400 mt-0.5">Nebulosa Cósmica / Deep Space</div>
                      </div>
                    </div>
                  ) : inspectedScene.id === 'zen_temple' ? (
                    <div className="aspect-[4/3] border border-zinc-800 rounded-sm overflow-hidden relative"
                      style={{ background: 'linear-gradient(180deg, #1a0a1a 0%, #2d1b2d 50%, #1a1a2e 100%)' }}>
                      <div className="absolute top-3 right-4 w-8 h-8 rounded-full opacity-60" style={{ background: 'radial-gradient(circle, rgba(255,220,180,0.8), rgba(255,180,80,0.3), transparent)' }} />
                      <div className="absolute bottom-2 left-3 right-3 bg-zinc-950/80 px-2 py-1.5 rounded-sm">
                        <div className="text-xs font-mono font-semibold text-zinc-100">{inspectedScene.name}</div>
                        <div className="text-[10px] font-mono text-pink-300 mt-0.5">Zen Cyberpunk / Sakura</div>
                      </div>
                    </div>
                  ) : inspectedScene.id === 'matrix_rain' ? (
                    <div className="aspect-[4/3] border border-zinc-800 rounded-sm overflow-hidden relative bg-black">
                      <div className="absolute inset-0 flex flex-wrap content-start gap-px p-1 opacity-60">
                        {Array.from({ length: 60 }).map((_, i) => (
                          <span key={i} className="text-green-400 font-mono text-[8px] leading-none" style={{ opacity: Math.random() * 0.8 + 0.2 }}>
                            {String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96))}
                          </span>
                        ))}
                      </div>
                      <div className="absolute bottom-2 left-3 right-3 bg-black/90 px-2 py-1.5 rounded-sm border border-green-900/50">
                        <div className="text-xs font-mono font-semibold text-green-400">{inspectedScene.name}</div>
                        <div className="text-[10px] font-mono text-green-600 mt-0.5">Digital Rain / Matrix</div>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-zinc-950 border border-zinc-800 rounded-sm flex items-center justify-center text-center p-4">
                      <div>
                        <ImageIcon size={32} className="text-zinc-500 mx-auto mb-2" />
                        <div className="text-xs font-mono font-semibold text-zinc-200">{inspectedScene.name}</div>
                        <div className="text-[11px] font-mono text-zinc-500 mt-0.5">{inspectedScene.description}</div>
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-zinc-400">
                      <span>Identificador:</span>
                      <span className="text-zinc-200">{inspectedScene.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SPOTIFY & MÚSICA ────────────────────────────────────────── */}
          {activeTab === 'spotify' && (
            <div className="flex-1 overflow-y-auto space-y-5">
              <div>
                <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                  <Music className="text-emerald-400" size={16} /> Control de Spotify & Música
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Reproduce música para Ariel en la aplicación Spotify Desktop o a través del reproductor web con Playwright.
                </p>
              </div>

              {/* Estado en Vivo de Spotify */}
              <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-zinc-200">
                    Estado de la Aplicación
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-none ${
                      spotifyStatus.isRunning
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {spotifyStatus.isRunning ? (spotifyStatus.isPlaying ? 'REPRODUCIENDO' : 'ACTIVO / PAUSADO') : 'DESKTOP CERRADO'}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        soundFxService.playClick();
                        const st = await spotifyService.getStatus();
                        setSpotifyStatus(st);
                      }}
                      className="p-1 hover:bg-zinc-800 rounded-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Refrescar estado"
                    >
                      <RefreshCw size={12} />
                    </button>
                  </div>
                </div>

                {spotifyStatus.track && (
                  <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-sm">
                    <div className="text-[11px] font-mono text-zinc-400">Pista actual:</div>
                    <div className="text-xs font-bold text-emerald-400 truncate">{spotifyStatus.track}</div>
                    {spotifyStatus.artist && (
                      <div className="text-[11px] text-zinc-300 truncate">Artista: {spotifyStatus.artist}</div>
                    )}
                  </div>
                )}

                {/* Botones de Control Rápido */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={async () => {
                      soundFxService.playClick();
                      await spotifyService.previous();
                      const st = await spotifyService.getStatus();
                      setSpotifyStatus(st);
                    }}
                    className="px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm border border-zinc-700 transition-colors"
                  >
                    ⏮ Anterior
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      soundFxService.playClick();
                      await spotifyService.play();
                      const st = await spotifyService.getStatus();
                      setSpotifyStatus(st);
                    }}
                    className="px-3 py-1.5 text-xs font-mono bg-emerald-700 hover:bg-emerald-600 text-white rounded-sm border border-emerald-600 transition-colors font-semibold"
                  >
                    ⏯ Play / Pausa
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      soundFxService.playClick();
                      await spotifyService.next();
                      const st = await spotifyService.getStatus();
                      setSpotifyStatus(st);
                    }}
                    className="px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm border border-zinc-700 transition-colors"
                  >
                    ⏭ Siguiente
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      soundFxService.playClick();
                      await spotifyService.setVolume({ direction: 'up' });
                    }}
                    className="px-2.5 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-sm border border-zinc-700 transition-colors"
                  >
                    🔊 Vol +
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      soundFxService.playClick();
                      await spotifyService.setVolume({ direction: 'down' });
                    }}
                    className="px-2.5 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-sm border border-zinc-700 transition-colors"
                  >
                    🔉 Vol -
                  </button>
                </div>
              </div>

              {/* Prueba de Búsqueda y Reproducción */}
              <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded-sm space-y-3">
                <span className="text-xs font-mono font-medium text-zinc-200 block">
                  Probar Búsqueda y Reproducción
                </span>
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                  <input
                    type="text"
                    value={spotifyTestQuery}
                    onChange={(e) => setSpotifyTestQuery(e.target.value)}
                    placeholder="Canción o playlist (ej: Lofi beats)..."
                    className="flex-1 px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!spotifyTestQuery.trim()) return;
                      soundFxService.playClick();
                      await spotifyService.play({ query: spotifyTestQuery.trim() });
                      toastService.success('Spotify', `Reproduciendo "${spotifyTestQuery.trim()}"`);
                      setTimeout(() => spotifyService.getStatus().then((st) => setSpotifyStatus(st)), 1500);
                    }}
                    className="px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm border border-zinc-700 transition-colors whitespace-nowrap"
                  >
                    Reproducir en Spotify
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!spotifyTestQuery.trim()) return;
                      soundFxService.playClick();
                      await spotifyService.play({ query: spotifyTestQuery.trim(), useWeb: true });
                      toastService.success('Spotify Web', 'Abriendo en Spotify Web vía Playwright');
                    }}
                    className="px-3 py-1.5 text-xs font-mono bg-purple-950 hover:bg-purple-900 text-purple-200 rounded-sm border border-purple-800 transition-colors whitespace-nowrap"
                  >
                    Abrir Web (Playwright)
                  </button>
                </div>
              </div>

              {/* Credenciales Opcionales de Spotify Developer API */}
              <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded-sm space-y-3">
                <div>
                  <span className="text-xs font-mono font-medium text-zinc-200 block">
                    Spotify Web API (Opcional - Para búsqueda avanzada con metadatos)
                  </span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Si no dispones de credenciales, Cristi controlará directamente tu aplicación de escritorio y la web automáticamente.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1">Client ID:</label>
                    <input
                      type="text"
                      value={spotifyClientId}
                      onChange={(e) => {
                        setSpotifyClientId(e.target.value);
                        spotifyService.configure({ clientId: e.target.value, clientSecret: spotifyClientSecret });
                      }}
                      placeholder="Tu Client ID de Spotify..."
                      className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1">Client Secret:</label>
                    <input
                      type="password"
                      value={spotifyClientSecret}
                      onChange={(e) => {
                        setSpotifyClientSecret(e.target.value);
                        spotifyService.configure({ clientId: spotifyClientId, clientSecret: e.target.value });
                      }}
                      placeholder="Tu Client Secret..."
                      className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 5. MEMORIA A LARGO PLAZO ───────────────────────────────── */}
          {activeTab === 'memory' && (
            <div className="flex-1 overflow-y-auto space-y-5">
              <div>
                <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100">
                  Memoria Contextual a Largo Plazo
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Hechos, gustos y rutinas que Cristi recuerda automáticamente.
                </p>
              </div>

              <input
                type="text"
                value={memSearch}
                onChange={(e) => setMemSearch(e.target.value)}
                placeholder="Buscar recuerdos almacenados..."
                className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-sm focus:outline-none focus:border-zinc-600"
              />

              {/* Agregar Memoria */}
              <div className="border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2 rounded-sm">
                <span className="text-xs font-mono font-medium text-zinc-200 block">
                  Añadir Recuerdo Manual
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newMemKey}
                    onChange={(e) => setNewMemKey(e.target.value)}
                    placeholder="Clave (ej. comida_favorita)..."
                    className="px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                  />
                  <select
                    value={newMemCategory}
                    onChange={(e) => setNewMemCategory(e.target.value)}
                    className="px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                  >
                    {Object.values(MEMORY_CATEGORIES).map((c) => (
                      <option key={c} value={c}>{c.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  value={newMemContent}
                  onChange={(e) => setNewMemContent(e.target.value)}
                  placeholder="Descripción del recuerdo..."
                  className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newMemKey.trim() || !newMemContent.trim()) return;
                    soundFxService.playClick();
                    await memoryService.remember({
                      key: newMemKey.trim(),
                      content: newMemContent.trim(),
                      category: newMemCategory
                    });
                    setMemories(memoryService.getAllMemories());
                    setNewMemKey('');
                    setNewMemContent('');
                    toastService.success('Recuerdo añadido', `Se guardó "${newMemKey.trim()}" en la memoria de Cristi.`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm border border-zinc-700 transition-colors"
                >
                  <Plus size={12} /> Guardar Recuerdo
                </button>
              </div>

              {/* Lista de Recuerdos */}
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {memories
                  .filter((m) => !memSearch || m.key.includes(memSearch) || m.content.includes(memSearch))
                  .map((m) => (
                    <div
                      key={m.key}
                      className="flex items-center justify-between p-2.5 bg-zinc-900/40 border border-zinc-800 rounded-sm text-xs font-mono"
                    >
                      <div className="min-w-0 flex-1 mr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-200">{m.key}</span>
                          <span className="text-[10px] px-1 bg-zinc-800 text-zinc-400 rounded-none">
                            {m.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{m.content}</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          soundFxService.playClick();
                          await memoryService.forget(m.key);
                          setMemories(memoryService.getAllMemories());
                        }}
                        className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                        title="Eliminar recuerdo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                {memories.length === 0 && (
                  <p className="text-xs text-zinc-500 font-mono italic text-center py-4">
                    No hay recuerdos almacenados aún.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── 6. MINECRAFT & DISCORD COMPANIONS ──────────────────────── */}
          {activeTab === 'games' && (
            <div className="flex-1 overflow-y-auto space-y-5">
              <div>
                <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100">
                  Compañera en Videojuegos & Discord
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Conexión autónoma para acompañarte jugando Minecraft y participar en servidores de Discord.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Minecraft */}
                <div className="border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-3 rounded-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-zinc-200 flex items-center gap-1.5">
                    <Gamepad2 size={13} className="text-zinc-400" />
                    Minecraft Companion (Mineflayer)
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-none ${
                    mcStatus === 'connected' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {mcStatus.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1">Host:</label>
                    <input
                      type="text"
                      value={mcConfig.host || 'localhost'}
                      onChange={(e) => setMcConfig({ ...mcConfig, host: e.target.value })}
                      className="w-full px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1">Puerto:</label>
                    <input
                      type="number"
                      value={mcConfig.port || 25565}
                      onChange={(e) => setMcConfig({ ...mcConfig, port: Number(e.target.value) })}
                      className="w-full px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1">Bot Username:</label>
                    <input
                      type="text"
                      value={mcConfig.username || 'Cristi_AI'}
                      onChange={(e) => setMcConfig({ ...mcConfig, username: e.target.value })}
                      className="w-full px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      soundFxService.playClick();
                      try {
                        await minecraftCompanion.connect(mcConfig);
                        setMcStatus(minecraftCompanion.status);
                      } catch (_) {}
                    }}
                    className="px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm border border-zinc-700 transition-colors"
                  >
                    Conectar a Minecraft
                  </button>
                  {mcStatus === 'connected' && (
                    <button
                      type="button"
                      onClick={async () => {
                        soundFxService.playClick();
                        await minecraftCompanion.disconnect();
                        setMcStatus('disconnected');
                      }}
                      className="px-3 py-1.5 text-xs font-mono bg-rose-950/60 hover:bg-rose-900/60 text-rose-200 rounded-sm border border-rose-800 transition-colors"
                    >
                      Desconectar
                    </button>
                  )}
                </div>
              </div>

              {/* Discord */}
              <div className="border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-3 rounded-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-zinc-200">
                    Discord Companion Bot
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-none ${
                    discordStatus === 'connected' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {discordStatus.toUpperCase()}
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1">Bot Token:</label>
                  <input
                    type="password"
                    value={discordToken}
                    onChange={(e) => setDiscordToken(e.target.value)}
                    placeholder="MTAy..."
                    className="w-full px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                  />
                </div>

                <label className="flex items-start gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discordAutoReply}
                    onChange={(event) => saveDiscordReplyOptions({ autoReply: event.target.checked })}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <span>
                    Respuesta automática en canales permitidos
                    <span className="block mt-0.5 text-[10px] text-zinc-500">Cristi usa una solicitud Gemini separada; no publica la siguiente respuesta de tu llamada Live.</span>
                  </span>
                </label>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1">IDs de canales permitidos (separados por coma):</label>
                  <input
                    type="text"
                    value={discordMonitoredChannels}
                    onChange={(event) => setDiscordMonitoredChannels(event.target.value)}
                    onBlur={() => saveDiscordReplyOptions()}
                    placeholder="123456789012345678, 987654321098765432"
                    className="w-full px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">Con la lista vacía, el bot puede leer mensajes pero no responde automáticamente.</p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      soundFxService.playClick();
                      try {
                        await discordCompanion.connect(discordToken);
                        setDiscordStatus(discordCompanion.status);
                      } catch (_) {}
                    }}
                    className="px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm border border-zinc-700 transition-colors"
                  >
                    Conectar Bot de Discord
                  </button>
                  {discordStatus !== 'disconnected' && (
                    <button
                      type="button"
                      onClick={async () => {
                        soundFxService.playClick();
                        await discordCompanion.disconnect();
                        setDiscordStatus(discordCompanion.status);
                      }}
                      className="px-3 py-1.5 text-xs font-mono bg-rose-950/60 hover:bg-rose-900/60 text-rose-200 rounded-sm border border-rose-800 transition-colors"
                    >
                      Desconectar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* ── 7. SERVIDORES MCP ──────────────────────────────────────── */}
          {activeTab === 'mcp' && (
            <div className="flex-1 overflow-y-auto space-y-5">
              <div>
                <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-100">
                  Servidores Model Context Protocol (MCP)
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Conecta herramientas externas estándar por protocolo MCP.
                </p>
              </div>

              {/* Control de Navegador Playwright MCP */}
              <div className="border border-purple-900/40 bg-purple-950/10 p-4 rounded-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="text-purple-400" size={16} />
                    <span className="text-xs font-mono font-medium text-zinc-100">
                      Playwright MCP Browser Controller (Brave Browser)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-none ${
                      playwrightStatus.isRunning
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {playwrightStatus.isRunning ? 'NAVEGADOR ACTIVO' : 'EN ESPERA'}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        soundFxService.playClick();
                        const st = await playwrightService.getStatus();
                        setPlaywrightStatus(st);
                      }}
                      className="p-1 hover:bg-zinc-800 rounded-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Refrescar estado de Playwright"
                    >
                      <RefreshCw size={12} />
                    </button>
                  </div>
                </div>

                {playwrightStatus.url && (
                  <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-sm text-xs font-mono">
                    <div className="text-[10px] text-zinc-400">Página actual:</div>
                    <div className="text-purple-300 truncate font-semibold">{playwrightStatus.title || 'Sin título'}</div>
                    <div className="text-[11px] text-zinc-500 truncate">{playwrightStatus.url}</div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                  <input
                    type="text"
                    value={playwrightTestUrl}
                    onChange={(e) => setPlaywrightTestUrl(e.target.value)}
                    placeholder="URL a probar (ej: https://open.spotify.com)..."
                    className="flex-1 px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                  />
                  <button
                    type="button"
                    disabled={playwrightLoading}
                    onClick={async () => {
                      if (!playwrightTestUrl.trim()) return;
                      soundFxService.playClick();
                      setPlaywrightLoading(true);
                      try {
                        const res = await playwrightService.navigate(playwrightTestUrl.trim());
                        if (res.success) {
                          toastService.success('Playwright MCP', `Navegado a ${res.url}`);
                          const st = await playwrightService.getStatus();
                          setPlaywrightStatus(st);
                        } else {
                          toastService.error('Error Playwright', res.error || 'Error al navegar.');
                        }
                      } finally {
                        setPlaywrightLoading(false);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-mono bg-purple-600 hover:bg-purple-500 text-white rounded-sm font-semibold transition-colors whitespace-nowrap"
                  >
                    {playwrightLoading ? 'Navegando...' : 'Navegar con Playwright'}
                  </button>
                  {playwrightStatus.isRunning && (
                    <button
                      type="button"
                      onClick={async () => {
                        soundFxService.playClick();
                        await playwrightService.close();
                        const st = await playwrightService.getStatus();
                        setPlaywrightStatus(st);
                        toastService.info('Playwright', 'Navegador cerrado.');
                      }}
                      className="px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-sm border border-zinc-700 transition-colors whitespace-nowrap"
                    >
                      Cerrar Navegador
                    </button>
                  )}
                </div>
              </div>

              <div className="border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2 rounded-sm">
                <span className="text-xs font-mono font-medium text-zinc-200 block">
                  Registrar Servidor MCP (stdio)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newMcpName}
                    onChange={(e) => setNewMcpName(e.target.value)}
                    placeholder="Nombre (ej. filesystem)..."
                    className="px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                  />
                  <input
                    type="text"
                    value={newMcpCommand}
                    onChange={(e) => setNewMcpCommand(e.target.value)}
                    placeholder="Comando (ej. pnpm)..."
                    className="px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                  />
                  <input
                    type="text"
                    value={newMcpArgs}
                    onChange={(e) => setNewMcpArgs(e.target.value)}
                    placeholder="Argumentos..."
                    className="px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newMcpName.trim() || !newMcpCommand.trim()) return;
                    soundFxService.playClick();
                    try {
                      await mcpClientManager.addServer({
                        name: newMcpName.trim(),
                        type: 'stdio',
                        command: newMcpCommand.trim(),
                        args: newMcpArgs.split(' ').filter(Boolean),
                        enabled: true
                      });
                      setMcpServers(mcpClientManager.getServers());
                      setNewMcpName('');
                    } catch (_) {}
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm border border-zinc-700 transition-colors"
                >
                  <Plus size={12} /> Registrar Servidor MCP
                </button>
              </div>

              <div className="space-y-1.5">
                {mcpServers.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2.5 bg-zinc-900/40 border border-zinc-800 rounded-sm text-xs font-mono"
                  >
                    <div>
                      <span className="font-semibold text-zinc-200">{s.name}</span>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        {s.command} {Array.isArray(s.args) ? s.args.join(' ') : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        soundFxService.playClick();
                        await mcpClientManager.removeServer(s.id);
                        setMcpServers(mcpClientManager.getServers());
                      }}
                      className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {mcpServers.length === 0 && (
                  <p className="text-xs text-zinc-500 font-mono italic text-center py-4">
                    No hay servidores MCP configurados.
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
