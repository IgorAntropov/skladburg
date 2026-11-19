import type { WarehouseAisleRectValue } from './warehouseAislePath';
import type { WarehouseDockPointValue } from './warehouseLayout';

import {
  buildWarehouseParking,
  readWarehouseParkingCapacity,
  WAREHOUSE_YARD_PARKING_LIMIT,
  WAREHOUSE_YARD_PARKING_SPACING,
} from './warehouseYardParking';

export interface WarehouseYardRoadsValue {
  apron: WarehouseAisleRectValue;
  entrance: WarehouseDockPointValue;
  junctionZ: number;
  parking: readonly WarehouseDockPointValue[];
  parkingMouthZ: number;
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
export const WAREHOUSE_TRUCK_SWEEP_RADIUS = 3.25;
const ENTRANCE_LANE_SPACING = 3.2;
const EXPANDED_LANE_SPACING = 4.4;
const JUNCTION_Z = -13.5;
const DOCK_THROAT_Z = -7;
const PARKING_CLEARANCE = 6.1;
const SHOULDER = WAREHOUSE_TRUCK_SWEEP_RADIUS + 0.25;
const TURN_RADIUS = (DOCK_THROAT_Z - JUNCTION_Z) / 2;
const QUARTER_CIRCLE = Math.PI / 2;
const TURN_LENGTH = TURN_RADIUS * QUARTER_CIRCLE;

const origin: WarehouseDockPointValue = { x: 0, z: 0 };

export const buildWarehouseYardRoads = (
  docks: readonly WarehouseDockPointValue[],
  parkingCount = WAREHOUSE_YARD_PARKING_LIMIT,
): undefined | WarehouseYardRoadsValue => {
  const primary = docks[0];
  if (primary === undefined) {
    return undefined;
  }
  const capacity = readWarehouseParkingCapacity(parkingCount);
  const isExpanded = capacity > WAREHOUSE_YARD_PARKING_LIMIT;
  const aisleX = isExpanded ? -EXPANDED_LANE_SPACING : -ENTRANCE_LANE_SPACING;
  const oppositeX = 2 * aisleX;
  const depth = Math.max(WAREHOUSE_YARD_PARKING_LIMIT, Math.ceil(capacity / 2));
  const parking = buildWarehouseParking(capacity, oppositeX);
  let left = isExpanded ? oppositeX : aisleX;
  let right = 0;
  for (const dock of docks) {
    const x = dock.x - primary.x;
    left = Math.min(left, x);
    right = Math.max(right, x);
  }
  const parkingMouthZ = JUNCTION_Z - PARKING_CLEARANCE;
  const minZ = parkingMouthZ - (depth + 1) * WAREHOUSE_YARD_PARKING_SPACING;
  return {
    apron: {
      maxX: right + SHOULDER,
      maxZ: DOCK_THROAT_Z + WAREHOUSE_TRUCK_CENTER_Z + SHOULDER,
      minX: left - SHOULDER,
      minZ,
    },
    entrance: { x: aisleX, z: minZ - 0.5 },
    junctionZ: JUNCTION_Z,
    parking,
    parkingMouthZ,
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

export const readWarehouseParkingExit = (
  roads: WarehouseYardRoadsValue,
  start: WarehouseDockPointValue,
  dock: WarehouseDockPointValue,
  z: number,
  pose: WarehouseYardPoseValue,
): void => { readYardTurn(pose, dock, start.x, roads.entrance.x, start.z, start.z + WAREHOUSE_PARKING_EXIT_ADVANCE, z); };

export const readWarehouseParkingArrival = (
  roads: WarehouseYardRoadsValue,
  spot: WarehouseDockPointValue,
  progress: number,
  pose: WarehouseYardPoseValue,
): void => {
  const { x, z } = roads.entrance;
  const turnStartZ = spot.z + WAREHOUSE_PARKING_EXIT_ADVANCE;
  const lead = turnStartZ - z;
  const turnLength = Math.hypot(spot.x - x, WAREHOUSE_PARKING_EXIT_ADVANCE);
  const distance = (lead + turnLength) * progress;
  if (distance <= lead) {
    pose.offsetX = x;
    pose.offsetZ = z + distance;
    pose.yaw = 0;
  }
  else {
    const turnProgress = (distance - lead) / turnLength;
    readWarehouseParkingExit(roads, spot, origin, turnStartZ - WAREHOUSE_PARKING_EXIT_ADVANCE * turnProgress, pose);
  }
};

export const readWarehouseYardApproach = (
  { junctionZ, throatZ }: WarehouseYardRoadsValue,
  startX: number,
  startZ: number,
  dock: WarehouseDockPointValue,
  progress: number,
  pose: WarehouseYardPoseValue,
): void => {
  const difference = dock.x - startX;
  const crossing = Math.abs(difference) - 2 * TURN_RADIUS;
  if (crossing <= 0) {
    const z = startZ + (dock.z - startZ) * progress;
    readYardTurn(pose, dock, startX, dock.x, junctionZ, throatZ, z);
    return;
  }

  const lead = junctionZ - startZ;
  const finish = lead + 2 * TURN_LENGTH + crossing;
  const distance = (finish + dock.z - throatZ) * progress;
  const direction = Math.sign(difference);
  const middleZ = junctionZ + TURN_RADIUS;
  let x = startX;
  let z = startZ + distance;
  let yaw = 0;
  if (distance >= finish) {
    x = dock.x;
    z = throatZ + distance - finish;
  }
  else if (distance >= finish - TURN_LENGTH) {
    const angle = (finish - distance) / TURN_RADIUS;
    x = dock.x - direction * TURN_RADIUS * (1 - Math.cos(angle));
    z = throatZ - TURN_RADIUS * Math.sin(angle);
    yaw = direction * angle;
  }
  else if (distance >= lead + TURN_LENGTH) {
    x = startX + direction * (TURN_RADIUS + distance - lead - TURN_LENGTH);
    z = middleZ;
    yaw = direction * QUARTER_CIRCLE;
  }
  else if (distance >= lead) {
    const angle = (distance - lead) / TURN_RADIUS;
    x = startX + direction * TURN_RADIUS * (1 - Math.cos(angle));
    z = junctionZ + TURN_RADIUS * Math.sin(angle);
    yaw = direction * angle;
  }
  pose.offsetX = x - dock.x;
  pose.offsetZ = z - dock.z;
  pose.yaw = yaw;
};
