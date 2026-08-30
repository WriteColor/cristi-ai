/**
 * Live2D Model Profile: Ellen Joe (ZZZ) (ellen)
 * Generated with dynamic capability introspection
 */

export const ellenProfile = {
  id: 'ellen',
  name: 'Ellen Joe (ZZZ)',
  character: 'Ellen Joe',
  theme: 'Shark Maid / Zenless Zone Zero',
  badge: 'ZZZ',
  recommendedVoice: 'Aoede',
  description: 'Maid tiburón de Zenless Zone Zero con expresiones de sonrojo, oscuridad y animaciones idle.',
  path: '/models/live2d/ellen/免费模型艾莲.model3.json',
  
  hiddenParts: ['Part17'],
  // Prevent activation of artist credit overlay expression
  // shuiyin.exp3.json contains attribution for 立绘/Illust: 神宫凉子, Rigger: 杨小咛
  // The file is preserved — only blocked from being triggered as a user expression
  blockedExpressions: ['shuiyin'],
  
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
        "black",
        "red",
        "shock",
        "shou",
        "tang"
        // Note: 'shuiyin' is intentionally excluded (artist credit expression — blocked)
    ],
    "motions": [
        "idle",
        "idle2"
    ],
    "totalParameters": 207
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
    "breath": "ParamBreath"
},
  
  semanticActions: {
    "idle": {
        "type": "parameters",
        "targets": {}
    },
    "happy": {
        "type": "expression",
        "name": "red"
    },
    "blush": {
        "type": "expression",
        "name": "red"
    },
    "yandere": {
        "type": "expression",
        "name": "black"
    },
    "wink": {
        "type": "parameters",
        "targets": {
            "ParamEyeROpen": 0.0,
            "ParamEyeRSmile": 1.0
        }
    },
    "surprised": {
        "type": "expression",
        "name": "shock"
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

export default ellenProfile;
