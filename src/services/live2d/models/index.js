/**
 * Live2D Model Profiles Index
 */

import { yanderegirlProfile } from './yanderegirl.profile.js';
import { icegirlProfile } from './icegirl.profile.js';
import { hiyoriProfile } from './hiyori.profile.js';
import { miaraProfile } from './miara.profile.js';
import { tokiProfile } from './toki.profile.js';
import { ellenProfile } from './ellen.profile.js';
import { jane_doeProfile } from './jane_doe.profile.js';
import { ruan_meiProfile } from './ruan_mei.profile.js';

export const ALL_MODEL_PROFILES = [
  yanderegirlProfile,
  icegirlProfile,
  hiyoriProfile,
  miaraProfile,
  tokiProfile,
  ellenProfile,
  jane_doeProfile,
  ruan_meiProfile,
];

export const MODEL_PROFILES_MAP = {
  'yanderegirl': yanderegirlProfile,
  'icegirl': icegirlProfile,
  'hiyori': hiyoriProfile,
  'miara': miaraProfile,
  'toki': tokiProfile,
  'ellen': ellenProfile,
  'jane_doe': jane_doeProfile,
  'ruan_mei': ruan_meiProfile,
};

export { yanderegirlProfile };
export { icegirlProfile };
export { hiyoriProfile };
export { miaraProfile };
export { tokiProfile };
export { ellenProfile };
export { jane_doeProfile };
export { ruan_meiProfile };
