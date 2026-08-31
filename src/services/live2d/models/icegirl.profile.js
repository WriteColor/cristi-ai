/**
 * Live2D Model Profile: Ice Girl (Cheongsam) (icegirl)
 * Generated with dynamic capability introspection
 */

export const icegirlProfile = {
  id: 'icegirl',
  name: 'Ice Girl (Cheongsam)',
  character: 'Ice Girl',
  theme: 'Elegant Ice Cheongsam',
  badge: 'Expresiva',
  recommendedVoice: 'Kore',
  description: 'Modelo elegante con 246 parámetros y 20 expresiones gestuales avanzadas (corazones, estrellas, sonrojo, guiño).',
  path: '/models/live2d/icegirl/IceGirl.model3.json',
  
  capabilities: {
    "facialExpressions": true,
    "eyeBlink": true,
    "eyeTracking": true,
    "mouthControl": true,
    "headMovement": true,
    "bodyMovement": false,
    "armMovement": true,
    "breathing": true,
    "physics": true,
    "customExpressions": [
        "←歪嘴",
        "惊讶",
        "手柄",
        "披发",
        "星星眼",
        "歪嘴→",
        "流泪",
        "爱心眼",
        "猫耳",
        "王冠",
        "生气",
        "疑惑",
        "白眼",
        "直播套装",
        "翅膀",
        "脸红",
        "脸黑",
        "舌头",
        "金钱眼",
        "马尾"
    ],
    "motions": [
        "DaiJi",
        "HuiShou",
        "MeiYan"
    ],
    "totalParameters": 246
},
  
  standardMapping: {
    "head_angle_x": "ParamAngleX",
    "head_angle_y": "ParamAngleY",
    "head_angle_z": "ParamAngleZ",
    "eye_l_open": "ParamEyeLOpen",
    "eye_r_open": "ParamEyeROpen",
    "eye_l_smile": "ParamEyeLSmile",
    "eye_r_smile": "ParamEyeRSmile",
    "eye_ball_x": "ParamEyeBallX",
    "eye_ball_y": "ParamEyeBallY",
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
            "ParamEyeLSmile": 1.0,
            "ParamEyeRSmile": 1.0,
            "ParamMouthForm": 1.0
        }
    },
    "blush": {
        "type": "expression",
        "name": "脸红"
    },
    "yandere": {
        "type": "expression",
        "name": "脸黑"
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
        "name": "惊讶"
    },
    "sad": {
        "type": "expression",
        "name": "流泪"
    },
    "angry": {
        "type": "expression",
        "name": "生气"
    },
    "love": {
        "type": "expression",
        "name": "爱心眼"
    },
    "excited": {
        "type": "expression",
        "name": "星星眼"
    },
    "gamer": {
        "type": "expression",
        "name": "手柄"
    },
    "smug": {
        "type": "expression",
        "name": "←歪嘴"
    }
}
};

export default icegirlProfile;
