import type { StockBalance } from '@skladburg/contracts/wms/v1/stock';

import type {
  WarehouseCargoValue,
  WarehouseDockVisitValue,
} from '../model/warehouseSceneCargo';

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
  const isSingleDock = dockIds.length === 1;
  const hasUnknownDock = cargo?.dockVisits?.some(({ unloadingPointId }) => (
    unloadingPointId !== undefined && unloadingPointId !== primaryId
  ));
  if (cargo === undefined || primaryId === undefined || (isSingleDock && !hasUnknownDock)) {
    return [{ balances, cargo }];
  }
  const configuredIds = new Set(dockIds);
  const nextByDock = new Map<string, WarehouseDockVisitValue>();
  const waiting: WarehouseDockVisitValue[] = [];
  let outbound: undefined | WarehouseDockVisitValue;
  for (const visit of cargo.dockVisits ?? []) {
    const unloadingPointId = visit.unloadingPointId ?? (isSingleDock ? primaryId : undefined);
    if (unloadingPointId !== undefined && !configuredIds.has(unloadingPointId)) {
      waiting.push({ ...visit, isWaitingInYard: true, unloadingPointId: undefined });
    }
    else if (visit.isWaitingInYard !== true && unloadingPointId !== undefined) {
      if (!nextByDock.has(unloadingPointId)) {
        nextByDock.set(unloadingPointId, visit);
      }
    }
    else if (visit.isOutbound === true && outbound === undefined) {
      outbound = visit;
    }
    else {
      waiting.push(visit);
    }
  }
  if (outbound !== undefined) {
    if (nextByDock.has(primaryId)) {
      waiting.push(outbound);
    }
    else {
      nextByDock.set(primaryId, outbound);
    }
  }

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
