import React, {
  useEffect, useRef, useState, useCallback,
  useImperativeHandle, forwardRef
} from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { logger } from '../services/logger.js';
import { eventBus, EVENTS } from '../services/eventBus.js';
import { live2dModelRegistry, Live2DAdapter, Live2DController, contextualEmotionOrchestrator } from '../services/live2d/index.js';
import { desktopCursorTracker } from '../services/desktop/DesktopCursorTracker.js';
import { useClickThrough } from '../hooks/useClickThrough.js';
import { performanceProfiler } from '../services/profiler/PerformanceProfilerService.js';
import { Sparkles } from 'lucide-react';

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
// CONSTANTS
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

// Scale limits to prevent model from being too small or too large
const MIN_SCALE = 0.25;
const MAX_SCALE = 4.0;
const SCALE_STEP = 0.12; // Per wheel tick multiplier factor

/**
 * Universal path resolver that works identically across development (http://localhost:5173),
 * custom Electron production schemes (app://cristi/), and relative setups without Network Errors.
 */
function resolveModelPath(rawPath) {
  if (!rawPath) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawPath)) {
    return rawPath;
  }
  const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    if (origin && origin !== 'null' && origin !== 'file://') {
      return `${origin}${cleanPath}`;
    }
  }
  return cleanPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export const Live2DCanvas = React.memo(forwardRef(function Live2DCanvas(
  {
    modelId = 'yanderegirl',
    gesture = 'idle',
    lipSyncValue = 0,
    isSpeaking = false,
    isListening = false,
    viewMode = 'torso',
    onModelClick,
    onModelContextMenu
  },
  ref
) {
  const containerRef = useRef(null);   // The div where PIXI canvas is mounted (no pointer-events)
  const hitTargetRef = useRef(null);   // The invisible interactive div that follows the model
  const pixiAppRef = useRef(null);
  const modelRef = useRef(null);
  const adapterRef = useRef(null);
  const controllerRef = useRef(null);
  const animFrameRef = useRef(null);
  const hitSyncRafRef = useRef(null);  // rAF handle for hit-target position sync

  // Scale state — starts at 1.0, modified by wheel events
  const scaleRef = useRef(1.0);
  const baseScaleRef = useRef(1.0); // The applyLayout scale, wheel scales relative to this

  // Drag state — only starts when pointerdown fires on the hit-target
  const dragRef = useRef({
    active: false,
    hasMoved: false,
    pointerId: null,
    startPointerX: 0,
    startPointerY: 0,
    startModelX: 0,
    startModelY: 0
  });

  // Mouse position reference (for gaze tracking)
  const mousePosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // References for live tick access
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const isSpeakingRef = useRef(isSpeaking);
  const isListeningRef = useRef(isListening);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [activeAnim, setActiveAnim] = useState('none');
  const [isDragging, setIsDragging] = useState(false);

  // Desktop Mate-style click-through: only the model area is interactive
  const { interactiveProps } = useClickThrough();

  // ── Layout helper ────────────────────────────────────────────────────────
  const applyLayout = useCallback((model, app, mode = viewModeRef.current) => {
    if (!model || !app?.renderer) return;
    const stageW = app.renderer.width / (window.devicePixelRatio || 1);
    const stageH = app.renderer.height / (window.devicePixelRatio || 1);
    const origH = model.internalModel?.originalHeight || 2000;

    let baseScale;
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
  }, []);

  // Update layout when viewMode changes
  useEffect(() => {
    if (modelRef.current && pixiAppRef.current) {
      applyLayout(modelRef.current, pixiAppRef.current, viewMode);
    }
  }, [viewMode, applyLayout]);

  // ── Forward Emotion changes to Controller ──────────────────────────────
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.setEmotion(gesture);
    }
    eventBus.emit(EVENTS.EMOTION_CHANGED, gesture);

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

  // ── Explicit AI Tool moveTo API ────────────────────────────────────────
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

  // ── Hit-Target Synchronizer ────────────────────────────────────────────
  // Synchronizes the invisible div position/size with the model.
  // Throttled to avoid expensive polygon vertex traversals on every frame,
  // providing 120+ FPS rendering while keeping click-through 100% accurate.
  const lastHitBoundsRef = useRef({ x: -1, y: -1, w: -1, h: -1 });

  const syncHitTargetBox = useCallback((force = false) => {
    const model = modelRef.current;
    const hitEl = hitTargetRef.current;
    if (!model || !hitEl) return;

    try {
      const b = model.getBounds();
      if (b && b.width > 2 && b.height > 2) {
        const x = Math.max(0, Math.round(b.x));
        const y = Math.max(0, Math.round(b.y));
        const w = Math.round(b.width);
        const h = Math.round(b.height);

        const last = lastHitBoundsRef.current;
        if (force || Math.abs(x - last.x) > 1 || Math.abs(y - last.y) > 1 || Math.abs(w - last.w) > 2 || Math.abs(h - last.h) > 2) {
          lastHitBoundsRef.current = { x, y, w, h };
          hitEl.style.left = `${x}px`;
          hitEl.style.top = `${y}px`;
          hitEl.style.width = `${w}px`;
          hitEl.style.height = `${h}px`;
        }
      }
    } catch (_) {}
  }, []);

  const startHitTargetSync = useCallback(() => {
    let lastSync = 0;
    const syncLoop = (now) => {
      if (now - lastSync > 66) {
        lastSync = now;
        syncHitTargetBox(false);
      }
      hitSyncRafRef.current = requestAnimationFrame(syncLoop);
    };
    hitSyncRafRef.current = requestAnimationFrame(syncLoop);
  }, [syncHitTargetBox]);

  // ── Drag Handlers (pointer events on the hit-target div) ────────────────
  // Using Pointer Events API with setPointerCapture for clean drag behavior.
  // This is the browser-native way to do drag: the element continues receiving
  // pointermove even when the pointer leaves it, but Windows still receives
  // events on other apps when the button is not pressed.
  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return; // Only left-click drag
    const model = modelRef.current;
    if (!model) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    dragRef.current = {
      active: true,
      hasMoved: false,
      pointerId: e.pointerId,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startModelX: model.x,
      startModelY: model.y
    };
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current.active) return;

    const dx = e.clientX - dragRef.current.startPointerX;
    const dy = e.clientY - dragRef.current.startPointerY;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      dragRef.current.hasMoved = true;
    }

    if (modelRef.current) {
      modelRef.current.x = dragRef.current.startModelX + dx;
      modelRef.current.y = dragRef.current.startModelY + dy;
      syncHitTargetBox(true);
    }
  }, []);

  const handlePointerUp = useCallback((e) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  }, []);

  // ── Click Handler on hit-target ──────────────────────────────────────
  const handleClick = useCallback((e) => {
    if (dragRef.current.hasMoved) return; // Was a drag, not a click
    if (onModelClick) onModelClick(e);
  }, [onModelClick]);

  // ── Context Menu Handler (right-click only on hit-target) ────────────
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const model = modelRef.current;
    let bounds = null;
    if (model && typeof model.getBounds === 'function') {
      const b = model.getBounds();
      bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
    }
    if (onModelContextMenu) {
      onModelContextMenu(e, bounds);
    }
  }, [onModelContextMenu]);

  // ── Wheel Scroll → Scale ──────────────────────────────────────────────
  // Only fires when cursor is over the model hit-target (not the whole screen).
  // Windows and other apps receive scroll events when cursor is outside.
  const handleWheel = useCallback((e) => {
    e.preventDefault(); // Prevent page scroll when scaling model
    const model = modelRef.current;
    if (!model) return;

    const direction = e.deltaY > 0 ? -1 : 1; // -1 = zoom out, +1 = zoom in
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleRef.current + direction * SCALE_STEP));
    scaleRef.current = newScale;

    // Store the model center before scaling (so it scales around its center)
    const bounds = model.getBounds();
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    model.scale.set(baseScaleRef.current * newScale);

    // Re-center model after scale change (pivot around visual center)
    const newBounds = model.getBounds();
    model.x += centerX - (newBounds.x + newBounds.width / 2);
    model.y += centerY - (newBounds.y + newBounds.height / 2);
  }, []);

  // ── Gaze tracking — stays on window level (passive, no pointer capture) ─
  useEffect(() => {
    desktopCursorTracker.start();

    const unsub = desktopCursorTracker.onCursorUpdate((pos) => {
      mousePosRef.current = { x: pos.x, y: pos.y };
    });

    return () => {
      unsub();
    };
  }, []);

  // ── PIXI & Model Lifecycle ────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    let app = null;
    let model = null;
    let adapter = null;
    let controller = null;
    let resizeHandler = null;
    let onContextLost = null;
    let onContextRestored = null;
    let lastActivity = performance.now();

    // Activity monitor for GPU frame throttling
    const trackActivity = () => {
      lastActivity = performance.now();
    };
    window.addEventListener('mousemove', trackActivity, { passive: true });
    window.addEventListener('pointermove', trackActivity, { passive: true });

    const cleanupCurrentModelAndEngine = () => {
      if (controller) {
        try { controller.destroy(); } catch (_) {}
        controller = null;
        controllerRef.current = null;
      }
      if (adapter) {
        try { adapter.destroy(); } catch (_) {}
        adapter = null;
        adapterRef.current = null;
      }
      if (model) {
        try {
          if (app?.stage) app.stage.removeChild(model);
          model.destroy({ children: true, texture: true, baseTexture: true });
        } catch (_) {}
        model = null;
        modelRef.current = null;
      }
      if (PIXI.utils?.clearTextureCache) {
        try { PIXI.utils.clearTextureCache(); } catch (_) {}
      }
      if (PIXI.Assets?.cache?.reset) {
        try { PIXI.Assets.cache.reset(); } catch (_) {}
      }
    };

    async function init() {
      if (!containerRef.current) return;

      try {
        setLoadError(null);
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

        // Optimal High-Fidelity & Ultra-Fast settings for NVIDIA RTX Dedicated GPU
        const renderRes = Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.25);
        if (PIXI.settings) {
          PIXI.settings.RESOLUTION = renderRes;
          PIXI.settings.FILTER_RESOLUTION = renderRes;
          PIXI.settings.ROUND_PIXELS = false;
          PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH;
          PIXI.settings.MIPMAP_MODES = PIXI.MIPMAP_MODES.POW2;
          PIXI.settings.ANISOTROPIC_LEVEL = 4; // Razor-sharp texture details on RTX GPU
          if (PIXI.ENV?.WEBGL2) {
            PIXI.settings.PREFER_ENV = PIXI.ENV.WEBGL2;
          }
        }
        if (PIXI.BaseTexture?.defaultOptions) {
          PIXI.BaseTexture.defaultOptions.anisotropicLevel = 4;
          PIXI.BaseTexture.defaultOptions.mipmap = PIXI.MIPMAP_MODES.POW2;
          PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.LINEAR;
          PIXI.BaseTexture.defaultOptions.resolution = renderRes;
        }

        // Create PIXI Application with uncapped high-performance discrete GPU
        app = new PIXI.Application({
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundAlpha: 0,
          antialias: false,
          resolution: renderRes,
          autoDensity: true,
          autoStart: true,
          preserveDrawingBuffer: false,
          clearBeforeRender: true,
          powerPreference: 'high-performance'
        });

        if (app.ticker) {
          app.ticker.maxFPS = 0; // Uncapped for 120Hz / 144Hz / 240Hz monitors
          app.ticker.minFPS = 60;
        }

        if (app.view) {
          app.view.className = 'live2d-pixi-view';
          app.view.style.width = '100%';
          app.view.style.height = '100%';
          app.view.style.position = 'absolute';
          app.view.style.top = '0';
          app.view.style.left = '0';
          app.view.style.background = 'transparent';
          app.view.style.pointerEvents = 'none'; // Canvas itself must never capture events
          containerRef.current.appendChild(app.view);
        }

        pixiAppRef.current = app;

        // Resolve requested model descriptor
        let targetModelId = modelId;
        let modelDescriptor = live2dModelRegistry.getModel(targetModelId);
        logger.info('SYSTEM', `Cargando modelo Live2D Cubism (${modelDescriptor.name}) con renderizado HD...`);

        // Attempt loading model with graceful fallback on corrupt/missing assets
        try {
          const resolvedPath = resolveModelPath(modelDescriptor.path);
          model = await Live2DModel.from(resolvedPath, {
            autoInteract: false,
            autoUpdate: true
          });
        } catch (loadErr) {
          logger.warn('SYSTEM', `Error al cargar "${modelDescriptor.name}" (${loadErr.message}). Evaluando fallback...`);
          if (targetModelId !== 'yanderegirl') {
            logger.info('SYSTEM', 'Iniciando recuperación y fallback automático al modelo seguro "yanderegirl"...');
            targetModelId = 'yanderegirl';
            modelDescriptor = live2dModelRegistry.getModel('yanderegirl');
            const fallbackResolvedPath = resolveModelPath(modelDescriptor.path);
            model = await Live2DModel.from(fallbackResolvedPath, {
              autoInteract: false,
              autoUpdate: true
            });
            eventBus.emit(EVENTS.MODEL_LOAD_FALLBACK, {
              failedModelId: modelId,
              fallbackModelId: 'yanderegirl',
              error: loadErr.message
            });
          } else {
            throw loadErr;
          }
        }

        if (!isMounted) {
          try { model?.destroy({ children: true, texture: true, baseTexture: true }); } catch (_) {}
          try { app?.destroy(true, { children: true, texture: true, baseTexture: true }); } catch (_) {}
          return;
        }

        // Optimize model textures
        try {
          const allTextures = [
            ...(model.textures || []),
            ...(model.internalModel?.textures || [])
          ];
          for (const tex of allTextures) {
            if (tex?.baseTexture) {
              tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
              tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
              tex.baseTexture.anisotropicLevel = 16;
              tex.baseTexture.resolution = renderRes;
              tex.baseTexture.update();
            }
          }
        } catch (texErr) {
          console.warn('[Live2DCanvas] Texture optimization notice:', texErr);
        }

        modelRef.current = model;

        // Disable ALL internal PIXI/Live2D pointer handling
        model.interactive = false;
        model.interactiveChildren = false;
        model.eventMode = 'none';
        if (model.internalModel) {
          try { model.internalModel.interactive = false; } catch (_) {}
        }
        app.stage.interactiveChildren = false;
        app.stage.eventMode = 'none';
        app.stage.addChild(model);

        // Detect capabilities and setup adapter
        const profile = live2dModelRegistry.getModel(targetModelId) || modelDescriptor;
        const detected = live2dModelRegistry.detectModelCapabilities(model);
        const mapping = {
          ...detected.standardMapping,
          ...(profile?.standardMapping || {})
        };

        adapter = new Live2DAdapter(model, mapping, profile);
        adapterRef.current = adapter;

        controller = new Live2DController(adapter, targetModelId);
        controllerRef.current = controller;

        // Connect Contextual Emotion Orchestrator
        contextualEmotionOrchestrator.setContextReferences(controller, adapter, targetModelId);

        // Expose to window for testing / automation
        if (typeof window !== 'undefined') {
          window.__cristiAvatar = {
            model,
            adapter,
            controller,
            orchestrator: contextualEmotionOrchestrator,
            registry: live2dModelRegistry,
            setGaze: (x, y) => controller.setGazeTarget(x, y),
            setEmotion: (emo) => controller.setEmotion(emo),
            triggerEmotion: (emo, src) => contextualEmotionOrchestrator.triggerEmotion(emo, src),
            setExpression: (exp) => adapter.setExpression(exp),
            setMotion: (group, index) => model.motion(group, index),
            setMotionByGroup: (group, index) => adapter.setMotionByGroup(group, index),
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

        // ── WebGL Context Loss & Recovery Handlers (Outer-Scoped) ───────
        onContextLost = (e) => {
          e.preventDefault();
          logger.warn('SYSTEM', 'Pérdida de contexto WebGL detectada. Pausando ticker de Live2D...');
          try {
            if (app?.ticker) app.ticker.stop();
          } catch (_) {}
        };

        onContextRestored = () => {
          logger.info('SYSTEM', 'Contexto WebGL restaurado exitosamente. Reiniciando motor Live2D...');
          if (isMounted) {
            cleanupCurrentModelAndEngine();
            if (app) {
              try { app.destroy(true, { children: true, texture: true, baseTexture: true }); } catch (_) {}
              app = null;
              pixiAppRef.current = null;
            }
            init();
          }
        };

        if (app.view) {
          app.view.addEventListener('webglcontextlost', onContextLost, false);
          app.view.addEventListener('webglcontextrestored', onContextRestored, false);
        }

        // ── Main Behavioral Ticker Loop with GPU Idle Throttling ────────
        let lastTime = performance.now();
        let lastRenderTime = performance.now();

        const tickerFn = () => {
          const now = performance.now();
          const isIdle = (now - lastActivity > 4500) && !isSpeakingRef.current && !isListeningRef.current;

          // If idle, cap ticker rate to ~30 FPS (32ms) to save CPU/GPU power smoothly
          if (isIdle && (now - lastRenderTime < 32)) {
            return;
          }
          lastRenderTime = now;

          const deltaMs = Math.min(now - lastTime, 50);
          lastTime = now;

          if (!model?.internalModel?.coreModel || !controller) return;

          performanceProfiler.measure('live2d', () => {
            // Fast O(1) face center calculation without matrix polygon traversal
            const mHeight = model.height || 650;
            const faceCenterX = model.x;
            const faceCenterY = model.y - (mHeight * 0.22);

            const dx = mousePosRef.current.x - faceCenterX;
            const dy = mousePosRef.current.y - faceCenterY;
            const normX = Math.max(-1, Math.min(1, dx / (window.innerWidth * 0.42)));
            const normY = Math.max(-1, Math.min(1, dy / (window.innerHeight * 0.42)));

            controller.setGazeTarget(normX, -normY);
            controller.update(deltaMs);
          });

          performanceProfiler.recordTick();
        };

        app.ticker.add(tickerFn);

        // Start the hit-target sync rAF loop
        startHitTargetSync();

        setIsLoaded(true);
        eventBus.emit(EVENTS.MODEL_LOADED, { modelId: targetModelId, modelDescriptor });
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
      window.removeEventListener('mousemove', trackActivity);
      window.removeEventListener('pointermove', trackActivity);
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (hitSyncRafRef.current) cancelAnimationFrame(hitSyncRafRef.current);

      cleanupCurrentModelAndEngine();

      if (app) {
        try {
          app.ticker?.stop();
          if (app.view) {
            if (onContextLost) app.view.removeEventListener('webglcontextlost', onContextLost);
            if (onContextRestored) app.view.removeEventListener('webglcontextrestored', onContextRestored);
          }
          app.destroy(true, { children: true, texture: true, baseTexture: true });
        } catch (_) {}
        app = null;
        pixiAppRef.current = null;
      }
    };
  }, [modelId]);

  return (
    <div className="live2d-root">
      {/* The PIXI rendering canvas — full-screen, pointer-events: none via CSS */}
      <div
        ref={containerRef}
        className={`live2d-canvas-container ${activeAnim !== 'none' ? `live2d-anim-${activeAnim}` : ''}`}
      />

      {/* The interactive hit-target div — tracks the model's exact bounding box via rAF.
          useClickThrough enables/disables Electron click-through on hover.
          ONLY this div captures pointer events; all transparent areas pass through to desktop. */}
      <div
        ref={hitTargetRef}
        className={`live2d-hit-target${isDragging ? ' dragging' : ''}`}
        {...interactiveProps}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        title="Arrastra a Cristi • Scroll para escalar • Clic derecho para menú"
        style={{ left: '-9999px', top: '-9999px', width: '1px', height: '1px' }} // Off-screen until model loads
      />

      {/* Loading overlay */}
      {!isLoaded && !loadError && (
        <div className="live2d-init-overlay">
          <div className="live2d-init-card">
            <span className="hud-corner hud-corner-tl" />
            <span className="hud-corner hud-corner-tr" />
            <span className="hud-corner hud-corner-bl" />
            <span className="hud-corner hud-corner-br" />

            <div className="live2d-init-spinner-box">
              <div className="live2d-init-spinner" />
              <Sparkles size={16} className="live2d-init-sparkle" />
            </div>

            <div className="live2d-init-text-group">
              <div className="live2d-init-title-row">
                <span className="live2d-init-badge">INITIALIZING</span>
                <h3 className="live2d-init-title">Invocando a Cristi</h3>
              </div>
              <p className="live2d-init-desc">
                Cargando modelo Live2D Cubism HD &amp; síntesis sensorial...
              </p>
            </div>

            <div className="live2d-init-progress-bar">
              <div className="live2d-init-progress-fill" />
            </div>
          </div>
        </div>
      )}

      {loadError && (
        <div className="live2d-error-fallback">
          <span>Error Live2D: {loadError}</span>
        </div>
      )}
    </div>
  );
}));
