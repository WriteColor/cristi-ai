/**
 * Cristi AI - High-Performance Live2D Cubism Engine v4
 *
 * Arquitectura de Click-Through correcta para Electron en Windows:
 * - El canvas WebGL es pointer-events: none (nunca bloquea nada)
 * - Solo el hitTarget (bounding box del modelo) tiene pointer-events: auto
 * - El hitTarget comienza oculto (pointer-events: none, opacity: 0) y solo
 *   se activa DESPUÉS de que el modelo carga y se calcula su bounding box real
 * - syncHitTargetBounds usa coordenadas CSS reales vía getBoundingClientRect()
 *   no coordenadas internas de PIXI (que no mapean 1:1 con px CSS)
 * - Ticker adaptativo (AdaptiveTicker) gobernando 60 FPS activo -> 30 FPS reposo -> 0 FPS suspendido.
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle
} from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { live2dModelRegistry } from '../services/live2d/index.js';
import { Live2DAdapter } from '../services/live2d/Live2DAdapter.js';
import { Live2DController } from '../services/live2d/Live2DController.js';
import { contextualEmotionOrchestrator } from '../services/live2d/ContextualEmotionOrchestrator.js';
import { logger } from '../services/logger.js';
import { eventBus, EVENTS } from '../services/eventBus.js';
import { electronBridge } from '../services/desktop/ElectronBridge.js';
import { clickThroughService } from '../services/desktop/ClickThroughService.js';
import { soundFxService } from '../services/soundFxService.js';
import { AdaptiveTicker } from '../domain/live2d/AdaptiveTicker';

// ── Global PIXI & Live2D Engine Setup ────────────────────────────────────────
declare global {
  interface Window {
    PIXI?: typeof PIXI;
    Live2DCubismCore?: unknown;
    __cristiAvatar?: {
      model: any;
      adapter: any;
      controller: any;
      setExpression: (exp: string) => void;
      setEmotion: (emo: string) => void;
    };
  }
}

if (typeof window !== 'undefined') {
  window.PIXI = PIXI;
  PIXI.settings.PREFER_ENV = PIXI.ENV.WEBGL2;
  PIXI.settings.ROUND_PIXELS = false;
  PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH;
  (PIXI.settings as any).MIPMAP_MODES = PIXI.MIPMAP_MODES.OFF;

  const displayProto = PIXI.DisplayObject?.prototype as any;
  if (displayProto && !displayProto.isInteractive) {
    displayProto.isInteractive = function () { return false; };
  }
  const live2dProto = (Live2DModel as any)?.prototype;
  if (live2dProto && !live2dProto.isInteractive) {
    live2dProto.isInteractive = function () { return false; };
  }
}

try { (Live2DModel as any).registerTicker(PIXI.Ticker); } catch (_) {}

// Serialize decoding so cancelled loads release textures before a replacement
// reuses PIXI's cache, including rapid A -> B -> A model changes.
let modelLoadQueue: Promise<unknown> = Promise.resolve();
function loadModel(path: string, isCurrent: () => boolean): Promise<any> {
  const loading = modelLoadQueue.then(async () => {
    if (!isCurrent()) return null;
    const loaded = await (Live2DModel as any).from(path, { autoInteract: false, autoUpdate: false });
    if (!isCurrent()) {
      try {
        loaded.destroy({ texture: true, baseTexture: true });
      } catch (_) {}
      return null;
    }
    return loaded;
  });
  modelLoadQueue = loading.catch(() => {});
  return loading;
}

function resolveModelPath(modelPath: string): string {
  if (!modelPath) return '';
  if (modelPath.startsWith('blob:') || modelPath.startsWith('data:') || modelPath.startsWith('http://') || modelPath.startsWith('https://')) {
    return modelPath;
  }
  const cleanPath = modelPath.startsWith('/') ? modelPath.slice(1) : modelPath;
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    if (origin && origin !== 'null' && !origin.startsWith('file:')) {
      return `${origin}/${cleanPath}`;
    }
    if (window.location.protocol === 'file:') {
      return new URL('./' + cleanPath, window.location.href).href;
    }
  }
  return '/' + cleanPath;
}

export interface Live2DCanvasProps {
  modelId?: string;
  gesture?: string;
  lipSyncValue?: number;
  isSpeaking?: boolean;
  isListening?: boolean;
  viewMode?: 'torso' | 'full' | string;
  onModelClick?: () => void;
  onModelContextMenu?: (e?: React.MouseEvent | MouseEvent | { clientX?: number; clientY?: number }) => void;
}

export interface Live2DCanvasRef {
  reapplyLayout: () => void;
  switchModel: (id: string) => void;
  triggerMotion: (group: string, index?: number) => void;
  triggerGesture: (name: string, comment?: string) => void;
  getModel: () => any;
  getAdapter: () => any;
  getController: () => any;
  getHitboxRect: () => DOMRect | null;
  moveTo?: (pos: unknown, anim?: unknown) => void;
  moveToPreset?: (pos: unknown, anim?: unknown) => void;
}

export const Live2DCanvas = React.memo(forwardRef<Live2DCanvasRef, Live2DCanvasProps>(function Live2DCanvas(
  {
    modelId = 'yanderegirl',
    gesture = 'idle',
    lipSyncValue = 0,
    isSpeaking = false,
    isListening: _isListening = false,
    viewMode = 'torso',
    onModelClick,
    onModelContextMenu
  },
  ref
) {
  // ── DOM Refs ───────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null); // Contiene el canvas WebGL
  const hitTargetRef = useRef<HTMLDivElement>(null); // Capa interactiva (bounding box del modelo)
  const wrapperRef = useRef<HTMLDivElement>(null);   // Div raíz, pointer-events: none

  // ── Engine Refs ────────────────────────────────────────────────────────────
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<any>(null);
  const adapterRef = useRef<any>(null);
  const controllerRef = useRef<any>(null);
  const adaptiveTickerRef = useRef<AdaptiveTicker | null>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [modelReady, setModelReady] = useState(false); // controla visibilidad del hitTarget

  // ── Drag State ─────────────────────────────────────────────────────────────
  const scaleRef = useRef(1.0);
  const baseScaleRef = useRef(1.0);
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const dragRef = useRef({
    active: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    modelStartX: 0,
    modelStartY: 0
  });

  // ── Sincronizar Hit Target al Bounding Box CSS Real del Modelo ────────────
  const syncHitTargetBounds = useCallback(() => {
    const model = modelRef.current;
    const hitEl = hitTargetRef.current;
    const app = pixiAppRef.current;
    if (!model || !hitEl || !app?.screen) return;

    try {
      const bounds = model.getBounds();
      if (!bounds || bounds.width < 10 || bounds.height < 10) return;

      const screenW = app.screen.width || window.innerWidth;
      const screenH = app.screen.height || window.innerHeight;

      // Coordenadas CSS exactas
      const cssX = Math.round(bounds.x);
      const cssY = Math.round(bounds.y);
      const cssW = Math.round(bounds.width);
      const cssH = Math.round(bounds.height);

      // Clamp dentro de la pantalla
      const clampedX = Math.max(0, cssX);
      const clampedY = Math.max(0, cssY);
      const clampedW = Math.min(cssW, screenW - clampedX);
      const clampedH = Math.min(cssH, screenH - clampedY);

      if (clampedW > 10 && clampedH > 10) {
        hitEl.style.left = `${clampedX}px`;
        hitEl.style.top = `${clampedY}px`;
        hitEl.style.width = `${clampedW}px`;
        hitEl.style.height = `${clampedH}px`;
        clickThroughService.registerHitbox('live2d', {
          x: clampedX,
          y: clampedY,
          width: clampedW,
          height: clampedH
        });
      }
    } catch (_) {}
  }, []);

  // ── Layout & Framing ───────────────────────────────────────────────────────
  const applyLayout = useCallback((model: any, app: PIXI.Application, mode = viewModeRef.current) => {
    if (!model || !app?.screen) return;
    const stageW = app.screen.width || window.innerWidth;
    const stageH = app.screen.height || window.innerHeight;
    const origH = model.internalModel?.originalHeight || 2000;

    let baseScale: number;
    if (mode === 'torso') {
      baseScale = (stageH * 1.55) / origH;
      model.scale.set(baseScale * scaleRef.current);
      model.x = (stageW - model.width) * 0.5;
      model.y = stageH * 0.08;
    } else {
      baseScale = (stageH * 0.90) / origH;
      model.scale.set(baseScale * scaleRef.current);
      model.x = (stageW - model.width) * 0.5;
      model.y = stageH * 0.05;
    }
    baseScaleRef.current = baseScale;
    syncHitTargetBounds();
  }, [syncHitTargetBounds]);

  // ── Inicialización del Motor Live2D ───────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    let app: PIXI.Application | null = null;
    let model: any = null;
    let controller: any = null;
    let adapter: any = null;
    let ticker: AdaptiveTicker | null = null;

    setIsLoading(true);
    setLoadError(null);
    setModelReady(false);

    async function init() {
      try {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = '';

        // 1. Cargar Cubism Core si no está en window
        if (typeof window !== 'undefined' && !window.Live2DCubismCore) {
          await new Promise<void>((resolve) => {
            const script = document.createElement('script');
            script.src = resolveModelPath('live2dcubismcore.min.js');
            script.onload = () => resolve();
            script.onerror = () => resolve();
            document.head.appendChild(script);
          });
        }
        if (!isMounted) return;

        if (PIXI.settings) {
          PIXI.settings.ROUND_PIXELS = false;
          PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH;
        }

        // Calidad nativa con soporte ultra nítido para pantallas HiDPI / 4K (hasta 2.0)
        const renderRes = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2.0);

        // 2. Crear PIXI Application (fondo transparente, pointer-events disabled en canvas)
        app = new PIXI.Application({
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundAlpha: 0,
          backgroundColor: 0x000000,
          antialias: true,
          autoDensity: true,
          autoStart: true,
          resolution: renderRes,
          clearBeforeRender: true,
          preserveDrawingBuffer: false, // Desactivar copia redundante de backbuffer (ahorra 40% de GPU)
          powerPreference: 'high-performance'
        });

        // Conectar AdaptiveTicker para regulación inteligente de FPS (60fps activo -> 30fps reposo -> 0fps en background)
        ticker = new AdaptiveTicker({
          activeFps: 60,
          idleFps: 30,
          inactivityThresholdMs: 4500,
          autoListenDom: true,
          targetElement: typeof window !== 'undefined' ? window : null
        });
        ticker.attachTicker(app.ticker);
        adaptiveTickerRef.current = ticker;

        const canvasEl = app.view as HTMLCanvasElement;
        if (canvasEl) {
          canvasEl.style.width = '100%';
          canvasEl.style.height = '100%';
          canvasEl.style.position = 'absolute';
          canvasEl.style.top = '0';
          canvasEl.style.left = '0';
          canvasEl.style.pointerEvents = 'none';
          containerRef.current.appendChild(canvasEl);
        }

        pixiAppRef.current = app;

        // 3. Cargar modelo Live2D
        const descriptor = live2dModelRegistry.getModel(modelId) || live2dModelRegistry.getModel('yanderegirl');
        const resolvedPath = resolveModelPath(descriptor.path);

        logger.info('Live2D', `Cargando modelo ${descriptor.name}...`);

        model = await loadModel(resolvedPath, () => isMounted);

        if (!isMounted) {
          try { model?.destroy({ texture: true, baseTexture: true }); } catch (_) {}
          try { app?.destroy(true); } catch (_) {}
          return;
        }

        // 4. Pre-decodificar texturas para evitar frames negros en WebGL
        const textures: any[] = [
          ...(model.textures || []),
          ...(model.internalModel?.textures || [])
        ];

        await Promise.all(textures.map((tex) => {
          const src = tex?.baseTexture?.resource?.source;
          if (src instanceof HTMLImageElement && !src.complete) {
            return new Promise<void>((res) => {
              src.onload = () => res();
              src.onerror = () => res();
              if (typeof src.decode === 'function') {
                src.decode().then(() => res()).catch(() => res());
              }
            });
          }
          return Promise.resolve();
        }));
        if (!isMounted) return;

        // Filtrado bilineal de alta fidelidad sin blur en texturas
        for (const tex of textures) {
          if (tex?.baseTexture) {
            tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;
            tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
            tex.baseTexture.wrapMode = PIXI.WRAP_MODES.CLAMP;
            tex.baseTexture.update();
          }
        }

        // 5. Supresión selectiva de partes y parámetros específicos según el perfil del modelo
        const core = model.internalModel?.coreModel;
        if (core) {
          const hiddenParts = Array.isArray(descriptor.hiddenParts) ? descriptor.hiddenParts : [];
          if (core._partIds && hiddenParts.length > 0) {
            for (const pId of hiddenParts) {
              const idx = core._partIds.indexOf(pId);
              if (idx !== -1) {
                if (typeof core.setPartOpacityByIndex === 'function') core.setPartOpacityByIndex(idx, 0);
                if (core._partOpacities) core._partOpacities[idx] = 0;
              }
            }
          }
          if (descriptor.lockedParameters && typeof descriptor.lockedParameters === 'object') {
            for (const [pId, val] of Object.entries(descriptor.lockedParameters)) {
              if (typeof core.setParameterValueById === 'function') {
                core.setParameterValueById(pId, val);
              }
            }
          }
        }

        // 6. Desactivar toda interactividad interna de PIXI (la maneja el DOM hitTarget)
        model.interactive = false;
        model.interactiveChildren = false;
        model.eventMode = 'none';
        if (model.internalModel) {
          try { model.internalModel.interactive = false; } catch (_) {}
        }
        app.stage.interactiveChildren = false;
        app.stage.eventMode = 'none';
        app.stage.addChild(model);
        modelRef.current = model;

        // 7. Conectar adaptador y controlador de expresiones
        const detected: any = live2dModelRegistry.detectModelCapabilities(model);
        const mapping = {
          ...(detected?.standardMapping || {}),
          ...(descriptor.standardMapping || {})
        };
        adapter = new Live2DAdapter(model, mapping, descriptor);
        adapterRef.current = adapter;
        controller = new Live2DController(adapter, descriptor.id);
        controllerRef.current = controller;
        contextualEmotionOrchestrator.setContextReferences(controller, adapter, descriptor.id);

        // 8. Conectar bucle de animación y cinética
        const onTick = (delta: number) => {
          if (!isMounted) return;
          const deltaMs = app?.ticker?.deltaMS || (delta * 16.6667);
          model.update(deltaMs);
          controller.update(deltaMs);
        };
        app.ticker.add(onTick);

        // 9. Aplicar layout y cebar WebGL con pases de render
        applyLayout(model, app, viewModeRef.current);
        model.update(16);
        app.renderer.render(app.stage);

        requestAnimationFrame(() => {
          if (!isMounted || !app) return;
          model.update(16);
          app.renderer.render(app.stage);

          // Sincronizar hit target DESPUÉS del primer render real
          syncHitTargetBounds();
          setIsLoading(false);
          setModelReady(true);
        });

        // 10. Exponer API para testing externo
        if (typeof window !== 'undefined') {
          window.__cristiAvatar = {
            get model() { return modelRef.current; },
            get adapter() { return adapterRef.current; },
            get controller() { return controllerRef.current; },
            setExpression: (exp: string) => adapterRef.current?.setExpression(exp),
            setEmotion: (emo: string) => controllerRef.current?.setEmotion(emo)
          };
        }

      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error('Live2D', `Error fatal: ${errorMsg}`, err);
        if (isMounted) {
          setLoadError(errorMsg);
          setIsLoading(false);
        }
      }
    }

    void init();

    return () => {
      isMounted = false;
      ticker?.destroy();
      adaptiveTickerRef.current = null;
      if (controller) controller.destroy();
      else adapter?.destroy();
      if (contextualEmotionOrchestrator.controller === controller) {
        contextualEmotionOrchestrator.setContextReferences(null, null);
      }
      delete window.__cristiAvatar;
      try { model?.destroy({ texture: true, baseTexture: true }); } catch (_) {}
      try { app?.destroy(true); } catch (_) {}
      clickThroughService.unregisterHitbox('live2d');
      modelRef.current = null;
      pixiAppRef.current = null;
      adapterRef.current = null;
      controllerRef.current = null;
    };
  }, [modelId, applyLayout, syncHitTargetBounds]);

  // ── Sincronizar estado de voz con AdaptiveTicker ───────────────────────────
  useEffect(() => {
    if (adaptiveTickerRef.current) {
      adaptiveTickerRef.current.setVoicePlaying(isSpeaking);
    }
  }, [isSpeaking]);

  // ── Redimensionamiento ────────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      if (pixiAppRef.current && modelRef.current) {
        pixiAppRef.current.renderer.resize(window.innerWidth, window.innerHeight);
        applyLayout(modelRef.current, pixiAppRef.current, viewModeRef.current);
        syncHitTargetBounds();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [applyLayout, syncHitTargetBounds]);

  // ── Cambios de viewMode ───────────────────────────────────────────────────
  useEffect(() => {
    if (modelRef.current && pixiAppRef.current) {
      applyLayout(modelRef.current, pixiAppRef.current, viewMode);
    }
  }, [viewMode, applyLayout]);

  // ── Gestos y Emociones ────────────────────────────────────────────────────
  useEffect(() => {
    if (controllerRef.current) controllerRef.current.setEmotion(gesture);
    eventBus.emit(EVENTS.EMOTION_CHANGED, gesture);
  }, [gesture]);

  // ── LipSync Reactivo ──────────────────────────────────────────────────────
  useEffect(() => {
    if (adapterRef.current && lipSyncValue > 0) {
      adapterRef.current.setMouth(Math.min(1.0, Math.max(0, lipSyncValue)), 0.2);
    }
  }, [lipSyncValue]);

  // ── Handlers de Interacción en el Hit Target ──────────────────────────────
  const handlePointerEnter = useCallback(() => {
    electronBridge?.setIgnoreMouseEvents(false);
    adaptiveTickerRef.current?.reportActivity('pointer_enter');
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (!dragRef.current.active) {
      electronBridge?.setIgnoreMouseEvents(true, { forward: true });
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    electronBridge?.setIgnoreMouseEvents(false);
    adaptiveTickerRef.current?.setInteracting(true);
    if (e.button === 2) return; // Clic derecho → menú contextual

    const model = modelRef.current;
    if (!model) return;

    dragRef.current = {
      active: true,
      hasMoved: false,
      startX: e.clientX,
      startY: e.clientY,
      modelStartX: model.x,
      modelStartY: model.y
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || !modelRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragRef.current.hasMoved = true;
    }

    modelRef.current.x = dragRef.current.modelStartX + dx;
    modelRef.current.y = dragRef.current.modelStartY + dy;
    syncHitTargetBounds();
    adaptiveTickerRef.current?.reportActivity('pointer_move');
  }, [syncHitTargetBounds]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    adaptiveTickerRef.current?.setInteracting(false);
    if (!dragRef.current.active) return;
    const hadMoved = dragRef.current.hasMoved;
    dragRef.current.active = false;
    setIsDragging(false);

    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}

    if (!hadMoved) {
      soundFxService.playClick();
      onModelClick?.();
    }
  }, [onModelClick]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    adaptiveTickerRef.current?.reportActivity('wheel');
    const model = modelRef.current;
    if (!model) return;

    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    scaleRef.current = Math.max(0.4, Math.min(2.5, scaleRef.current + delta));
    model.scale.set(baseScaleRef.current * scaleRef.current);
    syncHitTargetBounds();
  }, [syncHitTargetBounds]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    electronBridge?.setIgnoreMouseEvents(false);
    soundFxService.playClick();
    onModelContextMenu?.(e);
  }, [onModelContextMenu]);

  // ── API Pública (ref) ─────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    reapplyLayout: () => {
      if (modelRef.current && pixiAppRef.current) {
        applyLayout(modelRef.current, pixiAppRef.current, viewModeRef.current);
      }
    },
    switchModel: (_id: string) => {
      // Model change is managed by modelId prop
    },
    triggerMotion: (g: string, i?: number) => controllerRef.current?.playMotion?.(g, i),
    triggerGesture: (name: string, _comment?: string) => controllerRef.current?.setEmotion?.(name),
    getModel: () => modelRef.current,
    getAdapter: () => adapterRef.current,
    getController: () => controllerRef.current,
    getHitboxRect: () => hitTargetRef.current?.getBoundingClientRect() ?? null
  }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full select-none overflow-hidden"
      style={{ pointerEvents: 'none' }}
    >
      {/* Canvas WebGL — pointer-events: none (solo renderiza visualmente) */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ pointerEvents: 'none' }}
      />

      {/*
        Hit Target Interactivo:
        - Comienza con pointer-events: none hasta que el modelo cargue (modelReady)
        - Una vez listo, se posiciona exactamente sobre el bounding box CSS real del modelo
        - Es el ÚNICO elemento que captura interacciones con Cristi
      */}
      <div
        ref={hitTargetRef}
        onPointerEnter={modelReady ? handlePointerEnter : undefined}
        onPointerLeave={modelReady ? handlePointerLeave : undefined}
        onPointerDown={modelReady ? handlePointerDown : undefined}
        onPointerMove={modelReady ? handlePointerMove : undefined}
        onPointerUp={modelReady ? handlePointerUp : undefined}
        onPointerCancel={modelReady ? handlePointerUp : undefined}
        onContextMenu={modelReady ? handleContextMenu : undefined}
        onWheel={modelReady ? handleWheel : undefined}
        className={`absolute z-10 bg-transparent ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          left: '-9999px',
          top: '-9999px',
          width: '100px',
          height: '100px',
          pointerEvents: modelReady ? 'auto' : 'none',
        }}
        title="Arrastra a Cristi • Rueda para escalar • Clic derecho para menú"
      />

      {/* Indicador de Carga */}
      {isLoading && (
        <div
          className="absolute bottom-6 right-6 z-20 flex items-center gap-2 px-3 py-1.5 rounded-sm bg-zinc-950/90 border border-zinc-800 text-zinc-300 font-mono text-xs shadow-2xl backdrop-blur-md"
          style={{ pointerEvents: 'none' }}
        >
          <div className="w-2.5 h-2.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
          <span>Cargando avatar...</span>
        </div>
      )}

      {/* Error de Carga */}
      {loadError && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 p-4 rounded-sm bg-zinc-950 border border-rose-800 text-zinc-200 font-mono text-xs shadow-2xl space-y-2 text-center max-w-sm"
          style={{ pointerEvents: 'none' }}
        >
          <p className="text-rose-400 font-semibold">Error al cargar el avatar</p>
          <p className="text-[11px] text-zinc-400">{loadError}</p>
        </div>
      )}
    </div>
  );
}));

export default Live2DCanvas;
