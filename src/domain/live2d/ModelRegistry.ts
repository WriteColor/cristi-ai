/**
 * Cristi AI - Live2D Model Registry & Emotional Parameter Mapping Engine
 * 
 * Provides strongly-typed registration, discovery, parameter normalization,
 * and emotional gesture resolution across the 13 official Live2D Cubism models.
 */

export type OfficialModelId =
  | 'yanderegirl'
  | 'icegirl'
  | 'hiyori'
  | 'miara'
  | 'toki'
  | 'ellen'
  | 'jane_doe'
  | 'ruan_mei'
  | 'belle'
  | 'sparkle'
  | 'huohuo'
  | 'vivian'
  | 'goth_loli';

export const OFFICIAL_MODEL_IDS: readonly OfficialModelId[] = [
  'yanderegirl',
  'icegirl',
  'hiyori',
  'miara',
  'toki',
  'ellen',
  'jane_doe',
  'ruan_mei',
  'belle',
  'sparkle',
  'huohuo',
  'vivian',
  'goth_loli',
] as const;

export type EmotionalGesture =
  | 'idle'
  | 'happy'
  | 'smile'
  | 'blush'
  | 'shy'
  | 'yandere'
  | 'crazy'
  | 'angry'
  | 'mad'
  | 'pout'
  | 'surprised'
  | 'shock'
  | 'scared'
  | 'sad'
  | 'crying'
  | 'wink'
  | 'smug'
  | 'gamer'
  | 'streaming'
  | 'thinking'
  | 'love'
  | 'excited'
  | 'relaxed'
  | (string & {});

export interface StandardParameterMapping {
  head_angle_x?: string;
  head_angle_y?: string;
  head_angle_z?: string;
  body_angle_x?: string;
  body_angle_y?: string;
  body_angle_z?: string;
  eye_l_open?: string;
  eye_r_open?: string;
  eye_l_smile?: string;
  eye_r_smile?: string;
  eye_ball_x?: string;
  eye_ball_y?: string;
  brow_l_y?: string;
  brow_r_y?: string;
  brow_l_x?: string;
  brow_r_x?: string;
  brow_l_angle?: string;
  brow_r_angle?: string;
  brow_l_form?: string;
  brow_r_form?: string;
  mouth_open_y?: string;
  mouth_form?: string;
  cheek_blush?: string;
  breath?: string;
  [key: string]: string | undefined;
}

export type SemanticActionResult =
  | { type: 'expression'; name: string }
  | { type: 'parameters'; targets: Record<string, number> }
  | { type: 'motion'; group: string; index?: number }
  | { type: 'fallback'; fallback: string };

export interface MotionGroupItem {
  group: string;
  index: number;
  label?: string;
  icon?: string;
}

export interface ModelCapabilityInfo {
  facialExpressions: boolean;
  eyeBlink: boolean;
  eyeTracking: boolean;
  mouthControl: boolean;
  headMovement: boolean;
  bodyMovement: boolean;
  armMovement?: boolean;
  breathing: boolean;
  physics: boolean;
  customExpressions?: string[];
  motions?: Array<string | MotionGroupItem>;
  motionGroups?: Record<string, number[]>;
  totalParameters?: number;
}

export interface ModelDescriptor {
  id: OfficialModelId | string;
  name: string;
  character: string;
  theme: string;
  badge?: string;
  recommendedVoice?: string;
  description: string;
  path: string;
  hiddenParts?: string[];
  lockedParameters?: Record<string, number>;
  blockedExpressions?: string[];
  capabilities: ModelCapabilityInfo;
  standardMapping: StandardParameterMapping;
  semanticActions?: Record<string, SemanticActionResult>;
  registeredAt?: number;
}

export interface DetectedParameterInfo {
  id: string;
  min: number;
  max: number;
  default: number;
  index?: number;
}

export interface DetectedCapabilities {
  parameters: Map<string, DetectedParameterInfo>;
  expressions: string[];
  motions: string[];
  hasPhysics: boolean;
  standardMapping: Record<string, { paramId: string; min: number; max: number; default: number }>;
}

/**
 * Standard dictionary of 13 official Live2D Cubism models.
 */
export const OFFICIAL_MODEL_DESCRIPTORS: Record<OfficialModelId, ModelDescriptor> = {
  yanderegirl: {
    id: 'yanderegirl',
    name: 'Cristi Gótica (Yandere Girl)',
    character: 'Cristi',
    theme: 'Goth / Yandere AI Companion',
    badge: 'Predeterminado',
    recommendedVoice: 'Aoede',
    description: 'Compañera IA yandere gótica con amplio rango de expresiones, seguimiento visual y física capilar completa.',
    path: '/models/live2d/yanderegirl/yanderegirl.model3.json',
    capabilities: {
      facialExpressions: true,
      eyeBlink: true,
      eyeTracking: true,
      mouthControl: true,
      headMovement: true,
      bodyMovement: true,
      armMovement: false,
      breathing: true,
      physics: true,
      customExpressions: ['Crazy', 'Mad', 'Scared', 'Yandere'],
      motions: [],
      totalParameters: 35,
    },
    standardMapping: {
      head_angle_x: 'ParamAngleX',
      head_angle_y: 'ParamAngleY',
      head_angle_z: 'ParamAngleZ',
      body_angle_x: 'ParamBodyAngleX',
      body_angle_y: 'ParamBodyAngleY',
      body_angle_z: 'ParamBodyAngleZ',
      eye_l_open: 'ParamEyeLOpen',
      eye_r_open: 'ParamEyeROpen',
      eye_l_smile: 'ParamEyeLSmile',
      eye_r_smile: 'ParamEyeRSmile',
      eye_ball_x: 'ParamEyeBallX',
      eye_ball_y: 'ParamEyeBallY',
      brow_l_y: 'ParamBrowLY',
      brow_r_y: 'ParamBrowRY',
      brow_l_angle: 'ParamBrowLAngle',
      brow_r_angle: 'ParamBrowRAngle',
      mouth_open_y: 'ParamMouthOpenY',
      mouth_form: 'ParamMouthForm',
      cheek_blush: 'ParamCheek',
      breath: 'ParamBreath',
    },
    semanticActions: {
      idle: { type: 'parameters', targets: {} },
      happy: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamMouthForm: 1.0, ParamCheek: 0.5 },
      },
      blush: {
        type: 'parameters',
        targets: { ParamCheek: 1.0, ParamEyeLSmile: 0.6, ParamEyeRSmile: 0.6 },
      },
      yandere: { type: 'expression', name: 'Yandere' },
      wink: {
        type: 'parameters',
        targets: { ParamEyeROpen: 0.0, ParamEyeRSmile: 1.0 },
      },
      surprised: { type: 'expression', name: 'Scared' },
      crazy: { type: 'expression', name: 'Crazy' },
      sad: {
        type: 'parameters',
        targets: { ParamBrowLY: -0.6, ParamBrowRY: -0.6, ParamMouthForm: -1.0 },
      },
      angry: { type: 'expression', name: 'Mad' },
      love: { type: 'expression', name: 'Yandere' },
      gamer: {
        type: 'parameters',
        targets: { ParamEyeBallY: -0.3, ParamEyeBallX: 0.2, ParamMouthForm: 0.4 },
      },
    },
  },

  icegirl: {
    id: 'icegirl',
    name: 'Ice Girl (Cheongsam)',
    character: 'Ice Girl',
    theme: 'Elegant Ice Cheongsam',
    badge: 'Expresiva',
    recommendedVoice: 'Kore',
    description: 'Modelo elegante con 246 parámetros y 20 expresiones gestuales avanzadas (corazones, estrellas, sonrojo, guiño).',
    path: '/models/live2d/icegirl/IceGirl.model3.json',
    capabilities: {
      facialExpressions: true,
      eyeBlink: true,
      eyeTracking: true,
      mouthControl: true,
      headMovement: true,
      bodyMovement: false,
      armMovement: true,
      breathing: true,
      physics: true,
      customExpressions: [
        '←歪嘴', '惊讶', '手柄', '披发', '星星眼', '歪嘴→', '流泪', '爱心眼',
        '猫耳', '王冠', '生气', '疑惑', '白眼', '直播套装', '翅膀', '脸红',
        '脸黑', '舌头', '金钱眼', '马尾',
      ],
      motions: ['DaiJi', 'HuiShou', 'MeiYan'],
      totalParameters: 246,
    },
    standardMapping: {
      head_angle_x: 'ParamAngleX',
      head_angle_y: 'ParamAngleY',
      head_angle_z: 'ParamAngleZ',
      eye_l_open: 'ParamEyeLOpen',
      eye_r_open: 'ParamEyeROpen',
      eye_l_smile: 'ParamEyeLSmile',
      eye_r_smile: 'ParamEyeRSmile',
      eye_ball_x: 'ParamEyeBallX',
      eye_ball_y: 'ParamEyeBallY',
      brow_l_angle: 'ParamBrowLAngle',
      brow_r_angle: 'ParamBrowRAngle',
      mouth_open_y: 'ParamMouthOpenY',
      mouth_form: 'ParamMouthForm',
      cheek_blush: 'ParamCheek',
      breath: 'ParamBreath',
    },
    semanticActions: {
      idle: { type: 'parameters', targets: {} },
      happy: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamMouthForm: 1.0 },
      },
      blush: { type: 'expression', name: '脸红' },
      yandere: { type: 'expression', name: '脸黑' },
      wink: {
        type: 'parameters',
        targets: { ParamEyeROpen: 0.0, ParamEyeRSmile: 1.0 },
      },
      surprised: { type: 'expression', name: '惊讶' },
      sad: { type: 'expression', name: '流泪' },
      angry: { type: 'expression', name: '生气' },
      love: { type: 'expression', name: '爱心眼' },
      excited: { type: 'expression', name: '星星眼' },
      gamer: { type: 'expression', name: '手柄' },
      smug: { type: 'expression', name: '←歪嘴' },
      streaming: { type: 'expression', name: '直播套装' },
      thinking: { type: 'expression', name: '疑惑' },
    },
  },

  hiyori: {
    id: 'hiyori',
    name: 'Hiyori Momose',
    character: 'Hiyori',
    theme: 'Anime Schoolgirl / Official Live2D',
    badge: 'Oficial Live2D',
    recommendedVoice: 'Aoede',
    description: 'Modelo oficial de referencia Live2D Cubism con movimientos corporales fluidos, física y múltiples animaciones de interacción.',
    path: '/models/live2d/hiyori/hiyori_free_t08.model3.json',
    capabilities: {
      facialExpressions: true,
      eyeBlink: true,
      eyeTracking: true,
      mouthControl: true,
      headMovement: true,
      bodyMovement: true,
      armMovement: true,
      breathing: true,
      physics: true,
      customExpressions: [],
      motionGroups: {
        Idle: [0, 1, 2],
        Flick: [0],
        FlickDown: [0],
        Tap: [0],
        'Tap@Body': [0],
        'Flick@Body': [0],
      },
      motions: [
        { group: 'Idle', index: 0, label: 'Idle 1', icon: '🌸' },
        { group: 'Idle', index: 1, label: 'Idle 2', icon: '🌸' },
        { group: 'Idle', index: 2, label: 'Idle 3', icon: '🌸' },
        { group: 'Flick', index: 0, label: 'Giro (Flick)', icon: '🌀' },
        { group: 'FlickDown', index: 0, label: 'Bajar (FlickDown)', icon: '👇' },
        { group: 'Tap', index: 0, label: 'Tap Cabeza', icon: '🫳' },
        { group: 'Tap@Body', index: 0, label: 'Tap Cuerpo', icon: '👆' },
        { group: 'Flick@Body', index: 0, label: 'Flick Cuerpo', icon: '💫' },
      ],
      totalParameters: 29,
    },
    standardMapping: {
      head_angle_x: 'ParamAngleX',
      head_angle_y: 'ParamAngleY',
      head_angle_z: 'ParamAngleZ',
      body_angle_x: 'ParamBodyAngleX',
      body_angle_y: 'ParamBodyAngleY',
      body_angle_z: 'ParamBodyAngleZ',
      eye_l_open: 'ParamEyeLOpen',
      eye_r_open: 'ParamEyeROpen',
      eye_l_smile: 'ParamEyeLSmile',
      eye_r_smile: 'ParamEyeRSmile',
      eye_ball_x: 'ParamEyeBallX',
      eye_ball_y: 'ParamEyeBallY',
      mouth_open_y: 'ParamMouthOpenY',
      mouth_form: 'ParamMouthForm',
      cheek_blush: 'ParamCheek',
      breath: 'ParamBreath',
    },
    semanticActions: {
      idle: { type: 'parameters', targets: {} },
      happy: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamMouthForm: 1.0, ParamCheek: 0.5 },
      },
      blush: {
        type: 'parameters',
        targets: { ParamCheek: 1.0, ParamEyeLSmile: 0.8, ParamEyeRSmile: 0.8, ParamMouthForm: 0.6 },
      },
      yandere: {
        type: 'parameters',
        targets: { ParamMouthForm: -1.0, ParamEyeLSmile: 0.3, ParamEyeRSmile: 0.3 },
      },
      wink: {
        type: 'parameters',
        targets: { ParamEyeROpen: 0.0, ParamEyeRSmile: 1.0, ParamCheek: 0.5 },
      },
      surprised: {
        type: 'parameters',
        targets: { ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0, ParamMouthOpenY: 0.6, ParamMouthForm: -0.3 },
      },
      sad: {
        type: 'parameters',
        targets: { ParamMouthForm: -1.0, ParamCheek: 0.0 },
      },
      angry: {
        type: 'parameters',
        targets: { ParamMouthForm: -0.5, ParamEyeLOpen: 0.9, ParamEyeROpen: 0.9 },
      },
      love: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamCheek: 1.0, ParamMouthForm: 1.0 },
      },
    },
  },

  miara: {
    id: 'miara',
    name: 'Miara Pro',
    character: 'Miara',
    theme: 'Cute Fox Girl / Kemonomimi',
    badge: 'Pro Kemono',
    recommendedVoice: 'Aoede',
    description: 'Chica zorro kemonomimi con orejas dinámicas, física en cola y expresiones kawaii de alta definición.',
    path: '/models/live2d/miara/miara_pro_t03.model3.json',
    capabilities: {
      facialExpressions: true,
      eyeBlink: true,
      eyeTracking: true,
      mouthControl: true,
      headMovement: true,
      bodyMovement: true,
      armMovement: true,
      breathing: true,
      physics: true,
      customExpressions: [],
      motions: ['Idle', 'TapBody', 'TapSpecial'],
      totalParameters: 32,
    },
    standardMapping: {
      head_angle_x: 'ParamAngleX',
      head_angle_y: 'ParamAngleY',
      head_angle_z: 'ParamAngleZ',
      body_angle_x: 'ParamBodyAngleX',
      body_angle_y: 'ParamBodyAngleY',
      body_angle_z: 'ParamBodyAngleZ',
      eye_l_open: 'ParamEyeLOpen',
      eye_r_open: 'ParamEyeROpen',
      eye_l_smile: 'ParamEyeLSmile',
      eye_r_smile: 'ParamEyeRSmile',
      eye_ball_x: 'ParamEyeBallX',
      eye_ball_y: 'ParamEyeBallY',
      mouth_open_y: 'ParamMouthOpenY',
      mouth_form: 'ParamMouthForm',
      cheek_blush: 'ParamCheek',
      breath: 'ParamBreath',
    },
    semanticActions: {
      idle: { type: 'parameters', targets: {} },
      happy: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamMouthForm: 1.0, ParamCheek: 0.6 },
      },
      blush: {
        type: 'parameters',
        targets: { ParamCheek: 1.0, ParamEyeLSmile: 0.7, ParamEyeRSmile: 0.7 },
      },
      yandere: {
        type: 'parameters',
        targets: { ParamMouthForm: -0.8, ParamCheek: 0.5 },
      },
      wink: {
        type: 'parameters',
        targets: { ParamEyeROpen: 0.0, ParamEyeRSmile: 1.0 },
      },
      surprised: {
        type: 'parameters',
        targets: { ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0, ParamMouthOpenY: 0.7 },
      },
      love: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamCheek: 1.0, ParamMouthForm: 1.0 },
      },
    },
  },

  toki: {
    id: 'toki',
    name: 'Toki (Blue Archive)',
    character: 'Toki',
    theme: 'Cyber Maid / Blue Archive',
    badge: 'Blue Archive',
    recommendedVoice: 'Aoede',
    description: 'Doncella táctica de Blue Archive con mirada serena, respiración suave y estética cibernética.',
    path: '/models/live2d/toki/20220227toki.model3.json',
    capabilities: {
      facialExpressions: true,
      eyeBlink: true,
      eyeTracking: true,
      mouthControl: true,
      headMovement: true,
      bodyMovement: true,
      armMovement: true,
      breathing: true,
      physics: true,
      customExpressions: [],
      motions: [],
      totalParameters: 38,
    },
    standardMapping: {
      head_angle_x: 'ParamAngleX',
      head_angle_y: 'ParamAngleY',
      head_angle_z: 'ParamAngleZ',
      body_angle_x: 'ParamBodyAngleX',
      body_angle_y: 'ParamBodyAngleY',
      body_angle_z: 'ParamBodyAngleZ',
      eye_l_open: 'ParamEyeLOpen',
      eye_r_open: 'ParamEyeROpen',
      eye_l_smile: 'ParamEyeLSmile',
      eye_r_smile: 'ParamEyeRSmile',
      eye_ball_x: 'ParamEyeBallX',
      eye_ball_y: 'ParamEyeBallY',
      brow_l_y: 'ParamBrowLY',
      brow_r_y: 'ParamBrowRY',
      brow_l_angle: 'ParamBrowLAngle',
      brow_r_angle: 'ParamBrowRAngle',
      mouth_open_y: 'ParamMouthOpenY',
      mouth_form: 'ParamMouthForm',
      cheek_blush: 'ParamCheek',
      breath: 'ParamBreath',
    },
    semanticActions: {
      idle: { type: 'parameters', targets: {} },
      happy: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamMouthForm: 0.8, ParamCheek: 0.5 },
      },
      blush: {
        type: 'parameters',
        targets: { ParamCheek: 1.0, ParamEyeLSmile: 0.7, ParamEyeRSmile: 0.7 },
      },
      yandere: {
        type: 'parameters',
        targets: { ParamMouthForm: -0.5, ParamEyeLSmile: 0.4, ParamEyeRSmile: 0.4 },
      },
      wink: {
        type: 'parameters',
        targets: { ParamEyeROpen: 0.0, ParamEyeRSmile: 1.0 },
      },
      surprised: {
        type: 'parameters',
        targets: { ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0, ParamMouthOpenY: 0.5 },
      },
      sad: {
        type: 'parameters',
        targets: { ParamBrowLY: -0.5, ParamBrowRY: -0.5, ParamMouthForm: -0.8 },
      },
      angry: {
        type: 'parameters',
        targets: { ParamBrowLAngle: -0.7, ParamBrowRAngle: -0.7, ParamMouthForm: -0.4 },
      },
      love: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamCheek: 1.0, ParamMouthForm: 0.8 },
      },
    },
  },

  ellen: {
    id: 'ellen',
    name: 'Ellen Joe (ZZZ)',
    character: 'Ellen Joe',
    theme: 'Shark Maid / Zenless Zone Zero',
    badge: 'ZZZ',
    recommendedVoice: 'Aoede',
    description: 'Maid tiburón de Zenless Zone Zero con expresiones de sonrojo, oscuridad y animaciones idle.',
    path: '/models/live2d/ellen/免费模型艾莲.model3.json',
    hiddenParts: ['Part17', 'Part78', 'Part8'],
    lockedParameters: {
      Paramheadxy: 0,
      ParambodyXY2: 0,
    },
    blockedExpressions: ['shuiyin'],
    capabilities: {
      facialExpressions: true,
      eyeBlink: true,
      eyeTracking: true,
      mouthControl: true,
      headMovement: true,
      bodyMovement: true,
      armMovement: false,
      breathing: true,
      physics: true,
      customExpressions: ['black', 'red', 'shock', 'shou', 'tang'],
      motions: ['idle', 'idle2'],
      totalParameters: 207,
    },
    standardMapping: {
      head_angle_x: 'ParamAngleX',
      head_angle_y: 'ParamAngleY',
      head_angle_z: 'ParamAngleZ',
      body_angle_x: 'ParamBodyAngleX',
      body_angle_y: 'ParamBodyAngleY',
      body_angle_z: 'ParamBodyAngleZ',
      eye_l_open: 'ParamEyeLOpen',
      eye_r_open: 'ParamEyeROpen',
      eye_l_smile: 'ParamEyeLSmile',
      eye_r_smile: 'ParamEyeRSmile',
      eye_ball_x: 'ParamEyeBallX',
      eye_ball_y: 'ParamEyeBallY',
      brow_l_y: 'ParamBrowLY',
      brow_r_y: 'ParamBrowRY',
      brow_l_angle: 'ParamBrowLAngle',
      brow_r_angle: 'ParamBrowRAngle',
      mouth_open_y: 'ParamMouthOpenY',
      mouth_form: 'ParamMouthForm',
      breath: 'ParamBreath',
    },
    semanticActions: {
      idle: { type: 'parameters', targets: {} },
      happy: { type: 'expression', name: 'red' },
      blush: { type: 'expression', name: 'red' },
      yandere: { type: 'expression', name: 'black' },
      wink: {
        type: 'parameters',
        targets: { ParamEyeROpen: 0.0, ParamEyeRSmile: 1.0 },
      },
      surprised: { type: 'expression', name: 'shock' },
      sad: {
        type: 'parameters',
        targets: { ParamBrowLY: -0.6, ParamBrowRY: -0.6, ParamMouthForm: -1.0 },
      },
      angry: {
        type: 'parameters',
        targets: { ParamBrowLAngle: -0.8, ParamBrowRAngle: -0.8, ParamMouthForm: -0.5 },
      },
      love: { type: 'expression', name: 'red' },
      shy: { type: 'expression', name: 'shou' },
      playful: { type: 'expression', name: 'tang' },
    },
  },

  jane_doe: {
    id: 'jane_doe',
    name: 'Jane Doe (ZZZ)',
    character: 'Jane Doe',
    theme: 'Seductive Rat Thiren / Zenless Zone Zero',
    badge: 'ZZZ',
    recommendedVoice: 'Kore',
    description: 'Thiren rata seductora de Zenless Zone Zero con movimiento de cola, mirada intensa y física corporal dinámica.',
    path: '/models/live2d/jane_doe/简.model3.json',
    capabilities: {
      facialExpressions: true,
      eyeBlink: true,
      eyeTracking: true,
      mouthControl: true,
      headMovement: true,
      bodyMovement: true,
      armMovement: true,
      breathing: true,
      physics: true,
      customExpressions: [],
      motions: ['Idle', 'Special'],
      totalParameters: 45,
    },
    standardMapping: {
      head_angle_x: 'ParamAngleX',
      head_angle_y: 'ParamAngleY',
      head_angle_z: 'ParamAngleZ',
      body_angle_x: 'ParamBodyAngleX',
      body_angle_y: 'ParamBodyAngleY',
      body_angle_z: 'ParamBodyAngleZ',
      eye_l_open: 'ParamEyeLOpen',
      eye_r_open: 'ParamEyeROpen',
      eye_l_smile: 'ParamEyeLSmile',
      eye_r_smile: 'ParamEyeRSmile',
      eye_ball_x: 'ParamEyeBallX',
      eye_ball_y: 'ParamEyeBallY',
      mouth_open_y: 'ParamMouthOpenY',
      mouth_form: 'ParamMouthForm',
      cheek_blush: 'ParamCheek',
      breath: 'ParamBreath',
    },
    semanticActions: {
      idle: { type: 'parameters', targets: {} },
      happy: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamMouthForm: 1.0, ParamCheek: 0.4 },
      },
      blush: {
        type: 'parameters',
        targets: { ParamCheek: 1.0, ParamEyeLSmile: 0.8, ParamEyeRSmile: 0.8 },
      },
      yandere: {
        type: 'parameters',
        targets: { ParamMouthForm: -0.6, ParamCheek: 0.6 },
      },
      wink: {
        type: 'parameters',
        targets: { ParamEyeROpen: 0.0, ParamEyeRSmile: 1.0 },
      },
      surprised: {
        type: 'parameters',
        targets: { ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0, ParamMouthOpenY: 0.6 },
      },
      love: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamCheek: 1.0, ParamMouthForm: 0.9 },
      },
    },
  },

  ruan_mei: {
    id: 'ruan_mei',
    name: 'Ruan Mei (Honkai: Star Rail)',
    character: 'Ruan Mei',
    theme: 'Scholarly Biologist / HSR Genius Society #81',
    badge: 'HSR',
    recommendedVoice: 'Kore',
    description: 'Miembro #81 de la Sociedad de Genios de Honkai: Star Rail. Elegante, serena, con mirada analítica y porte refinado.',
    path: '/models/live2d/ruan_mei/ruan_mei.model3.json',
    capabilities: {
      facialExpressions: true,
      eyeBlink: true,
      eyeTracking: true,
      mouthControl: true,
      headMovement: true,
      bodyMovement: true,
      armMovement: true,
      breathing: true,
      physics: true,
      customExpressions: [],
      motions: ['Idle', 'Touch'],
      totalParameters: 40,
    },
    standardMapping: {
      head_angle_x: 'ParamAngleX',
      head_angle_y: 'ParamAngleY',
      head_angle_z: 'ParamAngleZ',
      body_angle_x: 'ParamBodyAngleX',
      body_angle_y: 'ParamBodyAngleY',
      body_angle_z: 'ParamBodyAngleZ',
      eye_l_open: 'ParamEyeLOpen',
      eye_r_open: 'ParamEyeROpen',
      eye_l_smile: 'ParamEyeLSmile',
      eye_r_smile: 'ParamEyeRSmile',
      eye_ball_x: 'ParamEyeBallX',
      eye_ball_y: 'ParamEyeBallY',
      mouth_open_y: 'ParamMouthOpenY',
      mouth_form: 'ParamMouthForm',
      cheek_blush: 'ParamCheek',
      breath: 'ParamBreath',
    },
    semanticActions: {
      idle: { type: 'parameters', targets: {} },
      happy: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 0.8, ParamEyeRSmile: 0.8, ParamMouthForm: 0.7, ParamCheek: 0.3 },
      },
      blush: {
        type: 'parameters',
        targets: { ParamCheek: 0.8, ParamEyeLSmile: 0.5, ParamEyeRSmile: 0.5 },
      },
      thinking: {
        type: 'parameters',
        targets: { ParamEyeBallY: 0.4, ParamMouthForm: 0.0 },
      },
      surprised: {
        type: 'parameters',
        targets: { ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0, ParamMouthOpenY: 0.4 },
      },
      love: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamCheek: 0.8, ParamMouthForm: 0.7 },
      },
    },
  },

  belle: {
    id: 'belle',
    name: 'Belle (ZZZ)',
    character: 'Belle',
    theme: 'Proxy Sister / Zenless Zone Zero',
    badge: 'ZZZ',
    recommendedVoice: 'Aoede',
    description: 'La carismática y expresiva Proxy de New Eridu (Zenless Zone Zero) con auriculares, gestos animados y estilo urbano.',
    path: '/models/live2d/belle/zzz_belle.model3.json',
    capabilities: {
      facialExpressions: true,
      eyeBlink: true,
      eyeTracking: true,
      mouthControl: true,
      headMovement: true,
      bodyMovement: true,
      armMovement: true,
      breathing: true,
      physics: true,
      customExpressions: [],
      motions: ['Idle', 'Tap'],
      totalParameters: 36,
    },
    standardMapping: {
      head_angle_x: 'ParamAngleX',
      head_angle_y: 'ParamAngleY',
      head_angle_z: 'ParamAngleZ',
      body_angle_x: 'ParamBodyAngleX',
      body_angle_y: 'ParamBodyAngleY',
      body_angle_z: 'ParamBodyAngleZ',
      eye_l_open: 'ParamEyeLOpen',
      eye_r_open: 'ParamEyeROpen',
      eye_l_smile: 'ParamEyeLSmile',
      eye_r_smile: 'ParamEyeRSmile',
      eye_ball_x: 'ParamEyeBallX',
      eye_ball_y: 'ParamEyeBallY',
      mouth_open_y: 'ParamMouthOpenY',
      mouth_form: 'ParamMouthForm',
      cheek_blush: 'ParamCheek',
      breath: 'ParamBreath',
    },
    semanticActions: {
      idle: { type: 'parameters', targets: {} },
      happy: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamMouthForm: 1.0, ParamCheek: 0.5 },
      },
      blush: {
        type: 'parameters',
        targets: { ParamCheek: 1.0, ParamEyeLSmile: 0.7, ParamEyeRSmile: 0.7 },
      },
      wink: {
        type: 'parameters',
        targets: { ParamEyeROpen: 0.0, ParamEyeRSmile: 1.0 },
      },
      surprised: {
        type: 'parameters',
        targets: { ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0, ParamMouthOpenY: 0.6 },
      },
      gamer: {
        type: 'parameters',
        targets: { ParamEyeBallX: 0.2, ParamEyeBallY: -0.2, ParamMouthForm: 0.5 },
      },
      love: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamCheek: 1.0, ParamMouthForm: 0.9 },
      },
    },
  },

  sparkle: {
    id: 'sparkle',
    name: 'Sparkle / Hanabi (Honkai: Star Rail)',
    character: 'Sparkle',
    theme: 'Masked Fool / Honkai: Star Rail',
    badge: 'HSR',
    recommendedVoice: 'Aoede',
    description: 'Incontenible Bufona Enmascarada de Honkai: Star Rail. Juguetona, traviesa, con máscaras kitsune y sonrisas pícaras.',
    path: '/models/live2d/sparkle/Sparkle.model3.json',
    capabilities: {
      facialExpressions: true,
      eyeBlink: true,
      eyeTracking: true,
      mouthControl: true,
      headMovement: true,
      bodyMovement: true,
      armMovement: true,
      breathing: true,
      physics: true,
      customExpressions: [],
      motions: ['Idle', 'Laugh'],
      totalParameters: 48,
    },
    standardMapping: {
      head_angle_x: 'ParamAngleX',
      head_angle_y: 'ParamAngleY',
      head_angle_z: 'ParamAngleZ',
      body_angle_x: 'ParamBodyAngleX',
      body_angle_y: 'ParamBodyAngleY',
      body_angle_z: 'ParamBodyAngleZ',
      eye_l_open: 'ParamEyeLOpen',
      eye_r_open: 'ParamEyeROpen',
      eye_l_smile: 'ParamEyeLSmile',
      eye_r_smile: 'ParamEyeRSmile',
      eye_ball_x: 'ParamEyeBallX',
      eye_ball_y: 'ParamEyeBallY',
      mouth_open_y: 'ParamMouthOpenY',
      mouth_form: 'ParamMouthForm',
      cheek_blush: 'ParamCheek',
      breath: 'ParamBreath',
    },
    semanticActions: {
      idle: { type: 'parameters', targets: {} },
      happy: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamMouthForm: 1.0, ParamCheek: 0.6 },
      },
      smug: {
        type: 'parameters',
        targets: { ParamMouthForm: 1.0, ParamEyeLSmile: 0.8, ParamEyeRSmile: 0.3, ParamCheek: 0.4 },
      },
      blush: {
        type: 'parameters',
        targets: { ParamCheek: 1.0, ParamEyeLSmile: 0.8, ParamEyeRSmile: 0.8 },
      },
      yandere: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 0.6, ParamEyeRSmile: 0.6, ParamMouthForm: -0.4, ParamCheek: 0.7 },
      },
      wink: {
        type: 'parameters',
        targets: { ParamEyeROpen: 0.0, ParamEyeRSmile: 1.0 },
      },
      surprised: {
        type: 'parameters',
        targets: { ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0, ParamMouthOpenY: 0.6 },
      },
      love: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamCheek: 1.0, ParamMouthForm: 1.0 },
      },
    },
  },

  huohuo: {
    id: 'huohuo',
    name: 'Huohuo (Honkai: Star Rail)',
    character: 'Huohuo',
    theme: 'Timid Foxian Judge / Ten-Lords Commission',
    badge: 'HSR',
    recommendedVoice: 'Aoede',
    description: 'Jueza Foxiana tímida de la Comisión de los Diez Señores (HSR). Adorable, asustadiza, con orejas de zorro que tiemblan de nervios.',
    path: '/models/live2d/huohuo/huohuo.model3.json',
    capabilities: {
      facialExpressions: true,
      eyeBlink: true,
      eyeTracking: true,
      mouthControl: true,
      headMovement: true,
      bodyMovement: true,
      armMovement: true,
      breathing: true,
      physics: true,
      customExpressions: [],
      motions: ['Idle', 'Scared'],
      totalParameters: 34,
    },
    standardMapping: {
      head_angle_x: 'ParamAngleX',
      head_angle_y: 'ParamAngleY',
      head_angle_z: 'ParamAngleZ',
      body_angle_x: 'ParamBodyAngleX',
      body_angle_y: 'ParamBodyAngleY',
      body_angle_z: 'ParamBodyAngleZ',
      eye_l_open: 'ParamEyeLOpen',
      eye_r_open: 'ParamEyeROpen',
      eye_l_smile: 'ParamEyeLSmile',
      eye_r_smile: 'ParamEyeRSmile',
      eye_ball_x: 'ParamEyeBallX',
      eye_ball_y: 'ParamEyeBallY',
      brow_l_y: 'ParamBrowLY',
      brow_r_y: 'ParamBrowRY',
      mouth_open_y: 'ParamMouthOpenY',
      mouth_form: 'ParamMouthForm',
      cheek_blush: 'ParamCheek',
      breath: 'ParamBreath',
    },
    semanticActions: {
      idle: { type: 'parameters', targets: {} },
      happy: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 0.9, ParamEyeRSmile: 0.9, ParamMouthForm: 0.8, ParamCheek: 0.6 },
      },
      blush: {
        type: 'parameters',
        targets: { ParamCheek: 1.0, ParamEyeLSmile: 0.5, ParamEyeRSmile: 0.5 },
      },
      surprised: {
        type: 'parameters',
        targets: { ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0, ParamBrowLY: 0.8, ParamBrowRY: 0.8, ParamMouthOpenY: 0.7 },
      },
      scared: {
        type: 'parameters',
        targets: { ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0, ParamBrowLY: 0.6, ParamBrowRY: 0.6, ParamMouthForm: -0.8 },
      },
      sad: {
        type: 'parameters',
        targets: { ParamBrowLY: -0.6, ParamBrowRY: -0.6, ParamMouthForm: -0.9 },
      },
      love: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamCheek: 1.0, ParamMouthForm: 0.7 },
      },
    },
  },

  vivian: {
    id: 'vivian',
    name: 'Vivian (Anime Idol)',
    character: 'Vivian',
    theme: 'Anime Idol / Cyber Singer',
    badge: 'Idol',
    recommendedVoice: 'Aoede',
    description: 'Idol virtual enérgica con sonrisa brillante, cabello turquesa vibrante y movimientos de canto en vivo.',
    path: '/models/live2d/vivian/薇薇安.model3.json',
    capabilities: {
      facialExpressions: true,
      eyeBlink: true,
      eyeTracking: true,
      mouthControl: true,
      headMovement: true,
      bodyMovement: true,
      armMovement: true,
      breathing: true,
      physics: true,
      customExpressions: [],
      motions: ['Idle', 'Sing'],
      totalParameters: 30,
    },
    standardMapping: {
      head_angle_x: 'ParamAngleX',
      head_angle_y: 'ParamAngleY',
      head_angle_z: 'ParamAngleZ',
      body_angle_x: 'ParamBodyAngleX',
      body_angle_y: 'ParamBodyAngleY',
      body_angle_z: 'ParamBodyAngleZ',
      eye_l_open: 'ParamEyeLOpen',
      eye_r_open: 'ParamEyeROpen',
      eye_l_smile: 'ParamEyeLSmile',
      eye_r_smile: 'ParamEyeRSmile',
      eye_ball_x: 'ParamEyeBallX',
      eye_ball_y: 'ParamEyeBallY',
      mouth_open_y: 'ParamMouthOpenY',
      mouth_form: 'ParamMouthForm',
      cheek_blush: 'ParamCheek',
      breath: 'ParamBreath',
    },
    semanticActions: {
      idle: { type: 'parameters', targets: {} },
      happy: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamMouthForm: 1.0, ParamCheek: 0.6 },
      },
      blush: {
        type: 'parameters',
        targets: { ParamCheek: 1.0, ParamEyeLSmile: 0.8, ParamEyeRSmile: 0.8 },
      },
      wink: {
        type: 'parameters',
        targets: { ParamEyeROpen: 0.0, ParamEyeRSmile: 1.0 },
      },
      surprised: {
        type: 'parameters',
        targets: { ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0, ParamMouthOpenY: 0.6 },
      },
      love: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamCheek: 1.0, ParamMouthForm: 1.0 },
      },
    },
  },

  goth_loli: {
    id: 'goth_loli',
    name: 'GothLoli Maid',
    character: 'GothLoli-chan / ゴスロリちゃん',
    theme: 'Gothic Lolita / Maid',
    badge: 'Maid',
    recommendedVoice: 'Aoede',
    description: 'Doncella gótica clásica con vestido victoriano negro y encaje blanco, physics capilares elásticas en coletas y lazos, reverencia y expresión recatada.',
    path: '/models/live2d/goth_loli/goth_loli.model3.json',
    capabilities: {
      facialExpressions: true,
      eyeBlink: true,
      eyeTracking: true,
      mouthControl: true,
      headMovement: true,
      bodyMovement: true,
      armMovement: false,
      breathing: true,
      physics: true,
      customExpressions: [],
      motions: [],
      totalParameters: 30,
    },
    standardMapping: {
      head_angle_x: 'ParamAngleX',
      head_angle_y: 'ParamAngleY',
      head_angle_z: 'ParamAngleZ',
      eye_l_open: 'ParamEyeLOpen',
      eye_r_open: 'ParamEyeROpen',
      eye_l_smile: 'ParamEyeLSmile',
      eye_r_smile: 'ParamEyeRSmile',
      eye_ball_x: 'ParamEyeBallX',
      eye_ball_y: 'ParamEyeBallY',
      brow_l_y: 'ParamBrowLY',
      brow_r_y: 'ParamBrowRY',
      brow_l_x: 'ParamBrowLX',
      brow_r_x: 'ParamBrowRX',
      brow_l_angle: 'ParamBrowLAngle',
      brow_r_angle: 'ParamBrowRAngle',
      brow_l_form: 'ParamBrowLForm',
      brow_r_form: 'ParamBrowRForm',
      mouth_open_y: 'ParamMouthOpenY',
      mouth_form: 'ParamMouthForm',
      cheek_blush: 'ParamCheek',
      body_angle_x: 'ParamBodyAngleX',
      body_angle_y: 'ParamBodyAngleY',
      body_angle_z: 'ParamBodyAngleZ',
      breath: 'ParamBreath',
    },
    semanticActions: {
      idle: { type: 'parameters', targets: {} },
      happy: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamMouthForm: 1.0, ParamCheek: 0.5 },
      },
      blush: {
        type: 'parameters',
        targets: { ParamCheek: 1.0, ParamEyeLSmile: 0.7, ParamEyeRSmile: 0.7 },
      },
      yandere: {
        type: 'parameters',
        targets: { ParamMouthForm: -0.7, ParamEyeLSmile: 0.3, ParamEyeRSmile: 0.3, ParamCheek: 0.6 },
      },
      wink: {
        type: 'parameters',
        targets: { ParamEyeROpen: 0.0, ParamEyeRSmile: 1.0 },
      },
      surprised: {
        type: 'parameters',
        targets: { ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0, ParamMouthOpenY: 0.6 },
      },
      sad: {
        type: 'parameters',
        targets: { ParamBrowLY: -0.6, ParamBrowRY: -0.6, ParamMouthForm: -1.0 },
      },
      angry: {
        type: 'parameters',
        targets: { ParamBrowLAngle: -0.8, ParamBrowRAngle: -0.8, ParamMouthForm: -0.5 },
      },
      love: {
        type: 'parameters',
        targets: { ParamEyeLSmile: 1.0, ParamEyeRSmile: 1.0, ParamCheek: 1.0, ParamMouthForm: 0.9 },
      },
    },
  },
};

/**
 * Multi-lingual synonym lookup map for resolving natural language gestures to Cubism tags.
 */
const SYNONYM_MAP: Record<string, string[]> = {
  love: ['爱心眼', 'love', 'amor', 'enamorada', 'corazon', 'corazón', 'teamo', 'red', 'yandere', 'shou'],
  happy: ['happy', 'feliz', 'alegre', 'contenta', 'smile', 'sonrisa', 'meiyan', 'red'],
  blush: ['脸红', 'blush', 'sonrojo', 'sonrojada', 'pena', 'vergüenza', 'verguenza', 'shy', 'tímida', 'timida', 'flustered', 'red', 'shou'],
  yandere: ['yandere', '脸黑', 'black', 'crazy', 'celosa', 'posesiva', 'obsesion', 'obsesión', 'dark', '血', 'mad'],
  crazy: ['crazy', 'loca', 'demente', 'yandere', 'black', '脸黑'],
  surprised: ['shock', '惊讶', '惊诧', 'surprised', 'sorprendida', 'asombrada', 'impactada', 'scared', 'asustada', '星星眼', '疑惑'],
  scared: ['scared', 'shock', '惊讶', 'asustada', 'miedo'],
  sad: ['流泪', '泪', 'sad', 'triste', 'pena', 'llorando', 'tears', 'crying'],
  angry: ['生气', 'mad', 'angry', 'enojada', 'molesta', 'pout', 'rabia'],
  wink: ['wink', 'guiño', 'guino', 'picarona', 'coqueta'],
  smug: ['←歪嘴', '歪嘴→', 'smug', 'presumida', 'mueca', '舌头', 'tongue'],
  gamer: ['手柄', 'gamer', 'juegos', 'videojuegos', 'jugar', 'partida'],
  streaming: ['直播套装', 'streaming', 'stream', 'en vivo'],
  thinking: ['疑惑', 'thinking', 'pensando', 'analizando', 'curiosa', 'duda'],
  relaxed: ['idle', 'relaxed', 'relajada', 'tranquila', 'paz', 'descanso'],
  excited: ['星星眼', 'excited', 'emocionada', 'stars', '直播套装', 'dance'],
};

/**
 * ModelRegistry: Central registry and capability introspection manager.
 */
export class ModelRegistry {
  private models: Map<string, ModelDescriptor> = new Map();
  private activeModelId: string = 'yanderegirl';

  constructor() {
    // Register all 13 official models
    for (const modelId of OFFICIAL_MODEL_IDS) {
      const descriptor = OFFICIAL_MODEL_DESCRIPTORS[modelId];
      if (descriptor) {
        this.registerModel(descriptor);
      }
    }
  }

  /**
   * Register a new or custom model descriptor.
   */
  public registerModel(descriptor: ModelDescriptor): ModelDescriptor {
    if (!descriptor.id || !descriptor.path) {
      throw new Error('[ModelRegistry] Model descriptor must specify both an "id" and a "path".');
    }
    const enriched: ModelDescriptor = {
      ...descriptor,
      registeredAt: descriptor.registeredAt ?? Date.now(),
    };
    this.models.set(descriptor.id, enriched);
    return enriched;
  }

  /**
   * Retrieve model descriptor by ID. Falls back to active model or yanderegirl.
   */
  public getModel(id: string): ModelDescriptor {
    const found = this.models.get(id);
    if (found) return found;

    const active = this.models.get(this.activeModelId);
    if (active) return active;

    const fallback = this.models.get('yanderegirl');
    if (fallback) return fallback;

    // Guaranteed fallback
    return OFFICIAL_MODEL_DESCRIPTORS.yanderegirl;
  }

  /**
   * Check if an ID belongs to the official models set.
   */
  public isOfficialModel(id: string): id is OfficialModelId {
    return OFFICIAL_MODEL_IDS.includes(id as OfficialModelId);
  }

  /**
   * Return array of all registered models.
   */
  public getAllModels(): ModelDescriptor[] {
    return Array.from(this.models.values());
  }

  /**
   * Return array of the 13 official model descriptors.
   */
  public getOfficialModels(): ModelDescriptor[] {
    return OFFICIAL_MODEL_IDS.map((id) => this.getModel(id));
  }

  /**
   * Set active model ID.
   */
  public setActiveModel(id: string): void {
    if (this.models.has(id)) {
      this.activeModelId = id;
    }
  }

  /**
   * Get active model ID.
   */
  public getActiveModelId(): string {
    return this.activeModelId;
  }

  /**
   * Resolve model asset URL for current runtime (http/https, Electron file://, dev server).
   */
  public resolveModelPath(modelPath: string): string {
    if (!modelPath) return '';
    if (
      modelPath.startsWith('blob:') ||
      modelPath.startsWith('data:') ||
      modelPath.startsWith('http://') ||
      modelPath.startsWith('https://')
    ) {
      return modelPath;
    }

    const cleanPath = modelPath.startsWith('/') ? modelPath.slice(1) : modelPath;
    if (typeof window !== 'undefined' && window.location) {
      const origin = window.location.origin;
      if (origin && origin !== 'null' && !origin.startsWith('file:')) {
        return `${origin}/${cleanPath}`;
      }
      if (window.location.protocol === 'file:') {
        return new URL('./' + cleanPath, window.location.href).href;
      }
    }
    return '/' + cleanPath;
  }

  /**
   * Resolve an emotional action name to model-specific expression name or Cubism parameter targets.
   */
  public resolveSemanticAction(modelId: string, actionName: string): SemanticActionResult {
    const model = this.getModel(modelId);
    const normalized = (actionName || 'idle').toLowerCase().trim();

    // 1. Direct match in model's pre-configured semanticActions map
    if (model.semanticActions && model.semanticActions[normalized]) {
      return model.semanticActions[normalized];
    }

    // 2. Multi-lingual synonym match against model's custom expressions
    const synonyms = SYNONYM_MAP[normalized] || [normalized];
    const customExpressions = model.capabilities?.customExpressions || [];
    const blockedList = model.blockedExpressions || [];

    for (const syn of synonyms) {
      for (const exp of customExpressions) {
        if (blockedList.includes(exp)) continue;
        if (
          exp.toLowerCase() === syn ||
          exp.toLowerCase().includes(syn) ||
          syn.includes(exp.toLowerCase())
        ) {
          return { type: 'expression', name: exp };
        }
      }
    }

    // 3. Fallback standard parameter targets mapped to model's unique parameter IDs
    const mapping = model.standardMapping || {};
    const targets: Record<string, number> = {};

    if (normalized === 'happy' || normalized === 'smile') {
      if (mapping.eye_l_smile) targets[mapping.eye_l_smile] = 1.0;
      if (mapping.eye_r_smile) targets[mapping.eye_r_smile] = 1.0;
      if (mapping.mouth_form) targets[mapping.mouth_form] = 1.0;
      if (mapping.cheek_blush) targets[mapping.cheek_blush] = 0.5;
    } else if (normalized === 'love') {
      if (mapping.eye_l_smile) targets[mapping.eye_l_smile] = 1.0;
      if (mapping.eye_r_smile) targets[mapping.eye_r_smile] = 1.0;
      if (mapping.mouth_form) targets[mapping.mouth_form] = 0.8;
      if (mapping.cheek_blush) targets[mapping.cheek_blush] = 1.0;
    } else if (normalized === 'blush' || normalized === 'shy') {
      if (mapping.cheek_blush) targets[mapping.cheek_blush] = 1.0;
      if (mapping.eye_l_smile) targets[mapping.eye_l_smile] = 0.7;
      if (mapping.eye_r_smile) targets[mapping.eye_r_smile] = 0.7;
    } else if (normalized === 'wink') {
      if (mapping.eye_r_open) targets[mapping.eye_r_open] = 0.0;
      if (mapping.eye_r_smile) targets[mapping.eye_r_smile] = 1.0;
      if (mapping.cheek_blush) targets[mapping.cheek_blush] = 0.5;
    } else if (normalized === 'sad') {
      if (mapping.brow_l_y) targets[mapping.brow_l_y] = -0.6;
      if (mapping.brow_r_y) targets[mapping.brow_r_y] = -0.6;
      if (mapping.mouth_form) targets[mapping.mouth_form] = -1.0;
    } else if (normalized === 'angry' || normalized === 'mad' || normalized === 'pout') {
      if (mapping.brow_l_angle) targets[mapping.brow_l_angle] = -0.8;
      if (mapping.brow_r_angle) targets[mapping.brow_r_angle] = -0.8;
      if (mapping.mouth_form) targets[mapping.mouth_form] = -0.6;
    } else if (normalized === 'yandere' || normalized === 'crazy') {
      if (mapping.mouth_form) targets[mapping.mouth_form] = -0.6;
      if (mapping.brow_l_angle) targets[mapping.brow_l_angle] = -0.5;
      if (mapping.brow_r_angle) targets[mapping.brow_r_angle] = -0.5;
      if (mapping.eye_l_smile) targets[mapping.eye_l_smile] = 0.3;
      if (mapping.eye_r_smile) targets[mapping.eye_r_smile] = 0.3;
      if (mapping.cheek_blush) targets[mapping.cheek_blush] = 0.7;
    } else if (normalized === 'surprised' || normalized === 'shock' || normalized === 'scared') {
      if (mapping.eye_l_open) targets[mapping.eye_l_open] = 1.0;
      if (mapping.eye_r_open) targets[mapping.eye_r_open] = 1.0;
      if (mapping.brow_l_y) targets[mapping.brow_l_y] = 0.7;
      if (mapping.brow_r_y) targets[mapping.brow_r_y] = 0.7;
      if (mapping.mouth_open_y) targets[mapping.mouth_open_y] = 0.6;
    } else if (normalized === 'gamer') {
      if (mapping.eye_ball_y) targets[mapping.eye_ball_y] = -0.2;
      if (mapping.eye_ball_x) targets[mapping.eye_ball_x] = 0.2;
      if (mapping.mouth_form) targets[mapping.mouth_form] = 0.4;
    } else if (normalized === 'smug') {
      if (mapping.mouth_form) targets[mapping.mouth_form] = 0.8;
      if (mapping.eye_l_smile) targets[mapping.eye_l_smile] = 0.6;
    } else if (normalized === 'thinking') {
      if (mapping.brow_l_y) targets[mapping.brow_l_y] = 0.3;
      if (mapping.brow_r_y) targets[mapping.brow_r_y] = -0.2;
      if (mapping.eye_ball_y) targets[mapping.eye_ball_y] = 0.4;
    }

    if (Object.keys(targets).length > 0) {
      return { type: 'parameters', targets };
    }

    return { type: 'fallback', fallback: 'idle' };
  }

  /**
   * Introspect a Live2DModel runtime instance to detect supported parameters & expressions.
   */
  public detectModelCapabilities(
    modelInstance: any,
    rawModel3Json: any = null
  ): DetectedCapabilities {
    const detected: DetectedCapabilities = {
      parameters: new Map(),
      expressions: [],
      motions: [],
      hasPhysics: false,
      standardMapping: {},
    };

    if (!modelInstance?.internalModel) return detected;

    const coreModel = modelInstance.internalModel.coreModel;

    try {
      if (coreModel?._parameterIds && Array.isArray(coreModel._parameterIds)) {
        const ids = coreModel._parameterIds as string[];
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          const min = typeof coreModel.getParameterMinimumValue === 'function'
            ? coreModel.getParameterMinimumValue(i)
            : (coreModel._parameterMinimumValues ? coreModel._parameterMinimumValues[i] : -30);
          const max = typeof coreModel.getParameterMaximumValue === 'function'
            ? coreModel.getParameterMaximumValue(i)
            : (coreModel._parameterMaximumValues ? coreModel._parameterMaximumValues[i] : 30);
          const def = typeof coreModel.getParameterDefaultValue === 'function'
            ? coreModel.getParameterDefaultValue(i)
            : 0;
          detected.parameters.set(id, { id, min, max, default: def, index: i });
        }
      } else if (typeof coreModel?.getParameterCount === 'function') {
        const count = coreModel.getParameterCount();
        for (let i = 0; i < count; i++) {
          const id = typeof coreModel.getParameterId === 'function'
            ? coreModel.getParameterId(i)
            : `param_${i}`;
          const min = typeof coreModel.getParameterMinimumValue === 'function'
            ? coreModel.getParameterMinimumValue(i)
            : -30;
          const max = typeof coreModel.getParameterMaximumValue === 'function'
            ? coreModel.getParameterMaximumValue(i)
            : 30;
          const def = typeof coreModel.getParameterDefaultValue === 'function'
            ? coreModel.getParameterDefaultValue(i)
            : 0;
          detected.parameters.set(id, { id, min, max, default: def, index: i });
        }
      }
    } catch (e) {
      console.warn('[ModelRegistry] Parameter introspection warning:', e);
    }

    if (rawModel3Json?.FileReferences?.Expressions) {
      detected.expressions = rawModel3Json.FileReferences.Expressions.map((e: any) => e.Name);
    } else if (modelInstance.internalModel.motionManager?.expressionManager?.definitions) {
      detected.expressions = modelInstance.internalModel.motionManager.expressionManager.definitions.map(
        (d: any) => d.name
      );
    }

    const heuristicMap: Record<string, string[]> = {
      head_angle_x: ['ParamAngleX', 'PARAM_ANGLE_X', 'AngleX', 'HeadAngleX', '角度 X'],
      head_angle_y: ['ParamAngleY', 'PARAM_ANGLE_Y', 'AngleY', 'HeadAngleY', '角度 Y'],
      head_angle_z: ['ParamAngleZ', 'PARAM_ANGLE_Z', 'AngleZ', 'HeadAngleZ', '角度 Z'],
      body_angle_x: ['ParamBodyAngleX', 'PARAM_BODY_ANGLE_X', 'BodyAngleX', 'BodyX', '身体旋转 X'],
      body_angle_y: ['ParamBodyAngleY', 'PARAM_BODY_ANGLE_Y', 'BodyAngleY', 'BodyY', '身体旋转 Y'],
      body_angle_z: ['ParamBodyAngleZ', 'PARAM_BODY_ANGLE_Z', 'BodyAngleZ', 'BodyZ', '身体旋转 Z'],
      eye_l_open: ['ParamEyeLOpen', 'PARAM_EYE_L_OPEN', 'EyeLOpen', '左眼 开闭'],
      eye_r_open: ['ParamEyeROpen', 'PARAM_EYE_R_OPEN', 'EyeROpen', '右眼 开闭'],
      eye_l_smile: ['ParamEyeLSmile', 'PARAM_EYE_L_SMILE', 'EyeLSmile', '左眼 微笑'],
      eye_r_smile: ['ParamEyeRSmile', 'PARAM_EYE_R_SMILE', 'EyeRSmile', '右眼 微笑'],
      eye_ball_x: ['ParamEyeBallX', 'PARAM_EYE_BALL_X', 'EyeBallX', '眼球 X'],
      eye_ball_y: ['ParamEyeBallY', 'PARAM_EYE_BALL_Y', 'EyeBallY', '眼球 Y'],
      brow_l_y: ['ParamBrowLY', 'PARAM_BROW_L_Y', 'BrowLY', '左眉 上下'],
      brow_r_y: ['ParamBrowRY', 'PARAM_BROW_R_Y', 'BrowRY', '右眉 上下'],
      brow_l_angle: ['ParamBrowLAngle', 'PARAM_BROW_L_ANGLE', 'BrowLAngle', '左眉 角度'],
      brow_r_angle: ['ParamBrowRAngle', 'PARAM_BROW_R_ANGLE', 'BrowRAngle', '右眉 角度'],
      mouth_open_y: ['ParamMouthOpenY', 'PARAM_MOUTH_OPEN_Y', 'MouthOpenY', '嘴巴 张开'],
      mouth_form: ['ParamMouthForm', 'PARAM_MOUTH_FORM', 'MouthForm', '嘴巴 变形'],
      cheek_blush: ['ParamCheek', 'PARAM_CHEEK', 'Cheek', 'Blush', '脸颊 红晕'],
      breath: ['ParamBreath', 'PARAM_BREATH', 'Breath', '呼吸'],
    };

    for (const [capability, candidateIds] of Object.entries(heuristicMap)) {
      for (const candidate of candidateIds) {
        if (detected.parameters.has(candidate)) {
          const info = detected.parameters.get(candidate)!;
          detected.standardMapping[capability] = {
            paramId: candidate,
            min: info.min,
            max: info.max,
            default: info.default,
          };
          break;
        }
      }
    }

    return detected;
  }
}

export const modelRegistry = new ModelRegistry();
