import type { ModelProfile } from '../types';

/**
 * Live2D Model Profile: Belle (ZZZ)
 * Zenless Zone Zero protagonist
 */

export const belleProfile: ModelProfile = {
  id: 'belle',
  name: 'Belle (ZZZ)',
  character: 'Belle / リン',
  theme: 'Zenless Zone Zero / Random Play',
  badge: 'ZZZ',
  recommendedVoice: 'Aoede',
  description: 'Protagonista de Zenless Zone Zero (ZZZ), administradora de Random Play con texturas 8K, interfaz ocular y gafas dinámicas.',
  path: '/models/live2d/belle/zzz_belle.model3.json',

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
      'blueEye',
      '蓝眼',
      'Glasses',
      'glasses',
      '眼镜'
    ],
    motions: [
      'Idle',
      'idle',
      'Tap'
    ],
    totalParameters: 175
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
    body_angle_z: 'ParamBodyAngleZ',
    body_lean: 'ParamBodyAngleX4'
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
        ParamCheek: 0.6
      }
    },
    blush: {
      type: 'parameters',
      targets: {
        ParamCheek: 1.0,
        Param131: 0.5,
        Param132: 0.5
      }
    },
    pout: {
      type: 'parameters',
      targets: {
        Param131: 1.0,
        Param132: 1.0,
        ParamBrowLY: -0.4,
        ParamBrowRY: -0.4,
        ParamMouthForm: -0.3
      }
    },
    lean: {
      type: 'parameters',
      targets: {
        ParamBodyAngleX4: 1.0,
        ParamAngleY: -8
      }
    },
    glasses: {
      type: 'expression',
      name: 'Glasses'
    },
    blueeye: {
      type: 'expression',
      name: 'blueEye'
    }
  },

  hitAreas: [
    {
      id: 'head',
      label: 'Cabeza / Cabello',
      reaction: 'surprised',
      bounds: { x: 0.25, y: 0.05, width: 0.5, height: 0.3 }
    },
    {
      id: 'glasses',
      label: 'Gafas de Belle',
      reaction: 'glasses',
      bounds: { x: 0.35, y: 0.18, width: 0.3, height: 0.12 }
    },
    {
      id: 'chest',
      label: 'Medallón / Chaqueta',
      reaction: 'blush',
      bounds: { x: 0.3, y: 0.35, width: 0.4, height: 0.3 }
    }
  ]
};
