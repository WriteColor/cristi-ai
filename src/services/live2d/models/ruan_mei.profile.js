/**
 * Live2D Model Profile: Ruan Mei (Star Rail) (ruan_mei)
 * No .exp3 files present — all expressions via rich parameter target combinations.
 * Model has 179 parameters including cheek, brow form, eye smile, and mouth shape controls.
 */

export const ruan_meiProfile = {
  id: 'ruan_mei',
  name: 'Ruan Mei (Star Rail)',
  character: 'Ruan Mei',
  theme: 'Genius Society / Honkai Star Rail',
  badge: 'Star Rail',
  recommendedVoice: 'Callirrhoe',
  description: 'Miembro #81 de la Sociedad de Genios de Honkai: Star Rail con texturas ultra HD 8K y física de ropa tradicional.',
  path: '/models/live2d/ruan_mei/ruan_mei.model3.json',

  capabilities: {
    "facialExpressions": true,
    "eyeBlink": true,
    "eyeTracking": true,
    "mouthControl": true,
    "headMovement": true,
    "bodyMovement": true,
    "armMovement": false,
    "breathing": true,
    "physics": true,
    // No .exp3 files — all expressions via parameter targets
    "customExpressions": [],
    "motions": [],
    "totalParameters": 179
  },

  standardMapping: {
    "head_angle_x": "ParamAngleX",
    "head_angle_y": "ParamAngleY",
    "head_angle_z": "ParamAngleZ",
    "body_angle_x": "ParamBodyAngleX",
    "body_angle_y": "ParamBodyAngleY",
    "body_angle_z": "ParamBodyAngleZ",
    "eye_l_open": "ParamEyeLOpen",
    "eye_r_open": "ParamEyeROpen",
    "eye_l_smile": "ParamEyeLSmile",
    "eye_r_smile": "ParamEyeRSmile",
    "eye_ball_x": "ParamEyeBallX",
    "eye_ball_y": "ParamEyeBallY",
    "brow_l_y": "ParamBrowLY",
    "brow_r_y": "ParamBrowRY",
    "brow_l_angle": "ParamBrowLAngle",
    "brow_r_angle": "ParamBrowRAngle",
    "brow_l_form": "ParamBrowLForm",
    "brow_r_form": "ParamBrowRForm",
    "mouth_open_y": "ParamMouthOpenY",
    "mouth_form": "ParamMouthForm",
    "cheek_blush": "ParamCheek",
    "breath": "ParamBreath"
  },

  semanticActions: {
    "idle": {
        "type": "parameters",
        "targets": {}
    },
    "happy": {
        "type": "parameters",
        "targets": {
            "ParamEyeLSmile": 1.0,
            "ParamEyeRSmile": 1.0,
            "ParamMouthForm": 1.0,
            "ParamCheek": 0.5,
            "ParamBrowLY": 0.3,
            "ParamBrowRY": 0.3,
            "ParamBrowLForm": 0.5,
            "ParamBrowRForm": 0.5
        }
    },
    "blush": {
        "type": "parameters",
        "targets": {
            "ParamCheek": 1.0,
            "ParamEyeLSmile": 0.8,
            "ParamEyeRSmile": 0.8,
            "ParamMouthForm": 0.6,
            "ParamEyeLOpen": 0.75,
            "ParamEyeROpen": 0.75,
            "ParamBrowLY": 0.2,
            "ParamBrowRY": 0.2
        }
    },
    "yandere": {
        "type": "parameters",
        "targets": {
            "ParamMouthForm": -0.6,
            "ParamBrowLAngle": -0.5,
            "ParamBrowRAngle": -0.5,
            "ParamBrowLForm": -0.6,
            "ParamBrowRForm": -0.6,
            "ParamEyeLSmile": 0.2,
            "ParamEyeRSmile": 0.2
        }
    },
    "wink": {
        "type": "parameters",
        "targets": {
            "ParamEyeROpen": 0.0,
            "ParamEyeRSmile": 1.0,
            "ParamCheek": 0.5,
            "ParamMouthForm": 0.5
        }
    },
    "surprised": {
        "type": "parameters",
        "targets": {
            "ParamEyeLOpen": 1.0,
            "ParamEyeROpen": 1.0,
            "ParamMouthOpenY": 0.4,
            "ParamMouthForm": -0.2,
            "ParamBrowLY": 0.8,
            "ParamBrowRY": 0.8
        }
    },
    "sad": {
        "type": "parameters",
        "targets": {
            "ParamBrowLY": -0.6,
            "ParamBrowRY": -0.6,
            "ParamBrowLAngle": 0.3,
            "ParamBrowRAngle": 0.3,
            "ParamMouthForm": -1.0,
            "ParamEyeLOpen": 0.6,
            "ParamEyeROpen": 0.6
        }
    },
    "angry": {
        "type": "parameters",
        "targets": {
            "ParamBrowLAngle": -0.8,
            "ParamBrowRAngle": -0.8,
            "ParamBrowLY": -0.4,
            "ParamBrowRY": -0.4,
            "ParamBrowLForm": -1.0,
            "ParamBrowRForm": -1.0,
            "ParamMouthForm": -0.5
        }
    },
    "love": {
        "type": "parameters",
        "targets": {
            "ParamEyeLSmile": 1.0,
            "ParamEyeRSmile": 1.0,
            "ParamCheek": 1.0,
            "ParamMouthForm": 1.0,
            "ParamBrowLY": 0.4,
            "ParamBrowRY": 0.4,
            "ParamBrowLForm": 0.5,
            "ParamBrowRForm": 0.5
        }
    }
  }
};

export default ruan_meiProfile;
