import type { StockBalance } from '@skladburg/contracts/wms/v1/stock';

import type { WarehouseCargoValue } from '../model/warehouseSceneCargo';

import {
  shouldSplitWarehouseDockAssignments,
  splitWarehouseDockAssignments,
} from '../model/warehouseDockAssignments';

export interface WarehouseDockCargoValue {
  balances: readonly StockBalance[] | undefined;
  cargo: undefined | WarehouseCargoValue;
}

export const splitWarehouseDockCargo = (
  cargo: undefined | WarehouseCargoValue,
  balances: readonly StockBalance[] | undefined,
  dockIds: readonly string[],
): WarehouseDockCargoValue[] => {
  const primaryId = dockIds[0];
  if (cargo === undefined || primaryId === undefined || !shouldSplitWarehouseDockAssignments(dockIds, cargo.dockVisits)) {
    return [{ balances, cargo }];
  }
  const { nextByDock, waiting } = splitWarehouseDockAssignments(dockIds, cargo.dockVisits);
  const unitDocks = new Map(cargo.units.map(unit => [unit.id, unit.unloadingPointId ?? primaryId]));
  const cellDocks = new Map<string, string | undefined>();
  for (const balance of balances ?? []) {
    if (!cellDocks.has(balance.cellId)) {
      cellDocks.set(balance.cellId, unitDocks.get(balance.handlingUnit?.id ?? '') ?? primaryId);
    }
  }
  return dockIds.map((dockId, index) => {
    const isPrimary = index === 0;
    const next = nextByDock.get(dockId);
    const dockVisits = isPrimary ? waiting : [];
    return {
      balances: balances?.filter(balance => cellDocks.get(balance.cellId) === dockId),
      cargo: {
        ...cargo,
        dockTaskId: next?.taskId,
        dockTripId: next?.tripId,
        dockVisits: next === undefined ? dockVisits : [next, ...dockVisits],
        units: cargo.units.filter(unit => (unit.unloadingPointId ?? primaryId) === dockId),
      },
    };
  });
};
