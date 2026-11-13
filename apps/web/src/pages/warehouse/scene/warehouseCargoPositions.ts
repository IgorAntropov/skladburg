import type { StockBalance } from '@skladburg/contracts/wms/v1/stock';

import type {
  WarehouseCargoUnitValue,
  WarehouseCargoValue,
} from '../model/warehouseSceneCargo';
import type { getWarehouseLayout } from './warehouseLayout';

import { readWarehouseCargoMoves } from '../model/warehouseSceneCargo';

interface CargoPlacementValue {
  point: CargoPointValue;
  size: number;
}
type CargoPointValue = [number, number, number];

interface WarehouseCargoVisualValue extends CargoPlacementValue {
  id: string;
  path: readonly CargoPointValue[];
  stays: boolean;
  stockUnitIds: readonly string[] | undefined;
}

type WarehouseLayoutValue = ReturnType<typeof getWarehouseLayout>;

const STAGING_MARGIN = 0.12;
const CARGO_SIZE = 0.48;
const TRUCK_SLOTS = 12;

const readStaging = (layout: WarehouseLayoutValue, slot: number): CargoPlacementValue | undefined => {
  const area = layout.receiving;
  if (area === undefined) {
    return undefined;
  }
  const width = area.width - 2 * STAGING_MARGIN;
  const depth = area.depth - 2 * STAGING_MARGIN;
  if (width <= 0 || depth <= 0) {
    return undefined;
  }
  const columns = Math.max(1, Math.floor(width / 0.62));
  const rows = Math.max(1, Math.floor(depth / 0.62));
  const column = slot % columns;
  const row = Math.floor(slot / columns) % rows;
  return {
    point: [
      area.x + STAGING_MARGIN + (column + 0.5) * width / columns,
      0.04,
      area.z + STAGING_MARGIN + (row + 0.5) * depth / rows,
    ],
    size: Math.min(CARGO_SIZE, width / columns * 0.82, depth / rows * 0.82),
  };
};

const readTruck = (layout: WarehouseLayoutValue, slot: number): CargoPlacementValue | undefined => {
  const dock = layout.receiving?.dock;
  if (dock === undefined) {
    return undefined;
  }
  const index = Math.min(slot, TRUCK_SLOTS - 1);
  return {
    point: [dock.x + (index % 2 === 0 ? -0.36 : 0.36), 0.75, dock.z - 0.55 - Math.floor(index / 2) * 0.63],
    size: CARGO_SIZE,
  };
};

const readCell = (layout: WarehouseLayoutValue, cellId: string | undefined): CargoPlacementValue | undefined => {
  const cell = cellId === undefined ? undefined : layout.cellsById.get(cellId);
  if (cell === undefined) {
    return undefined;
  }

  return {
    point: [cell.position[0], cell.position[1] + cell.size[1] / 2, cell.position[2]],
    size: Math.min(CARGO_SIZE, cell.size[0] * 0.78, cell.size[2] * 0.78),
  };
};

const readPosition = (
  layout: WarehouseLayoutValue,
  unit: WarehouseCargoUnitValue,
  location: WarehouseCargoUnitValue['location'],
): CargoPlacementValue | undefined => {
  if (location === 'truck') {
    return readTruck(layout, unit.truckSlot);
  }
  if (location === 'staging') {
    return readStaging(layout, unit.slot);
  }
  return readCell(layout, unit.cellId);
};

export const buildWarehouseCargoVisuals = (
  layout: WarehouseLayoutValue,
  prev: undefined | WarehouseCargoValue,
  current: WarehouseCargoValue,
  balances: readonly StockBalance[] | undefined,
): WarehouseCargoVisualValue[] => {
  const moves = new Map(readWarehouseCargoMoves(prev, current).map(move => [move.id, move.stops] as const));
  const result: WarehouseCargoVisualValue[] = [];

  for (const unit of current.units) {
    const stops = moves.get(unit.id);
    const isHiddenTruck = unit.location === 'truck' && (unit.taskId !== current.dockTaskId || unit.truckSlot >= TRUCK_SLOTS);
    if (isHiddenTruck || (unit.location === 'cell' && stops === undefined)) {
      continue;
    }

    const target = readPosition(layout, unit, unit.location);
    if (target === undefined) {
      continue;
    }
    const path = stops?.flatMap((stop) => {
      const placement = readPosition(layout, unit, stop);
      return placement === undefined ? [] : [placement.point];
    }) ?? [];

    result.push({
      ...target,
      id: unit.id,
      path,
      stays: unit.location !== 'cell',
      stockUnitIds: undefined,
    });
  }

  const occupiedCells = new Map<string, string[]>();
  for (const balance of balances ?? []) {
    const id = balance.handlingUnit?.id;
    if (id === undefined || !layout.cellsById.has(balance.cellId)) {
      continue;
    }
    const ids = occupiedCells.get(balance.cellId);
    if (ids === undefined) {
      occupiedCells.set(balance.cellId, [id]);
    }
    else {
      ids.push(id);
    }
  }

  for (const [id, stockUnitIds] of occupiedCells) {
    const cell = readCell(layout, id);
    if (cell !== undefined) {
      result.push({ ...cell, id: `stock:${id}`, path: [], stays: true, stockUnitIds });
    }
  }

  return result;
};
