import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import {
  AvatarStage,
  Live2DCanvas,
  FloatingHUD,
  SubtitleOverlay,
  ContextMenu,
  ScreenRegionOverlay,
  ScreenRegionPicker,
  ToastContainer,
  DesktopWidgets,
  BackgroundScene,
  PerformanceHUD
} from './components/index.js';
import {
  eventBus,
  EVENTS,
  GeminiLiveSocket,
  AudioInputService,
  AudioOutputService,
  ToolExecutor,
  CameraService,
  VisionDetectionService,
  ScreenCaptureService,
  SystemTrayService,
  externalDeviceManager,
  gameIntegrationManager,
  live2dModelRegistry,
  memoryService,
  mcpClientManager,
  contextualEmotionOrchestrator,
  electronBridge,
  clickThroughService,
  modelManager,
  configManager,
  soundFxService,
  proactiveTriggerService,
  proactiveScheduler,
  sceneManager,
  toast,
  toastService,
  ttsFallbackService,
  spotifyService,
  playwrightService,
  logger,
  VisionFrameDispatcher
} from './services/index.js';
import {
  DEFAULT_MODEL_ID,
  SYSTEM_PERSONA_PROMPT,
  GEMINI_MODELS,
  getScreenCaptureFPS
} from './config/index.js';

const STORAGE_KEY_CONFIG = 'cristi_ai_settings_v1';
const STORAGE_KEY_VIEWMODE = 'cristi_ai_viewmode_v1';

function getToolFriendlyLabel(name, args) {
  switch (name) {
    case 'trigger_companion_gesture':
      return `Expresando emoción: ${args?.gesture || 'cariñosa'}`;
    case 'take_screenshot':
      return 'Analizando pantalla completa';
    case 'capture_screen_snapshot':
      return 'Analizando área recortada';
    case 'set_screen_watch':
      return args?.active ? 'Iniciando vigilancia de pantalla' : 'Deteniendo vigilancia';
    case 'execute_terminal_command':
      return `Terminal: ${args?.command ? args.command.slice(0, 24) : '...'}`;
    case 'launch_app':
      return `Abriendo: ${args?.appName || 'programa'}`;
    case 'read_file':
      return `Leyendo: ${args?.path ? args.path.split(/[\\/]/).pop() : 'archivo'}`;
    case 'write_file':
      return `Guardando: ${args?.path ? args.path.split(/[\\/]/).pop() : 'archivo'}`;
    case 'open_url':
      return 'Buscando en Brave Browser';
    case 'move_avatar':
      return 'Ajustando posición';
    case 'spotify_play':
      return args?.query ? `Poniendo "${args.query}" en Spotify` : 'Reproduciendo en Spotify';
    case 'spotify_pause':
      return 'Pausando música en Spotify';
    case 'spotify_next':
      return 'Saltando a la siguiente canción';
    case 'spotify_previous':
      return 'Pista anterior en Spotify';
    case 'spotify_search':
      return `Buscando "${args?.query}" en Spotify`;
    case 'playwright_navigate':
      return `Navegando a ${args?.url}`;
    case 'playwright_click':
      return `Haciendo clic en ${args?.selector}`;
    case 'playwright_fill':
      return 'Completando formulario web';
    case 'playwright_screenshot':
      return 'Capturando página web';
    default:
      if (name?.startsWith('minecraft_')) return `Minecraft: ${name.replace('minecraft_', '')}`;
      if (name?.startsWith('discord_')) return `Discord: ${name.replace('discord_', '')}`;
      if (name?.startsWith('mcp_playwright_') || name?.startsWith('playwright_')) return `Navegador Web: ${name.replace(/^mcp_playwright_|^playwright_/, '')}`;
      return `Acción: ${name || 'procesando'}`;
  }
}

export function App() {
  // --- Persistent App Configuration ---
  const [config, setConfig] = useState(() => {
    const envApiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || '';
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        const isKnownModel = Object.values(GEMINI_MODELS).some((m) => m.id === parsed.modelId);
        if (!isKnownModel) {
          parsed.modelId = DEFAULT_MODEL_ID;
        }
        if (!parsed.live2dModelId) {
          parsed.live2dModelId = 'yanderegirl';
        }
        if (!parsed.systemPrompt || parsed.systemPrompt.includes('1. Respuestas habladas, fluidas, íntimas y concisas:') || !parsed.systemPrompt.includes('PROHIBICIÓN TOTAL DE COLETILLAS VOCALES')) {
          parsed.systemPrompt = SYSTEM_PERSONA_PROMPT;
        }
        return parsed;
      }
    } catch (e) {}
    return {
      apiKey: envApiKey,
      modelId: DEFAULT_MODEL_ID,
      live2dModelId: 'yanderegirl',
      voiceName: 'Aoede',
      temperature: 0.75,
      systemPrompt: SYSTEM_PERSONA_PROMPT,
      spotifyClientId: '137a82bce2e94563959a2d99bca747b7',
      spotifyClientSecret: '68a444218dab4a25898c2bbdd76b35db'
    };
  });

  // --- Framing View Mode: 'torso' (default: upper body) | 'full' (full body) ---
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_VIEWMODE) || 'torso';
    } catch (e) {
      return 'torso';
    }
  });

  // --- Real-Time Live Stream States ---
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [currentGesture, setCurrentGesture] = useState('idle');
  const [activeToolName, setActiveToolName] = useState(null);
  const [activeDecision, setActiveDecision] = useState(null);

  // --- Subtitles / User & Model Transcripts & Decision Toasts ---
  const [userTranscript, setUserTranscript] = useState('');
  const [modelTranscript, setModelTranscript] = useState('');
  const subtitleTimeoutRef = useRef(null);
  const userSubtitleTimeoutRef = useRef(null);
  const modelSubtitleTimeoutRef = useRef(null);
  const decisionTimeoutRef = useRef(null);

  const setSubtitleText = useCallback((text) => {
    if (isCallActiveRef.current) return;
    setModelTranscript(text);
    if (modelSubtitleTimeoutRef.current) clearTimeout(modelSubtitleTimeoutRef.current);
    modelSubtitleTimeoutRef.current = setTimeout(() => {
      setModelTranscript('');
    }, 4500);
  }, []);

  // --- Sensory Camera & Face Recognition States ---
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showWidgets, setShowWidgets] = useState(true);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState('');
  const [isIREnhanced, setIsIREnhanced] = useState(false);
  const [visionDetections, setVisionDetections] = useState(null);
  const [ownerSamples, setOwnerSamples] = useState([]);

  // --- UI & Windows Hello Desktop States ---
  const [isSolidBackdrop, setIsSolidBackdrop] = useState(() => sceneManager.getScene().isSceneVisible);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [isClickThroughEnabled, setIsClickThroughEnabled] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0 });
  const [isPerformanceHudOpen, setIsPerformanceHudOpen] = useState(false);

  // --- Screen Capture States ---
  const [isScreenWatchActive, setIsScreenWatchActive] = useState(false);
  const [screenRegion, setScreenRegion] = useState(null);
  const [isRegionPickerOpen, setIsRegionPickerOpen] = useState(false);
  const [isSettingsWindowOpen, setIsSettingsWindowOpen] = useState(false);
  const isSettingsOpenRef = useRef(false);
  isSettingsOpenRef.current = isSettingsWindowOpen;

  // --- Zen Mode / Ghost UI Auto-Hide States ---
  const [isZenMode, setIsZenMode] = useState(false);
  const [isUiVisible, setIsUiVisible] = useState(true);
  const autoHideTimerRef = useRef(null);

  const handleOpenSettings = useCallback(() => {
    soundFxService.playClick();
    electronBridge.openSettingsWindow();
  }, []);

  useEffect(() => {
    const unsub = electronBridge.onSettingsWindowState((data) => {
      setIsSettingsWindowOpen(Boolean(data?.isOpen));
    });
    return () => unsub?.();
  }, []);

  // --- Interaction Lock for Full Blocking Overlays (ContextMenu, RegionPicker) ---
  const isAnyModalOpen = Boolean(
    isRegionPickerOpen ||
    contextMenu.isOpen
  );

  useEffect(() => {
    if (isAnyModalOpen) {
      electronBridge.acquireInteractionLock();
    }
    return () => {
      if (isAnyModalOpen) {
        electronBridge.releaseInteractionLock();
      }
    };
  }, [isAnyModalOpen]);

  // --- Service References ---
  const socketRef = useRef(null);
  const audioInRef = useRef(null);
  const audioOutRef = useRef(null);
  const cameraRef = useRef(null);
  const visionServiceRef = useRef(null);
  const toolExecutorRef = useRef(null);
  const screenCaptureRef = useRef(null);
  const systemTrayRef = useRef(null);
  const live2dRef = useRef(null);
  const isCallActiveRef = useRef(false);
  const callGenerationRef = useRef(0);
  const visionDispatcherRef = useRef(null);
  const turnAudioReceivedRef = useRef(false);
  const pendingTextRef = useRef('');
  const lastVisionSendTimeRef = useRef(0);

  /**
   * Unified, Rate-Gated Vision Frame Dispatcher for Gemini Live
   * Coordinates full-screen sharing, regional vision, and optical camera to prevent socket congestion,
   * while giving 100% bandwidth and CPU priority to Cristi's incoming voice packets.
   */
  const sendRealtimeVisionFrame = useCallback((base64Jpeg, source = 'vision', priority = false) => {
    if (!base64Jpeg) return false;
    // Strict Speech Shield: Cristi's audio stream gets 100% priority. Frames
    // are retained by the dispatcher and released after AUDIO_END.
    const speechProtected = !isSpeakingRef.current && !audioOutRef.current?.isPlaying;
    return visionDispatcherRef.current?.enqueue(base64Jpeg, source, { priority: Boolean(priority && speechProtected) }) || false;
  }, []);
  const handleToggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const nextMode = prev === 'torso' ? 'full' : 'torso';
      try {
        localStorage.setItem(STORAGE_KEY_VIEWMODE, nextMode);
      } catch (e) {}
      return nextMode;
    });
  }, []);

  // Toggle Zen Mode (hide UI completely)
  const handleToggleZenMode = useCallback(() => {
    setIsZenMode((prev) => {
      const next = !prev;
      setIsUiVisible(!next);
      // When hiding UI: UI elements disappear without triggering onMouseLeave,
      // which can leave setIgnoreMouseEvents(false) active and block model drag.
      // Restore click-through passthrough so hitTarget on the model still works.
      if (next && electronBridge._interactionLockCount === 0) {
        electronBridge.setIgnoreMouseEvents(true, { forward: true });
      }
      return next;
    });
  }, []);

  // --- Always On Top Window Toggle ---
  const handleToggleAlwaysOnTop = useCallback(() => {
    setIsAlwaysOnTop((prev) => {
      const nextState = !prev;
      electronBridge.setAlwaysOnTop(nextState);
      return nextState;
    });
  }, []);

  // --- Zen Mode: Auto-Fade on Inactivity ---
  const resetInactivityTimer = useCallback(() => {
    if (isZenMode) {
      setIsUiVisible(false);
      return;
    }
    setIsUiVisible(true);

    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    autoHideTimerRef.current = setTimeout(() => {
      setIsUiVisible(false);
    }, 5000);
  }, [isZenMode]);

  // Clean up subtitle & decision timers on unmount
  useEffect(() => {
    visionDispatcherRef.current = new VisionFrameDispatcher({ socketRef: socketRef, minIntervalMs: 1000 });
    return () => {
      visionDispatcherRef.current?.destroy();
      visionDispatcherRef.current = null;
    };
  }, []);

  // --- Vision frame dispatcher is the only path that sends camera/screen JPEGs ---
  useEffect(() => () => {
    callGenerationRef.current++;
    isCallActiveRef.current = false;
    visionDispatcherRef.current?.reset();
    socketRef.current?.disconnect();
    audioInRef.current?.stop();
    proactiveTriggerService.setGeminiSocket(null);
    proactiveScheduler.setGeminiSocket(null);
    if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
    if (userSubtitleTimeoutRef.current) clearTimeout(userSubtitleTimeoutRef.current);
    if (modelSubtitleTimeoutRef.current) clearTimeout(modelSubtitleTimeoutRef.current);
    if (decisionTimeoutRef.current) clearTimeout(decisionTimeoutRef.current);
  }, []);

  // Synchronize Spotify Web API credentials with active runtime configuration
  useEffect(() => {
    if (config?.spotifyClientId || config?.spotifyClientSecret) {
      spotifyService.configure({
        clientId: config.spotifyClientId,
        clientSecret: config.spotifyClientSecret
      });
    }
  }, [config?.spotifyClientId, config?.spotifyClientSecret]);

  useEffect(() => {
    let lastActivityTime = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivityTime < 350) return; // Throttling: máximo 3 llamadas/segundo para eliminar 99.7% de thrashing
      lastActivityTime = now;
      proactiveTriggerService.recordUserActivity();
      if (!isZenMode) resetInactivityTimer();
    };
    const onKeyDown = (e) => {
      // Ignore all shortcut toggles while Settings Window is open
      if (isSettingsOpenRef.current) return;

      proactiveTriggerService.recordUserActivity();
      if (e.key === 'Escape') {
        // Hierarchical escape resolution
        if (contextMenu.isOpen) {
          setContextMenu({ isOpen: false, x: 0, y: 0, modelBounds: null });
        } else if (isRegionPickerOpen) {
          setIsRegionPickerOpen(false);
        } else if (isPerformanceHudOpen) {
          setIsPerformanceHudOpen(false);
        }
      }
      if (e.key === 'F3') {
        e.preventDefault();
        setIsPerformanceHudOpen((prev) => !prev);
      }
      if (e.key === 'h' || e.key === 'H') {
        if (!e.target.matches('input, textarea')) {
          e.preventDefault();
          handleToggleZenMode();
        }
      } else {
        if (!isZenMode) resetInactivityTimer();
      }
    };

    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('mousedown', onActivity, { passive: true });
    window.addEventListener('keydown', onKeyDown, { passive: true });
    resetInactivityTimer();

    // Start Proactive Autonomous Trigger Engine
    proactiveTriggerService.start();

    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('mousedown', onActivity);
      window.removeEventListener('keydown', onKeyDown);
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
      proactiveTriggerService.stop();
    };
  }, [
    isZenMode,
    resetInactivityTimer,
    handleToggleZenMode,
    contextMenu.isOpen,
    isRegionPickerOpen,
    isPerformanceHudOpen
  ]);

  // --- Desktop Click-Through State Sync ---
  // The heavy evaluateHitTarget has been purged. Interaction is handled natively by O(1) useClickThrough.
  useEffect(() => {
    if (!electronBridge.isElectron) return;
    if (!isClickThroughEnabled) {
      electronBridge.setIgnoreMouseEvents(false);
    } else {
      if (electronBridge._interactionLockCount === 0) {
        electronBridge.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  }, [isClickThroughEnabled]);

  // Establish correct initial click-through state on mount
  useEffect(() => {
    if (!electronBridge.isElectron) return;
    // Reset any stale lock state from hot-reload or prior session
    electronBridge._interactionLockCount = 0;
    electronBridge._lastIgnore = null;
    electronBridge._lastForward = null;
    electronBridge.setIgnoreMouseEvents(true, { forward: true });
  }, []);

  // --- Initialize Electron Native Desktop Environment & System Tray ---
  useEffect(() => {
    if (electronBridge.isElectron) {
      try {
        setIsAlwaysOnTop(true);

        systemTrayRef.current = new SystemTrayService({
          onRestoreWindow: () => {
            if (isSettingsOpenRef.current) return;
            setIsUiVisible(true);
          },
          onToggleMute: () => {
            if (isSettingsOpenRef.current) return;
            setIsMuted((prev) => !prev);
          },
          onToggleViewMode: () => {
            if (isSettingsOpenRef.current) return;
            handleToggleViewMode();
          },
          onToggleAlwaysOnTop: () => {
            if (isSettingsOpenRef.current) return;
            handleToggleAlwaysOnTop();
          },
          onOpenVoiceEnrollment: () => {
            handleOpenSettings();
          }
        });

        systemTrayRef.current.setupTray();

        // Register Global Shortcut Event Listeners (OS-Wide)
        const unsubMuteShortcut = electronBridge.onShortcutEvent('shortcut-toggle-mute', () => {
          if (isSettingsOpenRef.current) return;
          setIsMuted((prev) => {
            const next = !prev;
            toastService.info(next ? 'Micrófono silenciado (Ctrl+Shift+M)' : 'Micrófono activado (Ctrl+Shift+M)');
            return next;
          });
        });

        const unsubVisionShortcut = electronBridge.onShortcutEvent('shortcut-capture-screen', async () => {
          if (isSettingsOpenRef.current) return;
          toastService.info('Analizando pantalla activa (Ctrl+Shift+S)...');
          try {
            const frame = await electronBridge.captureScreenNative();
            if (frame && socketRef.current) {
              socketRef.current.sendRealtimeMedia(frame, 'image/jpeg');
              toastService.success('Captura enviada a Cristi para análisis.');
            }
          } catch (e) {
            toastService.error('Error al capturar pantalla: ' + e.message);
          }
        });

        const unsubZenShortcut = electronBridge.onShortcutEvent('shortcut-toggle-zen-mode', () => {
          if (isSettingsOpenRef.current) return;
          setIsZenMode((prev) => {
            const next = !prev;
            setIsUiVisible(!next);
            toastService.info(next ? 'Modo Zen activado / UI Oculta (Ctrl+Shift+H)' : 'Interfaz visible (Ctrl+Shift+H)');
            setTimeout(() => clickThroughService.syncHitboxes(), 60);
            return next;
          });
        });

        const unsubPerfShortcut = electronBridge.onShortcutEvent('shortcut-toggle-perf-hud', () => {
          if (isSettingsOpenRef.current) return;
          setIsPerformanceHudOpen((prev) => {
            const next = !prev;
            toastService.info(next ? 'Telemetría y FPS activada (Ctrl+Shift+P)' : 'Telemetría oculta (Ctrl+Shift+P)');
            return next;
          });
        });

        const unsubPinShortcut = electronBridge.onShortcutEvent('shortcut-toggle-always-on-top', () => {
          if (isSettingsOpenRef.current) return;
          handleToggleAlwaysOnTop();
        });

        systemTrayRef.current._unsubShortcuts = () => {
          unsubMuteShortcut();
          unsubVisionShortcut();
          unsubZenShortcut();
          unsubPerfShortcut();
          unsubPinShortcut();
        };
      } catch (e) {
        console.log('Electron init notice:', e);
      }
    }

    // Audit and verify AI models integrity on launch
    modelManager.auditAllModels().catch((e) => console.warn('ModelManager audit error:', e));
    memoryService.initialize().catch((e) => console.warn('MemoryService init error:', e));
    mcpClientManager.initialize().catch((e) => console.warn('MCPClientManager init error:', e));

    if (typeof window !== 'undefined') {
      window.__cristiEventBus = eventBus;
      window.__cristiModelManager = modelManager;
    }

    return () => {
      if (systemTrayRef.current?._unsubShortcuts) {
        systemTrayRef.current._unsubShortcuts();
      }
    };
  }, [handleOpenSettings, handleToggleAlwaysOnTop, handleToggleViewMode]);

  // --- Audio Output Service Setup ---
  useEffect(() => {
    audioOutRef.current = new AudioOutputService({
      onAudioStart: () => {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
      },
      onAudioEnd: () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      }
    });

    return () => {
      if (audioOutRef.current) {
        audioOutRef.current.destroy();
      }
    };
  }, []);

  // --- Vision & Multi-Sample Face Recognition & Anti-Procrastination Engine ---
  useEffect(() => {
    visionServiceRef.current = new VisionDetectionService({
      onDetectionsUpdated: (detections) => {
        setVisionDetections(detections);
      },
      onSamplesUpdated: (samples) => {
        setOwnerSamples(samples);
      },
      onDistractionAlert: ({ type, duration, distancePx, message }) => {
        logger.warn('VISION', `¡Alerta de distracción! ${type} (${duration}s, distancia ${distancePx}px): ${message}`);

        // Update Live2D expression to mad or crazy
        setCurrentGesture(duration > 25 ? 'crazy' : 'mad');

        // Show subtitle notification
        setSubtitleText(`⚠️ Cristi: ${message}`);

        // If Gemini Live is connected, send real-time sensory prompt so Cristi speaks out loud
        if (socketRef.current && socketRef.current.isConnected) {
          socketRef.current.sendTextMessage(
            `[EVENTO SENSORIAL DE VISIÓN: Ariel está distraído usando su teléfono celular en la mano frente a la cámara (${duration}s continuos, distancia muñeca-celular ${distancePx}px). Regáñalo cariñosa pero firmemente con tu personalidad yandere gótica para que deje el celular y vuelva a concentrarse en su trabajo.]`
          );
        }
      },
      onSceneStateChange: ({ sceneState, ownerCount, strangerCount }) => {
        if (socketRef.current && socketRef.current.isConnected) {
          if (sceneState === 'OWNER_WITH_OTHERS') {
            socketRef.current.sendTextMessage(
              `[EVENTO SENSORIAL DE VISIÓN: ¡Alerta de celos! Hay ${strangerCount} persona(s) desconocida(s) junto a tu Dueño en la cámara (${ownerCount + strangerCount} personas en total). Reacciona con tu personalidad posesiva yandere celosa preguntándole quién es esa persona.]`
            );
            setCurrentGesture('pout');
          } else if (sceneState === 'STRANGER_ONLY') {
            socketRef.current.sendTextMessage(
              `[EVENTO SENSORIAL DE VISIÓN: Hay ${strangerCount} persona(s) desconocida(s) frente a tu cámara y tu Dueño NO está en la habitación. Pregúntale con frialdad quién es y adviértele que no toque las cosas de tu Dueño.]`
            );
            setCurrentGesture('yandere');
          }
        }
      }
    });

    // Retrieve saved biometric owner samples without eagerly loading neural weights into memory
    setOwnerSamples(visionServiceRef.current.getOwnerSamples());

    return () => {
      if (visionServiceRef.current) {
        visionServiceRef.current.stop();
      }
    };
  }, [setSubtitleText]);

  // --- Camera Hardware Service Setup ---
  useEffect(() => {
    cameraRef.current = new CameraService({
      onFrame: (base64JPEG) => {
        sendRealtimeVisionFrame(base64JPEG, 'camera');
      },
      onError: (err) => {
        setErrorMessage(`Error de hardware de cámara: ${err.message}`);
      }
    });

    CameraService.getAvailableVideoDevices().then((devices) => {
      setAvailableDevices(devices);
      if (devices.length > 0) {
        setCurrentDeviceId(devices[0].deviceId);
      }
    });

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, [sendRealtimeVisionFrame]);

  // --- Synchronize Emotion State with Contextual Emotion Orchestrator ---
  useEffect(() => {
    const unsub = eventBus.on(EVENTS.EMOTION_CHANGED, (emotion) => {
      if (emotion) {
        setCurrentGesture(emotion);
      }
    });
    return unsub;
  }, []);

  // --- Local Companion Tool Executor Setup ---
  useEffect(() => {
    toolExecutorRef.current = new ToolExecutor({
      onGestureTrigger: (gesture, comment) => {
        contextualEmotionOrchestrator.triggerEmotion(gesture, 'tool_call');
        setCurrentGesture(gesture);
      },
      onMotionTrigger: (motionGroup, index) => {
        if (window.__cristiAvatar?.setMotionByGroup) {
          window.__cristiAvatar.setMotionByGroup(motionGroup, index);
        }
      },
      onToolExecutionStart: () => {
        // Badges flotantes de acción y pensamiento eliminados permanentemente por requerimiento del usuario
      },
      onToolExecutionEnd: () => {
        // Badges flotantes de acción y pensamiento eliminados permanentemente por requerimiento del usuario
      },
      getCameraSnapshot: () => {
        if (cameraRef.current) {
          return cameraRef.current.captureFrameJPEG();
        }
        return null;
      },
      getVisionDetections: () => {
        return visionServiceRef.current?.currentDetections || null;
      },
      getScreenCapture: async () => {
        if (!screenCaptureRef.current) return null;
        return await screenCaptureRef.current.captureActiveFrame();
      },
      onAvatarMove: (position, animation) => {
        if (live2dRef.current?.moveTo) {
          live2dRef.current.moveTo(position, animation);
        }
      },
      onModelSwitch: (_modelType, modelId) => {
        handleSaveConfig({
          ...config,
          live2dModelId: modelId
        });
        toastService.info('Avatar Actualizado', `Modelo: ${modelId}`);
      },
      onScreenRegionChange: (region) => {
        setScreenRegion(region);
        if (screenCaptureRef.current) {
          screenCaptureRef.current.setRegion(region);
        }
      },
      onScreenWatchChange: async (enabled) => {
        setIsScreenWatchActive(enabled);
        if (enabled) {
          if (!screenCaptureRef.current) {
            screenCaptureRef.current = new ScreenCaptureService({
              onFrame: (base64jpeg) => {
                sendRealtimeVisionFrame(base64jpeg);
              },
              onStreamEnd: () => {
                setIsScreenWatchActive(false);
              }
            });
          }
          const fps = getScreenCaptureFPS(config.modelId);
          await screenCaptureRef.current.startContinuous(fps);
        } else {
          screenCaptureRef.current?.stopContinuous();
        }
      }
    });
  }, [config.modelId]);

  // --- Multi-Sample Face Enrollment Handlers ---
  const handleAddOwnerSample = async (sampleLabel = 'Con Lentes') => {
    const video = cameraRef.current?.getVideoElement();
    if (!visionServiceRef.current || !video) {
      throw new Error('La cámara debe estar activa para capturar tu rostro.');
    }
    const result = await visionServiceRef.current.addOwnerSample(video, sampleLabel);
    setOwnerSamples(visionServiceRef.current.getOwnerSamples());
    setCurrentGesture('blush');

    if (socketRef.current && isConnected) {
      socketRef.current.sendTextMessage(
        `[EVENTO: Tu Dueño acaba de registrar una nueva muestra facial biométrica ("${sampleLabel}"). Ahora tienes ${result.totalSamples} muestras de referencia para reconocerlo con lentes, sin lentes o desde varios ángulos. Agradécele con mucha felicidad y ternura.]`
      );
    }
    return result;
  };

  const handleDeleteOwnerSample = (sampleId) => {
    if (visionServiceRef.current) {
      visionServiceRef.current.deleteOwnerSample(sampleId);
      setOwnerSamples(visionServiceRef.current.getOwnerSamples());
    }
  };

  const handleClearAllOwnerSamples = () => {
    if (visionServiceRef.current) {
      visionServiceRef.current.clearAllOwnerSamples();
      setOwnerSamples([]);
    }
  };

  // --- Camera Device Switch & IR Sensor Optimization ---
  const handleSwitchCamera = async (deviceId) => {
    setCurrentDeviceId(deviceId);
    if (isCameraActive && cameraRef.current) {
      if (visionServiceRef.current) {
        visionServiceRef.current.stopTracking();
      }
      await cameraRef.current.start(cameraRef.current.getVideoElement(), deviceId);
      if (visionServiceRef.current) {
        const getVideo = () => cameraRef.current?.getVideoElement();
        const getCanvas = () => null;
        visionServiceRef.current.startTracking(getVideo, getCanvas);
      }
    }
  };

  const handleToggleIREnhancement = () => {
    const nextVal = !isIREnhanced;
    setIsIREnhanced(nextVal);
    if (cameraRef.current) {
      cameraRef.current.setIREnhancement(nextVal);
    }
  };

  // --- Connection Toggle (Start / Stop Live Call) ---
  const handleToggleConnection = useCallback(async () => {
    if (isCallActiveRef.current) {
      callGenerationRef.current++;
      isCallActiveRef.current = false;
      proactiveTriggerService.setGeminiSocket(null);
      proactiveScheduler.setGeminiSocket(null);
      if (socketRef.current) socketRef.current.disconnect();
      if (audioInRef.current) audioInRef.current.stop();
      if (audioOutRef.current) audioOutRef.current.stopImmediate();
      if (cameraRef.current) cameraRef.current.stopPeriodicStreaming();

      setIsConnected(false);
      setIsConnecting(false);
      setIsSpeaking(false);
      setIsListening(false);
      setUserTranscript('');
      setModelTranscript('');
      setActiveDecision(null);
      setActiveToolName(null);
      setCurrentGesture('idle');
      soundFxService.playDisconnect();
      return;
    }

    if (!config.apiKey || !config.apiKey.trim()) {
      toastService.warning('Por favor configura tu Gemini API Key en el menú de Ajustes (⚙).');
      handleOpenSettings();
      return;
    }

    isCallActiveRef.current = true;
    const callGeneration = ++callGenerationRef.current;
    setUserTranscript('');
    setModelTranscript('');
    setErrorMessage(null);
    setIsConnecting(true);

    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (audioOutRef.current) {
        audioOutRef.current.stopImmediate();
      }

      if (!audioInRef.current) {
        audioInRef.current = new AudioInputService({
          onAudioData: (base64PCM) => {
            if (socketRef.current && socketRef.current.isConnected && !audioInRef.current?.isMuted) {
              // Full-Duplex Audio Streaming:
              // Mic audio is continuously streamed to Gemini Live so its server-side neural VAD
              // can detect user speech and trigger native barge-in.
              socketRef.current.sendAudioChunk(base64PCM);
            }
          },
          // Gemini's neural VAD owns interruption. An RMS threshold also detects
          // loudspeaker echo and used to repeatedly stop/restart the same reply.
          onError: (err) => {
            setErrorMessage(`Error de micrófono: ${err.message}`);
          }
        });
      }

      if (isMuted) audioInRef.current.mute();
      else audioInRef.current.unmute();
      await audioInRef.current.start();
      if (callGeneration !== callGenerationRef.current) return;
      if (audioOutRef.current) {
        await audioOutRef.current.resumeContext();
      }
      if (callGeneration !== callGenerationRef.current) return;

      const socket = new GeminiLiveSocket({
        apiKey: config.apiKey,
        modelId: config.modelId,
        voiceName: config.voiceName,
        temperature: config.temperature,
        systemPrompt: config.systemPrompt,
        thinkingConfig: { thinkingBudget: 0 },
        maxReconnectAttempts: Infinity,
        onOpen: () => {
          if (callGeneration !== callGenerationRef.current) return;
          setIsConnected(true);
          setIsConnecting(false);
          proactiveTriggerService.setGeminiSocket(socket);
          proactiveScheduler.setGeminiSocket(socket);
          soundFxService.playConnectedBleep();
        },
        onReconnecting: (_attempts, _delay) => {
          setIsConnected(false);
          setIsConnecting(true);
        },
        onClose: (event) => {
          if (callGeneration !== callGenerationRef.current) return;
          isCallActiveRef.current = false;
          audioInRef.current?.stop();
          audioOutRef.current?.stopImmediate();
          proactiveTriggerService.setGeminiSocket(null);
          proactiveScheduler.setGeminiSocket(null);
          setIsConnected(false);
          setIsConnecting(false);
          setIsSpeaking(false);
          setIsListening(false);
          setUserTranscript('');
          setModelTranscript('');
          setActiveDecision(null);
          soundFxService.playDisconnect();
          if (event && !event.wasClean && event.code !== 1000) {
            setErrorMessage(`Conexión cerrada inesperadamente (Código: ${event.code})`);
          }
        },
        onError: (err) => {
          console.error('Socket Live error:', err);
          if (callGeneration !== callGenerationRef.current) return;
          setErrorMessage(`Error de conexión Live: ${err.message}`);
          if (!socket.isConnecting && !socket.reconnectTimer) {
            isCallActiveRef.current = false;
            audioInRef.current?.stop();
            setIsConnecting(false);
          }
        },
        onAudioChunk: (base64PCM) => {
          turnAudioReceivedRef.current = true;
          proactiveTriggerService.recordDialogueActivity();
          if (audioOutRef.current) {
            audioOutRef.current.playAudioChunk(base64PCM);
          }
        },
        onTurnComplete: () => {
          if (audioOutRef.current) {
            audioOutRef.current.signalTurnComplete();
          }
          if (screenCaptureRef.current?.isCapturing && !isSpeakingRef.current && !audioOutRef.current?.isPlaying) {
            screenCaptureRef.current.triggerImmediateCapture();
          }
          // Reset turn text and state cleanly (never execute robotic speech synthesis)
          pendingTextRef.current = '';
          turnAudioReceivedRef.current = false;
        },
        onTextPart: (cleanText) => {
          pendingTextRef.current = cleanText;
        },
        onOutputTranscription: (text) => {
          proactiveTriggerService.recordDialogueActivity();
          const cleanText = text ? text.replace(/<thought>[\s\S]*?<\/thought>/gi, '')
                .replace(/\[thought[\s\S]*?\]/gi, '')
                .replace(/\*pensando[\s\S]*?\*/gi, '')
                .replace(/\*pensamiento[\s\S]*?\*/gi, '')
                .replace(/\[action:[\s\S]*?\]/gi, '')
                .replace(/\[tool:[\s\S]*?\]/gi, '')
                .replace(/\[decision:[\s\S]*?\]/gi, '')
                .replace(/\[(?:emotion|gesto|emocion|pose|mood|expression|modelo|model|tag|etiqueta):\s*[a-zA-Z0-9_-]+\]/gi, '')
                .replace(/\[(?:yandere|tsundere|dandere|deredere|kuudere|yanderegirl|icegirl|hiyori|ruan_mei|ellen|sparkle|huohuo|vivian|goth_loli)\]/gi, '')
                .replace(/\((?:yandere|tsundere|dandere|deredere|kuudere|yanderegirl|icegirl|hiyori|ruan_mei|ellen|sparkle|huohuo|vivian|goth_loli)\)/gi, '')
                .replace(/\b(?:yandere|tsundere|yanderegirl)\s*:\s*/gi, '')
                .replace(/\s{2,}/g, ' ')
                .trim()
            : '';
          if (cleanText) {
            pendingTextRef.current = cleanText;
            setModelTranscript(cleanText);
            if (modelSubtitleTimeoutRef.current) clearTimeout(modelSubtitleTimeoutRef.current);

          }
        },
        onInputTranscription: (text) => {
          proactiveTriggerService.recordDialogueActivity();
          const cleanText = text ? text.trim() : '';
          if (cleanText) {
            setUserTranscript(cleanText);
            if (userSubtitleTimeoutRef.current) clearTimeout(userSubtitleTimeoutRef.current);

          }
        },
        onInterrupted: () => {
          ttsFallbackService.stop();
          pendingTextRef.current = '';
          turnAudioReceivedRef.current = false;
          if (audioOutRef.current) {
            audioOutRef.current.stopImmediate();
          }
          setIsSpeaking(false);
        },
        onToolCall: async (functionCalls, sourceSocket) => {
          if (toolExecutorRef.current) {
            const responses = await toolExecutorRef.current.executeCalls(functionCalls);
            if (socket.websocket === sourceSocket && callGeneration === callGenerationRef.current) {
              socket.sendToolResponse(responses);
            }
          }
        }
      });

      socketRef.current = socket;
      await socket.connect();
    } catch (err) {
      if (callGeneration !== callGenerationRef.current) return;
      isCallActiveRef.current = false;
      audioInRef.current?.stop();
      socketRef.current?.disconnect();
      console.error('Error al iniciar llamada en vivo:', err);
      setErrorMessage(`No se pudo conectar: ${err.message}`);
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [isConnected, isConnecting, isMuted, isCameraActive, config, setSubtitleText]);

  // --- Configuration Persistence and Live Updates ---
  const handleSaveConfig = useCallback((newConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newConfig));
      configManager.saveConfig(newConfig);
      electronBridge.saveAppConfig(newConfig);
    } catch (e) {}

    // Update active Live2D model in runtime if changed
    if (newConfig.live2dModelId) {
      if (window.__cristiAvatar?.loadModel) {
        window.__cristiAvatar.loadModel(newConfig.live2dModelId);
      }
      if (live2dRef.current?.switchModel) {
        live2dRef.current.switchModel(newConfig.live2dModelId);
      }
    }
  }, []);

  const handleSwitchLive2DModel = useCallback((modelId) => {
    const nextConfig = {
      ...config,
      live2dModelId: modelId
    };
    handleSaveConfig(nextConfig);
    const modelName = live2dModelRegistry.getModel(modelId)?.name || modelId;
    toastService.info('Avatar', `Modelo cambiado a: ${modelName}`);
  }, [config, handleSaveConfig]);

  const handleSwitchAiModel = useCallback((modelId) => {
    const nextConfig = { ...config, modelId };
    handleSaveConfig(nextConfig);
    if (socketRef.current) {
      if (audioOutRef.current) audioOutRef.current.stopImmediate();
      setIsSpeaking(false);
      pendingTextRef.current = '';
      turnAudioReceivedRef.current = false;
      ttsFallbackService.stop();
      socketRef.current.switchModel(modelId);
    }
    toastService.info('Modelo IA', `Motor cambiado a: ${modelId}`);
  }, [config, handleSaveConfig]);

  const handleSwitchVoice = useCallback((voiceName) => {
    const nextConfig = { ...config, voiceName };
    handleSaveConfig(nextConfig);
    if (socketRef.current) {
      if (audioOutRef.current) audioOutRef.current.stopImmediate();
      setIsSpeaking(false);
      pendingTextRef.current = '';
      turnAudioReceivedRef.current = false;
      ttsFallbackService.stop();
      socketRef.current.switchVoice(voiceName);
    }
    toastService.info('Voz de Cristi', `Timbre cambiado a: ${voiceName}`);
  }, [config, handleSaveConfig]);

  // --- Real-Time IPC Hot Synchronization with Settings Window ---
  useEffect(() => {
    const unsubConfig = electronBridge.onConfigUpdated((newConfig) => {
      if (newConfig && typeof newConfig === 'object') {
        setConfig((prev) => ({ ...prev, ...newConfig }));

        // 1. Instant Live2D Model Hot-Swap
        if (newConfig.live2dModelId) {
          if (window.__cristiAvatar?.loadModel) {
            window.__cristiAvatar.loadModel(newConfig.live2dModelId);
          }
          if (live2dRef.current?.switchModel) {
            live2dRef.current.switchModel(newConfig.live2dModelId);
          }
        }

        // 2. Instant Background Scene Hot-Swap (only if scene itself actually changed)
        if (newConfig.sceneId && newConfig.sceneId !== sceneManager.selectedSceneId) {
          sceneManager.setScene(newConfig.sceneId);
        }

        // 3. Voice Switch Notification & Hot Live Reconnect
        if (newConfig.voiceName && newConfig.voiceName !== config.voiceName) {
          if (socketRef.current) {
            if (audioOutRef.current) audioOutRef.current.stopImmediate();
            setIsSpeaking(false);
            pendingTextRef.current = '';
            turnAudioReceivedRef.current = false;
            ttsFallbackService.stop();
            socketRef.current.switchVoice(newConfig.voiceName);
          }
          toastService.info('Voz de Cristi', `Timbre cambiado a: ${newConfig.voiceName}`);
        }

        // 4. Model Switch Notification & Hot Live Reconnect
        if (newConfig.modelId && newConfig.modelId !== config.modelId) {
          if (socketRef.current) {
            if (audioOutRef.current) audioOutRef.current.stopImmediate();
            setIsSpeaking(false);
            pendingTextRef.current = '';
            turnAudioReceivedRef.current = false;
            ttsFallbackService.stop();
            socketRef.current.switchModel(newConfig.modelId);
          }
          toastService.info('Modelo IA', `Motor cambiado a: ${newConfig.modelId}`);
        }
      }
    });

    const unsubPause = electronBridge.onCompanionPause(() => {
      if (live2dRef.current?.setFpsLimit) {
        live2dRef.current.setFpsLimit(30);
      }
    });

    const unsubResume = electronBridge.onCompanionResume(() => {
      if (live2dRef.current?.setFpsLimit) {
        live2dRef.current.setFpsLimit(0);
      }
    });

    const unsubScene = sceneManager.onSceneChange((scene) => {
      setIsSolidBackdrop(scene.isSceneVisible);
    });

    return () => {
      unsubConfig?.();
      unsubPause?.();
      unsubResume?.();
      unsubScene?.();
    };
  }, [config.live2dModelId, config.voiceName, config.modelId]);

  // --- Mute Toggle Handler ---
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // --- Camera Hardware & AI Tracking Toggle (Standalone Independent Window) ---
  const handleToggleCamera = useCallback(async () => {
    try {
      soundFxService.playClick();
      const isOpen = await electronBridge.isCameraWindowOpen();
      if (isOpen) {
        await electronBridge.closeCameraWindow();
        setIsCameraActive(false);
        toastService.info('Monitor de cámara cerrado');
        if (socketRef.current?.isConnected) {
          socketRef.current.sendTextMessage('[SISTEMA: Ariel ha cerrado la cámara web.]');
        }
      } else {
        await electronBridge.openCameraWindow();
        setIsCameraActive(true);
        toastService.info('Monitor de cámara abierto en ventana independiente');
        if (socketRef.current?.isConnected) {
          socketRef.current.sendTextMessage('[SISTEMA: Ariel ha encendido la cámara web. Los fotogramas de video en tiempo real corresponden a su cámara óptica.]');
        }
      }
    } catch (err) {
      console.error('Error al controlar ventana de cámara:', err);
    }
  }, []);

  // --- Transparent / Scene Backdrop Alternation ---
  const handleToggleBackdrop = useCallback(() => {
    try { soundFxService.playClick(); } catch (_) {}
    const visible = sceneManager.toggleBackdrop();
    setIsSolidBackdrop(visible);
  }, []);

  // --- Right-Click Context Menu Handler ---
  const handleModelContextMenu = useCallback((e, bounds) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    const posX = e?.clientX !== undefined ? e.clientX : (window.innerWidth / 2);
    const posY = e?.clientY !== undefined ? e.clientY : (window.innerHeight / 2);
    setContextMenu({
      isOpen: true,
      x: posX,
      y: posY,
      modelBounds: bounds || null
    });
  }, []);

  // --- Expose Automation Hooks & Test Bridge ---
  useEffect(() => {
    window.__cristiApp = {
      connect: () => !isCallActiveRef.current && handleToggleConnection(),
      disconnect: () => isCallActiveRef.current && handleToggleConnection(),
      sendTextMessage: (text) => socketRef.current?.sendTextMessage(text),
      triggerGesture: (g) => setCurrentGesture(g),
      setSubtitle: (t) => setSubtitleText(t),
      openContextMenu: (x, y) => handleModelContextMenu({ clientX: x || 300, clientY: y || 200 }),
      closeContextMenu: () => setContextMenu({ isOpen: false, x: 0, y: 0, modelBounds: null }),
      openPerformanceHUD: () => setIsPerformanceHudOpen(true),
      closePerformanceHUD: () => setIsPerformanceHudOpen(false),
      openRegionPicker: () => setIsRegionPickerOpen(true),
      closeRegionPicker: () => setIsRegionPickerOpen(false),
      openVoiceEnrollment: handleOpenSettings,
      closeVoiceEnrollment: () => electronBridge.closeSettingsWindow(),
      openSettings: handleOpenSettings,
      closeSettings: () => electronBridge.closeSettingsWindow(),
      toggleCamera: handleToggleCamera,
      getModalStates: () => ({
        isContextMenuOpen: contextMenu.isOpen,
        isRegionPickerOpen,
        isPerformanceHudOpen
      }),
      eventBus,
      toast,
      toastService,
      externalDeviceManager,
      gameIntegrationManager,
      live2dModelRegistry,
      socketRef,
      audioOutRef,
      audioInRef,
      switchLive2DModel: (id) => handleSaveConfig({ ...config, live2dModelId: id }),
      getStatus: () => ({
        isConnected,
        isConnecting,
        isSpeaking,
        isListening,
        modelId: config.modelId,
        live2dModelId: config.live2dModelId || 'yanderegirl',
        voiceName: config.voiceName,
        currentGesture,
        userTranscript,
        modelTranscript
      })
    };

    window.__triggerGesture = (g) => setCurrentGesture(g);
    window.__setSubtitle = (text) => setSubtitleText(text);

    return () => {
      delete window.__cristiApp;
      delete window.__triggerGesture;
      delete window.__setSubtitle;
    };
  }, [
    handleToggleConnection,
    handleSaveConfig,
    handleOpenSettings,
    handleToggleCamera,
    handleModelContextMenu,
    isConnected,
    isConnecting,
    isSpeaking,
    isListening,
    config,
    currentGesture,
    userTranscript,
    modelTranscript,
    setSubtitleText,
    contextMenu,
    isRegionPickerOpen,
    isPerformanceHudOpen
  ]);

  // --- Reactive Synchronization for Microphone Mute State (Shortcuts, Tray, UI) ---
  useEffect(() => {
    if (audioInRef.current) {
      if (isMuted) audioInRef.current.mute();
      else audioInRef.current.unmute();
    }
  }, [isMuted]);

  // Sync with standalone camera window state and frame stream for Gemini Live
  useEffect(() => {
    const unsubCameraState = electronBridge.onCameraWindowState?.(({ isOpen }) => {
      setIsCameraActive(isOpen);
    });

    let broadcast = null;
    let lastCameraSendTime = 0;
    try {
      broadcast = new BroadcastChannel('cristi_camera_stream');
      broadcast.onmessage = (e) => {
        if (e.data?.type === 'camera_frame' && e.data?.base64) {
            sendRealtimeVisionFrame(e.data.base64, 'camera');
        } else if (e.data?.type === 'camera_snapshot' && e.data?.base64) {
          if (socketRef.current?.isConnected) {
            sendRealtimeVisionFrame(e.data.base64, 'camera', true);
            toastService.info('Visión Cristi AI', 'Fotograma de cámara transmitido a la IA');
          } else {
            toastService.info('Cámara', 'Fotograma copiado al portapapeles');
          }
        }
      };
    } catch (_) {}

    return () => {
      unsubCameraState?.();
      try { broadcast?.close(); } catch (_) {}
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__cristiOpenContextMenu = (x, y) => handleModelContextMenu({ clientX: x || 300, clientY: y || 200 });
    }
  }, [handleModelContextMenu]);

  const handleTriggerRandomGesture = () => {
    const gestures = ['happy', 'blush', 'wink', 'dance', 'yandere', 'mad', 'surprised'];
    const random = gestures[Math.floor(Math.random() * gestures.length)];
    setCurrentGesture(random);
    setTimeout(() => {
      setCurrentGesture('idle');
    }, 4500);
  };

  // --- Screen Capture Handlers (Mutually Exclusive: Fullscreen vs Region) ---
  const handleToggleScreenWatch = () => {
    // Si había una región activa y se hace clic en pantalla completa, cambiamos a pantalla completa
    if (screenRegion) {
      setScreenRegion(null);
      screenCaptureRef.current?.clearRegion();
      setIsScreenWatchActive(true);
      toastService.info('Visión de Pantalla Completa', 'Cristi ahora observa toda la pantalla (región recortada desactivada).');
      if (toolExecutorRef.current) {
        toolExecutorRef.current.executeSingleTool('clear_screen_region', {});
        toolExecutorRef.current.executeSingleTool('set_screen_watch', { enabled: true });
      }
      if (socketRef.current?.isConnected) {
        socketRef.current.sendTextMessage('[SISTEMA: Ariel ha cambiado a la observación de pantalla completa. Los fotogramas de video en tiempo real corresponden a su monitor entero.]');
      }
      return;
    }

    const nextState = !isScreenWatchActive;
    setIsScreenWatchActive(nextState);
    if (nextState) {
      toastService.info('Visión de Pantalla Activa', 'Cristi ahora está observando y analizando toda tu pantalla en tiempo real.');
      if (socketRef.current?.isConnected) {
        socketRef.current.sendTextMessage('[SISTEMA: Ariel ha activado la compartición de pantalla completa. Los fotogramas de video en tiempo real corresponden a su monitor.]');
      }
    } else {
      toastService.info('Visión de Pantalla Desactivada', 'Se detuvo el análisis continuo de pantalla.');
      if (socketRef.current?.isConnected) {
        socketRef.current.sendTextMessage('[SISTEMA: Ariel ha desactivado la compartición de pantalla.]');
      }
    }
    if (toolExecutorRef.current) {
      toolExecutorRef.current.executeSingleTool('set_screen_watch', { enabled: nextState });
    }
  };

  const handleRegionSelected = (region) => {
    setScreenRegion(region);
    setIsRegionPickerOpen(false);
    setIsScreenWatchActive(true);
    toastService.success(
      'Área de Visión Seleccionada',
      `Cristi ahora vigila exclusivamente el área delimitada (${Math.round(region.w_pct)}% × ${Math.round(region.h_pct)}%).`
    );
    if (screenCaptureRef.current) {
      screenCaptureRef.current.setRegion(region);
    }
    if (toolExecutorRef.current) {
      toolExecutorRef.current.executeSingleTool('set_screen_region', region);
    }
    if (socketRef.current?.isConnected) {
      socketRef.current.sendTextMessage(`[SISTEMA: Ariel ha seleccionado un área recortada de su pantalla (${Math.round(region.w_pct)}% × ${Math.round(region.h_pct)}%) para que la observes en el flujo de video en tiempo real.]`);
    }
  };

  const handleClearScreenRegion = () => {
    setScreenRegion(null);
    setIsScreenWatchActive(false);
    screenCaptureRef.current?.clearRegion();
    toastService.info('Visión Desactivada', 'Se limpió el área de recorte y se detuvo la transmisión.');
    if (toolExecutorRef.current) {
      toolExecutorRef.current.executeSingleTool('clear_screen_region', {});
      toolExecutorRef.current.executeSingleTool('set_screen_watch', { enabled: false });
    }
    if (socketRef.current?.isConnected) {
      socketRef.current.sendTextMessage('[SISTEMA: Ariel ha desactivado el área recortada de pantalla.]');
    }
  };

  const handleMinimizeToTray = () => {
    if (systemTrayRef.current) {
      systemTrayRef.current.minimizeToTray();
    } else {
      electronBridge.minimizeWindow();
    }
  };

  return (
    <div
      className={`app-container ${isSolidBackdrop ? 'solid-backdrop' : 'transparent-backdrop'}`}
    >
      {/* Global Error Banner Toast */}
      {errorMessage && (
        <div className="global-error-toast">
          <ShieldAlert size={16} color="#f43f5e" />
          <span style={{ flex: 1 }}>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Atmospheric Background Scene & Themes */}
      <BackgroundScene />

      {/* 1. Live2D Avatar Stage */}
      <AvatarStage
        ref={live2dRef}
        modelId={config.live2dModelId || 'yanderegirl'}
        gesture={currentGesture}
        isSpeaking={isSpeaking}
        isListening={isListening}
        viewMode={viewMode}
        onModelClick={handleTriggerRandomGesture}
        onModelContextMenu={handleModelContextMenu}
        onTouchReaction={(hitArea) => {
          if (hitArea === 'head') {
            setCurrentGesture('blush');
            setTimeout(() => setCurrentGesture('happy'), 1500);
          } else {
            setCurrentGesture('happy');
          }
        }}
      />

      {/* Screen Region Overlay */}
      <ScreenRegionOverlay
        region={screenRegion}
        isWatchActive={isScreenWatchActive}
      />

      {/* Screen Region Picker */}
      {isRegionPickerOpen && (
        <ScreenRegionPicker
          onRegionSelected={handleRegionSelected}
          onCancel={() => setIsRegionPickerOpen(false)}
        />
      )}

      {/* 2. Dual Subtitles & Tactical Decision Micro-Toast */}
      <SubtitleOverlay
        userTranscript={userTranscript}
        modelTranscript={modelTranscript}
        activeDecision={activeDecision}
        isVisible={isUiVisible && !isZenMode}
      />

      {/* 3. Floating HUD & Controls with Zen Mode Auto-Hide */}
      <FloatingHUD
        isConnected={isConnected}
        isConnecting={isConnecting}
        isMuted={isMuted}
        isCameraActive={isCameraActive}
        isSolidBackdrop={isSolidBackdrop}
        modelId={config.modelId}
        voiceName={config.voiceName}
        isSpeaking={isSpeaking}
        isListening={isListening}
        activeToolName={activeToolName}
        viewMode={viewMode}
        isUiVisible={isUiVisible}
        onToggleConnection={handleToggleConnection}
        onToggleMute={handleToggleMute}
        onToggleCamera={handleToggleCamera}
        onToggleBackdrop={handleToggleBackdrop}
        onOpenSettings={handleOpenSettings}
        isScreenWatchActive={isScreenWatchActive}
        hasScreenRegion={!!screenRegion}
        onToggleScreenWatch={handleToggleScreenWatch}
        onTogglePerformanceHUD={() => setIsPerformanceHudOpen((prev) => !prev)}
        onOpenRegionPicker={() => setIsRegionPickerOpen(true)}
        onClearScreenRegion={handleClearScreenRegion}
        onToggleViewMode={handleToggleViewMode}
        onToggleZenMode={handleToggleZenMode}
        onWakeUi={resetInactivityTimer}
      />

      {/* 4. Tactical Desktop Cyber Widgets */}
      <DesktopWidgets isVisible={showWidgets && isUiVisible && !isZenMode} />

      {/* 6. Desktop Right-Click Context Menu */}
      <ContextMenu
        position={contextMenu}
        isOpen={contextMenu.isOpen}
        onClose={() => setContextMenu({ isOpen: false, x: 0, y: 0, modelBounds: null })}
        onOpenSettings={handleOpenSettings}
        onToggleCamera={handleToggleCamera}
        isCameraActive={isCameraActive}
        onToggleBackdrop={handleToggleBackdrop}
        isSolidBackdrop={isSolidBackdrop}
        onTriggerRandomGesture={handleTriggerRandomGesture}
        onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
        isAlwaysOnTop={isAlwaysOnTop}
        viewMode={viewMode}
        onToggleViewMode={handleToggleViewMode}
        isZenMode={isZenMode}
        onToggleZenMode={handleToggleZenMode}
        onMinimizeToTray={handleMinimizeToTray}
        showWidgets={showWidgets}
        onToggleWidgets={() => setShowWidgets((prev) => !prev)}
        isClickThroughEnabled={isClickThroughEnabled}
        onToggleClickThrough={() => setIsClickThroughEnabled((prev) => !prev)}
        onTogglePerformanceHUD={() => setIsPerformanceHudOpen((prev) => !prev)}
        onOpenRegionPicker={() => setIsRegionPickerOpen(true)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        activeModelId={config.live2dModelId || 'yanderegirl'}
        onSwitchLive2DModel={handleSwitchLive2DModel}
        activeAiModelId={config.modelId || DEFAULT_MODEL_ID}
        onSwitchAiModel={handleSwitchAiModel}
        activeVoiceName={config.voiceName || 'Aoede'}
        onSwitchVoice={handleSwitchVoice}
      />

      {/* 7. Enterprise Performance & Telemetry HUD (Toggle with F3) */}
      <PerformanceHUD
        isVisible={isPerformanceHudOpen}
        onClose={() => setIsPerformanceHudOpen(false)}
      />

      {/* 9. Futuristic Minimalist HUD Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

export default App;
