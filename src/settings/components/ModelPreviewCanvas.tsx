import '@pixi/unsafe-eval';
/**
 * Cristi AI - Settings Model Live WebGL Preview Canvas (Pure Live2D Edition)
 * Ultra-responsive Live2D WebGL canvas with:
 * - Fluid GPU Pan (Left Click Drag)
 * - Smooth Wheel Zoom (Clamped, with e.preventDefault to prevent page scroll)
 * - Zoom In / Zoom Out / Reset View controls
 * - Interactive motion triggers on click
 * - 100% Shadcn Minimalist Dark Zinc styling
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import { live2dModelRegistry } from '../../domain/live2d/Live2DModelRegistry.js';
import { soundFxService } from '../../domain/audio/SoundFxService.js';

// Setup PIXI global flags
if (typeof window !== 'undefined') {
  window.PIXI = PIXI;
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

export interface ModelPreviewCanvasProps {
  modelId?: string;
  className?: string;
}

export const ModelPreviewCanvas: React.FC<ModelPreviewCanvasProps> = React.memo(function ModelPreviewCanvas({
  modelId = 'yanderegirl',
  className = ''
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const live2dModelRef = useRef<any>(null);
  const baseScaleRef = useRef(1);

  // Transform States
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Live2D WebGL Preview Lifecycle ─────────────────────────────────────────
  useEffect(() => {
    let isCancelled = false;
    let app: PIXI.Application | null = null;
    let model: any = null;
    let resizeObserver: ResizeObserver | null = null;

    setIsLoading(true);
    setLoadError(null);

    async function loadLive2D() {
      try {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = '';

        const width = containerRef.current.clientWidth || 280;
        const height = containerRef.current.clientHeight || 360;

        // Load Cubism Core runtime script if not present
        if (typeof window !== 'undefined' && !window.Live2DCubismCore) {
          await new Promise<void>((resolve) => {
            const script = document.createElement('script');
            script.src = resolveModelPath('live2dcubismcore.min.js');
            script.onload = () => resolve();
            script.onerror = () => resolve();
            document.head.appendChild(script);
          });
        }

        if (PIXI.settings) {
          PIXI.settings.ROUND_PIXELS = false;
          PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH;
        }

        const previewRes = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2.0);

        app = new PIXI.Application({
          width: Math.max(100, width),
          height: Math.max(100, height),
          backgroundAlpha: 0,
          backgroundColor: 0x000000,
          antialias: true,
          autoDensity: true,
          resolution: previewRes,
          powerPreference: 'high-performance'
        });

        if (isCancelled || !containerRef.current) {
          app.destroy(true);
          return;
        }

        const canvasEl = app.view as HTMLCanvasElement;
        if (canvasEl) {
          containerRef.current.appendChild(canvasEl);
        }
        pixiAppRef.current = app;

        // Obtain model path
        let resolvedPath = '';
        const profile = live2dModelRegistry.getModel(modelId);
        if (profile?.path) {
          resolvedPath = resolveModelPath(profile.path);
        } else {
          resolvedPath = resolveModelPath(`/models/live2d/${modelId}/${modelId}.model3.json`);
        }

        model = await (Live2DModel as any).from(resolvedPath, {
          autoInteract: false,
          idleMotionGroup: 'Idle'
        });

        if (isCancelled) {
          model.destroy({ texture: true, baseTexture: true });
          app.destroy(true);
          return;
        }

        // Supresión continua de partes y parámetros bloqueados en preview (específicos del modelo)
        const core = model.internalModel?.coreModel;
        const hiddenParts = Array.isArray(profile?.hiddenParts) ? profile.hiddenParts : [];
        const lockedParams = profile?.lockedParameters && typeof profile.lockedParameters === 'object' ? profile.lockedParameters : null;

        if (hiddenParts.length > 0 || lockedParams) {
          const suppressHidden = () => {
            if (!core) return;
            if (core._partIds && hiddenParts.length > 0) {
              for (const pId of hiddenParts) {
                const idx = core._partIds.indexOf(pId);
                if (idx !== -1) {
                  if (typeof core.setPartOpacityByIndex === 'function') core.setPartOpacityByIndex(idx, 0);
                  if (core._partOpacities) core._partOpacities[idx] = 0;
                }
              }
            }
            if (lockedParams && typeof core.setParameterValueById === 'function') {
              for (const [pId, val] of Object.entries(lockedParams)) {
                core.setParameterValueById(pId, val);
              }
            }
          };

          suppressHidden();
          app.ticker.add(suppressHidden);
        }

        live2dModelRef.current = model;
        app.stage.addChild(model);

        // Center and frame model
        const naturalWidth = model.width;
        const naturalHeight = model.height;

        const currentW = app.renderer.width / previewRes;
        const currentH = app.renderer.height / previewRes;

        const scaleX = (currentW * 0.85) / naturalWidth;
        const scaleY = (currentH * 0.85) / naturalHeight;
        const autoScale = Math.min(scaleX, scaleY);
        baseScaleRef.current = autoScale;

        model.scale.set(autoScale);
        model.anchor.set(0.5, 0.5);
        model.position.set(currentW / 2, currentH / 2);

        // Responsive Resize Observer
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width: newW, height: newH } = entry.contentRect;
            if (newW > 0 && newH > 0 && app?.renderer) {
              app.renderer.resize(newW, newH);
              if (model) {
                model.position.set(newW / 2 + pan.x, newH / 2 + pan.y);
              }
            }
          }
        });
        resizeObserver.observe(containerRef.current);

        setIsLoading(false);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('Error al cargar modelo Live2D en preview:', err);
        if (!isCancelled) {
          setLoadError(errorMsg || 'Error al procesar modelo Live2D');
          setIsLoading(false);
        }
      }
    }

    void loadLive2D();

    return () => {
      isCancelled = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (model) {
        try { model.destroy({ texture: true, baseTexture: true }); } catch (_) {}
      }
      if (app) {
        try { app.destroy(true); } catch (_) {}
      }
      pixiAppRef.current = null;
      live2dModelRef.current = null;
    };
  }, [modelId]);

  // Sync Zoom and Pan with PIXI model
  useEffect(() => {
    const model = live2dModelRef.current;
    const app = pixiAppRef.current;
    if (!model || !app) return;

    const res = app.renderer.resolution || 1;
    const currentW = app.renderer.width / res;
    const currentH = app.renderer.height / res;

    const finalScale = baseScaleRef.current * zoom;
    model.scale.set(finalScale);
    model.position.set(currentW / 2 + pan.x, currentH / 2 + pan.y);
  }, [zoom, pan]);

  // Native non-passive Wheel Listener (Blocks window & page zoom completely)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = -e.deltaY * 0.0018;
      setZoom((prev) => {
        const next = Math.max(0.4, Math.min(3.5, prev + delta));
        return Number(next.toFixed(2));
      });
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  // Mouse Drag Handler (Pan)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // View Controls
  const handleZoomIn = () => {
    soundFxService.playClick();
    setZoom((z) => Math.min(3.5, Number((z + 0.15).toFixed(2))));
  };

  const handleZoomOut = () => {
    soundFxService.playClick();
    setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))));
  };

  const handleResetView = () => {
    soundFxService.playClick();
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      className={`relative select-none overflow-hidden bg-zinc-950 border border-zinc-800 rounded-sm ${className}`}
      onMouseDown={handleMouseDown}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Floating Viewport Controls */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-20 bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/80 rounded-sm p-1 shadow-lg">
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-sm transition-colors"
          title="Acercar (Zoom In)"
        >
          <ZoomIn size={13} />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-sm transition-colors"
          title="Alejar (Zoom Out)"
        >
          <ZoomOut size={13} />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-sm transition-colors"
          title="Restablecer Vista"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Top Left Pan & Zoom Telemetry */}
      <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/80 rounded-sm px-2 py-0.5 text-[10px] font-mono text-zinc-400">
        <Move size={11} className="text-zinc-500" />
        <span>{Math.round(zoom * 100)}%</span>
      </div>

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm z-10 gap-2 font-mono text-xs text-zinc-400 pointer-events-none">
          <div className="w-4 h-4 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
          <span>Cargando avatar Live2D...</span>
        </div>
      )}

      {/* Load Error Card (Shadcn Dark Zinc) */}
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/92 backdrop-blur-sm p-6 z-10 select-none animate-in fade-in duration-200">
          <div className="w-full max-w-[260px] bg-zinc-900/90 border border-zinc-800 rounded-lg p-4 text-center flex flex-col items-center gap-2.5 shadow-xl">
            <div className="w-9 h-9 rounded-md bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <RotateCcw size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-200">No se pudo cargar el avatar</div>
              <p className="text-[11px] font-mono text-zinc-400 mt-0.5">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={handleResetView}
              className="mt-1 px-3 py-1.5 text-[11px] font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-md transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={11} />
              <span>Reintentar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default ModelPreviewCanvas;
