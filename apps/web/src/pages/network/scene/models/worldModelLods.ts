import type { QualityLevelValue } from '@/shared/3d';

import type {
  WorldModelEntryValue,
  WorldModelGroupValue,
  WorldModelLodValue,
} from './worldModelCatalog';

import { WORLD_MODEL_CATALOG } from './worldModelCatalog';

export const WORLD_MODEL_LODS_BY_LEVEL: Readonly<Record<QualityLevelValue, WorldModelLodValue>> = {
  high: 'full',
  low: 'light',
  medium: 'full',
};

export const listWorldModelsForLevel = (
  group: WorldModelGroupValue,
  level: QualityLevelValue,
): readonly WorldModelEntryValue[] => {
  const groupEntries = WORLD_MODEL_CATALOG.filter(entry => entry.group === group);
  const levelEntries = groupEntries.filter(entry => entry.lod === WORLD_MODEL_LODS_BY_LEVEL[level]);

  return levelEntries.length > 0 ? levelEntries : groupEntries.filter(entry => entry.lod === 'full');
};
