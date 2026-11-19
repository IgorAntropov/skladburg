import type { WarehouseDockVisitValue } from './warehouseSceneCargo';

interface WarehouseDockAssignmentsValue {
  nextByDock: ReadonlyMap<string, WarehouseDockVisitValue>;
  waiting: WarehouseDockVisitValue[];
}

export const shouldSplitWarehouseDockAssignments = (
  dockIds: readonly string[],
  visits: readonly WarehouseDockVisitValue[] | undefined,
): boolean => dockIds.length > 1 || (dockIds.length === 1 && visits?.some(({ unloadingPointId }) => (
  unloadingPointId !== undefined && unloadingPointId !== dockIds[0]
)) === true);

export const splitWarehouseDockAssignments = (
  dockIds: readonly string[],
  visits: readonly WarehouseDockVisitValue[] | undefined,
): WarehouseDockAssignmentsValue => {
  const primaryId = dockIds[0];
  const singleDockId = dockIds.length === 1 ? primaryId : undefined;
  const configuredIds = new Set(dockIds);
  const nextByDock = new Map<string, WarehouseDockVisitValue>();
  const waiting: WarehouseDockVisitValue[] = [];
  let outbound: undefined | WarehouseDockVisitValue;
  for (const visit of visits ?? []) {
    const unloadingPointId = visit.unloadingPointId ?? singleDockId;
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

  if (outbound !== undefined && primaryId !== undefined) {
    if (nextByDock.has(primaryId)) {
      waiting.push(outbound);
    }
    else {
      nextByDock.set(primaryId, outbound);
    }
  }

  return { nextByDock, waiting };
};
