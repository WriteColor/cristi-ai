/**
 * Live2D Model Profiles Index
 */

import type { ModelProfile } from '../types';
import { yanderegirlProfile } from './yanderegirl.profile';
import { icegirlProfile } from './icegirl.profile';
import { hiyoriProfile } from './hiyori.profile';
import { miaraProfile } from './miara.profile';
import { tokiProfile } from './toki.profile';
import { ellenProfile } from './ellen.profile';
import { jane_doeProfile } from './jane_doe.profile';
import { ruan_meiProfile } from './ruan_mei.profile';
import { belleProfile } from './belle.profile';
import { sparkleProfile } from './sparkle.profile';
import { huohuoProfile } from './huohuo.profile';
import { vivianProfile } from './vivian.profile';
import { goth_loliProfile } from './goth_loli.profile';

export const ALL_MODEL_PROFILES: ModelProfile[] = [
  yanderegirlProfile,
  icegirlProfile,
  hiyoriProfile,
  miaraProfile,
  tokiProfile,
  ellenProfile,
  jane_doeProfile,
  ruan_meiProfile,
  belleProfile,
  sparkleProfile,
  huohuoProfile,
  vivianProfile,
  goth_loliProfile,
];

export const MODEL_PROFILES_MAP: Record<string, ModelProfile> = {
  'yanderegirl': yanderegirlProfile,
  'icegirl': icegirlProfile,
  'hiyori': hiyoriProfile,
  'miara': miaraProfile,
  'toki': tokiProfile,
  'ellen': ellenProfile,
  'jane_doe': jane_doeProfile,
  'ruan_mei': ruan_meiProfile,
  'belle': belleProfile,
  'sparkle': sparkleProfile,
  'huohuo': huohuoProfile,
  'vivian': vivianProfile,
  'goth_loli': goth_loliProfile,
};

export {
  yanderegirlProfile,
  icegirlProfile,
  hiyoriProfile,
  miaraProfile,
  tokiProfile,
  ellenProfile,
  jane_doeProfile,
  ruan_meiProfile,
  belleProfile,
  sparkleProfile,
  huohuoProfile,
  vivianProfile,
  goth_loliProfile,
};
