import type { ModelProfile } from '../types';

/**
 * Live2D Model Profile: Sparkle (Star Rail)
 * Honkai: Star Rail Masked Fool
 */

export const sparkleProfile: ModelProfile = {
  id: 'sparkle',
  name: 'Sparkle (Star Rail)',
  character: 'Sparkle / 花火 / Hanabi',
  theme: 'Honkai: Star Rail / Bufones Enmascarados',
  badge: 'Star Rail',
  recommendedVoice: 'Zephyr',
  description: 'Bufona Enmascarada de Honkai: Star Rail con abanico, máscara kitsune, 6 capas de textura 4K, cinemáticas y trucos de prestidigitación.',
  path: '/models/live2d/sparkle/Sparkle.model3.json',

  capabilities: {
    facialExpressions: true,
    eyeBlink: true,
    eyeTracking: true,
    mouthControl: true,
    headMovement: true,
    bodyMovement: true,
    armMovement: true,
    breathing: true,
    physics: true,
    customExpressions: [
      'hide_highlights',
      '高光隐藏',
      'dark_eyes',
      'hand_pose',
      '手姿势',
      'fan',
      'leg_pose',
      '正常腿'
    ],
    motions: [
      'Idle',
      'idle',
      'Tap',
      'Special',
      'daqiu',
      'ball',
      'motion2',
      'motion3'
    ],
    totalParameters: 174
  },

  standardMapping: {
    head_angle_x: 'ParamAngleX',
    head_angle_y: 'ParamAngleY',
    head_angle_z: 'ParamAngleZ',
    eye_l_open: 'ParamEyeLOpen',
    eye_r_open: 'ParamEyeROpen',
    eye_l_smile: 'ParamEyeLSmile',
    eye_r_smile: 'ParamEyeRSmile',
    eye_ball_x: 'ParamEyeBallX',
    eye_ball_y: 'ParamEyeBallY',
    brow_l_y: 'ParamBrowLY',
    brow_r_y: 'ParamBrowRY',
    brow_l_angle: 'ParamBrowLAngle',
    brow_r_angle: 'ParamBrowRAngle',
    mouth_open_y: 'ParamMouthOpenY',
    mouth_form: 'ParamMouthForm',
    cheek: 'ParamCheek',
    breath: 'ParamBreath',
    body_angle_x: 'ParamBodyAngleX',
    body_angle_y: 'ParamBodyAngleY',
    body_angle_z: 'ParamBodyAngleZ'
  },

  semanticActions: {
    idle: {
      type: 'parameters',
      targets: {}
    },
    happy: {
      type: 'parameters',
      targets: {
        ParamEyeLSmile: 1.0,
        ParamEyeRSmile: 1.0,
        ParamMouthForm: 1.0,
        ParamCheek: 0.5
      }
    },
    blush: {
      type: 'parameters',
      targets: {
        ParamCheek: 1.0
      }
    },
    smug: {
      type: 'parameters',
      targets: {
        Param120: 1.0,
        ParamCheek: 0.3
      }
    },
    pout: {
      type: 'parameters',
      targets: {
        Param122: 1.0,
        Param124: 0.8,
        ParamBrowLY: -0.3,
        ParamBrowRY: -0.3
      }
    },
    bow: {
      type: 'parameters',
      targets: {
        Param133: 1.0,
        ParamBodyAngleY: -8
      }
    },
    hand_pose: {
      type: 'expression',
      name: 'hand_pose'
    },
    hide_highlights: {
      type: 'expression',
      name: 'hide_highlights'
    },
    dark_eyes: {
      type: 'expression',
      name: 'hide_highlights'
    },
    leg_pose: {
      type: 'expression',
      name: 'leg_pose'
    },
    ball: {
      type: 'motion',
      group: 'Special',
      index: 2
    }
  },

  hitAreas: [
    {
      id: 'head',
      label: 'Máscara Kitsune / Cabello',
      reaction: 'surprised',
      bounds: { x: 0.25, y: 0.05, width: 0.5, height: 0.3 }
    },
    {
      id: 'fan',
      label: 'Abanico Enmascarado',
      reaction: 'hand_pose',
      bounds: { x: 0.15, y: 0.3, width: 0.3, height: 0.3 }
    },
    {
      id: 'body',
      label: 'Kimono / Cinturón',
      reaction: 'blush',
      bounds: { x: 0.3, y: 0.35, width: 0.4, height: 0.35 }
    }
  ]
};
