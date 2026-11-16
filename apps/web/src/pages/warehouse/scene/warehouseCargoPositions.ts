import type { StockBalance } from '@skladburg/contracts/wms/v1/stock';

import type {
  WarehouseCargoUnitValue,
  WarehouseCargoValue,
} from '../model/warehouseSceneCargo';
import type { getWarehouseLayout } from './warehouseLayout';

import { readWarehouseCargoMoves } from '../model/warehouseSceneCargo';
import { isWarehouseAisleSegmentOpen } from './warehouseAislePath';
import { WAREHOUSE_DOCK_HANDOFF_Z } from './warehouseLayout';

export interface CargoPlacementValue {
  point: CargoPointValue;
  size: number;
}
export type CargoPointValue = [number, number, number];

export interface WarehouseCargoEndpointValue extends CargoPlacementValue {
  cellId: string | undefined;
  location: WarehouseCargoUnitValue['location'];
}

export interface WarehouseCargoTransferValue {
  dockTaskId?: string | undefined;
  from: WarehouseCargoEndpointValue;
  id: string;
  to: WarehouseCargoEndpointValue;
}

export interface WarehouseCargoVisualValue extends CargoPlacementValue {
  id: string;
  requiresActiveDispatch?: boolean | undefined;
  stockUnitIds: readonly string[] | undefined;
  truckTaskId?: string | undefined;
}

export interface WarehouseDeparturePalletValue extends CargoPlacementValue {
  id: string;
}

type WarehouseLayoutValue = ReturnType<typeof getWarehouseLayout>;

const STAGING_MARGIN = 0.12;
const CARGO_SIZE = 0.48;
export const WAREHOUSE_TRUCK_SLOTS = 12;

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
  return {
    point: [dock.x + (slot % 2 === 0 ? -0.36 : 0.36), 0.75, dock.z - 0.55 - Math.floor(slot / 2) * 0.63],
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
    const truck = readTruck(layout, unit.truckSlot);
    const source = unit.isOutbound === true ? readCell(layout, unit.cellId) : undefined;
    return truck === undefined || source === undefined ? truck : { ...truck, size: source.size };
  }
  if (location === 'staging') {
    return readStaging(layout, unit.slot);
  }
  return readCell(layout, unit.cellId);
};

const canReachDockHandoff = (
  layout: WarehouseLayoutValue,
  previous: WarehouseCargoUnitValue,
  truckUnits: readonly WarehouseCargoUnitValue[],
): boolean => {
  const dock = layout.receiving?.dock;
  const start = readTruck(layout, previous.truckSlot);
  if (dock === undefined || start === undefined) {
    return false;
  }

  const halfWidth = CARGO_SIZE * 0.54;
  const obstacles = truckUnits.flatMap((unit) => {
    const placement = unit.expectedUnitId === previous.expectedUnitId ? undefined : readTruck(layout, unit.truckSlot);
    if (placement === undefined) {
      return [];
    }
    const [x, , z] = placement.point;
    return [{ maxX: x + halfWidth, maxZ: z + halfWidth, minX: x - halfWidth, minZ: z - halfWidth }];
  });
  const bounds = { maxX: dock.x + 1, maxZ: dock.z + 1, minX: dock.x - 1, minZ: dock.z - 4.2 };
  return isWarehouseAisleSegmentOpen(
    bounds, obstacles, { x: start.point[0], z: start.point[2] }, { x: dock.x, z: dock.z + WAREHOUSE_DOCK_HANDOFF_Z }, halfWidth,
  );
};

export const buildWarehouseCargoTransfers = (
  layout: WarehouseLayoutValue,
  prev: undefined | WarehouseCargoValue,
  current: WarehouseCargoValue,
  displayedDockTaskId?: string,
): WarehouseCargoTransferValue[] => {
  const previousById = new Map(prev?.units.map(unit => [unit.expectedUnitId, unit]));
  const truckUnits = prev?.units.filter(unit =>
    unit.location === 'truck' && unit.taskId === prev.dockTaskId && unit.truckSlot < WAREHOUSE_TRUCK_SLOTS,
  ) ?? [];
  const isSameTruck = prev?.dockTripId === undefined || current.dockTripId === undefined || prev.dockTripId === current.dockTripId;
  const moves = readWarehouseCargoMoves(prev, current).sort((first, second) =>
    (second.isOutbound === true ? second.truckSlot + 1 : 0) - (first.isOutbound === true ? first.truckSlot + 1 : 0),
  );
  const transfers: WarehouseCargoTransferValue[] = [];
  for (const unit of moves) {
    const previous = previousById.get(unit.expectedUnitId);
    if (previous === undefined) {
      continue;
    }
    const isTruckPickup = previous.location === 'truck' && current.hasDock;
    const isClosingReceipt = displayedDockTaskId === previous.taskId && current.dockDepartures?.get(previous.taskId) === 'received';
    const isSameDockTask = prev?.dockTaskId === previous.taskId && (current.dockTaskId === previous.taskId || isClosingReceipt);
    const hasConfirmedHandoff = isTruckPickup && (isSameTruck || isClosingReceipt) && isSameDockTask
      && previous.truckSlot < WAREHOUSE_TRUCK_SLOTS && canReachDockHandoff(layout, previous, truckUnits);
    if (isTruckPickup && !hasConfirmedHandoff) {
      continue;
    }
    const isDispatch = unit.isOutbound === true && unit.location === 'truck';
    const hasDispatchTruck = current.dockTaskId === unit.taskId || displayedDockTaskId === unit.taskId;
    if (isDispatch && (!hasDispatchTruck || !isSameTruck || unit.truckSlot >= WAREHOUSE_TRUCK_SLOTS
      || !canReachDockHandoff(layout, unit, truckUnits))) {
      continue;
    }

    let from: undefined | WarehouseCargoEndpointValue;
    for (const [index, location] of unit.stops.entries()) {
      const source = index === 0 && location === previous.location ? previous : unit;
      const placement = readPosition(layout, source, location);
      if (placement === undefined) {
        break;
      }

      const to = { ...placement, cellId: source.cellId, location };
      if (from !== undefined) {
        const dockTaskId = from.location === 'truck' || to.location === 'truck' ? unit.taskId : undefined;
        transfers.push({ dockTaskId, from, id: unit.id, to });
      }
      from = to;
    }
    if (isDispatch) {
      truckUnits.push(unit);
    }
  }
  return transfers;
};

export const buildWarehouseDepartureCargo = (
  layout: WarehouseLayoutValue,
  taskId: string,
  prev: undefined | WarehouseCargoValue,
  shippedUnitIds: ReadonlySet<string> | undefined,
): WarehouseDeparturePalletValue[] => {
  const result: WarehouseDeparturePalletValue[] = [];
  for (const unit of prev?.units ?? []) {
    if (unit.taskId !== taskId || unit.isOutbound !== true || unit.truckSlot >= WAREHOUSE_TRUCK_SLOTS
      || shippedUnitIds?.has(unit.id) !== true) {
      continue;
    }
    const target = readPosition(layout, unit, 'truck');
    if (target !== undefined) {
      result.push({ ...target, id: unit.id });
    }
  }
  return result;
};

export const buildWarehouseCargoVisuals = (
  layout: WarehouseLayoutValue,
  current: WarehouseCargoValue,
  balances: readonly StockBalance[] | undefined,
  activeDispatchId: string | undefined,
  parkedTaskIds?: ReadonlySet<string>,
): WarehouseCargoVisualValue[] => {
  const result: WarehouseCargoVisualValue[] = [];

  for (const unit of current.units) {
    const requiresActiveDispatch = current.dockTaskId !== unit.taskId && unit.isOutbound === true && unit.taskId === activeDispatchId;
    const isTruck = unit.location === 'truck';
    const isHiddenTruck = isTruck && (unit.truckSlot >= WAREHOUSE_TRUCK_SLOTS
      || (unit.taskId !== current.dockTaskId && !requiresActiveDispatch && parkedTaskIds?.has(unit.taskId) !== true));
    if (isHiddenTruck || unit.location === 'cell') {
      continue;
    }

    const target = readPosition(layout, unit, unit.location);
    if (target !== undefined) {
      result.push({
        ...target, id: unit.id, requiresActiveDispatch, stockUnitIds: undefined, truckTaskId: isTruck ? unit.taskId : undefined,
      });
    }
  }

  const occupiedCells = new Map<string, string[]>();
  for (const balance of balances ?? []) {
    const id = balance.handlingUnit?.id;
    if (id === undefined || current.shippedUnitIds?.has(id) === true || !layout.cellsById.has(balance.cellId)) {
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
      result.push({ ...cell, id: `stock:${id}`, stockUnitIds });
    }
  }

  return result;
};
