import type { ModelProfile } from '../types';

/**
 * Live2D Model Profile: Vivian (ZZZ)
 * Zenless Zone Zero umbrella lady
 */

export const vivianProfile: ModelProfile = {
  id: 'vivian',
  name: 'Vivian (ZZZ)',
  character: 'Vivian / ビビアン / 薇薇安',
  theme: 'Zenless Zone Zero / Sombrilla Elegante',
  badge: 'ZZZ',
  recommendedVoice: 'Leda',
  description: 'Modelo de alta definición de ZZZ con sombrilla gótica, 11 texturas 4K, ojos rodantes, llanto, timidez y posturas de puntillas.',
  path: '/models/live2d/vivian/薇薇安.model3.json',

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
      'umbrella_closed',
      '伞关闭',
      'umbrella',
      'cry',
      '哭',
      'tears',
      'shy',
      '害羞',
      'blush',
      'flustered',
      '慌张',
      'roll_eyes',
      '白眼',
      'dark_face',
      '黑脸'
    ],
    motions: [
      'Idle',
      'idle',
      'Tap',
      'Scene1'
    ],
    totalParameters: 197
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
    shy: {
      type: 'expression',
      name: 'shy'
    },
    blush: {
      type: 'expression',
      name: 'shy'
    },
    cry: {
      type: 'expression',
      name: 'cry'
    },
    sad: {
      type: 'expression',
      name: 'cry'
    },
    flustered: {
      type: 'expression',
      name: 'flustered'
    },
    roll_eyes: {
      type: 'expression',
      name: 'roll_eyes'
    },
    dark_face: {
      type: 'expression',
      name: 'dark_face'
    },
    umbrella_closed: {
      type: 'expression',
      name: 'umbrella_closed'
    },
    tongue: {
      type: 'parameters',
      targets: {
        Param22: 1.0,
        Param131: 1.0,
        ParamMouthOpenY: 0.8
      }
    },
    pout: {
      type: 'parameters',
      targets: {
        Param15: 1.0,
        Param16: 1.0,
        ParamBrowLY: -0.3,
        ParamBrowRY: -0.3
      }
    },
    smug: {
      type: 'parameters',
      targets: {
        Param13: 1.0,
        ParamCheek: 0.3
      }
    },
    lean: {
      type: 'parameters',
      targets: {
        Paramqq: 1.0,
        ParamAngleY: -6
      }
    },
    tiptoe: {
      type: 'parameters',
      targets: {
        Paramtj1: 0.8,
        Paramjj: 1.0,
        Paramjj2: 1.0
      }
    }
  },

  hitAreas: [
    {
      id: 'umbrella',
      label: 'Sombrilla Gótica',
      reaction: 'umbrella_closed',
      bounds: { x: 0.05, y: 0.05, width: 0.45, height: 0.5 }
    },
    {
      id: 'head',
      label: 'Gorra Victoriana / Rostro',
      reaction: 'shy',
      bounds: { x: 0.35, y: 0.1, width: 0.4, height: 0.28 }
    },
    {
      id: 'dress',
      label: 'Vestido de Volantes',
      reaction: 'flustered',
      bounds: { x: 0.3, y: 0.4, width: 0.45, height: 0.35 }
    }
  ]
};
