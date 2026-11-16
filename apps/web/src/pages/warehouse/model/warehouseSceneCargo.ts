export interface WarehouseCargoUnitValue {
  cellId: string | undefined;
  expectedUnitId: string;
  id: string;
  isOutbound?: boolean;
  location: CargoLocationValue;
  slot: number;
  taskId: string;
  truckSlot: number;
}

export interface WarehouseCargoValue {
  dockDepartures?: ReadonlyMap<string, WarehouseDockDepartureValue> | undefined;
  dockTaskId: string | undefined;
  dockTripId?: string | undefined;
  hasDock: boolean;
  shippedUnitIds?: ReadonlySet<string> | undefined;
  units: readonly WarehouseCargoUnitValue[];
}

export type WarehouseDockDepartureValue = 'received' | 'route' | 'self-pickup';

type CargoLocationValue = 'cell' | 'staging' | 'truck';

interface WarehouseCargoMoveValue extends WarehouseCargoUnitValue {
  stops: readonly CargoLocationValue[];
}

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
        && (current.dockTaskId === unit.taskId || current.dockTaskId === undefined)) {
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
