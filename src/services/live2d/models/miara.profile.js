/**
 * Live2D Model Profile: Miara (miara)
 * Generated with dynamic capability introspection
 */

export const miaraProfile = {
  id: 'miara',
  name: 'Miara',
  character: 'Miara',
  theme: 'Fantasy Elf / Official Live2D',
  badge: 'Oficial Live2D',
  recommendedVoice: 'Aoede',
  description: 'Modelo oficial Live2D Cubism Pro con 138 parámetros, física de orejas de elfo y animaciones idle.',
  path: '/models/live2d/miara/miara_pro_t03.model3.json',
  
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
    "customExpressions": [],
    "motions": [
        "Scene1",
        "Scene2",
        "Scene3"
    ],
    "totalParameters": 138
},
  
  standardMapping: {
    "head_angle_x": "ParamAngleX",
    "head_angle_y": "ParamAngleY",
    "head_angle_z": "ParamAngleZ",
    "body_angle_x": "ParamBodyAngleX",
    "body_angle_z": "ParamBodyAngleZ",
    "eye_l_open": "ParamEyeLOpen",
    "eye_r_open": "ParamEyeROpen",
    "eye_ball_x": "ParamEyeBallX",
    "eye_ball_y": "ParamEyeBallY",
    "brow_l_y": "ParamBrowLY",
    "brow_r_y": "ParamBrowRY",
    "brow_l_angle": "ParamBrowLAngle",
    "brow_r_angle": "ParamBrowRAngle",
    "mouth_open_y": "ParamMouthOpenY",
    "mouth_form": "ParamMouthForm",
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
            "ParamMouthForm": 1.0
        }
    },
    "blush": {
        "type": "fallback",
        "fallback": "idle"
    },
    "yandere": {
        "type": "fallback",
        "fallback": "idle"
    },
    "wink": {
        "type": "parameters",
        "targets": {
            "ParamEyeROpen": 0.0
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

export default miaraProfile;
