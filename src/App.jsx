import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Live2DCanvas } from './components/Live2DCanvas';
import { FloatingHUD } from './components/FloatingHUD';
import { SubtitleOverlay } from './components/SubtitleOverlay';
import { ContextMenu } from './components/ContextMenu';
import { SettingsModal } from './components/SettingsModal';
import { CameraPreview } from './components/CameraPreview';
import { ScreenRegionOverlay } from './components/ScreenRegionOverlay';
import { ScreenRegionPicker } from './components/ScreenRegionPicker';
import { GeminiLiveSocket } from './services/geminiLiveSocket';
import { AudioInputService } from './services/audioInputService';
import { AudioOutputService } from './services/audioOutputService';
import { ToolExecutor } from './services/toolExecutor';
import { CameraService } from './services/cameraService';
import { SpeechRecognitionService } from './services/speechRecognition';
import { VisionDetectionService } from './services/visionDetectionService';
import { ScreenCaptureService } from './services/screenCaptureService';
import { SystemTrayService } from './services/systemTrayService';
import { DEFAULT_MODEL_ID, SYSTEM_PERSONA_PROMPT, GEMINI_MODELS, getScreenCaptureFPS } from './config/models';
import { ShieldAlert, X } from 'lucide-react';

const STORAGE_KEY_CONFIG = 'cristi_ai_settings_v1';
const STORAGE_KEY_VIEWMODE = 'cristi_ai_viewmode_v1';

export function App() {
  // --- Persistent App Configuration ---
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        const isKnownModel = Object.values(GEMINI_MODELS).some((m) => m.id === parsed.modelId);
        if (!isKnownModel) {
          parsed.modelId = DEFAULT_MODEL_ID;
        }
        return parsed;
      }
    } catch (e) {}
    return {
      apiKey: '',
      modelId: DEFAULT_MODEL_ID,
      voiceName: 'Aoede',
      temperature: 0.75,
      systemPrompt: ''
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
  const [userVolume, setUserVolume] = useState(0);
  const [modelVolume, setModelVolume] = useState(0);
  const [lipSyncValue, setLipSyncValue] = useState(0);
  const [currentGesture, setCurrentGesture] = useState('idle');
  const [activeToolName, setActiveToolName] = useState(null);

  // --- Subtitles / User Transcript ---
  const [userTranscript, setUserTranscript] = useState('');
  const [modelTranscript, setModelTranscript] = useState('');

  // --- Visual Sensory Camera & Face Recognition States ---
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState('');
  const [isIREnhanced, setIsIREnhanced] = useState(false);
  const [visionDetections, setVisionDetections] = useState(null);
  const [ownerSamples, setOwnerSamples] = useState([]);

  // --- UI & Windows Hello Desktop States ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSolidBackdrop, setIsSolidBackdrop] = useState(true);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0 });

  // --- Zen Mode / Ghost UI Auto-Hide States ---
  const [isZenMode, setIsZenMode] = useState(false);
  const [isUiVisible, setIsUiVisible] = useState(true);
  const autoHideTimerRef = useRef(null);

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

  // --- Screen Capture States ---
  const [isScreenWatchActive, setIsScreenWatchActive] = useState(false);
  const [screenRegion, setScreenRegion] = useState(null);
  const [isRegionPickerOpen, setIsRegionPickerOpen] = useState(false);

  // Save configuration changes
  const handleSaveConfig = (newConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newConfig));
  };

  // Toggle Torso vs Full body framing
  const handleToggleViewMode = () => {
    const nextMode = viewMode === 'torso' ? 'full' : 'torso';
    setViewMode(nextMode);
    localStorage.setItem(STORAGE_KEY_VIEWMODE, nextMode);
  };

  // Toggle Zen Mode (hide UI)
  const handleToggleZenMode = () => {
    setIsZenMode((prev) => !prev);
    setIsUiVisible((prev) => !prev);
  };

  // --- Zen Mode: Auto-Fade on Inactivity ---
  const resetInactivityTimer = useCallback(() => {
    if (!isZenMode) {
      setIsUiVisible(true);
    }
    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);

    autoHideTimerRef.current = setTimeout(() => {
      // Auto-hide UI after 4 seconds of mouse inactivity
      setIsUiVisible(false);
    }, 4000);
  }, [isZenMode]);

  useEffect(() => {
    const onActivity = () => resetInactivityTimer();
    const onKeyDown = (e) => {
      resetInactivityTimer();
      // Press 'H' to toggle Zen mode
      if (e.key === 'h' || e.key === 'H') {
        if (!e.target.matches('input, textarea')) {
          handleToggleZenMode();
        }
      }
    };

    window.addEventListener('mousemove', onActivity);
    window.addEventListener('mousedown', onActivity);
    window.addEventListener('keydown', onKeyDown);
    resetInactivityTimer();

    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('mousedown', onActivity);
      window.removeEventListener('keydown', onKeyDown);
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, [resetInactivityTimer]);

  // --- Initialize Neutralino Native Desktop environment & System Tray ---
  useEffect(() => {
    if (window.Neutralino) {
      try {
        window.Neutralino.init();

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
          }
        });

        systemTrayRef.current.setupTray();
      } catch (e) {
        console.log('Neutralino init notice:', e);
      }
    }
  }, []);

  // --- Audio Output Service Setup ---
  useEffect(() => {
    audioOutRef.current = new AudioOutputService({
      onAudioStart: () => {
        setIsSpeaking(true);
      },
      onAudioEnd: () => {
        setIsSpeaking(false);
        setLipSyncValue(0);
        setModelVolume(0);
      },
      onLipSyncUpdate: (val) => {
        setLipSyncValue(val);
      },
      onVolumeChange: (vol) => {
        setModelVolume(vol);
      }
    });

    return () => {
      if (audioOutRef.current) {
        audioOutRef.current.destroy();
      }
    };
  }, []);

  // --- Vision & Multi-Sample Face Recognition Engine Setup ---
  useEffect(() => {
    visionServiceRef.current = new VisionDetectionService({
      onDetectionsUpdated: (detections) => {
        setVisionDetections(detections);
      },
      onSamplesUpdated: (samples) => {
        setOwnerSamples(samples);
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

    visionServiceRef.current.initialize().then(() => {
      setOwnerSamples(visionServiceRef.current.getOwnerSamples());
    }).catch(console.error);

    return () => {
      if (visionServiceRef.current) {
        visionServiceRef.current.stopTracking();
      }
    };
  }, []);

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
      },
      onSpeechEnd: () => {
        setIsListening(false);
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

  // --- Local Companion Tool Executor Setup ---
  useEffect(() => {
    toolExecutorRef.current = new ToolExecutor({
      onGestureTrigger: (gesture, comment) => {
        setCurrentGesture(gesture);
        setTimeout(() => {
          setCurrentGesture('idle');
        }, 5000);
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
  }, []);

  // --- Multi-Sample Face Enrollment Handlers ---
  const handleAddOwnerSample = async (sampleLabel = 'Con Lentes') => {
    if (!visionServiceRef.current || !cameraVideoRef.current) {
      throw new Error('La cámara debe estar activa para capturar tu rostro.');
    }
    const result = await visionServiceRef.current.addOwnerSample(cameraVideoRef.current, sampleLabel);
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
        visionServiceRef.current.startTracking(cameraVideoRef.current, overlayCanvasRef.current);
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
      setErrorMessage('Por favor configura tu Gemini API Key en el menú de Ajustes (⚙).');
      setIsSettingsOpen(true);
      return;
    }

    setErrorMessage(null);
    setIsConnecting(true);

    try {
      // Ensure any existing socket or playback is cleanly destroyed before creating a new one
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
            setUserVolume(vol);
            // Instant client-side Barge-In: Cut model playback when user speaks
            if (vol > 0.12 && audioOutRef.current && audioOutRef.current.isPlaying) {
              audioOutRef.current.stopImmediate();
              setIsSpeaking(false);
              setLipSyncValue(0);
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
        systemInstruction: config.systemPrompt && config.systemPrompt.trim()
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
          if (audioOutRef.current) {
            audioOutRef.current.playAudioChunk(base64PCM);
          }
        },
        onModelTurnText: (text) => {
          setModelTranscript(text);
        },
        onInterrupted: () => {
          if (audioOutRef.current) {
            audioOutRef.current.stopImmediate();
          }
          setIsSpeaking(false);
          setLipSyncValue(0);
        },
        onToolCall: async (functionCalls) => {
          if (toolExecutorRef.current) {
            return await toolExecutorRef.current.executeCalls(functionCalls);
          }
          return [];
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
  }, [isConnected, isConnecting, isMuted, isCameraActive, config]);

  // --- Mute Toggle Handler ---
  const handleToggleMute = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    if (audioInRef.current) {
      if (nextState) audioInRef.current.mute();
      else audioInRef.current.unmute();
    }
  };

  // --- Camera Hardware & AI Tracking Toggle ---
  const handleToggleCamera = async () => {
    const nextState = !isCameraActive;
    setIsCameraActive(nextState);

    if (nextState) {
      if (cameraRef.current && cameraVideoRef.current) {
        await cameraRef.current.start(cameraVideoRef.current, currentDeviceId);
        if (isConnected) {
          cameraRef.current.startPeriodicStreaming(0.5);
        }
      }
      if (visionServiceRef.current && cameraVideoRef.current && overlayCanvasRef.current) {
        visionServiceRef.current.startTracking(cameraVideoRef.current, overlayCanvasRef.current);
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

  // --- Transparent Backdrop Toggle ---
  const handleToggleBackdrop = () => {
    setIsSolidBackdrop((prev) => !prev);
  };

  // --- Always On Top Window Toggle ---
  const handleToggleAlwaysOnTop = () => {
    const nextState = !isAlwaysOnTop;
    setIsAlwaysOnTop(nextState);
    if (window.Neutralino?.window) {
      window.Neutralino.window.setAlwaysOnTop(nextState);
    }
  };

  // --- Right-Click Context Menu Handler ---
  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  // --- Random Gesture Tester ---
  const handleTriggerRandomGesture = () => {
    const gestures = ['happy', 'blush', 'surprised', 'waving', 'thinking', 'wink', 'pout', 'nod', 'dance'];
    const randomG = gestures[Math.floor(Math.random() * gestures.length)];
    setCurrentGesture(randomG);
    setTimeout(() => setCurrentGesture('idle'), 4000);
  };

  // --- Screen Watch Toggle (from HUD button) ---
  const handleToggleScreenWatch = async () => {
    if (isScreenWatchActive) {
      screenCaptureRef.current?.stopContinuous();
      setIsScreenWatchActive(false);
    } else {
      if (!screenCaptureRef.current) {
        screenCaptureRef.current = new ScreenCaptureService({
          onFrame: (base64jpeg) => {
            if (socketRef.current?.isConnected) {
              socketRef.current.sendVideoFrame(base64jpeg);
            }
          },
          onStreamEnd: () => setIsScreenWatchActive(false)
        });
      }
      const fps = getScreenCaptureFPS(config.modelId);
      await screenCaptureRef.current.startContinuous(fps);
      setIsScreenWatchActive(true);
    }
  };

  // --- Region Picker Handlers ---
  const handleRegionSelected = (region) => {
    setIsRegionPickerOpen(false);
    setScreenRegion(region);
    if (screenCaptureRef.current) {
      screenCaptureRef.current.setRegion(region);
    }
  };

  const handleClearScreenRegion = () => {
    setScreenRegion(null);
    screenCaptureRef.current?.clearRegion();
  };

  // --- Minimize to System Tray Handler ---
  const handleMinimizeToTray = () => {
    if (systemTrayRef.current) {
      systemTrayRef.current.minimizeToTray();
    } else if (window.Neutralino?.window) {
      window.Neutralino.window.minimize();
    }
  };

  return (
    <div
      className={`app-container ${isSolidBackdrop ? 'solid-backdrop' : 'transparent-backdrop'}`}
      onContextMenu={handleContextMenu}
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

      {/* 1. Live2D Character Canvas — Draggable on model, Torso/Full-body framing */}
      <Live2DCanvas
        ref={live2dRef}
        gesture={currentGesture}
        lipSyncValue={lipSyncValue}
        isSpeaking={isSpeaking}
        isListening={isListening}
        viewMode={viewMode}
        onModelClick={handleTriggerRandomGesture}
        onModelContextMenu={handleContextMenu}
      />

      {/* Screen Region Overlay — Shows Cristi's active vision area */}
      <ScreenRegionOverlay
        region={screenRegion}
        isWatchActive={isScreenWatchActive}
      />

      {/* Screen Region Picker — Drag-to-select vision area */}
      {isRegionPickerOpen && (
        <ScreenRegionPicker
          onRegionSelected={handleRegionSelected}
          onCancel={() => setIsRegionPickerOpen(false)}
        />
      )}

      {/* 2. Subtitle / Transcription CC Overlay (User only) */}
      <SubtitleOverlay
        userTranscript={userTranscript}
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
        userVolume={userVolume}
        modelVolume={modelVolume}
        isSpeaking={isSpeaking}
        isListening={isListening}
        activeToolName={activeToolName}
        viewMode={viewMode}
        isUiVisible={isUiVisible}
        onToggleConnection={handleToggleConnection}
        onToggleMute={handleToggleMute}
        onToggleCamera={handleToggleCamera}
        onToggleBackdrop={handleToggleBackdrop}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isScreenWatchActive={isScreenWatchActive}
        hasScreenRegion={!!screenRegion}
        onToggleScreenWatch={handleToggleScreenWatch}
        onOpenRegionPicker={() => setIsRegionPickerOpen(true)}
        onClearScreenRegion={handleClearScreenRegion}
        onToggleViewMode={handleToggleViewMode}
        onToggleZenMode={handleToggleZenMode}
      />

      {/* 4. Sensory Camera PiP Monitor */}
      <CameraPreview
        videoRef={cameraVideoRef}
        overlayCanvasRef={overlayCanvasRef}
        isStreaming={isCameraActive}
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

      {/* 5. Desktop Right-Click Context Menu */}
      <ContextMenu
        position={{ x: contextMenu.x, y: contextMenu.y }}
        isOpen={contextMenu.isOpen}
        onClose={() => setContextMenu({ isOpen: false, x: 0, y: 0 })}
        onOpenSettings={() => setIsSettingsOpen(true)}
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
      />

      {/* 6. Horizontal Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
      />
    </div>
  );
}

export default App;

