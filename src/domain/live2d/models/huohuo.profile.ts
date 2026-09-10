import type { ModelProfile } from '../types';

/**
 * Live2D Model Profile: Huohuo (Star Rail)
 * Honkai: Star Rail Ten-Lords Commission Judge
 */

export const huohuoProfile: ModelProfile = {
  id: 'huohuo',
  name: 'Huohuo (Star Rail)',
  character: 'Huohuo / 藿藿',
  theme: 'Honkai: Star Rail / Diez Líderes',
  badge: 'Star Rail',
  recommendedVoice: 'Kore',
  description: 'Jueza foxian aprendiz de la Comisión de los Diez Líderes en Honkai: Star Rail, con cola de heliobi (Cola), expresiones tímidas, llanto, almohada y estandarte de exorcismo.',
  path: '/models/live2d/huohuo/huohuo.model3.json',

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
      'angry',
      '生气',
      'cry',
      '哭',
      'tears',
      'baozhen',
      '抱枕',
      'pillow',
      'qizi1',
      'flag',
      'qizi2',
      'flag_cover',
      'white_eyes',
      'white eyes',
      'panic_eyes',
      '白眼'
    ],
    motions: [
      'Idle',
      'idle',
      'Curious',
      'haoqi',
      'Sleepy',
      'keshui',
      'Soul',
      'linghun',
      'Flag',
      'qizi',
      'No',
      'yaotou',
      'Pillow',
      'zhentou'
    ],
    totalParameters: 157
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
        ParamCheek: 0.4
      }
    },
    scared: {
      type: 'expression',
      name: 'white_eyes'
    },
    cry: {
      type: 'expression',
      name: 'cry'
    },
    sad: {
      type: 'expression',
      name: 'cry'
    },
    angry: {
      type: 'expression',
      name: 'angry'
    },
    pillow: {
      type: 'expression',
      name: 'baozhen'
    },
    flag: {
      type: 'expression',
      name: 'qizi1'
    },
    flag_cover: {
      type: 'expression',
      name: 'qizi2'
    },
    blush: {
      type: 'parameters',
      targets: {
        ParamCheek: 1.0
      }
    },
    dark_face: {
      type: 'parameters',
      targets: {
        Param107: 1.0
      }
    },
    curious: {
      type: 'motion',
      group: 'Curious',
      index: 0
    },
    sleepy: {
      type: 'motion',
      group: 'Sleepy',
      index: 0
    },
    soul: {
      type: 'motion',
      group: 'Soul',
      index: 0
    },
    no: {
      type: 'motion',
      group: 'No',
      index: 0
    }
  },

  hitAreas: [
    {
      id: 'ears',
      label: 'Orejas de Zorro Foxian',
      reaction: 'scared',
      bounds: { x: 0.25, y: 0.02, width: 0.5, height: 0.25 }
    },
    {
      id: 'tail',
      label: 'Cola Heliobi (Mr. Tail)',
      reaction: 'soul',
      bounds: { x: 0.65, y: 0.45, width: 0.35, height: 0.45 }
    },
    {
      id: 'pillow',
      label: 'Almohada Protectora',
      reaction: 'pillow',
      bounds: { x: 0.35, y: 0.35, width: 0.3, height: 0.25 }
    }
  ]
};
