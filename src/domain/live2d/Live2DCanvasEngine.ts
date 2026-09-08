/**
 * Cristi AI - Live2D Kinematic Canvas Engine v4
 * 
 * High-performance WebGL2 Live2D orchestration engine:
 * - Clean PIXI Application (v7) initialization with WebGL2 preference.
 * - Safe destruction and WebGL texture recycling with model.destroy({ children: true, texture: true, baseTexture: true })
 *   and PIXI.utils.clearTextureCache() guaranteeing zero memory leaks during model transitions.
 * - Serialized Promise queue for model loading to prevent GPU race conditions.
 * - Full WebGL context loss and recovery management (webglcontextlost / webglcontextrestored).
 * - Tightly integrates AdaptiveTicker, HitboxSynchronizer, MotionController, and ModelRegistry.
 */

import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { AdaptiveTicker, FpsMode } from './AdaptiveTicker';
import { HitboxSynchronizer, HitboxRect } from './HitboxSynchronizer';
import { MotionController, MotionPriority } from './MotionController';
import { ModelRegistry, modelRegistry, ModelDescriptor } from './ModelRegistry';

// ── Global PIXI & Live2D Engine Configuration ────────────────────────────────
if (typeof window !== 'undefined') {
  (window as any).PIXI = PIXI;
  if (PIXI.settings) {
    PIXI.settings.PREFER_ENV = PIXI.ENV.WEBGL2;
    PIXI.settings.ROUND_PIXELS = false;
    PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH;
    (PIXI.settings as any).MIPMAP_MODES = PIXI.MIPMAP_MODES.OFF;
  }

  if (PIXI.DisplayObject && !(PIXI.DisplayObject.prototype as any).isInteractive) {
    (PIXI.DisplayObject.prototype as any).isInteractive = function () {
      return false;
    };
  }
  if (Live2DModel?.prototype && !(Live2DModel.prototype as any).isInteractive) {
    (Live2DModel.prototype as any).isInteractive = function () {
      return false;
    };
  }
}

try {
  Live2DModel.registerTicker(PIXI.Ticker as any);
} catch (_) {}

export type CompanionViewMode = 'torso' | 'full';

export interface CanvasEngineConfig {
  /** Target container element for the WebGL canvas */
  container?: HTMLElement | null;
  /** Interactive hit-target element or selector for click-through */
  hitTarget?: HTMLElement | string | null;
  /** Initial model identifier (default: 'yanderegirl') */
  initialModelId?: string;
  /** Camera framing view mode (default: 'torso') */
  viewMode?: CompanionViewMode;
  /** Custom canvas resolution multiplier (capped at 2.0) */
  resolution?: number;
  /** Callback fired when model finishes loading and is mounted */
  onModelLoaded?: (model: Live2DModel, descriptor: ModelDescriptor) => void;
  /** Callback fired on model loading error */
  onModelError?: (error: Error) => void;
  /** Callback fired on WebGL context loss */
  onContextLost?: () => void;
  /** Callback fired on WebGL context restoration */
  onContextRestored?: () => void;
  /** Callback fired when FPS mode transitions */
  onFpsModeChange?: (mode: FpsMode, fps: number) => void;
}

export class Live2DCanvasEngine {
  private app: PIXI.Application | null = null;
  private currentModel: Live2DModel | null = null;
  private currentModelId: string = 'yanderegirl';
  private viewMode: CompanionViewMode = 'torso';
  private userScale: number = 1.0;
  private baseScale: number = 1.0;

  // Subsystems
  public readonly ticker: AdaptiveTicker;
  public readonly hitbox: HitboxSynchronizer;
  public readonly motion: MotionController;
  public readonly registry: ModelRegistry;

  // Concurrency & WebGL State
  private loadQueue: Promise<unknown> = Promise.resolve();
  private loadToken: number = 0;
  private isContextLost: boolean = false;
  private isDestroyed: boolean = false;
  private config: CanvasEngineConfig;

  // DOM references
  private containerElement: HTMLElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private boundOnTick: ((delta: number) => void) | null = null;
  private boundContextLost: ((e: Event) => void) | null = null;
  private boundContextRestored: ((e: Event) => void) | null = null;

  constructor(config: CanvasEngineConfig = {}) {
    this.config = config;
    this.currentModelId = config.initialModelId ?? 'yanderegirl';
    this.viewMode = config.viewMode ?? 'torso';
    this.registry = modelRegistry;

    this.ticker = new AdaptiveTicker({
      activeFps: 60,
      idleFps: 30,
      inactivityThresholdMs: 4500,
      autoListenDom: true,
      onFpsModeChange: (mode, fps) => {
        this.config.onFpsModeChange?.(mode, fps);
      },
    });

    this.hitbox = new HitboxSynchronizer({
      targetSelector: typeof config.hitTarget === 'string' ? config.hitTarget : undefined,
      targetElement: typeof config.hitTarget === 'object' ? config.hitTarget : null,
    });

    this.motion = new MotionController({
      modelId: this.currentModelId,
    });

    if (config.container) {
      this.initialize(config.container);
    }
  }

  /**
   * Initialize PIXI Application v7 with WebGL2 preference and append to container.
   */
  public async initialize(container: HTMLElement): Promise<void> {
    if (this.app) {
      console.warn('[Live2DCanvasEngine] Already initialized. Destroy before re-initializing.');
      return;
    }

    this.containerElement = container;
    this.isDestroyed = false;

    const width = container.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const height = container.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 720);

    const deviceRatio = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const renderResolution = Math.min(Math.max(this.config.resolution ?? deviceRatio, 1), 2.0);

    // Create PIXI v7 Application
    this.app = new PIXI.Application({
      width,
      height,
      backgroundAlpha: 0,
      backgroundColor: 0x000000,
      antialias: true,
      autoDensity: true,
      autoStart: true,
      resolution: renderResolution,
      clearBeforeRender: true,
      preserveDrawingBuffer: false, // Save ~40% GPU memory & avoid backbuffer copy
      powerPreference: 'high-performance',
    });

    // Configure WebGL Canvas View
    this.canvasElement = this.app.view as HTMLCanvasElement;
    if (this.canvasElement) {
      this.canvasElement.style.width = '100%';
      this.canvasElement.style.height = '100%';
      this.canvasElement.style.position = 'absolute';
      this.canvasElement.style.top = '0';
      this.canvasElement.style.left = '0';
      this.canvasElement.style.pointerEvents = 'none'; // Canvas never captures pointer events

      // Setup WebGL Context Lost & Restored listeners
      this.setupContextHandling(this.canvasElement);

      container.appendChild(this.canvasElement);
    }

    // Attach AdaptiveTicker to PIXI Ticker
    this.ticker.attachTicker(this.app.ticker);

    // Connect animation and kinetics update loop
    this.boundOnTick = (delta: number) => {
      this.onTick(delta);
    };
    this.app.ticker.add(this.boundOnTick);

    // Load initial model if specified
    if (this.currentModelId) {
      await this.loadModel(this.currentModelId);
    }
  }

  /**
   * Setup WebGL Context Loss and Restoration handlers.
   */
  private setupContextHandling(canvas: HTMLCanvasElement): void {
    this.boundContextLost = (e: Event) => {
      e.preventDefault(); // Crucial: prevents WebGL context permanent death
      this.isContextLost = true;
      this.ticker.setBossKey(true); // Suspend ticker to 0 FPS
      console.warn('[Live2DCanvasEngine] WebGL context lost! Execution suspended.');
      this.config.onContextLost?.();
    };

    this.boundContextRestored = async () => {
      console.info('[Live2DCanvasEngine] WebGL context restored! Recovering pipeline...');
      this.isContextLost = false;
      this.ticker.setBossKey(false); // Resume ticker
      this.config.onContextRestored?.();

      // Reload current model to re-allocate textures
      if (this.currentModelId && !this.isDestroyed) {
        await this.loadModel(this.currentModelId);
      }
    };

    canvas.addEventListener('webglcontextlost', this.boundContextLost as EventListener, false);
    canvas.addEventListener('webglcontextrestored', this.boundContextRestored as EventListener, false);
  }

  /**
   * Serialized Promise queue to load a Live2D Cubism model safely without GPU race conditions.
   * Supressed/canceled requests immediately recycle WebGL textures with zero memory leaks.
   */
  public loadModel(modelIdOrPath: string): Promise<Live2DModel | null> {
    if (this.isDestroyed || !this.app) {
      return Promise.resolve(null);
    }

    const token = ++this.loadToken;
    const descriptor = this.registry.getModel(modelIdOrPath);
    const resolvedPath = this.registry.resolveModelPath(descriptor.path);
    this.currentModelId = descriptor.id;

    const operation = this.loadQueue.then(async () => {
      if (token !== this.loadToken || this.isDestroyed) {
        return null;
      }

      // 1. Unload previous model & clear texture cache immediately
      this.unloadCurrentModel();

      try {
        // 2. Load model from path using pixi-live2d-display
        const loadedModel = await Live2DModel.from(resolvedPath, {
          autoInteract: false,
          autoUpdate: false,
        });

        // If a subsequent model load arrived while loading, destroy immediately
        if (token !== this.loadToken || this.isDestroyed) {
          this.destroyModelInstance(loadedModel);
          return null;
        }

        // 3. Pre-decode WebGL textures to prevent black frames or hitching
        await this.preDecodeTextures(loadedModel);

        if (token !== this.loadToken || this.isDestroyed) {
          this.destroyModelInstance(loadedModel);
          return null;
        }

        // 4. Configure bilinear texture filtering
        this.configureTextures(loadedModel);

        // 5. Apply descriptor specifics (hiddenParts, lockedParameters)
        this.applyModelDescriptorConstraints(loadedModel, descriptor);

        // 6. Disable internal PIXI pointer events (handled externally by HTML hitbox)
        loadedModel.interactive = false;
        loadedModel.interactiveChildren = false;
        loadedModel.eventMode = 'none';
        if (loadedModel.internalModel) {
          try {
            (loadedModel.internalModel as any).interactive = false;
          } catch (_) {}
        }

        // 7. Attach to stage
        this.app!.stage.interactiveChildren = false;
        this.app!.stage.eventMode = 'none';
        this.app!.stage.addChild(loadedModel as any);
        this.currentModel = loadedModel;

        // 8. Bind to MotionController
        this.motion.setModel(loadedModel, descriptor.id);

        // 9. Position and scale according to viewMode
        this.applyLayout();

        // 10. Prime WebGL pipeline with two warmup renders
        loadedModel.update(16);
        this.app!.renderer.render(this.app!.stage);

        requestAnimationFrame(() => {
          if (token !== this.loadToken || this.isDestroyed || !this.currentModel) return;
          this.currentModel.update(16);
          this.app?.renderer.render(this.app.stage);
          this.hitbox.sync(this.currentModel, this.app);
          this.config.onModelLoaded?.(this.currentModel, descriptor);
        });

        return loadedModel;
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(`[Live2DCanvasEngine] Failed loading model "${descriptor.name}":`, error);
        this.config.onModelError?.(error);
        return null;
      }
    });

    this.loadQueue = operation.catch(() => {});
    return operation;
  }

  /**
   * Pre-decode image sources before WebGL texture creation to eliminate stutter.
   */
  private async preDecodeTextures(model: Live2DModel): Promise<void> {
    const textures = [...(model.textures || []), ...((model.internalModel as any)?.textures || [])];

    await Promise.all(
      textures.map((tex) => {
        const src = tex?.baseTexture?.resource?.source;
        if (src instanceof HTMLImageElement && !src.complete) {
          return new Promise<void>((resolve) => {
            src.onload = () => resolve();
            src.onerror = () => resolve();
            if (typeof src.decode === 'function') {
              src.decode().then(() => resolve()).catch(() => resolve());
            }
          });
        }
        return Promise.resolve();
      })
    );
  }

  /**
   * Configure high-fidelity linear filtering on model textures.
   */
  private configureTextures(model: Live2DModel): void {
    const textures = [...(model.textures || []), ...((model.internalModel as any)?.textures || [])];
    for (const tex of textures) {
      if (tex?.baseTexture) {
        tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
        tex.baseTexture.wrapMode = PIXI.WRAP_MODES.CLAMP;
        tex.baseTexture.update();
      }
    }
  }

  /**
   * Apply descriptor rules like hidden parts (watermarks) and locked parameters.
   */
  private applyModelDescriptorConstraints(model: Live2DModel, descriptor: ModelDescriptor): void {
    const core = model.internalModel?.coreModel as any;
    if (!core) return;

    if (descriptor.hiddenParts && Array.isArray(descriptor.hiddenParts) && core._partIds) {
      for (const pId of descriptor.hiddenParts) {
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

  /**
   * Destroys a Live2DModel instance and cleans all textures from PIXI caches.
   */
  private destroyModelInstance(model: Live2DModel): void {
    try {
      model.destroy({
        children: true,
        texture: true,
        baseTexture: true,
      });
    } catch (_) {}

    try {
      PIXI.utils.clearTextureCache();
    } catch (_) {}

    if (this.app?.renderer) {
      try {
        (this.app.renderer as any).texture?.reset?.();
        (this.app.renderer as any).textureGC?.run?.();
      } catch (_) {}
    }
  }

  /**
   * Safely unloads and frees current model textures with 0 leaks.
   */
  public unloadCurrentModel(): void {
    if (this.currentModel) {
      if (this.app?.stage) {
        this.app.stage.removeChild(this.currentModel as any);
      }
      this.destroyModelInstance(this.currentModel);
      this.currentModel = null;
      this.motion.setModel(null);
      this.hitbox.clear();
    }
  }

  /**
   * Layout framing for viewMode (torso vs full) and user scaling.
   */
  public applyLayout(): void {
    if (!this.currentModel || !this.app?.screen) return;

    const stageW = this.app.screen.width || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const stageH = this.app.screen.height || (typeof window !== 'undefined' ? window.innerHeight : 720);
    const origH = (this.currentModel.internalModel as any)?.originalHeight || 2000;

    if (this.viewMode === 'torso') {
      this.baseScale = (stageH * 1.55) / origH;
      this.currentModel.scale.set(this.baseScale * this.userScale);
      this.currentModel.x = (stageW - this.currentModel.width) * 0.5;
      this.currentModel.y = stageH * 0.08;
    } else {
      this.baseScale = (stageH * 0.90) / origH;
      this.currentModel.scale.set(this.baseScale * this.userScale);
      this.currentModel.x = (stageW - this.currentModel.width) * 0.5;
      this.currentModel.y = stageH * 0.05;
    }

    this.hitbox.sync(this.currentModel, this.app);
  }

  /**
   * Main per-frame kinetic tick.
   */
  private onTick(delta: number): void {
    if (this.isDestroyed || this.isContextLost || !this.currentModel) return;

    const deltaMs = this.app?.ticker?.deltaMS || delta * 16.6667;
    this.currentModel.update(deltaMs);
  }

  /**
   * Set user camera framing viewMode ('torso' | 'full').
   */
  public setViewMode(mode: CompanionViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.applyLayout();
  }

  /**
   * Set user scaling multiplier.
   */
  public setUserScale(scale: number): void {
    this.userScale = Math.max(0.2, Math.min(3.0, scale));
    this.applyLayout();
  }

  /**
   * Trigger emotional gesture or expression.
   */
  public setGesture(gestureName: string): void {
    if (!this.currentModel) return;

    const action = this.registry.resolveSemanticAction(this.currentModelId, gestureName);

    if (action.type === 'expression') {
      try {
        this.currentModel.expression(action.name);
      } catch (_) {}
    } else if (action.type === 'parameters') {
      const core = this.currentModel.internalModel?.coreModel as any;
      if (core) {
        for (const [paramId, val] of Object.entries(action.targets)) {
          if (typeof core.setParameterValueById === 'function') {
            core.setParameterValueById(paramId, val);
          }
        }
      }
    } else if (action.type === 'motion') {
      this.motion.playMotion(action.group, action.index, MotionPriority.NORMAL);
    }
  }

  /**
   * Directly modulate mouth opening for reactive lip-sync.
   */
  public setLipSync(value: number): void {
    if (!this.currentModel) return;
    const core = this.currentModel.internalModel?.coreModel as any;
    if (!core) return;

    const descriptor = this.registry.getModel(this.currentModelId);
    const mouthParam = descriptor.standardMapping?.mouth_open_y || 'ParamMouthOpenY';

    const clamped = Math.max(0, Math.min(1, value));
    if (typeof core.setParameterValueById === 'function') {
      core.setParameterValueById(mouthParam, clamped);
    }
  }

  /**
   * Trigger manual canvas resize.
   */
  public resize(width: number, height: number): void {
    if (!this.app || this.isDestroyed) return;
    this.app.renderer.resize(width, height);
    this.applyLayout();
  }

  /**
   * Retrieve active Live2DModel.
   */
  public getModel(): Live2DModel | null {
    return this.currentModel;
  }

  /**
   * Retrieve active PIXI.Application instance.
   */
  public getPixiApp(): PIXI.Application | null {
    return this.app;
  }

  /**
   * Get current hitbox bounding box.
   */
  public getHitboxBounds(): HitboxRect | null {
    return this.hitbox.getCurrentRect();
  }

  /**
   * Clean destruction of all WebGL resources, listeners, and references.
   */
  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.canvasElement && this.boundContextLost && this.boundContextRestored) {
      this.canvasElement.removeEventListener('webglcontextlost', this.boundContextLost as EventListener);
      this.canvasElement.removeEventListener('webglcontextrestored', this.boundContextRestored as EventListener);
    }

    if (this.app?.ticker && this.boundOnTick) {
      this.app.ticker.remove(this.boundOnTick);
    }

    this.ticker.destroy();
    this.hitbox.destroy();
    this.motion.destroy();

    this.unloadCurrentModel();

    if (this.app) {
      try {
        this.app.destroy(true, { children: true, texture: true, baseTexture: true });
      } catch (_) {}
      this.app = null;
    }

    this.containerElement = null;
    this.canvasElement = null;
    this.boundOnTick = null;
    this.boundContextLost = null;
    this.boundContextRestored = null;
  }
}
