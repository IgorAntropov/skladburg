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
  dockDepartures?: ReadonlyMap<string, WarehouseDockDepartureValue> | undefined;
  dockTaskId: string | undefined;
  dockTripId?: string | undefined;
  dockVisits?: readonly WarehouseDockVisitValue[] | undefined;
  hasDock: boolean;
  shippedUnitIds?: ReadonlySet<string> | undefined;
  units: readonly WarehouseCargoUnitValue[];
}

export type WarehouseDockDepartureValue = 'received' | 'route' | 'self-pickup';

export interface WarehouseDockVisitValue {
  isOutbound?: boolean | undefined;
  taskId: string;
  tripId: string | undefined;
  unloadingPointId?: string | undefined;
}

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
  const next = dockVisits[0];
  return { ...current, dockTaskId: next?.taskId, dockTripId: next?.tripId, dockVisits };
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
  for (const unit of current.units) {
    const previous = before.get(unit.expectedUnitId);
    if (unit.isOutbound === true) {
      if (prev.hasDock && current.hasDock && previous?.isOutbound === true && previous.taskId === unit.taskId
        && previous.location === 'cell' && unit.location === 'truck' && prev.dockTaskId === unit.taskId
        && (current.dockTaskId === unit.taskId || current.dockTaskId === undefined
          || current.dockDepartures?.get(unit.taskId) === 'self-pickup')) {
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

  return moves;
};
