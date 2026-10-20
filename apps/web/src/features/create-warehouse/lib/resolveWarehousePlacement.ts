import type { BoardNode } from '@skladburg/contracts/network/v1/network';

import type {
  WarehousePlacementValue,
  WarehousePlacesValue,
} from '../model/warehousePlacesTypes';

const pickFirstNodeById = (nodes: readonly BoardNode[], cityId: string): BoardNode | undefined => {
  let first: BoardNode | undefined;

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

  const node = pickFirstNodeById(places.boardNodes, city.id);

  return node === undefined ? undefined : { boardNodeId: node.id, timeZone: city.timeZone };
};
