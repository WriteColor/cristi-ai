/**
 * Live2D Model Profile: GothLoli Maid
 * Gothic Lolita Maid generic VTuber model
 */

export const goth_loliProfile = {
  id: 'goth_loli',
  name: 'GothLoli Maid',
  character: 'GothLoli-chan / ゴスロリちゃん',
  theme: 'Gothic Lolita / Maid',
  badge: 'Maid',
  recommendedVoice: 'Aoede',
  description: 'Doncella gótica clásica con vestido victoriano negro y encaje blanco, physics capilares elásticas en coletas y lazos, reverencia y expresión recatada.',
  path: '/models/live2d/goth_loli/goth_loli.model3.json',

  capabilities: {
    facialExpressions: true,
    eyeBlink: true,
    eyeTracking: true,
    mouthControl: true,
    headMovement: true,
    bodyMovement: true,
    armMovement: false,
    breathing: true,
    physics: true,
    customExpressions: [],
    motions: [],
    totalParameters: 30
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
    brow_l_x: 'ParamBrowLX',
    brow_r_x: 'ParamBrowRX',
    brow_l_angle: 'ParamBrowLAngle',
    brow_r_angle: 'ParamBrowRAngle',
    brow_l_form: 'ParamBrowLForm',
    brow_r_form: 'ParamBrowRForm',
    mouth_open_y: 'ParamMouthOpenY',
    mouth_form: 'ParamMouthForm',
    cheek: 'ParamCheek',
    body_angle_x: 'ParamBodyAngleX',
    body_angle_y: 'ParamBodyAngleY',
    body_angle_z: 'ParamBodyAngleZ',
    breath: 'ParamBreath'
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
    sad: {
      type: 'parameters',
      targets: {
        ParamBrowLY: -0.6,
        ParamBrowRY: -0.6,
        ParamMouthForm: -1.0
      }
    },
    angry: {
      type: 'parameters',
      targets: {
        ParamBrowLAngle: -0.8,
        ParamBrowRAngle: -0.8,
        ParamMouthForm: -0.5
      }
    },
    bow: {
      type: 'parameters',
      targets: {
        ParamBodyAngleY: -15,
        ParamAngleY: -12
      }
    }
  },

  hitAreas: [
    {
      id: 'head',
      label: 'Cofia Victoriana / Cabello',
      reaction: 'happy',
      bounds: { x: 0.25, y: 0.05, width: 0.5, height: 0.3 }
    },
    {
      id: 'apron',
      label: 'Delantal de Doncella',
      reaction: 'bow',
      bounds: { x: 0.25, y: 0.38, width: 0.5, height: 0.35 }
    }
  ]
};
