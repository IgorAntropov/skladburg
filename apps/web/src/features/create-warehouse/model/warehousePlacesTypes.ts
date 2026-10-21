import type {
  City,
  MapNode,
} from '@skladburg/contracts/network/v1/network';

export interface WarehousePlacementValue {
  mapNodeId: string;
  timeZone: string;
}

export interface WarehousePlacesValue {
  cities: readonly City[];
  mapNodes: readonly MapNode[];
}
