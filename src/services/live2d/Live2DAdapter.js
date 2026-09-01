/**
 * Cristi AI - Live2D Universal Adapter
 * Bridges semantic animation commands (head, body, eyes, brows, mouth, blush, breathing)
 * to model-specific parameter adjustments with smooth physical lerp interpolation.
 *
 * v2.1 — Added blockedExpressions support, setMotionByGroup(), and expression fallback.
 */

export class Live2DAdapter {
  constructor(modelInstance, capabilityMapping = {}, modelProfile = null) {
    this.model = modelInstance;
    this.mapping = capabilityMapping;
    this.profile = modelProfile;

    // Current smoothed parameter values and Target values
    this.currentValues = new Map();
    this.targetValues = new Map();

    // Active Bezier transitions: paramId -> { startVal, targetVal, startTime, durationMs, easing }
    this.bezierTransitions = new Map();

    // Expression state
    this.currentExpression = 'none';

    // Lerp speeds for different types of parameters
    this.speeds = {
      head: 0.20,
      body: 0.14,
      eyes: 0.38,
      eyeballs: 0.24,
      brows: 0.22,
      mouth: 0.50,
      breath: 0.16,
      physics: 0.35,
      custom: 0.22
    };

    // Auto-discover and resolve parameters from model if available
    this.autoDiscoverParameters();
  }

  /**
   * Introspects model core and fills missing standard mappings automatically
   */
  autoDiscoverParameters() {
    if (!this.model?.internalModel?.coreModel) return;
    const coreModel = this.model.internalModel.coreModel;
    const paramIds = Array.isArray(coreModel._parameterIds) ? coreModel._parameterIds : [];

    const standardPatterns = {
      head_angle_x: /angle.*x|head.*x/i,
      head_angle_y: /angle.*y|head.*y/i,
      head_angle_z: /angle.*z|head.*z/i,
      body_angle_x: /body.*x/i,
      body_angle_y: /body.*y/i,
      body_angle_z: /body.*z/i,
      eye_l_open: /eye.*l.*open/i,
      eye_r_open: /eye.*r.*open/i,
      eye_l_smile: /eye.*l.*smile/i,
      eye_r_smile: /eye.*r.*smile/i,
      eye_ball_x: /eye.*ball.*x/i,
      eye_ball_y: /eye.*ball.*y/i,
      brow_l_y: /brow.*l.*y/i,
      brow_r_y: /brow.*r.*y/i,
      brow_l_angle: /brow.*l.*angle/i,
      brow_r_angle: /brow.*r.*angle/i,
      mouth_open_y: /mouth.*open/i,
      mouth_form: /mouth.*form/i,
      cheek_blush: /cheek|blush/i,
      breath: /breath/i
    };

    for (const [cap, regex] of Object.entries(standardPatterns)) {
      if (!this.mapping[cap]) {
        const found = paramIds.find((p) => regex.test(p));
        if (found) {
          let min = -30, max = 30, def = 0;
          if (/eye|mouth|cheek|breath/i.test(cap)) {
            min = (/eye_ball|mouth_form|brow/i.test(cap)) ? -1 : 0;
            max = 1;
          }
          this.mapping[cap] = { paramId: found, min, max, default: def };
        }
      }
    }
  }

  /**
   * Smoothly transitions a parameter to target value using Cubic Bezier ease-in-out
   * @param {string} paramId 
   * @param {number} targetValue 
   * @param {number} durationMs 
   */
  setBezierTarget(paramId, targetValue, durationMs = 400) {
    if (!paramId) return;
    const current = this.currentValues.get(paramId) ?? 0;
    this.bezierTransitions.set(paramId, {
      startVal: current,
      targetVal: targetValue,
      startTime: performance.now(),
      durationMs: Math.max(durationMs, 50)
    });
    this.targetValues.set(paramId, targetValue);
  }

  /**
   * Update the capability mapping for this adapter
   * @param {Object} mapping
   * @param {Object} profile
   */
  setMapping(mapping, profile = null) {
    this.mapping = {};
    if (mapping) {
      for (const [cap, entry] of Object.entries(mapping)) {
        if (typeof entry === 'string') {
          let min = -30, max = 30, def = 0;
          if (cap.includes('eye_ball') || cap.includes('eye_l_open') || cap.includes('eye_r_open') || cap.includes('eye_l_smile') || cap.includes('eye_r_smile') || cap.includes('mouth') || cap.includes('cheek') || cap.includes('breath')) {
            min = (cap.includes('eye_ball') || cap.includes('mouth_form') || cap.includes('brow')) ? -1 : 0;
            max = 1;
          }
          this.mapping[cap] = { paramId: entry, min, max, default: def };
        } else if (typeof entry === 'object' && entry !== null) {
          this.mapping[cap] = entry;
        }
      }
    }
    if (profile) this.profile = profile;
    this.autoDiscoverParameters();
  }

  /**
   * Set target value for a standard capability
   * @param {string} capability - Capability key (e.g. 'head_angle_x', 'mouth_open_y')
   * @param {number} value - Target value
   */
  setCapabilityTarget(capability, value) {
    const mapEntry = this.mapping[capability];
    if (!mapEntry) return;

    const paramId = typeof mapEntry === 'string' ? mapEntry : mapEntry.paramId;
    const min = typeof mapEntry === 'object' && mapEntry.min !== undefined ? mapEntry.min : -30;
    const max = typeof mapEntry === 'object' && mapEntry.max !== undefined ? mapEntry.max : 30;
    const def = typeof mapEntry === 'object' && mapEntry.default !== undefined ? mapEntry.default : 0;

    const clamped = Math.min(Math.max(value, min), max);
    this.targetValues.set(paramId, clamped);

    if (!this.currentValues.has(paramId)) {
      this.currentValues.set(paramId, def);
    }
  }

  /**
   * Set target for a direct parameter ID (including custom parameters)
   * @param {string} paramId
   * @param {number} value
   */
  setDirectParamTarget(paramId, value) {
    if (!paramId) return;
    this.targetValues.set(paramId, value);
    if (!this.currentValues.has(paramId)) {
      this.currentValues.set(paramId, 0);
    }
  }

  // ── High-Level Semantic Controls ──────────────────────────────────────────

  setHeadAngle(x = 0, y = 0, z = 0) {
    this.setCapabilityTarget('head_angle_x', x);
    this.setCapabilityTarget('head_angle_y', y);
    this.setCapabilityTarget('head_angle_z', z);
  }

  setBodyAngle(x = 0, y = 0, z = 0) {
    this.setCapabilityTarget('body_angle_x', x);
    this.setCapabilityTarget('body_angle_y', y);
    this.setCapabilityTarget('body_angle_z', z);
  }

  setEyes(lOpen = 1, rOpen = 1, lSmile = 0, rSmile = 0, ballX = 0, ballY = 0) {
    this.setCapabilityTarget('eye_l_open', lOpen);
    this.setCapabilityTarget('eye_r_open', rOpen);
    this.setCapabilityTarget('eye_l_smile', lSmile);
    this.setCapabilityTarget('eye_r_smile', rSmile);
    this.setCapabilityTarget('eye_ball_x', ballX);
    this.setCapabilityTarget('eye_ball_y', ballY);
  }

  setEyebrows(lY = 0, rY = 0, lAngle = 0, rAngle = 0, lForm = 0, rForm = 0) {
    this.setCapabilityTarget('brow_l_y', lY);
    this.setCapabilityTarget('brow_r_y', rY);
    this.setCapabilityTarget('brow_l_angle', lAngle);
    this.setCapabilityTarget('brow_r_angle', rAngle);
    this.setCapabilityTarget('brow_l_form', lForm);
    this.setCapabilityTarget('brow_r_form', rForm);
  }

  setMouth(openY = 0, form = 0) {
    this.setCapabilityTarget('mouth_open_y', openY);
    this.setCapabilityTarget('mouth_form', form);
  }

  setCheeks(blush = 0) {
    this.setCapabilityTarget('cheek_blush', blush);
  }

  setBreath(value = 0) {
    this.setCapabilityTarget('breath', value);
  }

  /**
   * Check if an expression is blocked by this model's profile
   * (e.g., artist credit overlays like Ellen's 'shuiyin')
   * @param {string} expressionName
   * @returns {boolean}
   */
  isExpressionBlocked(expressionName) {
    const blocked = this.profile?.blockedExpressions;
    if (!blocked || !Array.isArray(blocked)) return false;
    return blocked.includes(expressionName);
  }

  /**
   * Set expression on the Live2D model.
   * Checks blockedExpressions first, then falls back to parameter targets if no expressionManager.
   * @param {string} expressionName
   */
  setExpression(expressionName) {
    // Guard: refuse to activate blocked expressions (e.g., artist credit overlays)
    if (expressionName && expressionName !== 'none' && expressionName !== 'idle') {
      if (this.isExpressionBlocked(expressionName)) {
        console.info(`[Live2DAdapter] Expression "${expressionName}" is blocked (artist credit overlay). Skipping.`);
        return;
      }
    }

    if (!this.model?.internalModel?.motionManager) return;

    try {
      const expManager = this.model.internalModel.motionManager.expressionManager;

      if (!expressionName || expressionName.toLowerCase() === 'idle' || expressionName.toLowerCase() === 'none') {
        // Reset: clear expression manager and reset parameter targets
        if (expManager) {
          expManager.resetExpression();
        }
        this.currentExpression = 'none';
        return;
      }

      if (expManager && expManager.definitions && expManager.definitions.length > 0) {
        // Cubism expressionManager exists — use it directly
        this.model.expression(expressionName);
        this.currentExpression = expressionName;
      } else {
        // No expressionManager loaded — this model has no Expressions section in model3.json
        // Fallback: check if profile semanticActions has a parameter target for this expression
        const action = this.profile?.semanticActions?.[expressionName];
        if (action?.type === 'parameters' && action.targets) {
          for (const [paramId, val] of Object.entries(action.targets)) {
            this.setDirectParamTarget(paramId, val);
          }
          this.currentExpression = expressionName;
        } else {
          console.warn(`[Live2DAdapter] No expressionManager and no parameter fallback for "${expressionName}"`);
        }
      }
    } catch (e) {
      console.warn(`[Live2DAdapter] Failed to set expression "${expressionName}":`, e);
    }
  }

  /**
   * Trigger a motion by group name and index using the Live2D model's motion API.
   * @param {string} groupName - Motion group as declared in model3.json (e.g. 'Idle', 'Tap', 'Flick')
   * @param {number} index - Index within the group (0-based)
   */
  setMotionByGroup(groupName, index = 0) {
    if (!this.model) return;
    try {
      // pixi-live2d-display: model.motion(group, index)
      this.model.motion(groupName, index);
    } catch (e) {
      console.warn(`[Live2DAdapter] Failed to trigger motion "${groupName}[${index}]":`, e);
    }
  }

  /**
   * Reset all parameter targets back to their neutral / resting values
   */
  resetNeutralState() {
    this.setExpression('none');
    this.setCheeks(0);
    this.setEyebrows(0, 0, 0, 0, 0, 0);
    this.setEyes(1.0, 1.0, 0, 0, 0, 0);
    this.setMouth(0, 0);
  }

  /**
   * Called every animation frame to apply smoothed target parameters to the underlying model
   */
  update(deltaTime = 1.0) {
    if (!this.model?.internalModel?.coreModel) return;

    const coreModel = this.model.internalModel.coreModel;

    // Enforce profile hidden parts (e.g. Part17 watermark layer in Ellen)
    if (this.profile?.hiddenParts && Array.isArray(this.profile.hiddenParts) && coreModel._partIds) {
      for (const partId of this.profile.hiddenParts) {
        const idx = coreModel._partIds.indexOf(partId);
        if (idx !== -1) {
          if (typeof coreModel.setPartOpacityByIndex === 'function') {
            coreModel.setPartOpacityByIndex(idx, 0);
          }
          if (coreModel._partOpacities) {
            coreModel._partOpacities[idx] = 0;
          }
        }
      }
    }

    const now = performance.now();

    for (const [paramId, targetVal] of this.targetValues.entries()) {
      const currentVal = this.currentValues.get(paramId) || 0;
      let nextVal;

      // 1. Check if an active Cubic Bezier transition is running for this parameter
      const bezier = this.bezierTransitions.get(paramId);
      if (bezier) {
        const elapsed = now - bezier.startTime;
        const t = Math.min(Math.max(elapsed / bezier.durationMs, 0), 1);
        
        // Cubic Bezier easeInOut: 3t^2 - 2t^3
        const ease = t * t * (3 - 2 * t);
        nextVal = bezier.startVal + (bezier.targetVal - bezier.startVal) * ease;

        if (t >= 1) {
          this.bezierTransitions.delete(paramId);
          nextVal = bezier.targetVal;
        }
      } else {
        // 2. Exponential Lerp - frame-rate normalized for 60Hz-240Hz
        let speed = this.speeds.custom;
        const lower = paramId.toLowerCase();
        if (lower.includes('mouth')) speed = this.speeds.mouth;
        else if (lower.includes('eyeopen') || lower.includes('eyesmile')) speed = this.speeds.eyes;
        else if (lower.includes('eyeball')) speed = this.speeds.eyeballs;
        else if (lower.includes('angle') && !lower.includes('body')) speed = this.speeds.head;
        else if (lower.includes('body')) speed = this.speeds.body;
        else if (lower.includes('brow')) speed = this.speeds.brows;
        else if (lower.includes('breath')) speed = this.speeds.breath;
        else if (lower.includes('hair') || lower.includes('cloth') || lower.includes('ribbon') || lower.includes('tail')) speed = this.speeds.physics;

        const dtSec = Math.max(0, (deltaTime * 16.6667) / 1000);
        const factor = 1.0 - Math.exp(-speed * 90.0 * dtSec);
        nextVal = currentVal + (targetVal - currentVal) * factor;
      }

      this.currentValues.set(paramId, nextVal);

      // Direct write to Cubism CoreModel safely
      try {
        if (typeof coreModel.setParameterValueById === 'function') {
          coreModel.setParameterValueById(paramId, nextVal);
        } else if (typeof this.model.internalModel.setParamFloat === 'function') {
          this.model.internalModel.setParamFloat(paramId, nextVal);
        }
      } catch (_) {}
    }
  }

  /**
   * Release references and clear transition maps
   */
  destroy() {
    this.currentValues.clear();
    this.targetValues.clear();
    this.bezierTransitions.clear();
    this.model = null;
    this.mapping = {};
    this.profile = null;
  }
}

