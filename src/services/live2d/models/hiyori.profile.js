/**
 * Live2D Model Profile: Hiyori Momose (hiyori)
 * Generated with dynamic capability introspection
 */

export const hiyoriProfile = {
  id: 'hiyori',
  name: 'Hiyori Momose',
  character: 'Hiyori',
  theme: 'Anime Schoolgirl / Official Live2D',
  badge: 'Oficial Live2D',
  recommendedVoice: 'Fenrir',
  description: 'Modelo oficial de referencia Live2D Cubism con movimientos corporales fluidos, física y múltiples animaciones de interacción.',
  path: '/models/live2d/hiyori/hiyori_free_t08.model3.json',
  
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
        "hiyori_m01",
        "hiyori_m02",
        "hiyori_m03",
        "hiyori_m04",
        "hiyori_m05",
        "hiyori_m06",
        "hiyori_m07",
        "hiyori_m08"
    ],
    "totalParameters": 29
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
            "ParamMouthForm": -1.0
        }
    },
    "angry": {
        "type": "parameters",
        "targets": {
            "ParamMouthForm": -0.5
        }
    },
    "love": {
        "type": "fallback",
        "fallback": "idle"
    }
}
};

export default hiyoriProfile;
