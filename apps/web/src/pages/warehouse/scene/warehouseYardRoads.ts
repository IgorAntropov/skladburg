import type { WarehouseDockPointValue } from './warehouseLayout';

import { readWarehouseParkingOffset } from './warehouseYardParking';

export interface WarehouseYardRoadsValue {
  entrance: WarehouseDockPointValue;
  junctionZ: number;
  throatZ: number;
}

interface WarehouseYardPoseValue {
  offsetX: number;
  offsetZ: number;
  yaw: number;
}

export const WAREHOUSE_PARKING_EXIT_ADVANCE = 0.65;
export const WAREHOUSE_TRUCK_CENTER_Z = -3;
export const WAREHOUSE_TRUCK_RUNUP = 3.2;
const ENTRANCE_LANE_SPACING = 3.2;
const JUNCTURE_Z = -13.5;
const DOCK_THROAT_Z = -7;

export const buildWarehouseYardRoads = (docks: readonly WarehouseDockPointValue[]): undefined | WarehouseYardRoadsValue => {
  const primary = docks[0];
  if (primary === undefined) {
    return undefined;
  }
  let left = primary.x;
  for (const dock of docks) {
    left = Math.min(left, dock.x);
  }
  return {
    entrance: { x: left - primary.x - ENTRANCE_LANE_SPACING, z: readWarehouseParkingOffset(0) - 2 },
    junctionZ: JUNCTURE_Z,
    throatZ: DOCK_THROAT_Z,
  };
};

const readYardTurn = (
  pose: WarehouseYardPoseValue,
  dock: WarehouseDockPointValue,
  startX: number,
  endX: number,
  startZ: number,
  endZ: number,
  z: number,
): void => {
  const span = endZ - startZ;
  const progress = Math.max(0, Math.min(1, (z - startZ) / span));
  const distanceX = endX - startX;
  const x = progress === 1 ? endX : startX + distanceX * progress * progress * (3 - 2 * progress);
  pose.offsetX = x - dock.x;
  pose.offsetZ = z - dock.z;
  pose.yaw = Math.atan(6 * distanceX * progress * (1 - progress) / span) || 0;
};

export const readWarehouseYardApproach = (
  { entrance, junctionZ, throatZ }: WarehouseYardRoadsValue,
  start: WarehouseDockPointValue,
  dock: WarehouseDockPointValue,
  z: number,
  pose: WarehouseYardPoseValue,
  usesParkingExit: boolean,
): void => {
  const parkingExitZ = start.z + WAREHOUSE_PARKING_EXIT_ADVANCE;
  if (usesParkingExit && z < parkingExitZ) {
    readYardTurn(pose, dock, start.x, entrance.x, start.z, parkingExitZ, z);
  }
  else {
    readYardTurn(pose, dock, usesParkingExit ? entrance.x : start.x, dock.x, junctionZ, throatZ, z);
  }
};
