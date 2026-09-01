/**
 * Cristi Desktop - Live2D Expression & Blendshape Manager 2.0
 * Provides robust facial expression transitions, blocked expression filtering (e.g. artist credits),
 * smooth Bezier target blending, and fallback parameter mappings for models without .exp3.json.
 */

import { live2dModelRegistry } from './Live2DModelRegistry.js';
import { logger } from '../logger.js';

export class ExpressionManager {
  constructor(adapter, modelId = 'yanderegirl') {
    this.adapter = adapter;
    this.modelId = modelId;
    this.currentExpression = 'none';
    this.lockedParams = new Set();
    this.lockExpiry = 0;
  }

  setModel(modelId, adapter) {
    this.modelId = modelId;
    if (adapter) this.adapter = adapter;
    this.currentExpression = 'none';
    this.lockedParams.clear();
    this.lockExpiry = 0;
  }

  setAdapter(adapter) {
    this.adapter = adapter;
  }

  /**
   * Check if expression is blocked (e.g. watermark overlay)
   * @param {string} expName 
   * @returns {boolean}
   */
  isBlocked(expName) {
    const profile = live2dModelRegistry.getModel(this.modelId);
    return profile?.blockedExpressions?.includes(expName) ?? false;
  }

  /**
   * Set facial expression with semantic action resolution & fallback
   * @param {string} expressionName 
   * @param {number} blendDurationMs 
   */
  setExpression(expressionName, blendDurationMs = 400) {
    if (!expressionName || expressionName.toLowerCase() === 'idle' || expressionName.toLowerCase() === 'none') {
      this.resetExpression();
      return;
    }

    if (this.isBlocked(expressionName)) {
      logger.info('AVATAR', `[ExpressionManager] Expresión "${expressionName}" bloqueada por perfil de seguridad.`);
      return;
    }

    const resolved = live2dModelRegistry.resolveSemanticAction(this.modelId, expressionName);

    if (resolved.type === 'expression' && resolved.name) {
      if (this.adapter) {
        this.adapter.setExpression(resolved.name);
      }
      this.currentExpression = resolved.name;
      this.lockedParams.clear();
      this.lockExpiry = 0;
    } else if (resolved.type === 'parameters' && resolved.targets) {
      this.lockedParams = new Set(Object.keys(resolved.targets));
      this.lockExpiry = performance.now() + 8000;
      if (this.adapter) {
        for (const [paramId, val] of Object.entries(resolved.targets)) {
          this.adapter.setBezierTarget(paramId, val, blendDurationMs);
        }
      }
      this.currentExpression = expressionName;
    }
  }

  /**
   * Reset to neutral baseline
   */
  resetExpression() {
    this.currentExpression = 'none';
    this.lockedParams.clear();
    this.lockExpiry = 0;
    if (this.adapter) {
      this.adapter.resetNeutralState();
    }
  }

  /**
   * Periodic tick check for expression lock expiration
   */
  update() {
    if (this.lockExpiry > 0 && performance.now() > this.lockExpiry) {
      this.lockedParams.clear();
      this.lockExpiry = 0;
    }
  }

  destroy() {
    this.lockedParams.clear();
    this.lockExpiry = 0;
    this.adapter = null;
  }
}
