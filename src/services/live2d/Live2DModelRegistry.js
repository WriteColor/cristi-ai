/**
 * Cristi AI - Extensible Live2D Model Registry & Capability Mapping Engine
 * Allows registering, validating, discovering, and switching Live2D Cubism models
 * without coupling the core AI or animation logic to specific parameter IDs.
 */

import { ALL_MODEL_PROFILES, MODEL_PROFILES_MAP } from './models';

export class Live2DModelRegistry {
  constructor() {
    this.models = new Map();
    this.activeModelId = 'yanderegirl';

    // Register all discovered model profiles
    for (const profile of ALL_MODEL_PROFILES) {
      this.registerModel(profile);
    }
  }

  /**
   * Register a new Live2D Model descriptor
   * @param {Object} modelConfig 
   */
  registerModel(modelConfig) {
    if (!modelConfig.id || !modelConfig.path) {
      throw new Error('[Live2DModelRegistry] Model must have an id and path.');
    }
    this.models.set(modelConfig.id, {
      ...modelConfig,
      registeredAt: Date.now()
    });
    return this.models.get(modelConfig.id);
  }

  /**
   * Get model configuration by ID
   * @param {string} id 
   */
  getModel(id) {
    return this.models.get(id) || this.models.get(this.activeModelId) || this.models.get('yanderegirl');
  }

  /**
   * Get all registered models
   */
  getAllModels() {
    return Array.from(this.models.values());
  }

  /**
   * Set active model ID
   * @param {string} id 
   */
  setActiveModel(id) {
    if (this.models.has(id)) {
      this.activeModelId = id;
    }
  }

  /**
   * Get capabilities profile of a model
   * @param {string} id 
   */
  getCapabilities(id) {
    const model = this.getModel(id);
    return model?.capabilities || {
      facialExpressions: true,
      eyeBlink: true,
      eyeTracking: true,
      mouthControl: true,
      headMovement: true,
      bodyMovement: true,
      breathing: true,
      physics: true
    };
  }

  /**
   * Resolve a high-level semantic action (e.g. 'happy', 'blush', 'wink', 'yandere')
   * to model-specific parameter targets or expression names
   * @param {string} modelId 
   * @param {string} actionName 
   * @returns {Object} { type: 'expression'|'parameters'|'fallback', name?: string, targets?: Object }
   */
  resolveSemanticAction(modelId, actionName) {
    const model = this.getModel(modelId);
    if (!model) return { type: 'fallback', fallback: 'idle' };

    // 1. Check model's pre-configured semantic action map
    if (model.semanticActions && model.semanticActions[actionName]) {
      return model.semanticActions[actionName];
    }

    // 2. Dynamic expression fuzzy match
    const expressions = model.capabilities?.customExpressions || model.expressions || [];
    const normalizedAction = actionName.toLowerCase();
    
    for (const exp of expressions) {
      if (exp.toLowerCase().includes(normalizedAction)) {
        return { type: 'expression', name: exp };
      }
    }

    // 3. Fallback standard parameter targets
    const mapping = model.standardMapping || {};
    const targets = {};

    if (normalizedAction === 'happy' || normalizedAction === 'smile') {
      if (mapping.eye_l_smile) targets[mapping.eye_l_smile] = 1.0;
      if (mapping.eye_r_smile) targets[mapping.eye_r_smile] = 1.0;
      if (mapping.mouth_form) targets[mapping.mouth_form] = 1.0;
      if (mapping.cheek_blush) targets[mapping.cheek_blush] = 0.5;
    } else if (normalizedAction === 'blush') {
      if (mapping.cheek_blush) targets[mapping.cheek_blush] = 1.0;
      if (mapping.eye_l_smile) targets[mapping.eye_l_smile] = 0.8;
      if (mapping.eye_r_smile) targets[mapping.eye_r_smile] = 0.8;
    } else if (normalizedAction === 'wink') {
      if (mapping.eye_r_open) targets[mapping.eye_r_open] = 0.0;
      if (mapping.eye_r_smile) targets[mapping.eye_r_smile] = 1.0;
    } else if (normalizedAction === 'sad') {
      if (mapping.brow_l_y) targets[mapping.brow_l_y] = -0.6;
      if (mapping.brow_r_y) targets[mapping.brow_r_y] = -0.6;
      if (mapping.mouth_form) targets[mapping.mouth_form] = -1.0;
    } else if (normalizedAction === 'angry' || normalizedAction === 'mad') {
      if (mapping.brow_l_angle) targets[mapping.brow_l_angle] = -0.8;
      if (mapping.brow_r_angle) targets[mapping.brow_r_angle] = -0.8;
      if (mapping.mouth_form) targets[mapping.mouth_form] = -0.5;
    }

    if (Object.keys(targets).length > 0) {
      return { type: 'parameters', targets };
    }

    return { type: 'fallback', fallback: 'idle' };
  }

  /**
   * Introspect a loaded Live2DModel instance to auto-detect parameters and map capabilities
   * @param {Live2DModel} modelInstance 
   * @param {Object} rawModel3Json 
   * @returns {Object} Detected capabilities and mapping
   */
  detectModelCapabilities(modelInstance, rawModel3Json = null) {
    const detected = {
      parameters: new Map(),
      expressions: [],
      motions: [],
      hasPhysics: false,
      standardMapping: {}
    };

    if (!modelInstance?.internalModel) return detected;

    const coreModel = modelInstance.internalModel.coreModel;

    // Detect parameters from coreModel safely
    try {
      if (coreModel?._parameterIds && Array.isArray(coreModel._parameterIds)) {
        const ids = coreModel._parameterIds;
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          const min = typeof coreModel.getParameterMinimumValue === 'function'
            ? coreModel.getParameterMinimumValue(i)
            : (coreModel._parameterMinimumValues ? coreModel._parameterMinimumValues[i] : -30);
          const max = typeof coreModel.getParameterMaximumValue === 'function'
            ? coreModel.getParameterMaximumValue(i)
            : (coreModel._parameterMaximumValues ? coreModel._parameterMaximumValues[i] : 30);
          const def = typeof coreModel.getParameterDefaultValue === 'function'
            ? coreModel.getParameterDefaultValue(i)
            : 0;
          detected.parameters.set(id, { id, min, max, default: def, index: i });
        }
      } else if (coreModel?._parameters?.ids) {
        const ids = coreModel._parameters.ids;
        const mins = coreModel._parameters.minimumValues || [];
        const maxs = coreModel._parameters.maximumValues || [];
        const defs = coreModel._parameters.defaultValues || [];
        for (let i = 0; i < ids.length; i++) {
          detected.parameters.set(ids[i], {
            id: ids[i],
            min: mins[i] ?? -1,
            max: maxs[i] ?? 1,
            default: defs[i] ?? 0,
            index: i
          });
        }
      } else if (typeof coreModel?.getParameterCount === 'function') {
        const count = coreModel.getParameterCount();
        for (let i = 0; i < count; i++) {
          const id = typeof coreModel.getParameterId === 'function'
            ? coreModel.getParameterId(i)
            : (coreModel._parameterIds ? coreModel._parameterIds[i] : `param_${i}`);
          const min = typeof coreModel.getParameterMinimumValue === 'function' ? coreModel.getParameterMinimumValue(i) : -30;
          const max = typeof coreModel.getParameterMaximumValue === 'function' ? coreModel.getParameterMaximumValue(i) : 30;
          const def = typeof coreModel.getParameterDefaultValue === 'function' ? coreModel.getParameterDefaultValue(i) : 0;
          detected.parameters.set(id, { id, min, max, default: def, index: i });
        }
      } else if (modelInstance.internalModel?.parameters) {
        for (const [id, val] of Object.entries(modelInstance.internalModel.parameters)) {
          detected.parameters.set(id, { id, min: -30, max: 30, default: val || 0 });
        }
      }
    } catch (e) {
      console.warn('[Live2DModelRegistry] Parameter introspection notice:', e);
    }

    // Detect expressions from internal model or model3.json
    if (rawModel3Json?.FileReferences?.Expressions) {
      detected.expressions = rawModel3Json.FileReferences.Expressions.map(e => e.Name);
    } else if (modelInstance.internalModel.motionManager?.expressionManager?.definitions) {
      detected.expressions = modelInstance.internalModel.motionManager.expressionManager.definitions.map(d => d.name);
    }

    // Build standard capability mapping automatically using standard naming heuristics
    const heuristicMap = {
      head_angle_x: ['ParamAngleX', 'PARAM_ANGLE_X', 'AngleX', 'HeadAngleX', 'PARAM_ANGLE_HEAD_X', 'ParamAngleHeadX', '角度 X'],
      head_angle_y: ['ParamAngleY', 'PARAM_ANGLE_Y', 'AngleY', 'HeadAngleY', 'PARAM_ANGLE_HEAD_Y', 'ParamAngleHeadY', '角度 Y'],
      head_angle_z: ['ParamAngleZ', 'PARAM_ANGLE_Z', 'AngleZ', 'HeadAngleZ', 'PARAM_ANGLE_HEAD_Z', 'ParamAngleHeadZ', '角度 Z'],
      body_angle_x: ['ParamBodyAngleX', 'PARAM_BODY_ANGLE_X', 'BodyAngleX', 'BodyX', 'PARAM_BODY_X', '身体旋转 X'],
      body_angle_y: ['ParamBodyAngleY', 'PARAM_BODY_ANGLE_Y', 'BodyAngleY', 'BodyY', 'PARAM_BODY_Y', '身体旋转 Y'],
      body_angle_z: ['ParamBodyAngleZ', 'PARAM_BODY_ANGLE_Z', 'BodyAngleZ', 'BodyZ', 'PARAM_BODY_Z', '身体旋转 Z'],
      eye_l_open: ['ParamEyeLOpen', 'PARAM_EYE_L_OPEN', 'EyeLOpen', 'ParamEyeOpen', '左眼 开闭'],
      eye_r_open: ['ParamEyeROpen', 'PARAM_EYE_R_OPEN', 'EyeROpen', 'ParamEyeOpen', '右眼 开闭'],
      eye_l_smile: ['ParamEyeLSmile', 'PARAM_EYE_L_SMILE', 'EyeLSmile', '左眼 微笑'],
      eye_r_smile: ['ParamEyeRSmile', 'PARAM_EYE_R_SMILE', 'EyeRSmile', '右眼 微笑'],
      eye_ball_x: ['ParamEyeBallX', 'PARAM_EYE_BALL_X', 'EyeBallX', 'ParamEyeX', '眼球 X'],
      eye_ball_y: ['ParamEyeBallY', 'PARAM_EYE_BALL_Y', 'EyeBallY', 'ParamEyeY', '眼球 Y'],
      brow_l_y: ['ParamBrowLY', 'PARAM_BROW_L_Y', 'BrowLY', '左眉 上下'],
      brow_r_y: ['ParamBrowRY', 'PARAM_BROW_R_Y', 'BrowRY', '右眉 上下'],
      brow_l_angle: ['ParamBrowLAngle', 'PARAM_BROW_L_ANGLE', 'BrowLAngle', '左眉 角度'],
      brow_r_angle: ['ParamBrowRAngle', 'PARAM_BROW_R_ANGLE', 'BrowRAngle', '右眉 角度'],
      brow_l_form: ['ParamBrowLForm', 'PARAM_BROW_L_FORM', 'BrowLForm', '左眉 变形'],
      brow_r_form: ['ParamBrowRForm', 'PARAM_BROW_R_FORM', 'BrowRForm', '右眉 变形'],
      mouth_open_y: ['ParamMouthOpenY', 'PARAM_MOUTH_OPEN_Y', 'MouthOpenY', 'MouthOpen', '嘴巴 张开'],
      mouth_form: ['ParamMouthForm', 'PARAM_MOUTH_FORM', 'MouthForm', '嘴巴 变形'],
      cheek_blush: ['ParamCheek', 'PARAM_CHEEK', 'Cheek', 'Blush', '脸颊 红晕'],
      breath: ['ParamBreath', 'PARAM_BREATH', 'Breath', '呼吸']
    };

    for (const [capability, candidateIds] of Object.entries(heuristicMap)) {
      for (const candidate of candidateIds) {
        if (detected.parameters.has(candidate)) {
          const paramInfo = detected.parameters.get(candidate);
          detected.standardMapping[capability] = {
            paramId: candidate,
            min: paramInfo.min,
            max: paramInfo.max,
            default: paramInfo.default
          };
          break;
        }
      }
    }

    return detected;
  }
}

export const live2dModelRegistry = new Live2DModelRegistry();
