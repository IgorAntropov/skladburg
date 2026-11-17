export type WarehouseActiveVisitPhaseValue = 'assigned' | 'awaiting-load' | 'loaded' | 'queued' | 'unloading' | 'waiting-documents';

export interface WarehouseCargoUnitValue {
  cellId: string | undefined;
  expectedUnitId: string;
  id: string;
  isOutbound?: boolean;
  location: CargoLocationValue;
  slot: number;
  taskId: string;
  truckSlot: number;
  unloadingPointId?: string | undefined;
}

export interface WarehouseCargoValue {
  dockTaskId: string | undefined;
  dockTripId?: string | undefined;
  dockVisits?: readonly WarehouseDockVisitValue[] | undefined;
  hasDock: boolean;
  shippedUnitIds?: ReadonlySet<string> | undefined;
  units: readonly WarehouseCargoUnitValue[];
  yardVisits?: ReadonlyMap<string, WarehouseYardVisitValue> | undefined;
}

export type WarehouseDockDepartureValue = 'received' | 'route' | 'self-pickup';

export interface WarehouseDockVisitValue {
  isOutbound?: boolean | undefined;
  isWaitingInYard?: boolean | undefined;
  taskId: string;
  tripId: string | undefined;
  unloadingPointId?: string | undefined;
}

export type WarehouseYardVisitValue = WarehouseDockVisitValue & (
  { departure: 'received'; phase: 'released' }
  | { departure: 'route' | 'self-pickup'; phase: 'departed' }
  | { phase: 'awaiting-shipment' | 'cancelled' | 'pass-rejected' }
  | { phase: WarehouseActiveVisitPhaseValue }
);

export const readWarehouseDockDeparture = (
  cargo: WarehouseCargoValue,
  taskId: string | undefined,
  previousTripId?: string,
): undefined | WarehouseDockDepartureValue => {
  const visit = taskId === undefined ? undefined : cargo.yardVisits?.get(taskId);
  if (visit?.phase === 'released') {
    return visit.departure;
  }
  return visit?.phase === 'departed' && (previousTripId === undefined || visit.tripId === previousTripId) ? visit.departure : undefined;
};

type CargoLocationValue = 'cell' | 'staging' | 'truck';

interface WarehouseCargoMoveValue extends WarehouseCargoUnitValue {
  stops: readonly CargoLocationValue[];
}

export const retainWarehouseDockOrder = (prev: undefined | WarehouseCargoValue, current: WarehouseCargoValue): WarehouseCargoValue => {
  if (prev?.dockVisits === undefined || current.dockVisits === undefined) {
    return current;
  }
  const incoming = new Map(current.dockVisits.map(visit => [visit.taskId, visit]));
  const dockVisits: WarehouseDockVisitValue[] = [];
  for (const { taskId } of prev.dockVisits) {
    const visit = incoming.get(taskId);
    if (visit !== undefined) {
      dockVisits.push(visit);
      incoming.delete(taskId);
    }
  }
  dockVisits.push(...incoming.values());
  const previous = dockVisits.find(visit => visit.taskId === prev.dockTaskId && visit.isWaitingInYard !== true);
  const assigned = dockVisits.find(visit => visit.unloadingPointId !== undefined);
  const next = previous?.isOutbound === true ? previous : assigned ?? previous ?? dockVisits.find(visit => visit.isWaitingInYard !== true);
  return { ...current, dockTaskId: next?.taskId, dockTripId: next?.tripId, dockVisits };
};

export const retainWarehouseDockDuringShipment = (
  prev: undefined | WarehouseCargoValue,
  current: WarehouseCargoValue,
  truckTaskId: string | undefined,
): WarehouseCargoValue => {
  if (truckTaskId === undefined || truckTaskId !== prev?.dockTaskId || prev.dockTripId === undefined) {
    return current;
  }

  const visit = current.yardVisits?.get(truckTaskId);
  return visit?.phase === 'awaiting-shipment' && visit.tripId === prev.dockTripId
    ? { ...current, dockTaskId: truckTaskId, dockTripId: visit.tripId }
    : current;
};

export const readWarehouseCargoMoves = (
  prev: undefined | WarehouseCargoValue,
  current: WarehouseCargoValue,
): WarehouseCargoMoveValue[] => {
  if (prev === undefined) {
    return [];
  }

  const before = new Map(prev.units.map(unit => [unit.expectedUnitId, unit] as const));
  const moves: WarehouseCargoMoveValue[] = [];
  const leaving = readWarehouseDockDeparture(current, prev.dockTaskId, prev.dockTripId);
  for (const unit of current.units) {
    const previous = before.get(unit.expectedUnitId);
    if (unit.isOutbound === true) {
      if (prev.hasDock && current.hasDock && previous?.isOutbound === true && previous.taskId === unit.taskId
        && previous.location === 'cell' && unit.location === 'truck' && prev.dockTaskId === unit.taskId
        && (current.dockTaskId === unit.taskId || leaving === 'self-pickup')) {
        moves.push({ ...unit, stops: ['cell', 'truck'] });
      }
      continue;
    }
    if (unit.location === 'truck' || unit.location === previous?.location) {
      continue;
    }

    if (unit.location === 'staging' && previous?.location === 'truck' && current.hasDock) {
      moves.push({ ...unit, stops: ['truck', 'staging'] });
    }
    else if (unit.location === 'cell' && previous?.location === 'truck') {
      moves.push({ ...unit, stops: current.hasDock ? ['truck', 'staging', 'cell'] : ['staging', 'cell'] });
    }
    else if (unit.location === 'cell' && previous?.location === 'staging') {
      moves.push({ ...unit, stops: ['staging', 'cell'] });
    }
  }

  if (prev.hasDock && current.hasDock && leaving === 'route') {
    for (const unit of prev.units) {
      if (unit.taskId === prev.dockTaskId && unit.isOutbound === true && unit.location === 'cell' && current.shippedUnitIds?.has(unit.id)) {
        moves.push({ ...unit, location: 'truck', stops: ['cell', 'truck'] });
      }
    }
  }
  return moves;
};
