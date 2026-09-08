/**
 * Cristi AI - Live2D Kinematic Engine Subsystem
 * 
 * Clean TypeScript architectural exports for the Live2D kinematic domain:
 * - Live2DCanvasEngine: WebGL2 PIXI Application v7 runtime, serialized model loader, texture recycling.
 * - AdaptiveTicker: Smart FPS regulator (60 FPS active -> 30 FPS idle -> 0 FPS suspended).
 * - HitboxSynchronizer: Viewport bounding box mapping for Electron click-through.
 * - ModelRegistry: Registry of 13 official Cubism models and semantic gesture mappings.
 * - MotionController: Animation poses and motion3 group triggering.
 */

export * from './Live2DCanvasEngine';
export * from './AdaptiveTicker';
export * from './HitboxSynchronizer';
export * from './ModelRegistry';
export * from './MotionController';

import { Live2DCanvasEngine, CanvasEngineConfig } from './Live2DCanvasEngine';

/**
 * Factory method to instantiate a new isolated Live2D Canvas Engine.
 */
export function createLive2DEngine(config: CanvasEngineConfig = {}): Live2DCanvasEngine {
  return new Live2DCanvasEngine(config);
}

/**
 * Singleton holder for application-wide Live2D canvas engine instance.
 */
let sharedEngineInstance: Live2DCanvasEngine | null = null;

/**
 * Retrieve or initialize the shared singleton Live2D engine instance.
 */
export function getLive2DEngine(config?: CanvasEngineConfig): Live2DCanvasEngine {
  if (!sharedEngineInstance) {
    sharedEngineInstance = new Live2DCanvasEngine(config);
  }
  return sharedEngineInstance;
}

/**
 * Reset or dispose the shared singleton engine instance.
 */
export function resetLive2DEngine(): void {
  if (sharedEngineInstance) {
    sharedEngineInstance.destroy();
    sharedEngineInstance = null;
  }
}
