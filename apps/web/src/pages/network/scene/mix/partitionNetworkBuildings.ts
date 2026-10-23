import type { NetworkCityTierValue } from '@/entities/network';
import type { QualityLevelValue } from '@/shared/3d';

import type { NetworkSceneBuildingValue } from '../layout';
import type { WorldModelDataValue } from '../models/format/worldModelFormat';
import type { WorldModelPlacementValue } from '../models/placeWorldModels';
import type { WorldModelEntryValue } from '../models/worldModelCatalog';
import type { BuildingStyleValue } from './pickBuildingStyle';

import { pickCompanyWarehouseModel } from '../models/pickCompanyWarehouseModel';
import { pickDecorModel } from '../models/pickDecorModel';
import { placeWorldModels } from '../models/placeWorldModels';
import { DEFAULT_CITY_TIER } from './mixConstants';
import { pickBuildingStyle } from './pickBuildingStyle';

export interface BuildingPartitionOptionsValue {
  level: QualityLevelValue;
  models: ReadonlyMap<string, WorldModelDataValue>;
  tierByCityId: ReadonlyMap<string, NetworkCityTierValue>;
}

export interface BuildingPartitionValue {
  beveled: readonly NetworkSceneBuildingValue[];
  boxes: readonly NetworkSceneBuildingValue[];
  placements: readonly WorldModelPlacementValue[];
}

const pickBuildingModel = (building: NetworkSceneBuildingValue, level: QualityLevelValue): undefined | WorldModelEntryValue => (
  building.isCompany ? pickCompanyWarehouseModel(building) : pickDecorModel(building, level)
);

export const partitionNetworkBuildings = (
  buildings: readonly NetworkSceneBuildingValue[],
  { level, models, tierByCityId }: BuildingPartitionOptionsValue,
): BuildingPartitionValue => {
  const styles = buildings.map((building): BuildingStyleValue => (
    pickBuildingStyle(building, tierByCityId.get(building.cityId) ?? DEFAULT_CITY_TIER)
  ));
  const modelCandidates = buildings.filter((_, index) => styles[index] === 'model');
  const { placements, rest } = placeWorldModels(modelCandidates, building => pickBuildingModel(building, level), models);
  const restIds = new Set(rest.map(building => building.id));
  const beveled: NetworkSceneBuildingValue[] = [];
  const boxes: NetworkSceneBuildingValue[] = [];

  for (const [index, building] of buildings.entries()) {
    const style = styles[index];

    if (style === 'beveled') {
      beveled.push(building);
    }
    else if (style === 'box' || restIds.has(building.id)) {
      boxes.push(building);
    }
  }

  return { beveled, boxes, placements };
};
