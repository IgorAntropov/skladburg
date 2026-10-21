import type { NetworkSceneBuildingValue } from './networkSceneTypes';

import { compareIds } from './layoutHash';

export const isBuildingVisible = (building: Pick<NetworkSceneBuildingValue, 'isCompany' | 'rank'>, density: number): boolean =>
  building.isCompany || building.rank < density;

export const orderBuildingsForDensity = (buildings: readonly NetworkSceneBuildingValue[]): NetworkSceneBuildingValue[] => buildings
  .toSorted((current, prev) => (
    Number(prev.isCompany) - Number(current.isCompany)
    || current.rank - prev.rank
    || compareIds(current.id, prev.id)
  ));

export const getVisibleBuildingCount = (
  buildings: readonly Pick<NetworkSceneBuildingValue, 'isCompany' | 'rank'>[],
  density: number,
): number => {
  let count = 0;

  while (count < buildings.length) {
    const building = buildings[count];

    if (building === undefined || !isBuildingVisible(building, density)) {
      break;
    }

    count += 1;
  }

  return count;
};
