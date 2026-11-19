import type { WarehouseDockVisitValue } from '../model/warehouseSceneCargo';
import type { WarehouseDockTruckValue } from './warehouseDockTruckMotion';
import type { WarehouseForkliftPlaybackValue } from './warehouseForkliftPlayback';
import type { WarehouseDockPointValue } from './warehouseLayout';
import type { WarehouseYardMotionValue } from './warehouseYardMotion';
import type { WarehouseYardRoadsValue } from './warehouseYardRoads';

import {
  advanceWarehouseDockTruck,
  isWarehouseDockTruckMoving,
  settleWarehouseDockTruck,
  startWarehouseDockApproach,
  startWarehouseDockDeparture,
} from './warehouseDockTruckMotion';
import {
  advanceWarehouseYardMotion,
  createWarehouseYardMotion,
  readWarehouseYardTruckOffset,
  syncWarehouseYardMotion,
} from './warehouseYardMotion';
import {
  WAREHOUSE_YARD_PARKING_ENTRANCE,
  WAREHOUSE_YARD_PARKING_LIMIT,
  WAREHOUSE_YARD_PARKING_SPACING,
} from './warehouseYardParking';

export interface WarehouseYardLaneValue {
  dock: WarehouseDockPointValue;
  hasChanged: boolean;
  hasConfirmedDeparture: boolean;
  target: string | undefined;
  truck: WarehouseDockTruckValue;
}

export interface WarehouseYardTrafficValue {
  forklifts: (undefined | WarehouseForkliftPlaybackValue)[];
  hasParkingChanged: boolean;
  lanes: (undefined | WarehouseYardLaneValue)[];
  queue: string[];
  reservation: undefined | WarehouseYardLaneValue;
  visits: readonly WarehouseDockVisitValue[];
  yard: WarehouseYardMotionValue;
}

export const createWarehouseYardTraffic = (): WarehouseYardTrafficValue => ({
  forklifts: [],
  hasParkingChanged: false,
  lanes: [],
  queue: [],
  reservation: undefined,
  visits: [],
  yard: createWarehouseYardMotion(),
});

export const setWarehouseYardLane = (
  traffic: WarehouseYardTrafficValue,
  index: number,
  lane: undefined | WarehouseYardLaneValue,
): void => {
  if (lane !== traffic.lanes[index] && traffic.reservation === traffic.lanes[index]) {
    traffic.reservation = undefined;
  }
  traffic.lanes[index] = lane;
};

export const setWarehouseYardVisits = (traffic: WarehouseYardTrafficValue, visits: readonly WarehouseDockVisitValue[]): void => {
  traffic.visits = visits;
};

export const setWarehouseYardForklift = (
  traffic: WarehouseYardTrafficValue,
  index: number,
  playback: undefined | WarehouseForkliftPlaybackValue,
): void => {
  traffic.forklifts[index] = playback;
};

const readTaskLane = (traffic: WarehouseYardTrafficValue, taskId: string): undefined | WarehouseYardLaneValue => {
  let index = 0;
  while (index < traffic.lanes.length) {
    const lane = traffic.lanes[index];
    index += 1;
    if (lane !== undefined && (lane.target === taskId || lane.truck.taskId === taskId)) {
      return lane;
    }
  }
  return undefined;
};

const isVisitingYard = (visits: readonly WarehouseDockVisitValue[], taskId: string): boolean => {
  let index = 0;
  while (index < visits.length) {
    const visit = visits[index];
    index += 1;
    if (visit?.taskId === taskId) {
      return true;
    }
  }
  return false;
};

const syncParking = (traffic: WarehouseYardTrafficValue, isReducedMotion: boolean): void => {
  const { queue, visits, yard } = traffic;
  queue.length = 0;
  let tailZ = Infinity;
  let index = 0;
  while (index < yard.parked.length) {
    const slot = yard.parked[index];
    index += 1;
    if (slot === undefined) {
      continue;
    }
    const lane = readTaskLane(traffic, slot.taskId);
    if (lane === undefined ? isVisitingYard(visits, slot.taskId) : lane.truck.taskId !== slot.taskId) {
      queue.push(slot.taskId);
      tailZ = slot.offsetZ;
    }
  }
  const needsClearEntrance = !isReducedMotion && yard.hasInitialized;
  const clearanceZ = WAREHOUSE_YARD_PARKING_ENTRANCE + WAREHOUSE_YARD_PARKING_SPACING;
  index = 0;
  while (index < visits.length && queue.length < WAREHOUSE_YARD_PARKING_LIMIT && (!needsClearEntrance || tailZ >= clearanceZ)) {
    const taskId = visits[index]?.taskId;
    index += 1;
    if (taskId !== undefined && !queue.includes(taskId) && readTaskLane(traffic, taskId) === undefined) {
      queue.push(taskId);
      tailZ = WAREHOUSE_YARD_PARKING_ENTRANCE;
    }
  }
  syncWarehouseYardMotion(yard, queue, isReducedMotion);
};

const reserveDeparture = (traffic: WarehouseYardTrafficValue, isReducedMotion: boolean): void => {
  let index = 0;
  while (index < traffic.lanes.length) {
    const lane = traffic.lanes[index];
    index += 1;
    if (lane === undefined || (lane.truck.taskId === lane.target && !isWarehouseDockTruckMoving(lane.truck))) {
      continue;
    }
    const { hasConfirmedDeparture, target, truck } = lane;
    const isReplacement = !hasConfirmedDeparture && truck.taskId !== target && truck.phase !== 'away' && truck.phase !== 'departing';
    if (isReducedMotion || isReplacement) {
      const isWaiting = !isReducedMotion && readWarehouseYardTruckOffset(traffic.yard, target) !== undefined;
      settleWarehouseDockTruck(truck, isWaiting ? undefined : target);
      if (traffic.reservation === lane) {
        traffic.reservation = undefined;
      }
      lane.hasChanged = true;
    }
    else if (hasConfirmedDeparture && truck.phase === 'docked' && traffic.reservation === undefined) {
      startWarehouseDockDeparture(truck);
      traffic.reservation = lane;
      lane.hasChanged = true;
    }
  }
};

const reserveApproach = (
  traffic: WarehouseYardTrafficValue,
  roads: WarehouseYardRoadsValue,
): undefined | WarehouseYardLaneValue => {
  let index = 0;
  while (index < traffic.yard.parked.length) {
    const slot = traffic.yard.parked[index];
    const isRearSpot = index > 0;
    index += 1;
    const lane = slot === undefined ? undefined : readTaskLane(traffic, slot.taskId);
    if (slot !== undefined && lane?.truck.phase === 'away') {
      startWarehouseDockApproach(lane.truck, slot.taskId, 0, slot.offsetZ, lane.dock, isRearSpot);
      return lane;
    }
  }

  index = 0;
  while (index < traffic.lanes.length) {
    const lane = traffic.lanes[index];
    index += 1;
    if (lane?.target !== undefined && lane.truck.phase === 'away'
      && readWarehouseYardTruckOffset(traffic.yard, lane.target) === undefined) {
      startWarehouseDockApproach(lane.truck, lane.target, roads.entrance.x, roads.entrance.z, lane.dock, false);
      return lane;
    }
  }
  return undefined;
};

export const advanceWarehouseYardTraffic = (
  traffic: WarehouseYardTrafficValue,
  roads: undefined | WarehouseYardRoadsValue,
  delta: number,
  isReducedMotion: boolean,
  hasPendingLayout = false,
): boolean => {
  const { yard } = traffic;
  traffic.hasParkingChanged = false;
  yard.hasChanged = false;
  if (roads === undefined || traffic.lanes[0] === undefined) {
    return false;
  }

  let index = 0;
  while (index < traffic.lanes.length) {
    const lane = traffic.lanes[index];
    index += 1;
    if (lane !== undefined) {
      lane.hasChanged = false;
    }
  }

  const { reservation } = traffic;
  if (isReducedMotion) {
    traffic.reservation = undefined;
    if (hasPendingLayout && reservation !== undefined) {
      settleWarehouseDockTruck(reservation.truck, undefined);
      reservation.hasChanged = true;
    }
  }
  else if (reservation !== undefined) {
    advanceWarehouseDockTruck(reservation.truck, roads, reservation.dock, delta);
    reservation.hasChanged = true;
    if (!isWarehouseDockTruckMoving(reservation.truck)) {
      traffic.reservation = undefined;
    }
  }
  if (hasPendingLayout) {
    return traffic.reservation !== undefined;
  }

  reserveDeparture(traffic, isReducedMotion);
  syncParking(traffic, isReducedMotion);
  if (!isReducedMotion && traffic.reservation === undefined) {
    const approach = reserveApproach(traffic, roads);
    if (approach !== undefined) {
      traffic.reservation = approach;
      approach.hasChanged = true;
      syncParking(traffic, false);
    }
    else {
      advanceWarehouseYardMotion(yard, delta);
    }
  }
  traffic.hasParkingChanged = yard.hasChanged;
  return traffic.reservation !== undefined || yard.isMoving;
};
