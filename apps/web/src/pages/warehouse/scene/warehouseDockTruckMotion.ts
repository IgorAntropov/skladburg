import type { WarehouseDockPointValue } from './warehouseLayout';
import type { WarehouseYardRoadsValue } from './warehouseYardRoads';

import {
  readWarehouseParkingExit,
  readWarehouseYardApproach,
  WAREHOUSE_PARKING_EXIT_ADVANCE,
  WAREHOUSE_TRUCK_RUNUP,
} from './warehouseYardRoads';

export interface WarehouseDockTruckValue {
  elapsed: number;
  offsetX: number;
  offsetZ: number;
  phase: 'approaching' | 'away' | 'departing' | 'docked';
  start: WarehouseDockPointValue;
  taskId: string | undefined;
  usesParkingExit: boolean;
  yaw: number;
}

const APPROACH_SECONDS = 2.8;
const DEPARTURE_SECONDS = 2.8;
const PARKING_EXIT_SECONDS = 1.15;
const MAX_FRAME_DELTA = 0.05;

export const createWarehouseDockTruck = (taskId: string | undefined): WarehouseDockTruckValue => ({
  elapsed: 0,
  offsetX: 0,
  offsetZ: taskId === undefined ? -WAREHOUSE_TRUCK_RUNUP : 0,
  phase: taskId === undefined ? 'away' : 'docked',
  start: { x: 0, z: 0 },
  taskId,
  usesParkingExit: false,
  yaw: 0,
});

export const settleWarehouseDockTruck = (truck: WarehouseDockTruckValue, taskId: string | undefined): void => {
  truck.offsetX = 0;
  truck.offsetZ = taskId === undefined ? -WAREHOUSE_TRUCK_RUNUP : 0;
  truck.phase = taskId === undefined ? 'away' : 'docked';
  truck.taskId = taskId;
  truck.yaw = 0;
};

export const isWarehouseDockTruckMoving = ({ phase }: WarehouseDockTruckValue): boolean =>
  phase === 'approaching' || phase === 'departing';

export const startWarehouseDockApproach = (
  truck: WarehouseDockTruckValue,
  taskId: string,
  startX: number,
  startZ: number,
  dock: WarehouseDockPointValue,
  usesParkingExit: boolean,
): void => {
  truck.elapsed = 0;
  truck.offsetX = startX - dock.x;
  truck.offsetZ = startZ - dock.z;
  truck.phase = 'approaching';
  truck.start.x = startX;
  truck.start.z = startZ;
  truck.usesParkingExit = usesParkingExit;
  truck.taskId = taskId;
  truck.yaw = 0;
};

export const startWarehouseDockDeparture = (truck: WarehouseDockTruckValue): void => {
  truck.elapsed = 0;
  truck.phase = 'departing';
};

export const advanceWarehouseDockTruck = (
  truck: WarehouseDockTruckValue,
  roads: WarehouseYardRoadsValue,
  dock: WarehouseDockPointValue,
  delta: number,
): void => {
  if (!isWarehouseDockTruckMoving(truck)) {
    return;
  }
  const isApproaching = truck.phase === 'approaching';
  const exitSeconds = isApproaching && truck.usesParkingExit ? PARKING_EXIT_SECONDS : 0;
  const duration = isApproaching ? APPROACH_SECONDS : DEPARTURE_SECONDS;
  truck.elapsed += Math.min(delta, MAX_FRAME_DELTA);
  const isLeavingParking = truck.elapsed < exitSeconds;
  const progress = isLeavingParking ? truck.elapsed / exitSeconds : Math.min((truck.elapsed - exitSeconds) / duration, 1);
  if (progress === 1) {
    settleWarehouseDockTruck(truck, isApproaching ? truck.taskId : undefined);
    return;
  }

  const eased = progress * progress * (3 - 2 * progress);
  if (isLeavingParking) {
    readWarehouseParkingExit(roads, truck.start, dock, truck.start.z + WAREHOUSE_PARKING_EXIT_ADVANCE * eased, truck);
  }
  else if (isApproaching) {
    const startX = truck.usesParkingExit ? roads.entrance.x : truck.start.x;
    const startZ = truck.usesParkingExit ? truck.start.z + WAREHOUSE_PARKING_EXIT_ADVANCE : truck.start.z;
    readWarehouseYardApproach(roads, startX, startZ, dock, eased, truck);
  }
  else {
    readWarehouseYardApproach(roads, roads.entrance.x, roads.entrance.z, dock, 1 - eased, truck);
  }
};
