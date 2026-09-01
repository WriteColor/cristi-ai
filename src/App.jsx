import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import {
  Live2DCanvas,
  FloatingHUD,
  SubtitleOverlay,
  ContextMenu,
  CameraPreview,
  ScreenRegionOverlay,
  ScreenRegionPicker,
  ToastContainer,
  DesktopWidgets,
  SpeakerDiagnosticsHUD,
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
  SpeechRecognitionService,
  VisionDetectionService,
  ScreenCaptureService,
  SystemTrayService,
  externalDeviceManager,
  gameIntegrationManager,
  live2dModelRegistry,
  contextualEmotionOrchestrator,
  electronBridge,
  clickThroughService,
  speakerRecognitionService,
  modelManager,
  configManager,
  soundFxService,
  proactiveTriggerService,
  toast,
  toastService,
  logger
} from './services/index.js';
import {
  DEFAULT_MODEL_ID,
  SYSTEM_PERSONA_PROMPT,
  GEMINI_MODELS,
  getScreenCaptureFPS
} from './config/index.js';

const STORAGE_KEY_CONFIG = 'cristi_ai_settings_v1';
const STORAGE_KEY_VIEWMODE = 'cristi_ai_viewmode_v1';

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
        return parsed;
      }
    } catch (e) {}
    return {
      apiKey: envApiKey,
      modelId: DEFAULT_MODEL_ID,
      live2dModelId: 'yanderegirl',
      voiceName: 'Aoede',
      temperature: 0.75,
      systemPrompt: SYSTEM_PERSONA_PROMPT
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
  const [isListening, setIsListening] = useState(false);
  const [currentGesture, setCurrentGesture] = useState('idle');
  const [activeToolName, setActiveToolName] = useState(null);

  // --- Subtitles / User Transcript ---
  const [userTranscript, setUserTranscript] = useState('');
  const [modelTranscript, setModelTranscript] = useState('');
  const subtitleTimeoutRef = useRef(null);

  const setSubtitleText = useCallback((text) => {
    setModelTranscript(text);
    setUserTranscript(text);
    if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
    subtitleTimeoutRef.current = setTimeout(() => {
      setUserTranscript('');
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
  const [isSolidBackdrop, setIsSolidBackdrop] = useState(() => {
    try {
      const saved = localStorage.getItem('cristi_ai_solid_backdrop_v1');
      if (saved !== null) return saved === 'true';
      return false; // Default: Transparent Desktop Widget mode
    } catch {
      return false;
    }
  });
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [isClickThroughEnabled, setIsClickThroughEnabled] = useState(true);
  const [speakerDecision, setSpeakerDecision] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0 });
  const [isPerformanceHudOpen, setIsPerformanceHudOpen] = useState(false);

  // --- Screen Capture States ---
  const [isScreenWatchActive, setIsScreenWatchActive] = useState(false);
  const [screenRegion, setScreenRegion] = useState(null);
  const [isRegionPickerOpen, setIsRegionPickerOpen] = useState(false);

  // --- Zen Mode / Ghost UI Auto-Hide States ---
  const [isZenMode, setIsZenMode] = useState(false);
  const [isUiVisible, setIsUiVisible] = useState(true);
  const autoHideTimerRef = useRef(null);

  const handleOpenSettings = useCallback(() => {
    soundFxService.playClick();
    electronBridge.openSettingsWindow();
  }, []);

  // --- Interaction Lock for Modals ---
  const isAnyModalOpen = Boolean(
    isRegionPickerOpen ||
    contextMenu.isOpen ||
    isPerformanceHudOpen
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
  const speechRecRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const screenCaptureRef = useRef(null);
  const systemTrayRef = useRef(null);
  const live2dRef = useRef(null);



  // Toggle Torso vs Full body framing
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
      return next;
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

  // Clean up subtitle timer on unmount
  useEffect(() => {
    return () => {
      if (subtitleTimeoutRef.current) {
        clearTimeout(subtitleTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onActivity = () => {
      proactiveTriggerService.recordUserActivity();
      if (!isZenMode) resetInactivityTimer();
    };
    const onKeyDown = (e) => {
      proactiveTriggerService.recordUserActivity();
      if (e.key === 'Escape') {
        // Hierarchical escape resolution
        if (contextMenu.isOpen) {
          setContextMenu({ isOpen: false, x: 0, y: 0, modelBounds: null });
        } else if (isRegionPickerOpen) {
          setIsRegionPickerOpen(false);
        } else if (isVoiceEnrollmentOpen) {
          setIsVoiceEnrollmentOpen(false);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
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

    window.addEventListener('mousemove', onActivity);
    window.addEventListener('mousedown', onActivity);
    window.addEventListener('keydown', onKeyDown);
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
    isVoiceEnrollmentOpen,
    isSettingsOpen,
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

  // --- Initialize Electron Native Desktop Environment & System Tray ---
  useEffect(() => {
    if (electronBridge.isElectron) {
      try {
        setIsAlwaysOnTop(true);

        systemTrayRef.current = new SystemTrayService({
          onRestoreWindow: () => {
            setIsUiVisible(true);
          },
          onToggleMute: () => {
            setIsMuted((prev) => !prev);
          },
          onToggleViewMode: () => {
            handleToggleViewMode();
          },
          onToggleAlwaysOnTop: () => {
            handleToggleAlwaysOnTop();
          },
          onOpenVoiceEnrollment: () => {
            setIsVoiceEnrollmentOpen(true);
          }
        });

        systemTrayRef.current.setupTray();

        // Register Global Shortcut Event Listeners (OS-Wide)
        const unsubMuteShortcut = electronBridge.onShortcutEvent('shortcut-toggle-mute', () => {
          setIsMuted((prev) => {
            const next = !prev;
            toastService.info(next ? 'Micrófono silenciado (Ctrl+Shift+M)' : 'Micrófono activado (Ctrl+Shift+M)');
            return next;
          });
        });

        const unsubVisionShortcut = electronBridge.onShortcutEvent('shortcut-capture-screen', async () => {
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
          setIsZenMode((prev) => {
            const next = !prev;
            setIsUiVisible(!next);
            toastService.info(next ? 'Modo Zen activado / UI Oculta (Ctrl+Shift+H)' : 'Interfaz visible (Ctrl+Shift+H)');
            setTimeout(() => clickThroughService.syncHitboxes(), 60);
            return next;
          });
        });

        const unsubPerfShortcut = electronBridge.onShortcutEvent('shortcut-toggle-perf-hud', () => {
          setIsPerformanceHudOpen((prev) => {
            const next = !prev;
            toastService.info(next ? 'Telemetría y FPS activada (Ctrl+Shift+P)' : 'Telemetría oculta (Ctrl+Shift+P)');
            return next;
          });
        });

        const unsubPinShortcut = electronBridge.onShortcutEvent('shortcut-toggle-always-on-top', () => {
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

    // Listen to Speaker Recognition telemetry
    const unsubSpeaker = speakerRecognitionService.onTelemetry((telemetry) => {
      setSpeakerDecision(telemetry.lastDecision);
    });

    if (typeof window !== 'undefined') {
      window.__cristiEventBus = eventBus;
      window.__cristiOpenVoiceEnrollment = () => setIsVoiceEnrollmentOpen(true);
      window.__cristiModelManager = modelManager;
      window.__cristiSpeakerService = speakerRecognitionService;
    }

    return () => {
      if (systemTrayRef.current?._unsubShortcuts) {
        systemTrayRef.current._unsubShortcuts();
      }
      unsubSpeaker();
    };
  }, []);

  // --- Audio Output Service Setup ---
  useEffect(() => {
    audioOutRef.current = new AudioOutputService({
      onAudioStart: () => {
        setIsSpeaking(true);
      },
      onAudioEnd: () => {
        setIsSpeaking(false);
      },
      onLipSyncUpdate: (val) => {
        // Obsolete
      },
      onVolumeChange: (vol) => {
        // Obsolete
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
            `[EVENTO SENSORIAL DE VISIÓN: Jeremy está distraído usando su teléfono celular en la mano frente a la cámara (${duration}s continuos, distancia muñeca-celular ${distancePx}px). Regáñalo cariñosa pero firmemente con tu personalidad yandere gótica para que deje el celular y vuelva a concentrarse en su trabajo.]`
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
        if (socketRef.current && socketRef.current.isConnected) {
          socketRef.current.sendVideoFrame(base64JPEG);
        }
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
  }, []);

  // --- Web Speech Recognition Service Setup ---
  useEffect(() => {
    speechRecRef.current = new SpeechRecognitionService({
      onSpeechStart: () => {
        setIsListening(true);
        eventBus.emit(EVENTS.USER_SPEAKING);
      },
      onSpeechEnd: () => {
        setIsListening(false);
        eventBus.emit(EVENTS.USER_STOPPED_SPEAKING);
      },
      onResult: (text, isFinal) => {
        setUserTranscript(text);
        if (isFinal && text.trim()) {
          setTimeout(() => setUserTranscript(''), 3000);
        }
      },
      onError: (err) => {
        console.warn('SpeechRecognition warning:', err);
      }
    });

    return () => {
      if (speechRecRef.current) {
        speechRecRef.current.stop();
      }
    };
  }, []);

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
      onToolExecutionStart: (name) => {
        setActiveToolName(name);
      },
      onToolExecutionEnd: () => {
        setTimeout(() => {
          setActiveToolName(null);
        }, 2000);
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
                if (socketRef.current?.isConnected) {
                  socketRef.current.sendVideoFrame(base64jpeg);
                }
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
    const video = cameraVideoRef.current || cameraRef.current?.getVideoElement();
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
      await cameraRef.current.start(cameraVideoRef.current, deviceId);
      if (visionServiceRef.current) {
        const getVideo = () => cameraVideoRef.current || cameraRef.current?.getVideoElement();
        const getCanvas = () => overlayCanvasRef.current;
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
    if (isConnected || isConnecting) {
      if (socketRef.current) socketRef.current.disconnect();
      if (audioInRef.current) audioInRef.current.stop();
      if (audioOutRef.current) audioOutRef.current.stopImmediate();
      if (speechRecRef.current) speechRecRef.current.stop();
      if (cameraRef.current) cameraRef.current.stopPeriodicStreaming();

      setIsConnected(false);
      setIsConnecting(false);
      setIsSpeaking(false);
      setIsListening(false);
      setUserTranscript('');
      setModelTranscript('');
      setCurrentGesture('idle');
      return;
    }

    if (!config.apiKey || !config.apiKey.trim()) {
      toastService.warning('Por favor configura tu Gemini API Key en el menú de Ajustes (⚙).');
      handleOpenSettings();
      return;
    }

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
            if (socketRef.current && socketRef.current.isConnected && !isMuted) {
              socketRef.current.sendAudioChunk(base64PCM);
            }
          },
          onVolumeChange: (vol) => {
            if (vol > 0.12 && audioOutRef.current && audioOutRef.current.isPlaying) {
              audioOutRef.current.stopImmediate();
              setIsSpeaking(false);
            }
          },
          onError: (err) => {
            setErrorMessage(`Error de micrófono: ${err.message}`);
          }
        });
      }

      await audioInRef.current.start();
      if (audioOutRef.current) {
        await audioOutRef.current.resumeContext();
      }

      const socket = new GeminiLiveSocket({
        apiKey: config.apiKey,
        modelId: config.modelId,
        voiceName: config.voiceName,
        temperature: config.temperature,
        systemPrompt: config.systemPrompt && config.systemPrompt.trim()
          ? config.systemPrompt
          : SYSTEM_PERSONA_PROMPT,
        onOpen: () => {
          setIsConnected(true);
          setIsConnecting(false);
          setCurrentGesture('happy');
          setTimeout(() => setCurrentGesture('idle'), 3000);
        },
        onClose: (event) => {
          setIsConnected(false);
          setIsConnecting(false);
          setIsSpeaking(false);
          setIsListening(false);
          if (event && event.code !== 1000) {
            setErrorMessage(`Llamada terminada (${event.code}): ${event.reason || 'Conexión cerrada'}`);
          }
        },
        onError: (err) => {
          console.error('Socket Live error:', err);
          setErrorMessage(`Error de conexión Live: ${err.message}`);
          setIsConnecting(false);
        },
        onAudioChunk: (base64PCM) => {
          // If speaker was identified as unauthorized stranger, suppress Cristi audio response
          if (speakerRecognitionService.hasEnrolledProfile() && speakerRecognitionService.lastDecision?.isOwner === false) {
            return;
          }
          if (audioOutRef.current) {
            audioOutRef.current.playAudioChunk(base64PCM);
          }
        },
        onOutputTranscription: (text) => {
          if (speakerRecognitionService.hasEnrolledProfile() && speakerRecognitionService.lastDecision?.isOwner === false) {
            return;
          }
          setSubtitleText(text);
        },
        onInputTranscription: (text) => {
          setUserTranscript(text);

          // Verify speaker identity against enrolled profile
          if (audioInRef.current) {
            const recentSamples = audioInRef.current.getRecentAudioSamples(1500);
            const decision = speakerRecognitionService.verifySpeaker(recentSamples);
            setSpeakerDecision(decision);

            if (decision.hasProfile && decision.isOwner === false) {
              logger.warn('SPEAKER', `Intervención de tercero detectada ("${text}"). Silenciando respuesta de Cristi.`);
              if (audioOutRef.current) {
                audioOutRef.current.stopImmediate();
              }
              setIsSpeaking(false);
              setSubtitleText('🔇 [Voz no autorizada — Cristi permanece en silencio]');
              toastService.error('Voz no autorizada detectada. Respuesta bloqueada.');
              soundFxService.playDisconnect();
            }
          }
        },
        onInterrupted: () => {
          if (audioOutRef.current) {
            audioOutRef.current.stopImmediate();
          }
          setIsSpeaking(false);
        },
        onToolCall: async (functionCalls) => {
          if (toolExecutorRef.current) {
            const responses = await toolExecutorRef.current.executeCalls(functionCalls);
            socket.sendToolResponse(responses);
          }
        }
      });

      socketRef.current = socket;
      await socket.connect();

      if (speechRecRef.current) {
        speechRecRef.current.start();
      }

      if (isCameraActive && cameraRef.current) {
        cameraRef.current.startPeriodicStreaming(0.5);
      }
    } catch (err) {
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
    const nextConfig = { ...config, live2dModelId: modelId };
    handleSaveConfig(nextConfig);
    toastService.info('Personaje Live2D', `Modelo cambiado a: ${live2dModelRegistry.getModel(modelId)?.name || modelId}`);
  }, [config, handleSaveConfig]);

  const handleSwitchAiModel = useCallback((modelId) => {
    const nextConfig = { ...config, modelId };
    handleSaveConfig(nextConfig);
    toastService.info('Modelo IA', `Motor cambiado a: ${modelId}`);
  }, [config, handleSaveConfig]);

  const handleSwitchVoice = useCallback((voiceName) => {
    const nextConfig = { ...config, voiceName };
    handleSaveConfig(nextConfig);
    toastService.info('Voz de Cristi', `Timbre cambiado a: ${voiceName}`);
  }, [config, handleSaveConfig]);

  // --- Real-Time IPC Hot Synchronization with Settings Window ---
  useEffect(() => {
    const unsubConfig = electronBridge.onConfigUpdated((newConfig) => {
      if (newConfig && typeof newConfig === 'object') {
        setConfig((prev) => ({ ...prev, ...newConfig }));
        if (newConfig.live2dModelId && newConfig.live2dModelId !== config.live2dModelId) {
          if (window.__cristiAvatar?.loadModel) {
            window.__cristiAvatar.loadModel(newConfig.live2dModelId);
          }
          if (live2dRef.current?.switchModel) {
            live2dRef.current.switchModel(newConfig.live2dModelId);
          }
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

    return () => {
      unsubConfig?.();
      unsubPause?.();
      unsubResume?.();
    };
  }, [config.live2dModelId]);

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
      connect: handleToggleConnection,
      disconnect: handleToggleConnection,
      sendTextMessage: (text) => socketRef.current?.sendTextMessage(text),
      triggerGesture: (g) => setCurrentGesture(g),
      setSubtitle: (t) => setSubtitleText(t),
      openSettings: () => setIsSettingsOpen(true),
      closeSettings: () => setIsSettingsOpen(false),
      openContextMenu: (x, y) => handleModelContextMenu({ clientX: x || 300, clientY: y || 200 }),
      closeContextMenu: () => setContextMenu({ isOpen: false, x: 0, y: 0, modelBounds: null }),
      openPerformanceHUD: () => setIsPerformanceHudOpen(true),
      closePerformanceHUD: () => setIsPerformanceHudOpen(false),
      openRegionPicker: () => setIsRegionPickerOpen(true),
      closeRegionPicker: () => setIsRegionPickerOpen(false),
      openVoiceEnrollment: () => setIsVoiceEnrollmentOpen(true),
      closeVoiceEnrollment: () => setIsVoiceEnrollmentOpen(false),
      toggleCamera: handleToggleCamera,
      getModalStates: () => ({
        isSettingsOpen,
        isContextMenuOpen: contextMenu.isOpen,
        isRegionPickerOpen,
        isPerformanceHudOpen,
        isVoiceEnrollmentOpen
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
    isConnected,
    isConnecting,
    isSpeaking,
    isListening,
    config,
    currentGesture,
    userTranscript,
    modelTranscript,
    setSubtitleText,
    isSettingsOpen,
    contextMenu,
    isRegionPickerOpen,
    isPerformanceHudOpen,
    isVoiceEnrollmentOpen
  ]);

  // --- Reactive Synchronization for Microphone Mute State (Shortcuts, Tray, UI) ---
  useEffect(() => {
    if (audioInRef.current) {
      if (isMuted) audioInRef.current.mute();
      else audioInRef.current.unmute();
    }
  }, [isMuted]);

  // --- Mute Toggle Handler ---
  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  // --- Camera Hardware & AI Tracking Toggle ---
  const handleToggleCamera = async () => {
    const nextState = !isCameraActive;
    setIsCameraActive(nextState);

    if (nextState) {
      try {
        if (!cameraRef.current) {
          cameraRef.current = new CameraService({
            onFrame: (base64JPEG) => {
              if (socketRef.current && socketRef.current.isConnected) {
                socketRef.current.sendVideoFrame(base64JPEG);
              }
            },
            onError: (err) => {
              setErrorMessage(`Error de hardware de cámara: ${err.message}`);
            }
          });
        }

        await cameraRef.current.start(cameraVideoRef.current, currentDeviceId);

        if (isConnected) {
          cameraRef.current.startPeriodicStreaming(0.5);
        }

        if (visionServiceRef.current) {
          const getVideo = () => cameraVideoRef.current || cameraRef.current?.getVideoElement();
          const getCanvas = () => overlayCanvasRef.current;
          visionServiceRef.current.startTracking(getVideo, getCanvas);
        }
      } catch (err) {
        console.error('Error al activar cámara:', err);
        setErrorMessage(`Error al activar cámara: ${err.message}`);
        setIsCameraActive(false);
      }
    } else {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (visionServiceRef.current) {
        visionServiceRef.current.stopTracking();
      }
      setVisionDetections(null);
    }
  };

  // Sync camera preview element when CameraPreview component mounts into DOM
  useEffect(() => {
    if (isCameraActive && cameraVideoRef.current && cameraRef.current?.isStreaming) {
      cameraRef.current.attachVideoPreview(cameraVideoRef.current);
    }
  }, [isCameraActive]);

  // --- Transparent Backdrop Toggle ---
  const handleToggleBackdrop = () => {
    setIsSolidBackdrop((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cristi_ai_solid_backdrop_v1', next ? 'true' : 'false');
      } catch {}
      return next;
    });
  };

  // --- Always On Top Window Toggle ---
  const handleToggleAlwaysOnTop = useCallback(() => {
    setIsAlwaysOnTop((prev) => {
      const nextState = !prev;
      electronBridge.setAlwaysOnTop(nextState);
      return nextState;
    });
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

  // --- Screen Capture Handlers ---
  const handleToggleScreenWatch = () => {
    const nextState = !isScreenWatchActive;
    setIsScreenWatchActive(nextState);
    if (nextState) {
      toastService.info('Visión de Pantalla Activa', 'Cristi ahora está observando y analizando toda tu pantalla en tiempo real.');
    } else {
      toastService.info('Visión de Pantalla Desactivada', 'Se detuvo el análisis continuo de pantalla.');
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
      `Cristi ahora vigila el área delimitada (${Math.round(region.w_pct)}% × ${Math.round(region.h_pct)}% de la pantalla).`
    );
    if (screenCaptureRef.current) {
      screenCaptureRef.current.setRegion(region);
    }
    if (toolExecutorRef.current) {
      toolExecutorRef.current.executeSingleTool('set_screen_region', region);
    }
  };

  const handleClearScreenRegion = () => {
    setScreenRegion(null);
    screenCaptureRef.current?.clearRegion();
    toastService.info('Visión Reestablecida', 'Cristi ha vuelto a la visión de pantalla completa.');
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
      onContextMenu={handleModelContextMenu}
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

      {/* 1. Live2D Character Canvas */}
      <Live2DCanvas
        ref={live2dRef}
        modelId={config.live2dModelId || 'yanderegirl'}
        gesture={currentGesture}
        isSpeaking={isSpeaking}
        isListening={isListening}
        viewMode={viewMode}
        onModelClick={handleTriggerRandomGesture}
        onModelContextMenu={handleModelContextMenu}
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

      {/* 2. Subtitle / Transcription CC Overlay */}
      <SubtitleOverlay
        userTranscript={userTranscript || modelTranscript}
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
        onOpenRegionPicker={() => setIsRegionPickerOpen(true)}
        onClearScreenRegion={handleClearScreenRegion}
        onToggleViewMode={handleToggleViewMode}
        onToggleZenMode={handleToggleZenMode}
        onWakeUi={resetInactivityTimer}
      />

      {/* 4. Sensory Camera PiP Monitor */}
      <CameraPreview
        videoRef={cameraVideoRef}
        overlayCanvasRef={overlayCanvasRef}
        isStreaming={isCameraActive}
        mediaStream={cameraRef.current?.getMediaStream()}
        cameraService={cameraRef.current}
        detections={visionDetections}
        ownerSamples={ownerSamples}
        availableDevices={availableDevices}
        currentDeviceId={currentDeviceId}
        onSwitchCamera={handleSwitchCamera}
        isIREnhanced={isIREnhanced}
        onToggleIREnhancement={handleToggleIREnhancement}
        onAddSample={handleAddOwnerSample}
        onDeleteSample={handleDeleteOwnerSample}
        onClearAllSamples={handleClearAllOwnerSamples}
        onClose={handleToggleCamera}
      />

      {/* 5. Tactical Desktop Cyber Widgets */}
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
        onOpenVoiceEnrollment={handleOpenSettings}
        onOpenSpeakerHUD={handleOpenSettings}
        onTogglePerformanceHUD={() => setIsPerformanceHudOpen((prev) => !prev)}
        onOpenRegionPicker={() => setIsRegionPickerOpen(true)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isScreenWatchActive={isScreenWatchActive}
        onToggleScreenWatch={handleToggleScreenWatch}
        activeModelId={config.live2dModelId || 'yanderegirl'}
        onSwitchLive2DModel={handleSwitchLive2DModel}
        activeAiModelId={config.modelId || DEFAULT_MODEL_ID}
        onSwitchAiModel={handleSwitchAiModel}
        activeVoiceName={config.voiceName || 'Aoede'}
        onSwitchVoice={handleSwitchVoice}
      />

      {/* 7. Live S2S Voice Biometrics & Speaker Recognition Diagnostics HUD */}
      {isUiVisible && !isZenMode && (
        <SpeakerDiagnosticsHUD onOpenEnrollment={handleOpenSettings} />
      )}

      {/* 8. Enterprise Performance & Telemetry HUD (Toggle with F3) */}
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
