import type { WarehouseDockVisitValue } from './warehouseSceneCargo';

import {
  shouldSplitWarehouseDockAssignments,
  splitWarehouseDockAssignments,
} from './warehouseDockAssignments';

export interface WarehouseSceneParkingValue {
  capacity: number;
  warehouseId: string;
}

export const WAREHOUSE_YARD_PARKING_LIMIT = 3;
export const WAREHOUSE_YARD_MAX_PARKING_LIMIT = 30;

export const readWarehouseSceneParking = (
  current: undefined | WarehouseSceneParkingValue,
  warehouseId: string,
  visits: readonly WarehouseDockVisitValue[] | undefined,
  dockIds: readonly string[],
  dockTaskId: string | undefined,
): WarehouseSceneParkingValue => {
  const isSplit = shouldSplitWarehouseDockAssignments(dockIds, visits);
  const candidates = isSplit ? splitWarehouseDockAssignments(dockIds, visits).waiting : visits ?? [];
  const waiting = new Set<string>();
  for (const visit of candidates) {
    if (isSplit || visit.taskId !== dockTaskId) {
      waiting.add(visit.taskId);
    }
    if (waiting.size === WAREHOUSE_YARD_MAX_PARKING_LIMIT) {
      break;
    }
  }
  const capacity = waiting.size <= WAREHOUSE_YARD_PARKING_LIMIT
    ? WAREHOUSE_YARD_PARKING_LIMIT
    : Math.max(WAREHOUSE_YARD_PARKING_LIMIT * 2, Math.ceil(waiting.size / 2) * 2);
  return current?.warehouseId === warehouseId && current.capacity >= capacity ? current : { capacity, warehouseId };
};
