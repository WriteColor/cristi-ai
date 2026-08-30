/**
 * Live2D Model Profile: Toki (Blue Archive) (toki)
 * No .exp3 files present — all expressions implemented as parameter target combinations.
 * These produce real visual changes via direct Cubism parameter writes.
 */

export const tokiProfile = {
  id: 'toki',
  name: 'Toki (Blue Archive)',
  character: 'Toki',
  theme: 'Cyber Maid / Blue Archive',
  badge: 'Blue Archive',
  recommendedVoice: 'Puck',
  description: 'Doncella táctica de Blue Archive con mirada serena, respiración suave y estética cibernética.',
  path: '/models/live2d/toki/20220227toki.model3.json',

  capabilities: {
    "facialExpressions": true,
    "eyeBlink": true,
    "eyeTracking": true,
    "mouthControl": true,
    "headMovement": true,
    "bodyMovement": true,
    "armMovement": true,
    "breathing": true,
    "physics": true,
    // No .exp3 files — all expressions via parameter targets
    "customExpressions": [],
    "motions": [],
    "totalParameters": 38
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
            "ParamBrowRY": 0.3
        }
    },
    "blush": {
        "type": "parameters",
        "targets": {
            "ParamCheek": 1.0,
            "ParamEyeLSmile": 0.7,
            "ParamEyeRSmile": 0.7,
            "ParamMouthForm": 0.5,
            "ParamEyeLOpen": 0.8,
            "ParamEyeROpen": 0.8
        }
    },
    "yandere": {
        "type": "parameters",
        "targets": {
            "ParamMouthForm": -0.7,
            "ParamBrowLAngle": -0.6,
            "ParamBrowRAngle": -0.6,
            "ParamEyeLSmile": 0.4,
            "ParamEyeRSmile": 0.4
        }
    },
    "wink": {
        "type": "parameters",
        "targets": {
            "ParamEyeROpen": 0.0,
            "ParamEyeRSmile": 1.0,
            "ParamCheek": 0.4
        }
    },
    "surprised": {
        "type": "parameters",
        "targets": {
            "ParamEyeLOpen": 1.0,
            "ParamEyeROpen": 1.0,
            "ParamMouthOpenY": 0.5,
            "ParamMouthForm": -0.2,
            "ParamBrowLY": 0.7,
            "ParamBrowRY": 0.7
        }
    },
    "sad": {
        "type": "parameters",
        "targets": {
            "ParamBrowLY": -0.6,
            "ParamBrowRY": -0.6,
            "ParamMouthForm": -1.0,
            "ParamEyeLOpen": 0.7,
            "ParamEyeROpen": 0.7
        }
    },
    "angry": {
        "type": "parameters",
        "targets": {
            "ParamBrowLAngle": -0.8,
            "ParamBrowRAngle": -0.8,
            "ParamMouthForm": -0.5,
            "ParamBrowLY": -0.4,
            "ParamBrowRY": -0.4
        }
    },
    "love": {
        "type": "parameters",
        "targets": {
            "ParamEyeLSmile": 1.0,
            "ParamEyeRSmile": 1.0,
            "ParamCheek": 1.0,
            "ParamMouthForm": 1.0,
            "ParamBrowLY": 0.3,
            "ParamBrowRY": 0.3
        }
    }
  }
};

export default tokiProfile;
