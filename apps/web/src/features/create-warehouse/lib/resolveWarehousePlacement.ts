import type { MapNode } from '@skladburg/contracts/network/v1/network';

import type {
  WarehousePlacementValue,
  WarehousePlacesValue,
} from '../model/warehousePlacesTypes';

const pickFirstNodeById = (nodes: readonly MapNode[], cityId: string): MapNode | undefined => {
  let first: MapNode | undefined;

  for (const node of nodes) {
    if (node.cityId === cityId && (first === undefined || node.id < first.id)) {
      first = node;
    }
  }

  return first;
};

export const resolveWarehousePlacement = (
  cityId: string,
  places: WarehousePlacesValue,
): undefined | WarehousePlacementValue => {
  const city = places.cities.find(candidate => candidate.id === cityId);

  if (city === undefined) {
    return undefined;
  }

  const node = pickFirstNodeById(places.mapNodes, city.id);

  return node === undefined ? undefined : { mapNodeId: node.id, timeZone: city.timeZone };
};
