import type { WarehouseAvailability } from '@skladburg/contracts/catalog/v1/catalog';
import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';

import { compareIds } from '../../../state/index';

export interface CityAvailabilityValue {
  cityId: string;
  mapNodeId: string;
  quantity: bigint;
  status: AvailabilityStatus;
}

interface CityAccumulatorValue {
  mapNodeId: string;
  quantity: bigint;
  sourceWarehouseId: string;
  status: AvailabilityStatus;
}

const STATUS_RANK: Readonly<Record<AvailabilityStatus, number>> = {
  [AvailabilityStatus.IN_STOCK]: 3,
  [AvailabilityStatus.LOW]: 2,
  [AvailabilityStatus.ON_ORDER]: 1,
  [AvailabilityStatus.UNSPECIFIED]: 0,
};

const pickBetterStatus = (current: AvailabilityStatus, candidate: AvailabilityStatus): AvailabilityStatus =>
  STATUS_RANK[candidate] > STATUS_RANK[current] ? candidate : current;

export const projectCityAvailability = (
  availability: readonly WarehouseAvailability[],
  warehouses: ReadonlyMap<string, Warehouse>,
): CityAvailabilityValue[] => {
  const accumulators = new Map<string, CityAccumulatorValue>();

  for (const entry of availability) {
    const warehouse = warehouses.get(entry.warehouseId);

    if (warehouse === undefined) {
      continue;
    }

    const accumulator = accumulators.get(warehouse.cityId);

    if (accumulator === undefined) {
      accumulators.set(warehouse.cityId, {
        mapNodeId: warehouse.mapNodeId,
        quantity: entry.quantity,
        sourceWarehouseId: warehouse.id,
        status: entry.status,
      });
      continue;
    }

    accumulator.quantity += entry.quantity;
    accumulator.status = pickBetterStatus(accumulator.status, entry.status);

    if (compareIds(warehouse.id, accumulator.sourceWarehouseId) < 0) {
      accumulator.mapNodeId = warehouse.mapNodeId;
      accumulator.sourceWarehouseId = warehouse.id;
    }
  }

  return [...accumulators.entries()]
    .map(([cityId, accumulator]) => ({
      cityId,
      mapNodeId: accumulator.mapNodeId,
      quantity: accumulator.quantity,
      status: accumulator.status,
    }))
    .sort((current, prev) => compareIds(current.cityId, prev.cityId));
};
