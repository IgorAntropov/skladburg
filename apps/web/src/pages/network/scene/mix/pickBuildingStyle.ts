import type { NetworkCityTierValue } from '@/entities/network';

import type { NetworkSceneBuildingValue } from '../layout';

import {
  hashUnit,
  LAYOUT_SALT,
} from '../layout';
import { NETWORK_WORLD_SEED } from '../networkWorldConstants';
import {
  MODEL_SHARE_BASE,
  MODEL_SHARE_MAX,
  MODEL_SHARE_SPAN,
  OFFICE_MODEL_BONUS,
  TIER_SCALES,
} from './mixConstants';

export type BuildingStyleValue = 'beveled' | 'box' | 'model';

export const measureModelShare = (building: Pick<NetworkSceneBuildingValue, 'kind'>, tier: NetworkCityTierValue): number => {
  const bonus = building.kind === 'office' ? OFFICE_MODEL_BONUS : 0;

  return Math.min(MODEL_SHARE_MAX, MODEL_SHARE_BASE + MODEL_SHARE_SPAN * TIER_SCALES[tier] + bonus);
};

export const pickBuildingStyle = (
  building: Pick<NetworkSceneBuildingValue, 'id' | 'isCompany' | 'kind'>,
  tier: NetworkCityTierValue,
): BuildingStyleValue => {
  if (building.isCompany) {
    return 'model';
  }

  const modelShare = measureModelShare(building, tier);
  const unit = hashUnit(NETWORK_WORLD_SEED, building.id, LAYOUT_SALT.buildingStyle);

  if (unit < modelShare) {
    return 'model';
  }

  return unit < modelShare + (1 - modelShare) / 2 ? 'beveled' : 'box';
};
