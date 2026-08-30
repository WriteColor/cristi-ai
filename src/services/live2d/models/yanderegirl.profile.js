/**
 * Live2D Model Profile: Cristi Gótica (Yandere Girl) (yanderegirl)
 * Generated with dynamic capability introspection
 */

export const yanderegirlProfile = {
  id: 'yanderegirl',
  name: 'Cristi Gótica (Yandere Girl)',
  character: 'Cristi',
  theme: 'Goth / Yandere AI Companion',
  badge: 'Predeterminado',
  recommendedVoice: 'Aoede',
  description: 'Compañera IA yandere gótica con amplio rango de expresiones, seguimiento visual y física capilar completa.',
  path: '/models/live2d/yanderegirl/yanderegirl.model3.json',
  
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
    "customExpressions": [
        "Crazy",
        "Mad",
        "Scared",
        "Yandere"
    ],
    "motions": [],
    "totalParameters": 35
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
        "type": "expression",
        "name": "Scared"
    },
    "blush": {
        "type": "expression",
        "name": "Scared"
    },
    "yandere": {
        "type": "expression",
        "name": "Yandere"
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
        "type": "expression",
        "name": "Mad"
    },
    "love": {
        "type": "fallback",
        "fallback": "idle"
    }
}
};

export default yanderegirlProfile;
