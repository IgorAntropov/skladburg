import type { QualityLevelValue } from '@/shared/3d';

import type { NetworkSceneBuildingValue } from '../layout';
import type { WorldModelEntryValue } from './worldModelCatalog';

import {
  compareIds,
  hashIndex,
  LAYOUT_SALT,
} from '../layout';
import { NETWORK_WORLD_SEED } from '../networkWorldConstants';
import { measureFootprintStretch } from './fitWorldModelToFootprint';
import { MAX_MODEL_STRETCH } from './modelFitConstants';
import { listWorldModelsForLevel } from './worldModelLods';

interface MeasuredCandidateValue {
  entry: WorldModelEntryValue;
  stretch: number;
}

export const pickDecorModel = (
  building: Pick<NetworkSceneBuildingValue, 'depth' | 'id' | 'kind' | 'width'>,
  level: QualityLevelValue,
): undefined | WorldModelEntryValue => {
  if (building.kind === 'warehouse') {
    return undefined;
  }

  const measured = listWorldModelsForLevel(building.kind, level)
    .toSorted((current, prev) => compareIds(current.id, prev.id))
    .map((entry): MeasuredCandidateValue => ({
      entry,
      stretch: measureFootprintStretch(entry.footprint[0], entry.footprint[1], building),
    }));
  const fitting = measured.filter(({ stretch }) => stretch <= MAX_MODEL_STRETCH);
  const closest = measured.toSorted((current, prev) => current.stretch - prev.stretch).slice(0, 1);
  const pool = fitting.length > 0 ? fitting : closest;

  return pool[hashIndex(NETWORK_WORLD_SEED, building.id, LAYOUT_SALT.decorModel, pool.length)]?.entry;
};
