import React, {
  useEffect, useRef, useState, useCallback,
  useImperativeHandle, forwardRef
} from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { logger } from '../services/logger';
import { eventBus, EVENTS } from '../services/eventBus';
import { live2dModelRegistry, Live2DAdapter, Live2DController } from '../services/live2d';
import { desktopCursorTracker } from '../services/desktop/DesktopCursorTracker';

// ─────────────────────────────────────────────────────────────────────────────
// PIXI & LIVE2D ENGINE GLOBAL CONFIG
// ─────────────────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.PIXI = PIXI;
  PIXI.settings.PREFER_ENV = PIXI.ENV.WEBGL_LEGACY;
  if (PIXI.BatchRenderer) {
    PIXI.BatchRenderer.defaultMaxTextures = 1;
  }

  // PixiJS v7 Compatibility Polyfill for pixi-live2d-display
  if (PIXI.DisplayObject && !PIXI.DisplayObject.prototype.isInteractive) {
    PIXI.DisplayObject.prototype.isInteractive = function () {
      return !!(this.interactive || (this.eventMode && this.eventMode !== 'none' && this.eventMode !== 'passive'));
    };
  }
  if (Live2DModel.prototype && !Live2DModel.prototype.isInteractive) {
    Live2DModel.prototype.isInteractive = function () {
      return false;
    };
  }
}

try {
  Live2DModel.registerTicker(PIXI.Ticker);
} catch (_) {}

// ─────────────────────────────────────────────────────────────────────────────
// POSITION PRESETS (percentage of stage viewport)
// ─────────────────────────────────────────────────────────────────────────────
const PRESETS = {
  center:         { xPct: 50, yPct: 50 },
  left:           { xPct: 22, yPct: 50 },
  right:          { xPct: 78, yPct: 50 },
  'top-left':     { xPct: 22, yPct: 25 },
  'top-right':    { xPct: 78, yPct: 25 },
  'bottom-left':  { xPct: 22, yPct: 75 },
  'bottom-right': { xPct: 78, yPct: 75 },
};

const randomPreset = () => {
  const keys = Object.keys(PRESETS);
  return keys[Math.floor(Math.random() * keys.length)];
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export const Live2DCanvas = forwardRef(function Live2DCanvas(
  {
    modelId = 'yanderegirl',
    gesture = 'idle',
    lipSyncValue = 0,
    isSpeaking = false,
    isListening = false,
    viewMode = 'torso', // 'torso' (default: upper body) | 'full' (entire model)
    onModelClick,
    onModelContextMenu
  },
  ref
) {
  const containerRef = useRef(null);
  const pixiAppRef = useRef(null);
  const modelRef = useRef(null);
  const adapterRef = useRef(null);
  const controllerRef = useRef(null);
  const animFrameRef = useRef(null);

  // Drag state with exact delta calculation (NEVER resets user position)
  const dragRef = useRef({
    active: false,
    hasMoved: false,
    startMouseX: 0,
    startMouseY: 0,
    startModelX: 0,
    startModelY: 0
  });

  // Mouse position reference
  const mousePosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // References for live tick access
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [activeAnim, setActiveAnim] = useState('none');
  const [isHoveringModel, setIsHoveringModel] = useState(false);

  // ── Layout helper (Torso framing vs Full body framing) ────────────────────
  const applyLayout = useCallback((model, app, mode = viewModeRef.current) => {
    if (!model || !app?.renderer) return;
    const stageW = app.renderer.width / (window.devicePixelRatio || 1);
    const stageH = app.renderer.height / (window.devicePixelRatio || 1);
    const origH = model.internalModel?.originalHeight || 2000;

    if (mode === 'torso') {
      // Torso framing: focus on chest and head (larger scale, centered)
      const scale = (stageH * 1.55) / origH;
      model.scale.set(scale);
      model.x = (stageW - model.width) * 0.5;
      model.y = stageH * 0.08;
    } else {
      // Full body framing
      const scale = (stageH * 0.90) / origH;
      model.scale.set(scale);
      model.x = (stageW - model.width) * 0.5;
      model.y = stageH * 0.05;
    }
  }, []);

  // Update layout when viewMode changes
  useEffect(() => {
    if (modelRef.current && pixiAppRef.current) {
      applyLayout(modelRef.current, pixiAppRef.current, viewMode);
    }
  }, [viewMode, applyLayout]);

  // ── Forward Emotion changes to Controller ─────────────────────────────────
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.setEmotion(gesture);
    }
    eventBus.emit(EVENTS.EMOTION_CHANGED, gesture);

    // Trigger micro-animation impulse in-place
    const animMap = {
      happy:     'bounce',
      blush:     'float',
      wink:      'float',
      dance:     'dance',
      surprised: 'bounce',
      yandere:   'shake',
      crazy:     'bounce',
    };

    const anim = animMap[gesture.toLowerCase()];
    if (anim) {
      setActiveAnim(anim);
      setTimeout(() => setActiveAnim('none'), 1200);
    }
  }, [gesture]);

  // ── Explicit AI Tool moveTo API (Only invoked when AI explicitly requests moving) ──
  const moveTo = useCallback((preset, animation = 'slide') => {
    const model = modelRef.current;
    const app = pixiAppRef.current;
    if (!model || !app?.renderer) return;

    const p = preset === 'random' ? PRESETS[randomPreset()] : (PRESETS[preset] || PRESETS.center);
    const stageW = app.renderer.width / (window.devicePixelRatio || 1);
    const stageH = app.renderer.height / (window.devicePixelRatio || 1);

    const targetX = (p.xPct / 100) * stageW - model.width * 0.5;
    const targetY = (p.yPct / 100) * stageH - model.height * 0.5;

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (animation === 'none') {
      model.x = targetX;
      model.y = targetY;
      return;
    }

    setActiveAnim(animation);
    setTimeout(() => setActiveAnim('none'), 1200);

    const startX = model.x;
    const startY = model.y;
    const startTime = performance.now();
    const duration = 500;

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      model.x = startX + (targetX - startX) * ease;
      model.y = startY + (targetY - startY) * ease;
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        animFrameRef.current = null;
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  }, []);

  useImperativeHandle(ref, () => ({
    moveTo,
    getModel: () => modelRef.current,
    getAdapter: () => adapterRef.current,
    getController: () => controllerRef.current,
    reapplyLayout: () => applyLayout(modelRef.current, pixiAppRef.current, viewModeRef.current)
  }), [moveTo, applyLayout]);

  // ── Hit-Testing Helper ────────────────────────────────────────────────────
  const isPointerOverModel = useCallback((clientX, clientY) => {
    const model = modelRef.current;
    if (!model) return false;

    const bounds = model.getBounds();
    const padding = 20;
    return (
      clientX >= bounds.x - padding &&
      clientX <= bounds.x + bounds.width + padding &&
      clientY >= bounds.y - padding &&
      clientY <= bounds.y + bounds.height + padding
    );
  }, []);

  // ── Precise Drag Handlers ─────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    const model = modelRef.current;
    if (!model) return;

    if (e.button === 0) {
      const isOver = isPointerOverModel(e.clientX, e.clientY);
      if (!isOver) return;

      dragRef.current = {
        active: true,
        hasMoved: false,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startModelX: model.x,
        startModelY: model.y
      };
      e.preventDefault();
    }
  }, [isPointerOverModel]);

  const handleContextMenu = useCallback((e) => {
    const isOver = isPointerOverModel(e.clientX, e.clientY);
    if (isOver && onModelContextMenu) {
      e.preventDefault();
      const model = modelRef.current;
      let bounds = null;
      if (model && typeof model.getBounds === 'function') {
        const b = model.getBounds();
        bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
      }
      onModelContextMenu(e, bounds);
    }
  }, [isPointerOverModel, onModelContextMenu]);

  useEffect(() => {
    desktopCursorTracker.start();

    const unsub = desktopCursorTracker.onCursorUpdate((pos) => {
      mousePosRef.current = { x: pos.x, y: pos.y };

      if (!dragRef.current.active) {
        setIsHoveringModel(isPointerOverModel(pos.x, pos.y));
      }

      if (dragRef.current.active && modelRef.current) {
        const dx = pos.x - dragRef.current.startMouseX;
        const dy = pos.y - dragRef.current.startMouseY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          dragRef.current.hasMoved = true;
        }

        modelRef.current.x = dragRef.current.startModelX + dx;
        modelRef.current.y = dragRef.current.startModelY + dy;
      }
    });

    const handleMouseUp = () => {
      if (dragRef.current.active) {
        dragRef.current.active = false;
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      unsub();
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPointerOverModel]);

  // ── PIXI & Model Lifecycle with Adapter & Controller ─────────────────────
  useEffect(() => {
    let isMounted = true;
    let app = null;
    let model = null;
    let adapter = null;
    let controller = null;
    let resizeHandler = null;

    async function init() {
      if (!containerRef.current) return;

      try {
        eventBus.emit(EVENTS.MODEL_LOADING, { modelId });

        if (typeof window !== 'undefined' && !window.Live2DCubismCore) {
          await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = '/live2dcubismcore.min.js';
            script.onload = resolve;
            script.onerror = resolve;
            document.head.appendChild(script);
          });
        }

        if (!isMounted || !containerRef.current) return;

        // Clean leftover canvas
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild);
        }

        // Create PIXI Application
        app = new PIXI.Application({
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
          autoStart: true,
          preserveDrawingBuffer: true,
          clearBeforeRender: true,
          powerPreference: 'high-performance'
        });

        if (app.view) {
          app.view.className = 'live2d-pixi-view';
          app.view.style.width = '100%';
          app.view.style.height = '100%';
          app.view.style.position = 'absolute';
          app.view.style.top = '0';
          app.view.style.left = '0';
          app.view.style.background = 'transparent';
          containerRef.current.appendChild(app.view);
        }

        pixiAppRef.current = app;

        // Resolve model from Registry
        const modelDescriptor = live2dModelRegistry.getModel(modelId);
        logger.info('SYSTEM', `Cargando modelo Live2D Cubism (${modelDescriptor.name})...`);

        model = await Live2DModel.from(modelDescriptor.path, {
          autoInteract: false,
          autoUpdate: true
        });

        if (!isMounted) {
          try { model.destroy(); } catch (_) {}
          try { app.destroy(true, { children: true }); } catch (_) {}
          return;
        }

        modelRef.current = model;
        model.interactive = false;
        model.eventMode = 'none';
        app.stage.interactiveChildren = false;
        app.stage.eventMode = 'none';
        app.stage.addChild(model);

        // Detect capabilities and setup adapter
        const profile = live2dModelRegistry.getModel(modelId) || modelDescriptor;
        const detected = live2dModelRegistry.detectModelCapabilities(model);
        const mapping = {
          ...detected.standardMapping,
          ...(profile?.standardMapping || {})
        };

        adapter = new Live2DAdapter(model, mapping, profile);
        adapterRef.current = adapter;

        controller = new Live2DController(adapter, modelId);
        controllerRef.current = controller;

        // Expose to window for testing / automation
        if (typeof window !== 'undefined') {
          window.__cristiAvatar = {
            model,
            adapter,
            controller,
            registry: live2dModelRegistry,
            setGaze: (x, y) => controller.setGazeTarget(x, y),
            setEmotion: (emo) => controller.setEmotion(emo),
            setHead: (x, y, z) => adapter.setHeadAngle(x, y, z),
            setBody: (x, y, z) => adapter.setBodyAngle(x, y, z),
            setMouth: (o, f) => adapter.setMouth(o, f),
            setCheeks: (b) => adapter.setCheeks(b)
          };
        }

        applyLayout(model, app, viewModeRef.current);

        resizeHandler = () => {
          if (!app?.renderer || !model) return;
          try {
            app.renderer.resize(window.innerWidth, window.innerHeight);
            applyLayout(model, app, viewModeRef.current);
          } catch (_) {}
        };
        window.addEventListener('resize', resizeHandler);

        // ── Main Behavioral Ticker Loop ──────────────────────────────────
        let lastTime = performance.now();
        app.ticker.add(() => {
          const now = performance.now();
          const deltaMs = Math.min(now - lastTime, 50); // clamp delta
          lastTime = now;

          if (!model?.internalModel?.coreModel || !controller) return;

          const bounds = model.getBounds();
          const faceCenterX = bounds.x + bounds.width * 0.5;
          const faceCenterY = bounds.y + bounds.height * 0.28;

          // Normalized gaze vector (-1.0 to 1.0)
          const dx = mousePosRef.current.x - faceCenterX;
          const dy = mousePosRef.current.y - faceCenterY;
          const normX = Math.max(-1, Math.min(1, dx / (window.innerWidth * 0.42)));
          const normY = Math.max(-1, Math.min(1, dy / (window.innerHeight * 0.42)));

          controller.setGazeTarget(normX, -normY);

          // Update all organic parameters via Controller & Adapter
          controller.update(deltaMs);
        });

        setIsLoaded(true);
        eventBus.emit(EVENTS.MODEL_LOADED, { modelId, modelDescriptor });
        logger.info('SYSTEM', `¡Modelo Live2D "${modelDescriptor.name}" inicializado con éxito!`);
      } catch (err) {
        console.error('Error al inicializar Live2D:', err);
        logger.error('SYSTEM', `Fallo al cargar modelo Live2D: ${err.message}`);
        if (isMounted) setLoadError(err.message);
      }
    }

    init();

    return () => {
      isMounted = false;
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      if (controller) {
        controller.destroy();
        controllerRef.current = null;
      }
      if (adapter) {
        adapterRef.current = null;
      }
      if (model) {
        try { model.destroy(); } catch (_) {}
        modelRef.current = null;
      }
      if (app) {
        try {
          app.ticker.stop();
          app.destroy(true, { children: true, texture: false, baseTexture: false });
        } catch (_) {}
        pixiAppRef.current = null;
      }
    };
  }, [modelId, applyLayout]);

  return (
    <div className="live2d-root">
      <div
        ref={containerRef}
        className={`live2d-canvas-container ${activeAnim !== 'none' ? `live2d-anim-${activeAnim}` : ''} ${isHoveringModel ? 'cursor-grab' : 'cursor-default'}`}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        onClick={(e) => {
          if (!dragRef.current.hasMoved && isPointerOverModel(e.clientX, e.clientY) && onModelClick) {
            onModelClick(e);
          }
        }}
        title={isHoveringModel ? 'Arrastra a Cristi • Clic para interactuar • Clic derecho para menú' : ''}
      />

      {!isLoaded && !loadError && (
        <div className="live2d-loading-indicator">
          <div className="live2d-spinner" />
          <span>Invocando a Cristi...</span>
        </div>
      )}

      {loadError && (
        <div className="live2d-error-fallback">
          <span>Error Live2D: {loadError}</span>
        </div>
      )}
    </div>
  );
});
