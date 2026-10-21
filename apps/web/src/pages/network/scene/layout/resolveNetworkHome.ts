import type { SceneWorldValue } from '@/shared/3d';

import type {
  LayoutPointValue,
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
} from './networkSceneTypes';

import { getBuildingFootprint } from './buildingFootprint';
import {
  HOME_MARGIN_METERS,
  HOME_MIN_RADIUS_METERS,
} from './layoutConstants';

export interface NetworkHomeSourceValue {
  buildings: readonly NetworkSceneBuildingValue[];
  cities: readonly NetworkSceneCityValue[];
}

interface CircleValue extends LayoutPointValue {
  radius: number;
}

const enclose = (circles: readonly CircleValue[]): SceneWorldValue['home'] => {
  const minX = Math.min(...circles.map(circle => circle.x - circle.radius));
  const maxX = Math.max(...circles.map(circle => circle.x + circle.radius));
  const minZ = Math.min(...circles.map(circle => circle.z - circle.radius));
  const maxZ = Math.max(...circles.map(circle => circle.z + circle.radius));
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const reach = Math.max(...circles.map(circle => Math.hypot(circle.x - centerX, circle.z - centerZ) + circle.radius));

  return { centerX, centerZ, radius: Math.max(HOME_MIN_RADIUS_METERS, reach + HOME_MARGIN_METERS) };
};

export const resolveNetworkHome = (
  source: NetworkHomeSourceValue,
  world: Pick<SceneWorldValue, 'home'>,
): SceneWorldValue['home'] => {
  const ownCorners = source.buildings
    .filter(building => building.isOwn)
    .flatMap(building => getBuildingFootprint(building));

  if (ownCorners.length > 0) {
    return enclose(ownCorners.map(corner => ({ radius: 0, x: corner.x, z: corner.z })));
  }

  if (source.cities.length > 0) {
    return enclose(source.cities.map(city => ({ radius: city.radius, x: city.x, z: city.z })));
  }

  return world.home;
};
