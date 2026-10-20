import type {
  BoardNode,
  City,
} from '@skladburg/contracts/network/v1/network';

export interface WarehousePlacementValue {
  boardNodeId: string;
  timeZone: string;
}

export interface WarehousePlacesValue {
  boardNodes: readonly BoardNode[];
  cities: readonly City[];
}
