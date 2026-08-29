import React, {
  useEffect, useRef, useState, useCallback,
  useImperativeHandle, forwardRef
} from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { logger } from '../services/logger';

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

  // Gaze tracking state (smooth lerped normal coords -1 to 1)
  const mousePosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const gazeRef = useRef({ x: 0, y: 0 });

  // References for live tick access
  const gestureRef = useRef(gesture);
  const lipSyncRef = useRef(lipSyncValue);
  const isSpeakingRef = useRef(isSpeaking);
  const viewModeRef = useRef(viewMode);
  gestureRef.current = gesture;
  lipSyncRef.current = lipSyncValue;
  isSpeakingRef.current = isSpeaking;
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
    reapplyLayout: () => applyLayout(modelRef.current, pixiAppRef.current, viewModeRef.current)
  }), [moveTo, applyLayout]);

  // ── Native Expression & Emotion Handling (IN-PLACE, NEVER CHANGES X/Y) ───
  useEffect(() => {
    const model = modelRef.current;
    if (!model || !model.internalModel?.motionManager) return;

    const g = gesture.toLowerCase();

    // 1. Trigger native Cubism expression
    try {
      if (g === 'yandere') {
        model.expression('Yandere');
      } else if (g === 'crazy') {
        model.expression('Crazy');
      } else if (g === 'pout' || g === 'mad') {
        model.expression('Mad');
      } else if (g === 'surprised') {
        model.expression('Scared');
      } else {
        if (model.internalModel.motionManager.expressionManager) {
          model.internalModel.motionManager.expressionManager.resetExpression();
        }
      }
    } catch (_) {}

    // 2. Trigger micro-animation impulse IN-PLACE without moving her position!
    const animMap = {
      happy:     'bounce',
      blush:     'float',
      wink:      'float',
      dance:     'dance',
      surprised: 'bounce',
      yandere:   'shake',
      crazy:     'bounce',
    };

    const anim = animMap[g];
    if (anim) {
      setActiveAnim(anim);
      setTimeout(() => setActiveAnim('none'), 1200);
    }
  }, [gesture]);

  // ── Hit-Testing Helper (Uses actual model bounding box) ───────────────────
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

  // ── Precise Drag Handlers (Starts only on model, preserves exact drop position) ─
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
      onModelContextMenu(e);
    }
  }, [isPointerOverModel, onModelContextMenu]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };

      if (!dragRef.current.active) {
        setIsHoveringModel(isPointerOverModel(e.clientX, e.clientY));
      }

      if (dragRef.current.active && modelRef.current) {
        const dx = e.clientX - dragRef.current.startMouseX;
        const dy = e.clientY - dragRef.current.startMouseY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          dragRef.current.hasMoved = true;
        }

        // Direct position update without snaps or bounds constraint
        modelRef.current.x = dragRef.current.startModelX + dx;
        modelRef.current.y = dragRef.current.startModelY + dy;
      }
    };

    const handleMouseUp = () => {
      if (dragRef.current.active) {
        dragRef.current.active = false;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPointerOverModel]);

  // ── PIXI & Model Lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    let app = null;
    let model = null;
    let resizeHandler = null;

    async function init() {
      if (!containerRef.current) return;

      try {
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

        // Clean any leftover canvas elements inside container
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild);
        }

        // Create PIXI Application with fresh managed canvas
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

        logger.info('SYSTEM', 'Cargando modelo Live2D Cubism (YandereGirl)...');

        model = await Live2DModel.from(
          '/models/live2d/yanderegirl/yanderegirl.model3.json',
          {
            autoInteract: false,
            autoUpdate: true
          }
        );

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

        applyLayout(model, app, viewModeRef.current);

        resizeHandler = () => {
          if (!app?.renderer || !model) return;
          try {
            app.renderer.resize(window.innerWidth, window.innerHeight);
            applyLayout(model, app, viewModeRef.current);
          } catch (_) {}
        };
        window.addEventListener('resize', resizeHandler);

        // ── Real-Time Accurate Face-Centered Gaze Tracking & Lip Sync Loop ──
        app.ticker.add(() => {
          if (!model?.internalModel?.coreModel) return;

          const core = model.internalModel.coreModel;
          const bounds = model.getBounds();

          // Compute Face Center coordinates dynamically relative to where she is on screen
          const faceCenterX = bounds.x + bounds.width * 0.5;
          const faceCenterY = bounds.y + bounds.height * 0.28; // Face is at ~28% height of model

          // Vector from face center to mouse pointer
          const dx = mousePosRef.current.x - faceCenterX;
          const dy = mousePosRef.current.y - faceCenterY;

          // Normalized coordinates (-1 to 1)
          const targetNormX = Math.max(-1, Math.min(1, dx / (window.innerWidth * 0.42)));
          const targetNormY = Math.max(-1, Math.min(1, dy / (window.innerHeight * 0.42)));

          // Smooth interpolation (lerp) for natural human-like eye/head movement
          gazeRef.current.x += (targetNormX - gazeRef.current.x) * 0.12;
          gazeRef.current.y += (targetNormY - gazeRef.current.y) * 0.12;

          const gx = gazeRef.current.x;
          const gy = gazeRef.current.y;

          // Apply head angles:
          // X: Positive is Turn Right, Negative is Turn Left
          // Y: Positive is Look UP, Negative is Look DOWN (inverted screen Y)
          try {
            if (typeof core.setParameterValueById === 'function') {
              core.setParameterValueById('ParamAngleX', gx * 28);
              core.setParameterValueById('ParamAngleY', -gy * 22); // Correct direction!
              core.setParameterValueById('ParamAngleZ', gx * -8);
              core.setParameterValueById('ParamEyeBallX', gx * 0.85);
              core.setParameterValueById('ParamEyeBallY', -gy * 0.85); // Correct direction!
              core.setParameterValueById('ParamBodyAngleX', gx * 8);
            }
          } catch (_) {}

          // Dynamic lip-sync when speaking
          const isSpk = isSpeakingRef.current;
          const lip = lipSyncRef.current;

          if (isSpk && core) {
            const mouthVal = Math.min(1, lip * 2.4);
            try {
              if (typeof core.setParameterValueById === 'function') {
                core.setParameterValueById('ParamMouthOpenY', mouthVal);
              }
            } catch (_) {}
          }

          // Special gesture overrides
          const g = gestureRef.current;
          if (g === 'wink') {
            try {
              core.setParameterValueById('ParamEyeROpen', 0);
              core.setParameterValueById('ParamEyeRSmile', 1);
            } catch (_) {}
          } else if (g === 'blush' || g === 'happy') {
            try {
              core.setParameterValueById('ParamCheek', 1.0);
              core.setParameterValueById('ParamEyeLSmile', 1.0);
              core.setParameterValueById('ParamEyeRSmile', 1.0);
            } catch (_) {}
          }
        });

        setIsLoaded(true);
        logger.info('SYSTEM', '¡Modelo Live2D de Cristi cargado e inicializado con éxito!');
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
  }, [applyLayout]);

  return (
    <div className="live2d-root">
      {/* Container where PIXI appends its fresh canvas */}
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
