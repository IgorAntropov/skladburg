import type { NetworkSceneBuildingValue } from '../layout';
import type { WorldModelPlacementValue } from '../models/placeWorldModels';

export const listWindowBuildings = (
  buildings: readonly NetworkSceneBuildingValue[],
  placements: readonly WorldModelPlacementValue[],
): readonly NetworkSceneBuildingValue[] => {
  const unlitIds = new Set(
    placements
      .filter(placement => placement.group !== 'warehouse')
      .flatMap(placement => placement.items.map(item => item.id)),
  );

  return buildings.filter(building => !unlitIds.has(building.id));
};
