export interface WarehouseCargoUnitValue {
  cellId: string | undefined;
  expectedUnitId: string;
  id: string;
  location: CargoLocationValue;
  slot: number;
  taskId: string;
  truckSlot: number;
}

export interface WarehouseCargoValue {
  dockTaskId: string | undefined;
  hasDock: boolean;
  units: readonly WarehouseCargoUnitValue[];
}

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
