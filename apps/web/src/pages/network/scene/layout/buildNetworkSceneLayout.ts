import type { NetworkMapModelValue } from '@/entities/network';

import { createSquareWorld } from '@/shared/3d';

import type {
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
  NetworkSceneLayoutValue,
  NetworkSceneRoadValue,
} from './networkSceneTypes';

import {
  NETWORK_WORLD_SEED,
  NETWORK_WORLD_SIZE_METERS,
} from '../networkWorldConstants';
import { orderBuildingsForDensity } from './buildingVisibility';
import { buildTerrainReserved } from './buildTerrainReserved';
import { layoutMiniCity } from './layoutMiniCity';
import { projectMapGrid } from './projectMapGrid';
import { resolveNetworkHome } from './resolveNetworkHome';

const layoutCache = new WeakMap<NetworkMapModelValue, NetworkSceneLayoutValue>();

const buildRoads = (
  model: NetworkMapModelValue,
  cityById: ReadonlyMap<string, NetworkSceneCityValue>,
): NetworkSceneRoadValue[] => {
  const roads: NetworkSceneRoadValue[] = [];

  for (const road of model.roads) {
    const from = cityById.get(road.fromNodeId);
    const to = cityById.get(road.toNodeId);

    if (from !== undefined && to !== undefined) {
      roads.push({
        from: { x: from.x, z: from.z },
        fromCityId: from.id,
        id: road.id,
        to: { x: to.x, z: to.z },
        toCityId: to.id,
      });
    }
  }

  return roads;
};

const createLayout = (model: NetworkMapModelValue): NetworkSceneLayoutValue => {
  const world = createSquareWorld(NETWORK_WORLD_SIZE_METERS);
  const projection = projectMapGrid(model.cities, world);
  const cities: NetworkSceneCityValue[] = [];
  const buildings: NetworkSceneBuildingValue[] = [];

  for (const city of model.cities) {
    const center = projection.centers.get(city.id);

    if (center !== undefined) {
      const sites = model.sites
        .filter(site => site.nodeId === city.id)
        .map(site => ({ id: site.id, isOwn: site.isOwn, side: site.side }));
      const miniCity = layoutMiniCity({ center, cityId: city.id, seed: NETWORK_WORLD_SEED, sites });

      cities.push({
        cityId: city.cityId,
        hiddenSiteIds: miniCity.hiddenSiteIds,
        id: city.id,
        name: city.name,
        radius: miniCity.radius,
        tier: city.tier,
        x: center.x,
        z: center.z,
      });
      buildings.push(...miniCity.buildings);
    }
  }

  const orderedBuildings = orderBuildingsForDensity(buildings);
  const roads = buildRoads(model, new Map(cities.map(city => [city.id, city])));
  const home = resolveNetworkHome({ buildings: orderedBuildings, cities }, world);

  return {
    buildings: orderedBuildings,
    cities,
    home,
    roads,
    terrainReserved: buildTerrainReserved(cities, roads),
    world: { ...world, home },
  };
};

export const buildNetworkSceneLayout = (model: NetworkMapModelValue): NetworkSceneLayoutValue => {
  const cached = layoutCache.get(model);

  if (cached !== undefined) {
    return cached;
  }

  const layout = createLayout(model);
  layoutCache.set(model, layout);

  return layout;
};
