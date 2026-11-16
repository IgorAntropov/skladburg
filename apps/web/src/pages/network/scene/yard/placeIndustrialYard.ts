import type {
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
} from '../layout';

import { PLAZA_SEGMENTS } from '../geometry/networkSceneMetrics';
import {
  compareIds,
  getBuildingFootprint,
} from '../layout';
import {
  INDUSTRIAL_YARD_DEPTH,
  INDUSTRIAL_YARD_WIDTH,
} from './industrialYardSize';

export interface IndustrialYardPlacementValue {
  rotation: number;
  siteId: string;
  x: number;
  z: number;
}

export const placeIndustrialYard = (
  buildings: readonly NetworkSceneBuildingValue[],
  cities: readonly NetworkSceneCityValue[],
): IndustrialYardPlacementValue | undefined => {
  const candidates = buildings
    .filter(({ isCompany, kind }) => isCompany && kind === 'warehouse')
    .toSorted((current, prev) => compareIds(current.id, prev.id));
  const citiesById = new Map(cities.map(city => [city.id, city]));

  for (const building of candidates) {
    const { cityId, rotation, siteId } = building;
    const city = citiesById.get(cityId);

    if (siteId === undefined || city === undefined) {
      continue;
    }

    const offset = (building.width + INDUSTRIAL_YARD_WIDTH) / 2;
    const x = building.x - Math.cos(rotation) * offset;
    const z = building.z + Math.sin(rotation) * offset;
    const lot = getBuildingFootprint({ depth: INDUSTRIAL_YARD_DEPTH, rotation, width: INDUSTRIAL_YARD_WIDTH, x, z });
    const plazaInradius = city.radius * Math.cos(Math.PI / PLAZA_SEGMENTS);

    if (lot.every(corner => Math.hypot(corner.x - city.x, corner.z - city.z) <= plazaInradius)) {
      return { rotation, siteId, x, z };
    }
  }

  return undefined;
};
