/**
 * Live2D Model Profile: Miara (miara)
 * Official Live2D Cubism Pro with 3 named motion groups.
 * Expressions via parameter targets (no .exp3 files present).
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
    // No .exp3 files — expressions via parameter targets
    "customExpressions": [],
    // Motion groups as declared in model3.json
    "motionGroups": {
      "Idle": [0],  // Scene1
      "Tap":  [0],  // Scene2
      "Flic": [0]   // Scene3
    },
    "motions": [
      { "group": "Idle", "index": 0, "label": "Idle",             "icon": "🌙" },
      { "group": "Tap",  "index": 0, "label": "Reacción (Tap)",   "icon": "🫳" },
      { "group": "Flic", "index": 0, "label": "Barrido (Flick)",  "icon": "💫" }
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
            "ParamMouthForm": 1.0,
            "ParamBrowLY": 0.3,
            "ParamBrowRY": 0.3
        }
    },
    "blush": {
        "type": "parameters",
        "targets": {
            "ParamMouthForm": 0.8,
            "ParamBrowLY": 0.2,
            "ParamBrowRY": 0.2
        }
    },
    "yandere": {
        "type": "parameters",
        "targets": {
            "ParamMouthForm": -0.8,
            "ParamBrowLAngle": -0.7,
            "ParamBrowRAngle": -0.7
        }
    },
    "wink": {
        "type": "parameters",
        "targets": {
            "ParamEyeROpen": 0.0
        }
    },
    "surprised": {
        "type": "parameters",
        "targets": {
            "ParamEyeLOpen": 1.0,
            "ParamEyeROpen": 1.0,
            "ParamMouthOpenY": 0.5,
            "ParamBrowLY": 0.6,
            "ParamBrowRY": 0.6
        }
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
        "type": "parameters",
        "targets": {
            "ParamMouthForm": 1.0,
            "ParamBrowLY": 0.4,
            "ParamBrowRY": 0.4
        }
    }
  }
};

export default miaraProfile;
