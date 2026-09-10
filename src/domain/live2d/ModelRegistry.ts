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

export { Live2DModelRegistry as ModelRegistry, live2dModelRegistry as modelRegistry } from './Live2DModelRegistry';
