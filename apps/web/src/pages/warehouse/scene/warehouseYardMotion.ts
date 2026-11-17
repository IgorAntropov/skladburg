import {
  readWarehouseParkingOffset,
  WAREHOUSE_YARD_PARKING_ENTRANCE,
  WAREHOUSE_YARD_PARKING_LIMIT,
} from './warehouseYardParking';

export interface WarehouseYardMotionValue {
  elapsed: number;
  hasChanged: boolean;
  hasInitialized: boolean;
  isMoving: boolean;
  parked: WarehouseParkingPoseValue[];
  pool: readonly WarehouseParkingPoseValue[];
  previous: readonly WarehouseParkingPositionValue[];
}

interface WarehouseParkingPoseValue extends WarehouseParkingPositionValue {
  startZ: number;
  targetZ: number;
}

interface WarehouseParkingPositionValue {
  offsetZ: number;
  taskId: string;
}

const MAX_FRAME_DELTA = 0.05;
const PARKING_ADVANCE_SECONDS = 2.8;

export const createWarehouseYardMotion = (): WarehouseYardMotionValue => ({
  elapsed: 0,
  hasChanged: true,
  hasInitialized: false,
  isMoving: false,
  parked: [],
  pool: Array.from({ length: WAREHOUSE_YARD_PARKING_LIMIT }, (): WarehouseParkingPoseValue =>
    ({ offsetZ: 0, startZ: 0, targetZ: 0, taskId: '' })),
  previous: Array.from({ length: WAREHOUSE_YARD_PARKING_LIMIT }, (): WarehouseParkingPositionValue => ({ offsetZ: 0, taskId: '' })),
});

const findTruckOffset = (parked: readonly WarehouseParkingPositionValue[], taskId: string | undefined): number | undefined => {
  for (let index = 0; taskId !== undefined && index < parked.length; index += 1) {
    const truck = parked[index];
    if (truck?.taskId === taskId) {
      return truck.offsetZ;
    }
  }
  return undefined;
};

export const readWarehouseYardTruckOffset = (yard: WarehouseYardMotionValue, taskId: string | undefined): number | undefined =>
  findTruckOffset(yard.parked, taskId);

export const syncWarehouseYardMotion = (
  yard: WarehouseYardMotionValue,
  taskIds: readonly string[],
  isReducedMotion: boolean,
): void => {
  let hasDifferentQueue = yard.parked.length !== taskIds.length;
  for (let index = 0; index < taskIds.length && !hasDifferentQueue; index += 1) {
    hasDifferentQueue = yard.parked[index]?.taskId !== taskIds[index];
  }
  if (!hasDifferentQueue && (!isReducedMotion || !yard.isMoving)) {
    yard.hasInitialized = true;
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
  for (let index = 0; index < taskIds.length; index += 1) {
    const taskId = taskIds[index];
    const truck = yard.pool[index];
    if (taskId === undefined || truck === undefined) {
      continue;
    }
    const targetZ = readWarehouseParkingOffset(index);
    const fromZ = isReducedMotion || !yard.hasInitialized
      ? targetZ
      : findTruckOffset(yard.previous, taskId) ?? WAREHOUSE_YARD_PARKING_ENTRANCE;
    truck.offsetZ = fromZ;
    truck.startZ = fromZ;
    truck.targetZ = targetZ;
    truck.taskId = taskId;
    yard.isMoving ||= fromZ !== targetZ;
    yard.parked.push(truck);
  }
  yard.hasChanged = true;
  yard.hasInitialized = true;
};

export const advanceWarehouseYardMotion = (yard: WarehouseYardMotionValue, delta: number): void => {
  if (!yard.isMoving) {
    return;
  }
  yard.elapsed += Math.min(delta, MAX_FRAME_DELTA);
  const progress = Math.min(yard.elapsed / PARKING_ADVANCE_SECONDS, 1);
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
