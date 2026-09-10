import { useCompanionRuntime } from '../app/CompanionRuntimeProvider';
import type { TranscriptSnapshot } from '../domain/transcription/TranscriptAssembler';
import { useEffect, useRef, useCallback } from 'react';
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
  discordCompanion,
  logger,
  VisionFrameDispatcher,
  interactionOrchestrator,
  externalReplyService,
  translationService,
  GeminiTranslationProvider,
  virtualAudioOutputService,
  TranslationOutputCoordinator
} from '../app/serviceRegistry.js';
import { DEFAULT_MODEL_ID, getScreenCaptureFPS } from '../config/index.js';
import { useCompanionStore } from '../stores/useCompanionStore.js';
import { useSessionStore } from '../stores/useSessionStore.js';
import { useAudioStore } from '../stores/useAudioStore.js';
import { useVisionStore, ScreenRegion } from '../stores/useVisionStore.js';
import { useSettingsStore } from '../stores/useSettingsStore.js';
import { useTelemetryStore } from '../stores/useTelemetryStore.js';

interface UseCompanionServicesProps {
  live2dRef: React.RefObject<any>;
}

export function useCompanionServices({ live2dRef }: UseCompanionServicesProps) {
  const runtime = useCompanionRuntime();
  const isCallActiveRef = useRef(false);
  const callGenerationRef = useRef(0);
  const socketRef = useRef<GeminiLiveSocket | null>(null);
  const audioInRef = useRef<AudioInputService | null>(null);
  const audioOutRef = useRef<AudioOutputService | null>(null);
  const cameraRef = useRef<CameraService | null>(null);
  const visionServiceRef = useRef<VisionDetectionService | null>(null);
  const toolExecutorRef = useRef<ToolExecutor | null>(null);
  const screenCaptureRef = useRef<ScreenCaptureService | null>(null);
  const systemTrayRef = useRef<SystemTrayService | null>(null);
  const visionDispatcherRef = useRef<VisionFrameDispatcher | null>(null);
  const translationProviderRef = useRef<GeminiTranslationProvider | null>(null);
  const turnAudioReceivedRef = useRef(false);
  const modelTextTurnRef = useRef('');
  const externalResponseRef = useRef('');
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subtitle timers
  const modelSubtitleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userSubtitleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translationSubtitleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Grab state from stores
  const config = useSettingsStore((s) => s.config);
  const isMuted = useAudioStore((s) => s.isMuted);
  const isZenMode = useCompanionStore((s) => s.isZenMode);
  const isClickThroughEnabled = useCompanionStore((s) => s.isClickThroughEnabled);
  const screenRegion = useVisionStore((s) => s.screenRegion);
  const isScreenWatchActive = useVisionStore((s) => s.isScreenWatchActive);

  // Reset UI inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (useCompanionStore.getState().isZenMode) {
      useCompanionStore.getState().setIsUiVisible(false);
      return;
    }
    useCompanionStore.getState().setIsUiVisible(true);

    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    autoHideTimerRef.current = setTimeout(() => {
      useCompanionStore.getState().setIsUiVisible(false);
    }, 5000);
  }, []);

  // Dispatch vision frames to Gemini Live socket
  const sendRealtimeVisionFrame = useCallback((base64Jpeg: string, source = 'vision', priority = false) => {
    if (!base64Jpeg) return false;
    return visionDispatcherRef.current?.enqueue(base64Jpeg, source, { priority: Boolean(priority) }) || false;
  }, []);

  // Send an explicit instruction with screen capture frame
  const sendScreenInstruction = useCallback(async (text: string) => {
    const socket = socketRef.current;
    if (!socket?.isConnected || !text) return false;
    let frame = null;
    try {
      frame = await screenCaptureRef.current?.captureActiveFrame?.();
    } catch (_) {}
    if (socketRef.current !== socket || !socket.isConnected) return false;
    socket.sendTextMessage(text, frame);
    return true;
  }, []);

  // Context menu helper
  const handleModelContextMenu = useCallback((e: any, bounds?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    const posX = e?.clientX !== undefined ? e.clientX : window.innerWidth / 2;
    const posY = e?.clientY !== undefined ? e.clientY : window.innerHeight / 2;
    useCompanionStore.getState().openContextMenu(posX, posY, bounds || null);
  }, []);

  // Connection Toggle (Start / Stop Live Call)
  const handleToggleConnection = useCallback(async () => {
    const currentConfig = useSettingsStore.getState().config;
    const sessionStore = useSessionStore.getState();
    const companionStore = useCompanionStore.getState();

    if (isCallActiveRef.current) {
      callGenerationRef.current++;
      isCallActiveRef.current = false;
      proactiveTriggerService.setGeminiSocket(null);
      proactiveScheduler.setGeminiSocket(null);
      interactionOrchestrator.setGeminiSocket(null);
      if (socketRef.current) socketRef.current.disconnect();
      if (audioInRef.current) audioInRef.current.stop();
      if (audioOutRef.current) audioOutRef.current.stopImmediate();
      if (cameraRef.current) cameraRef.current.stopPeriodicStreaming();
      screenCaptureRef.current?.stopAll();
      visionDispatcherRef.current?.reset();
      useVisionStore.getState().setIsScreenWatchActive(false);

      sessionStore.dispatchConnection('DISCONNECT');
      companionStore.setIsSpeaking(false);
      companionStore.setIsListening(false);
      sessionStore.setUserTranscript('');
      sessionStore.setModelTranscript('');
      modelTextTurnRef.current = '';
      externalResponseRef.current = '';
      companionStore.setActiveDecision(null);
      companionStore.setActiveToolName(null);
      companionStore.setCurrentGesture('idle');
      soundFxService.playDisconnect();
      return;
    }

    if (!currentConfig.hasGeminiCredential) {
      toastService.warning('Por favor configura tu Gemini API Key en el menú de Ajustes (⚙).');
      useSettingsStore.getState().handleOpenSettings();
      return;
    }

    isCallActiveRef.current = true;
    const callGeneration = ++callGenerationRef.current;
    sessionStore.setUserTranscript('');
    sessionStore.setModelTranscript('');
    sessionStore.setErrorMessage(null);
    sessionStore.dispatchConnection('CONNECT');

    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (audioOutRef.current) {
        audioOutRef.current.stopImmediate();
      }

      if (!audioInRef.current) {
        audioInRef.current = runtime.createCapture({
          onStreamEnd: () => socketRef.current?.endAudioStream(),
          onAudioData: (base64PCM: ArrayBuffer) => {
            if (socketRef.current && socketRef.current.isConnected && !audioInRef.current?.isMuted) {
              socketRef.current.sendAudioChunk(base64PCM);
            }
          },
          onError: (err: any) => {
            useSessionStore.getState().setErrorMessage(`Error de micrófono: ${err.message}`);
          }
        });
      }

      // Initialize audio capture in muted state during handshake to prevent unhandled packets
      audioInRef.current.mute();
      await audioInRef.current.start();

      if (callGeneration !== callGenerationRef.current) return;
      if (audioOutRef.current) {
        await audioOutRef.current.resumeContext();
      }
      if (callGeneration !== callGenerationRef.current) return;

      const socket = runtime.createSocket({

        modelId: currentConfig.modelId,
        voiceName: currentConfig.voiceName,
        temperature: currentConfig.temperature,
        systemPrompt: currentConfig.systemPrompt,
        thinkingConfig: { thinkingBudget: 0 },
        maxReconnectAttempts: 5,
        onOpen: () => {
          if (callGeneration !== callGenerationRef.current) return;
          useSessionStore.getState().dispatchConnection('SETUP_COMPLETE');
          proactiveTriggerService.setGeminiSocket(socket);
          proactiveScheduler.setGeminiSocket(socket);
          interactionOrchestrator.setGeminiSocket(socket);
          soundFxService.playConnectedBleep();
        },
        onSetupComplete: () => {
          if (callGeneration !== callGenerationRef.current) return;
          // Open audio capture gate only when Gemini Live session setup is fully acknowledged
          if (!useAudioStore.getState().isMuted) {
            audioInRef.current?.unmute();
          }
        },
        onReconnecting: () => {
          audioInRef.current?.mute();
          audioOutRef.current?.stopImmediate();
          externalResponseRef.current = '';
          modelTextTurnRef.current = '';
          useSessionStore.getState().dispatchConnection('RECONNECT');
        },
        onClose: (event: any) => {
          if (callGeneration !== callGenerationRef.current) return;
          isCallActiveRef.current = false;
          audioInRef.current?.mute();
          void audioInRef.current?.stop();
          audioOutRef.current?.stopImmediate();
          screenCaptureRef.current?.stopAll();
          visionDispatcherRef.current?.reset();
          useVisionStore.getState().setIsScreenWatchActive(false);
          proactiveTriggerService.setGeminiSocket(null);
          proactiveScheduler.setGeminiSocket(null);
          interactionOrchestrator.setGeminiSocket(null);
          useSessionStore.getState().dispatchConnection('DISCONNECT');
          useCompanionStore.getState().setIsSpeaking(false);
          useCompanionStore.getState().setIsListening(false);
          useSessionStore.getState().setUserTranscript('');
          useSessionStore.getState().setModelTranscript('');
          useCompanionStore.getState().setActiveDecision(null);
          soundFxService.playDisconnect();
          if (event && !event.wasClean && event.code !== 1000) {
            useSessionStore.getState().setErrorMessage(`Conexión cerrada inesperadamente (Código: ${event.code})`);
          }
        },
        onError: (err: any) => {
          logger.error('Live2D', 'Socket Live error:', err);
          if (callGeneration !== callGenerationRef.current) return;
          useSessionStore.getState().setErrorMessage(`Error de conexión Live: ${err.message}`);
          if (!socket.isConnecting && !socket.reconnectTimer) {
            isCallActiveRef.current = false;
            audioInRef.current?.stop();
            useSessionStore.getState().dispatchConnection('FAIL');
          }
        },
        onGenerationStart: () => audioOutRef.current?.beginGeneration(),
        onGenerationComplete: () => audioOutRef.current?.signalGenerationComplete(),
        onAudioChunk: (base64PCM: string) => {
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
          if (screenCaptureRef.current?.isCapturing && !useCompanionStore.getState().isSpeaking && !audioOutRef.current?.isPlaying) {
            screenCaptureRef.current.triggerImmediateCapture();
          }
          const completedModelText = externalResponseRef.current || modelTextTurnRef.current || '';
          if (completedModelText) {
            useSessionStore.getState().setModelTranscript(completedModelText);
            if (modelSubtitleTimeoutRef.current) clearTimeout(modelSubtitleTimeoutRef.current);
            modelSubtitleTimeoutRef.current = setTimeout(() => {
              useSessionStore.getState().setModelTranscript('');
            }, 30000);
          }
          modelTextTurnRef.current = '';
          externalResponseRef.current = '';
          turnAudioReceivedRef.current = false;
        },
        onTextPart: (cleanText: string) => {
          if (!cleanText) return;
          const previous = modelTextTurnRef.current;
          const next = previous && !previous.endsWith(cleanText) && !cleanText.startsWith(previous)
            ? `${previous} ${cleanText}`.replace(/\s{2,}/g, ' ').trim()
            : cleanText.startsWith(previous) ? cleanText : previous || cleanText;
          modelTextTurnRef.current = next;
          if (!externalResponseRef.current) useSessionStore.getState().setModelTranscript(next);
        },
        onOutputTranscription: (text: string, snapshot?: TranscriptSnapshot) => {
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
            .trim() : '';

          if (cleanText) {
            externalResponseRef.current = cleanText;
            useSessionStore.getState().setTranscript('output', cleanText, snapshot?.isFinal ?? false);
          }
        },
        onInputTranscription: (text: string, snapshot?: TranscriptSnapshot) => {
          proactiveTriggerService.recordDialogueActivity();
          const cleanText = text ? text.trim() : '';
          if (cleanText) {
            useSessionStore.getState().setTranscript('input', cleanText, snapshot?.isFinal ?? false);
            if (userSubtitleTimeoutRef.current) clearTimeout(userSubtitleTimeoutRef.current);
            userSubtitleTimeoutRef.current = setTimeout(() => {
              useSessionStore.getState().setUserTranscript('');
            }, 30000);
          }
        },
        onInterrupted: () => {
          ttsFallbackService.stop();
          externalResponseRef.current = '';
          modelTextTurnRef.current = '';
          turnAudioReceivedRef.current = false;
          if (audioOutRef.current) {
            audioOutRef.current.stopImmediate();
          }
          useCompanionStore.getState().setIsSpeaking(false);
        },
        onToolCall: async (functionCalls: any, sourceSocket: any) => {
          if (toolExecutorRef.current) {
            const responses = await toolExecutorRef.current.executeCalls(
              functionCalls,
              (id?: string) => (id ? socket.cancelledTools.has(id) : false) || socket.websocket !== sourceSocket || callGeneration !== callGenerationRef.current
            );
            if (socket.websocket === sourceSocket && callGeneration === callGenerationRef.current) {
              socket.sendToolResponse(responses);
            }
          }
        }
      });

      socketRef.current = socket;
      await socket.connect();
    } catch (err: any) {
      if (callGeneration !== callGenerationRef.current) return;
      isCallActiveRef.current = false;
      audioInRef.current?.stop();
      socketRef.current?.disconnect();
      useSessionStore.getState().setErrorMessage(`No se pudo conectar: ${err.message}`);
      useSessionStore.getState().dispatchConnection('FAIL');
    }
  }, []);

  // Camera toggle (Standalone window)
  const handleToggleCamera = useCallback(async () => {
    try {
      soundFxService.playClick();
      const isOpen = await electronBridge.isCameraWindowOpen();
      if (isOpen) {
        await electronBridge.closeCameraWindow();
        useVisionStore.getState().setIsCameraActive(false);
        toastService.info('Monitor de cámara cerrado');
        if (socketRef.current?.isConnected) {
          socketRef.current.sendTextMessage('[SISTEMA: Ariel ha cerrado la cámara web.]');
        }
      } else {
        await electronBridge.openCameraWindow();
        useVisionStore.getState().setIsCameraActive(true);
        toastService.info('Monitor de cámara abierto en ventana independiente');
        if (socketRef.current?.isConnected) {
          socketRef.current.sendTextMessage(
            '[SISTEMA: Ariel ha encendido la cámara web. Los fotogramas de video en tiempo real corresponden a su cámara óptica.]'
          );
        }
      }
    } catch (err) {
      logger.error('Live2D', 'Error al controlar ventana de cámara:', err);
    }
  }, []);

  // Screen watch toggle (full screen vs region)
  const handleToggleScreenWatch = useCallback(() => {
    const { screenRegion, isScreenWatchActive } = useVisionStore.getState();

    if (screenRegion) {
      useVisionStore.getState().setScreenRegion(null);
      screenCaptureRef.current?.clearRegion();
      visionDispatcherRef.current?.clearSource('screen');
      useVisionStore.getState().setIsScreenWatchActive(true);
      toastService.info('Visión de Pantalla Completa', 'Cristi ahora observa toda la pantalla.');
      if (toolExecutorRef.current) {
        toolExecutorRef.current.executeSingleTool('clear_screen_region', {});
        toolExecutorRef.current.executeSingleTool('set_screen_watch', { enabled: true });
      }
      void sendScreenInstruction(
        '[SISTEMA: Ariel ha cambiado a la observación de pantalla completa. Los fotogramas corresponden a su monitor entero.]'
      );
      return;
    }

    const nextState = !isScreenWatchActive;
    useVisionStore.getState().setIsScreenWatchActive(nextState);
    if (nextState) {
      toastService.info('Visión de Pantalla Activa', 'Cristi ahora está observando y analizando toda tu pantalla en tiempo real.');
      void sendScreenInstruction(
        '[SISTEMA: Ariel ha activado la compartición de pantalla completa. Los fotogramas corresponden a su monitor.]'
      );
    } else {
      toastService.info('Visión de Pantalla Desactivada', 'Se detuvo el análisis continuo de pantalla.');
      if (socketRef.current?.isConnected) {
        socketRef.current.sendTextMessage('[SISTEMA: Ariel ha desactivado la compartición de pantalla.]');
      }
    }
    if (toolExecutorRef.current) {
      toolExecutorRef.current.executeSingleTool('set_screen_watch', { enabled: nextState });
    }
  }, [sendScreenInstruction]);

  // Region selected handler
  const handleRegionSelected = useCallback((region: ScreenRegion) => {
    useVisionStore.getState().setScreenRegion(region);
    useVisionStore.getState().closeRegionPicker();
    useVisionStore.getState().setIsScreenWatchActive(true);
    const wPct = Number(region.w_pct ?? 100);
    const hPct = Number(region.h_pct ?? 100);
    toastService.success(
      'Área de Visión Seleccionada',
      `Cristi ahora vigila exclusivamente el área delimitada (${Math.round(wPct)}% × ${Math.round(hPct)}%).`
    );
    if (screenCaptureRef.current) {
      screenCaptureRef.current.setRegion(region);
      visionDispatcherRef.current?.clearSource('screen');
    }
    if (toolExecutorRef.current) {
      toolExecutorRef.current.executeSingleTool('set_screen_region', region as unknown as Record<string, unknown>);
    }
    void sendScreenInstruction(
      `[SISTEMA: Ariel ha seleccionado un área recortada de su pantalla (${Math.round(wPct)}% × ${Math.round(hPct)}%) para que la observes en el flujo de video.]`
    );
  }, [sendScreenInstruction]);

  // Clear screen region
  const handleClearScreenRegion = useCallback(() => {
    useVisionStore.getState().clearScreenRegion();
    screenCaptureRef.current?.clearRegion();
    visionDispatcherRef.current?.clearSource('screen');
    toastService.info('Visión Desactivada', 'Se limpió el área de recorte y se detuvo la transmisión.');
    if (toolExecutorRef.current) {
      toolExecutorRef.current.executeSingleTool('clear_screen_region', {});
      toolExecutorRef.current.executeSingleTool('set_screen_watch', { enabled: false });
    }
    if (socketRef.current?.isConnected) {
      socketRef.current.sendTextMessage('[SISTEMA: Ariel ha desactivado el área recortada de pantalla.]');
    }
  }, []);

  const handleMinimizeToTray = useCallback(() => {
    if (systemTrayRef.current) {
      systemTrayRef.current.minimizeToTray();
    } else {
      electronBridge.minimizeWindow();
    }
  }, []);

  // Lifecycle initialization
  useEffect(() => {
    // 1. Initialize AudioOutputService
    audioOutRef.current = runtime.createPlayback({
      onAudioStart: () => useCompanionStore.getState().setIsSpeaking(true),
      onAudioEnd: () => useCompanionStore.getState().setIsSpeaking(false),
      onFirstPlayout: (timestamp: number) => {
        socketRef.current?.recordPlayoutTimestamp?.(timestamp);
      }
    });

    // 2. VisionFrameDispatcher & Autonomous services
    visionDispatcherRef.current = new (VisionFrameDispatcher as any)({ socketRef, minIntervalMs: 1000 });
    interactionOrchestrator.start();
    interactionOrchestrator.setExternalSender('discord', (channelId: string, text: string) =>
      discordCompanion.sendMessage(channelId, text)
    );
    externalReplyService.start();
    proactiveTriggerService.start();

    // 3. Translation Output Coordinator
    const coordinator = new (TranslationOutputCoordinator as any)({
      getAudioOutput: () => audioOutRef.current,
      getGameAudioOutput: () => virtualAudioOutputService
    });
    coordinator.start();

    const handleTranslationOutput = (envelope: any) => {
      const result = envelope?.payload || envelope;
      if (!result?.translation) return;
      const speaker = result.speakerId ? ` (${result.speakerId})` : '';
      useSessionStore.getState().setTranslationTranscript(`TRADUCCIÓN${speaker}: ${result.translation}`);
      if (translationSubtitleTimeoutRef.current) clearTimeout(translationSubtitleTimeoutRef.current);
      translationSubtitleTimeoutRef.current = setTimeout(() => {
        useSessionStore.getState().setTranslationTranscript('');
      }, 15000);
    };
    const unsubTrans = eventBus.on('translation.local_output', handleTranslationOutput);
    const unsubGameVoice = eventBus.on('translation.game_voice_output', handleTranslationOutput);

    // 4. Emotion event bus subscription
    const unsubEmotion = eventBus.on(EVENTS.EMOTION_CHANGED, (emotion: string) => {
      if (emotion) useCompanionStore.getState().setCurrentGesture(emotion);
    });

    // 5. Connection toggle event
    const unsubConnToggle = eventBus.on('connection.toggle', () => handleToggleConnection());

    // 6. Native screen capture event
    const unsubSnap = eventBus.on('screen.capture_snapshot', async () => {
      toastService.info('Analizando pantalla activa...');
      try {
        const frame = await electronBridge.captureScreenNative();
        if (frame && socketRef.current) {
          socketRef.current.sendRealtimeMedia(frame, 'image/jpeg');
          toastService.success('Captura enviada a Cristi para análisis.');
        }
      } catch (e: any) {
        toastService.error('Error al capturar pantalla: ' + e.message);
      }
    });

    // 7. Initialize ToolExecutor
    toolExecutorRef.current = new ToolExecutor({
      onGestureTrigger: (gesture: string) => {
        contextualEmotionOrchestrator.triggerEmotion(gesture, 'tool_call');
        useCompanionStore.getState().setCurrentGesture(gesture);
      },
      onMotionTrigger: (motionGroup: string, index?: number) => {
        if ((window as any).__cristiAvatar?.setMotionByGroup) {
          (window as any).__cristiAvatar.setMotionByGroup(motionGroup, index);
        }
      },
      getCameraSnapshot: () => cameraRef.current?.captureFrameJPEG() || null,
      getVisionDetections: () => visionServiceRef.current?.currentDetections || null,
      getScreenCapture: async () => {
        if (!screenCaptureRef.current) return null;
        return await screenCaptureRef.current.captureActiveFrame();
      },
      onAvatarMove: (position: string, animation?: string) => {
        if (live2dRef.current?.moveTo) {
          live2dRef.current.moveTo(position, animation);
        }
      },
      onModelSwitch: (_modelType: string, modelId: string) => {
        useSettingsStore.getState().switchLive2DModel(modelId);
      },
      onScreenRegionChange: (region: ScreenRegion) => {
        useVisionStore.getState().setScreenRegion(region);
        if (screenCaptureRef.current) {
          screenCaptureRef.current.setRegion(region);
          visionDispatcherRef.current?.clearSource('screen');
        }
      },
      onScreenWatchChange: async (enabled: boolean) => {
        useVisionStore.getState().setIsScreenWatchActive(enabled);
        if (enabled) {
          if (!screenCaptureRef.current) {
            screenCaptureRef.current = new ScreenCaptureService({
              onFrame: (base64jpeg: string) => sendRealtimeVisionFrame(base64jpeg, 'screen'),
              onStreamEnd: () => useVisionStore.getState().setIsScreenWatchActive(false)
            });
          }
          const fps = getScreenCaptureFPS(useSettingsStore.getState().config.modelId);
          const started = await screenCaptureRef.current.startContinuous(fps);
          if (!started) useVisionStore.getState().setIsScreenWatchActive(false);
        } else {
          screenCaptureRef.current?.stopAll();
          visionDispatcherRef.current?.clearSource('screen');
        }
      }
    });

    // 8. Audits and background init
    modelManager.auditAllModels().catch((e: any) => console.warn('ModelManager audit error:', e));
    memoryService.initialize().catch((e: any) => console.warn('MemoryService init error:', e));
    mcpClientManager.initialize().catch((e: any) => console.warn('MCPClientManager init error:', e));

    // 9. SystemTray Setup
    if (electronBridge.isElectron) {
      systemTrayRef.current = new SystemTrayService({
        onRestoreWindow: () => useCompanionStore.getState().setIsUiVisible(true),
        onToggleMute: () => useAudioStore.getState().toggleMute(),
        onToggleViewMode: () => useCompanionStore.getState().toggleViewMode(),
        onToggleAlwaysOnTop: () => useCompanionStore.getState().toggleAlwaysOnTop(),
        onOpenVoiceEnrollment: () => useSettingsStore.getState().handleOpenSettings()
      });
      systemTrayRef.current.setupTray();
    }

    // Development inspection only.
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      (window as any).__cristiEventBus = eventBus;
      (window as any).__cristiModelManager = modelManager;
      (window as any).__cristiApp = {
        connect: () => !isCallActiveRef.current && handleToggleConnection(),
        disconnect: () => isCallActiveRef.current && handleToggleConnection(),
        sendTextMessage: (t: string) => socketRef.current?.sendTextMessage(t),
        triggerGesture: (g: string) => useCompanionStore.getState().setCurrentGesture(g),
        setSubtitle: (t: string) => useSessionStore.getState().setSubtitleText(t),
        openContextMenu: (x: number, y: number) => handleModelContextMenu({ clientX: x || 300, clientY: y || 200 }),
        closeContextMenu: () => useCompanionStore.getState().closeContextMenu(),
        openPerformanceHUD: () => useTelemetryStore.getState().openPerformanceHud(),
        closePerformanceHUD: () => useTelemetryStore.getState().closePerformanceHud(),
        openRegionPicker: () => useVisionStore.getState().openRegionPicker(),
        closeRegionPicker: () => useVisionStore.getState().closeRegionPicker(),
        openVoiceEnrollment: () => useSettingsStore.getState().handleOpenSettings(),
        closeVoiceEnrollment: () => electronBridge.closeSettingsWindow(),
        openSettings: () => useSettingsStore.getState().handleOpenSettings(),
        closeSettings: () => electronBridge.closeSettingsWindow(),
        toggleCamera: handleToggleCamera,
        eventBus,
        toast,
        toastService,
        externalDeviceManager,
        gameIntegrationManager,
        live2dModelRegistry,
        socketRef,
        audioOutRef,
        audioInRef
      };
      (window as any).__triggerGesture = (g: string) => useCompanionStore.getState().setCurrentGesture(g);
      (window as any).__setSubtitle = (t: string) => useSessionStore.getState().setSubtitleText(t);
    }

    return () => {
      callGenerationRef.current++;
      isCallActiveRef.current = false;
      for (const timer of [autoHideTimerRef, modelSubtitleTimeoutRef, userSubtitleTimeoutRef, translationSubtitleTimeoutRef]) {
        if (timer.current) {
          clearTimeout(timer.current);
          timer.current = null;
        }
      }
      runtime.dispose();
      audioInRef.current = audioOutRef.current = socketRef.current = null;
      visionDispatcherRef.current?.destroy();
      interactionOrchestrator.stop();
      externalReplyService.stop();
      proactiveTriggerService.stop();
      coordinator.destroy();
      unsubTrans?.();
      unsubGameVoice?.();
      unsubEmotion?.();
      unsubConnToggle?.();
      unsubSnap?.();
      screenCaptureRef.current?.stopAll();
      delete (window as any).__cristiApp;
      delete (window as any).__triggerGesture;
      delete (window as any).__setSubtitle;
    };
  }, [handleToggleConnection, handleToggleCamera, handleModelContextMenu, sendRealtimeVisionFrame, live2dRef]);

  // IPC Event Syncs
  useEffect(() => {
    const unsubConfig = electronBridge.onConfigUpdated((newConfig: any) => {
      if (newConfig && typeof newConfig === 'object') {
        useSettingsStore.getState().setConfig(newConfig);
        if (newConfig.live2dModelId && (window as any).__cristiAvatar?.loadModel) {
          (window as any).__cristiAvatar.loadModel(newConfig.live2dModelId);
        }
        if (newConfig.sceneId && newConfig.sceneId !== sceneManager.selectedSceneId) {
          sceneManager.setScene(newConfig.sceneId);
        }
      }
    });

    const unsubSettingsState = electronBridge.onSettingsWindowState((data: any) => {
      useSettingsStore.getState().setIsSettingsWindowOpen(Boolean(data?.isOpen));
    });

    const unsubPause = electronBridge.onCompanionPause(() => {
      if (live2dRef.current?.setFpsLimit) live2dRef.current.setFpsLimit(30);
    });

    const unsubResume = electronBridge.onCompanionResume(() => {
      if (live2dRef.current?.setFpsLimit) live2dRef.current.setFpsLimit(0);
    });

    const unsubScene = sceneManager.onSceneChange((scene: any) => {
      useCompanionStore.getState().setIsSolidBackdrop(scene?.isSceneVisible);
    });

    const unsubCameraState = electronBridge.onCameraWindowState?.(({ isOpen }: any) => {
      useVisionStore.getState().setIsCameraActive(isOpen);
    });

    // BroadcastChannel camera stream
    let broadcast: BroadcastChannel | null = null;
    try {
      broadcast = new BroadcastChannel('cristi_camera_stream');
      broadcast.onmessage = (e) => {
        if (e.data?.type === 'camera_frame' && e.data?.base64) {
          sendRealtimeVisionFrame(e.data.base64, 'camera');
        } else if (e.data?.type === 'camera_snapshot' && e.data?.base64) {
          if (socketRef.current?.isConnected) {
            sendRealtimeVisionFrame(e.data.base64, 'camera', true);
            toastService.info('Visión Cristi AI', 'Fotograma transmitido a la IA');
          }
        }
      };
    } catch (_) {}

    return () => {
      unsubConfig?.();
      unsubSettingsState?.();
      unsubPause?.();
      unsubResume?.();
      unsubScene?.();
      unsubCameraState?.();
      try { broadcast?.close(); } catch (_) {}
    };
  }, [sendRealtimeVisionFrame, live2dRef]);

  // Audio mute sync
  useEffect(() => {
    if (audioInRef.current) {
      if (isMuted) audioInRef.current.mute();
      else audioInRef.current.unmute();
    }
  }, [isMuted]);

  // Interaction Lock for full blocking overlays
  const isRegionPickerOpen = useVisionStore((s) => s.isRegionPickerOpen);
  const isContextMenuOpen = useCompanionStore((s) => s.contextMenu.isOpen);
  useEffect(() => {
    if (isRegionPickerOpen || isContextMenuOpen) {
      electronBridge.acquireInteractionLock();
      return () => {
        electronBridge.releaseInteractionLock();
      };
    }
  }, [isRegionPickerOpen, isContextMenuOpen]);

  // Click-through sync
  useEffect(() => {
    if (!electronBridge.isElectron) return;
    if (!isClickThroughEnabled) {
      electronBridge.setIgnoreMouseEvents(false);
    } else if (electronBridge._interactionLockCount === 0) {
      electronBridge.setIgnoreMouseEvents(true, { forward: true });
    }
  }, [isClickThroughEnabled]);

  // Spotify configuration sync
  useEffect(() => {
    if (config?.spotifyClientId || config?.spotifyClientSecret) {
      spotifyService.configure({
        clientId: config.spotifyClientId,
        clientSecret: config.spotifyClientSecret
      });
    }
  }, [config?.spotifyClientId, config?.spotifyClientSecret]);

  return {
    handleToggleConnection,
    handleToggleCamera,
    handleToggleScreenWatch,
    handleRegionSelected,
    handleClearScreenRegion,
    handleModelContextMenu,
    handleMinimizeToTray,
    resetInactivityTimer
  };
}

export default useCompanionServices;
