/**
 * Live2D Model Profile: Ruan Mei (Star Rail) (ruan_mei)
 * Generated with dynamic capability introspection
 */

export const ruan_meiProfile = {
  id: 'ruan_mei',
  name: 'Ruan Mei (Star Rail)',
  character: 'Ruan Mei',
  theme: 'Genius Society / Honkai Star Rail',
  badge: 'Star Rail',
  recommendedVoice: 'Fenrir',
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
            "ParamCheek": 0.5
        }
    },
    "blush": {
        "type": "parameters",
        "targets": {
            "ParamCheek": 1.0,
            "ParamEyeLSmile": 0.8,
            "ParamEyeRSmile": 0.8
        }
    },
    "yandere": {
        "type": "fallback",
        "fallback": "idle"
    },
    "wink": {
        "type": "parameters",
        "targets": {
            "ParamEyeROpen": 0.0,
            "ParamEyeRSmile": 1.0
        }
    },
    "surprised": {
        "type": "fallback",
        "fallback": "idle"
    },
    "sad": {
        "type": "parameters",
        "targets": {
            "ParamBrowLY": -0.6,
            "ParamBrowRY": -0.6,
            "ParamMouthForm": -1.0
        }
    },
    "angry": {
        "type": "parameters",
        "targets": {
            "ParamBrowLAngle": -0.8,
            "ParamBrowRAngle": -0.8,
            "ParamMouthForm": -0.5
        }
    },
    "love": {
        "type": "fallback",
        "fallback": "idle"
    }
}
};

export default ruan_meiProfile;
