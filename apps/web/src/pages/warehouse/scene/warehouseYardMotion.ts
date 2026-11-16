import type { WarehouseDockVisitValue } from '../model/warehouseSceneCargo';

import { WAREHOUSE_YARD_ADVANCE_SECONDS } from './warehouseDockTruckMotion';
import {
  readWarehouseParkingOffset,
  WAREHOUSE_YARD_PARKING_LIMIT,
} from './warehouseYardParking';

export interface WarehouseYardMotionValue {
  elapsed: number;
  hasChanged: boolean;
  isMoving: boolean;
  parked: WarehouseParkingPoseValue[];
  pool: readonly WarehouseParkingPoseValue[];
  previous: readonly WarehouseParkingPositionValue[];
  visible: WarehouseParkingPoseValue[];
}

interface WarehouseParkingPoseValue extends WarehouseParkingPositionValue {
  startZ: number;
  targetZ: number;
}

interface WarehouseParkingPositionValue {
  offsetZ: number;
  taskId: string;
}

export const WAREHOUSE_TRUCK_CLEARANCE = 6.35;
const MAX_FRAME_DELTA = 0.05;

const createSlotPool = (): WarehouseParkingPoseValue[] => Array.from(
  { length: WAREHOUSE_YARD_PARKING_LIMIT },
  (): WarehouseParkingPoseValue => ({ offsetZ: 0, startZ: 0, targetZ: 0, taskId: '' }),
);

export const createWarehouseYardMotion = (): WarehouseYardMotionValue => ({
  elapsed: 0,
  hasChanged: true,
  isMoving: false,
  parked: [],
  pool: createSlotPool(),
  previous: Array.from({ length: WAREHOUSE_YARD_PARKING_LIMIT }, (): WarehouseParkingPositionValue => ({ offsetZ: 0, taskId: '' })),
  visible: [],
});

const refreshVisibleParking = (yard: WarehouseYardMotionValue, dockOffsetZ: number | undefined): void => {
  let frontZ = dockOffsetZ ?? Infinity;
  let count = 0;
  let index = 0;
  while (index < yard.parked.length) {
    const truck = yard.parked[index];
    index += 1;
    if (truck !== undefined && frontZ - truck.offsetZ >= WAREHOUSE_TRUCK_CLEARANCE) {
      yard.hasChanged ||= yard.visible[count] !== truck;
      yard.visible[count] = truck;
      count += 1;
      frontZ = truck.offsetZ;
    }
  }
  yard.hasChanged ||= yard.visible.length !== count;
  yard.visible.length = count;
};

const findTruckOffset = (parked: readonly WarehouseParkingPositionValue[], taskId: string | undefined): number | undefined => {
  let index = 0;
  while (taskId !== undefined && index < parked.length) {
    const truck = parked[index];
    index += 1;
    if (truck?.taskId === taskId) {
      return truck.offsetZ;
    }
  }
  return undefined;
};

export const readWarehouseYardTruckOffset = (yard: WarehouseYardMotionValue, taskId: string | undefined): number | undefined =>
  findTruckOffset(yard.visible, taskId);

export const readPreviousWarehouseYardTruckOffset = (yard: WarehouseYardMotionValue, taskId: string | undefined): number | undefined =>
  findTruckOffset(yard.previous, taskId);

export const syncWarehouseYardMotion = (
  yard: WarehouseYardMotionValue,
  visits: readonly WarehouseDockVisitValue[],
  dockTaskId: string | undefined,
  isReducedMotion: boolean,
  dockOffsetZ?: number,
): void => {
  let hasDifferentQueue = false;
  let count = 0;
  let index = 0;
  while (index < visits.length && count < WAREHOUSE_YARD_PARKING_LIMIT) {
    const taskId = visits[index]?.taskId;
    index += 1;
    if (taskId !== undefined && taskId !== dockTaskId) {
      hasDifferentQueue ||= yard.parked[count]?.taskId !== taskId;
      count += 1;
    }
  }
  if (!hasDifferentQueue && yard.parked.length === count && (!isReducedMotion || !yard.isMoving)) {
    refreshVisibleParking(yard, dockOffsetZ);
    return;
  }

  for (let slot = 0; slot < WAREHOUSE_YARD_PARKING_LIMIT; slot += 1) {
    const prev = yard.previous[slot];
    if (prev !== undefined) {
      prev.taskId = yard.parked[slot]?.taskId ?? '';
      prev.offsetZ = yard.parked[slot]?.offsetZ ?? 0;
    }
  }
  yard.elapsed = 0;
  yard.isMoving = false;
  yard.parked.length = 0;
  index = 0;
  while (index < visits.length && yard.parked.length < WAREHOUSE_YARD_PARKING_LIMIT) {
    const taskId = visits[index]?.taskId;
    index += 1;
    const truck = yard.pool[yard.parked.length];
    if (truck === undefined || taskId === undefined || taskId === dockTaskId) {
      continue;
    }
    const targetZ = readWarehouseParkingOffset(yard.parked.length);
    const fromZ = isReducedMotion ? targetZ : findTruckOffset(yard.previous, taskId) ?? targetZ;
    truck.offsetZ = fromZ;
    truck.startZ = fromZ;
    truck.targetZ = targetZ;
    truck.taskId = taskId;
    yard.isMoving ||= fromZ !== targetZ;
    yard.parked.push(truck);
  }
  yard.hasChanged = true;
  refreshVisibleParking(yard, dockOffsetZ);
};

export const advanceWarehouseYardMotion = (yard: WarehouseYardMotionValue, delta: number): void => {
  if (!yard.isMoving) {
    return;
  }
  yard.elapsed += Math.min(delta, MAX_FRAME_DELTA);
  const progress = Math.min(yard.elapsed / WAREHOUSE_YARD_ADVANCE_SECONDS, 1);
  const eased = progress * progress * (3 - 2 * progress);
  let index = 0;
  while (index < yard.parked.length) {
    const truck = yard.parked[index];
    index += 1;
    if (truck !== undefined) {
      truck.offsetZ = truck.startZ + (truck.targetZ - truck.startZ) * eased;
    }
  }
  yard.isMoving = progress < 1;
  yard.hasChanged = true;
};
