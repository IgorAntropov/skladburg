import type { WarehouseDockPointValue } from './warehouseLayout';
import type { WarehouseYardRoadsValue } from './warehouseYardRoads';

import {
  readWarehouseParkingOffset,
  WAREHOUSE_YARD_MAX_PARKING_LIMIT,
  WAREHOUSE_YARD_PARKING_ENTRANCE,
  WAREHOUSE_YARD_PARKING_LIMIT,
} from './warehouseYardParking';
import { readWarehouseParkingArrival } from './warehouseYardRoads';

export interface WarehouseParkingPoseValue extends WarehouseParkingPositionValue {
  offsetX: number;
  slotIndex: number;
  startZ: number;
  targetZ: number;
  yaw: number;
}

export interface WarehouseYardMotionValue {
  byTask: Map<string, WarehouseParkingPoseValue>;
  elapsed: number;
  hasChanged: boolean;
  hasInitialized: boolean;
  isMoving: boolean;
  parked: WarehouseParkingPoseValue[];
  pool: readonly WarehouseParkingPoseValue[];
  previous: readonly WarehouseParkingPositionValue[];
}

interface WarehouseParkingPositionValue {
  offsetZ: number;
  taskId: string;
}

const MAX_FRAME_DELTA = 0.05;
const PARKING_ADVANCE_SECONDS = 2.8;

export const createWarehouseYardMotion = (): WarehouseYardMotionValue => ({
  byTask: new Map(),
  elapsed: 0,
  hasChanged: true,
  hasInitialized: false,
  isMoving: false,
  parked: [],
  pool: Array.from({ length: WAREHOUSE_YARD_MAX_PARKING_LIMIT }, (_unused, slotIndex): WarehouseParkingPoseValue =>
    ({ offsetX: 0, offsetZ: 0, slotIndex, startZ: 0, targetZ: 0, taskId: '', yaw: 0 })),
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

export const readWarehouseYardTruckPose = (
  yard: WarehouseYardMotionValue,
  taskId: string | undefined,
): undefined | WarehouseParkingPoseValue => taskId === undefined ? undefined : yard.byTask.get(taskId);

export const readWarehouseYardTruckOffset = (yard: WarehouseYardMotionValue, taskId: string | undefined): number | undefined =>
  readWarehouseYardTruckPose(yard, taskId)?.offsetZ;

export const settleWarehouseParkingArrival = (
  yard: WarehouseYardMotionValue,
  truck: WarehouseParkingPoseValue,
  spot: WarehouseDockPointValue,
): void => {
  truck.offsetX = spot.x;
  truck.offsetZ = spot.z;
  truck.yaw = 0;
  yard.isMoving = false;
  yard.hasChanged = true;
};

export const placeWarehouseParkingTruck = (
  yard: WarehouseYardMotionValue,
  roads: WarehouseYardRoadsValue,
  truck: WarehouseParkingPoseValue,
  spot: WarehouseDockPointValue,
  taskId: string,
  isMoving: boolean,
): void => {
  truck.taskId = taskId;
  yard.byTask.set(taskId, truck);
  yard.parked.push(truck);
  if (isMoving) {
    yard.elapsed = 0;
    yard.isMoving = true;
    yard.hasChanged = true;
    readWarehouseParkingArrival(roads, spot, 0, truck);
  }
  else {
    settleWarehouseParkingArrival(yard, truck, spot);
  }
};

export const advanceWarehouseParkingArrival = (
  yard: WarehouseYardMotionValue,
  roads: WarehouseYardRoadsValue,
  truck: WarehouseParkingPoseValue,
  delta: number,
  isReducedMotion: boolean,
  playbackRate = 1,
): void => {
  const spot = roads.parking[truck.slotIndex];
  if (spot === undefined) {
    yard.isMoving = false;

    return;
  }

  yard.elapsed += Math.min(delta, MAX_FRAME_DELTA) * playbackRate;
  const progress = Math.min(yard.elapsed / PARKING_ADVANCE_SECONDS, 1);
  if (isReducedMotion || progress === 1) {
    settleWarehouseParkingArrival(yard, truck, spot);

    return;
  }

  const eased = progress * progress * (3 - 2 * progress);
  readWarehouseParkingArrival(roads, spot, eased, truck);
  yard.hasChanged = true;
};

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
    const truck = yard.pool[slot];
    if (truck !== undefined) {
      truck.taskId = '';
    }
  }
  yard.elapsed = 0;
  yard.isMoving = false;
  yard.byTask.clear();
  yard.parked.length = 0;
  for (let index = 0; index < Math.min(taskIds.length, WAREHOUSE_YARD_PARKING_LIMIT); index += 1) {
    const taskId = taskIds[index];
    const truck = yard.pool[index];
    if (taskId === undefined || truck === undefined) {
      continue;
    }
    const targetZ = readWarehouseParkingOffset(index);
    const fromZ = isReducedMotion || !yard.hasInitialized
      ? targetZ
      : findTruckOffset(yard.previous, taskId) ?? WAREHOUSE_YARD_PARKING_ENTRANCE;
    truck.offsetX = 0;
    truck.offsetZ = fromZ;
    truck.startZ = fromZ;
    truck.targetZ = targetZ;
    truck.taskId = taskId;
    truck.yaw = 0;
    yard.isMoving ||= fromZ !== targetZ;
    yard.parked.push(truck);
    yard.byTask.set(taskId, truck);
  }
  yard.hasChanged = true;
  yard.hasInitialized = true;
};

export const advanceWarehouseYardMotion = (yard: WarehouseYardMotionValue, delta: number, playbackRate = 1): void => {
  if (!yard.isMoving) {
    return;
  }
  yard.elapsed += Math.min(delta, MAX_FRAME_DELTA) * playbackRate;
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
