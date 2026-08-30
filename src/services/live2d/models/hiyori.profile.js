/**
 * Live2D Model Profile: Hiyori Momose (hiyori)
 * Official Live2D Cubism Pro sample model with 8 named motion groups.
 * Expressions implemented via parameter targets (no .exp3 files present).
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
    // No .exp3 files — expressions via parameter targets
    "customExpressions": [],
    // Motion groups as declared in model3.json
    "motionGroups": {
      "Idle":       [0, 1, 2],  // hiyori_m01, m02, m05
      "Flick":      [0],         // hiyori_m03
      "FlickDown":  [0],         // hiyori_m04
      "Tap":        [0],         // hiyori_m06
      "Tap@Body":   [0],         // hiyori_m07
      "Flick@Body": [0]          // hiyori_m08
    },
    "motions": [
      { "group": "Idle",       "index": 0, "label": "Idle 1",         "icon": "🌸" },
      { "group": "Idle",       "index": 1, "label": "Idle 2",         "icon": "🌸" },
      { "group": "Idle",       "index": 2, "label": "Idle 3",         "icon": "🌸" },
      { "group": "Flick",      "index": 0, "label": "Giro (Flick)",   "icon": "🌀" },
      { "group": "FlickDown",  "index": 0, "label": "Bajar (FlickDown)", "icon": "👇" },
      { "group": "Tap",        "index": 0, "label": "Tap Cabeza",     "icon": "🫳" },
      { "group": "Tap@Body",   "index": 0, "label": "Tap Cuerpo",     "icon": "👆" },
      { "group": "Flick@Body", "index": 0, "label": "Flick Cuerpo",   "icon": "💫" }
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
            "ParamEyeRSmile": 0.8,
            "ParamMouthForm": 0.6
        }
    },
    "yandere": {
        "type": "parameters",
        "targets": {
            "ParamMouthForm": -1.0,
            "ParamEyeLSmile": 0.3,
            "ParamEyeRSmile": 0.3
        }
    },
    "wink": {
        "type": "parameters",
        "targets": {
            "ParamEyeROpen": 0.0,
            "ParamEyeRSmile": 1.0,
            "ParamCheek": 0.5
        }
    },
    "surprised": {
        "type": "parameters",
        "targets": {
            "ParamEyeLOpen": 1.0,
            "ParamEyeROpen": 1.0,
            "ParamMouthOpenY": 0.6,
            "ParamMouthForm": -0.3
        }
    },
    "sad": {
        "type": "parameters",
        "targets": {
            "ParamMouthForm": -1.0,
            "ParamCheek": 0.0
        }
    },
    "angry": {
        "type": "parameters",
        "targets": {
            "ParamMouthForm": -0.5,
            "ParamEyeLOpen": 0.9,
            "ParamEyeROpen": 0.9
        }
    },
    "love": {
        "type": "parameters",
        "targets": {
            "ParamEyeLSmile": 1.0,
            "ParamEyeRSmile": 1.0,
            "ParamCheek": 1.0,
            "ParamMouthForm": 1.0
        }
    }
  }
};

export default hiyoriProfile;
