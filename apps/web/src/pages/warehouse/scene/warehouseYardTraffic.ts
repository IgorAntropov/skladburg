import type { WarehouseDockVisitValue } from '../model/warehouseSceneCargo';
import type { WarehouseDockTruckValue } from './warehouseDockTruckMotion';
import type { WarehouseForkliftPlaybackValue } from './warehouseForkliftPlayback';
import type { WarehouseDockPointValue } from './warehouseLayout';
import type {
  WarehouseParkingPoseValue,
  WarehouseYardMotionValue,
} from './warehouseYardMotion';
import type { WarehouseYardRoadsValue } from './warehouseYardRoads';

import {
  advanceWarehouseDockTruck,
  isWarehouseDockTruckMoving,
  settleWarehouseDockTruck,
  startWarehouseDockApproach,
  startWarehouseDockDeparture,
} from './warehouseDockTruckMotion';
import {
  advanceWarehouseParkingArrival,
  advanceWarehouseYardMotion,
  createWarehouseYardMotion,
  placeWarehouseParkingTruck,
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
  indexedVisits: readonly WarehouseDockVisitValue[] | undefined;
  lanes: (undefined | WarehouseYardLaneValue)[];
  queue: string[];
  reservation: undefined | WarehouseParkingPoseValue | WarehouseYardLaneValue;
  visitIds: Set<string>;
  visits: readonly WarehouseDockVisitValue[];
  yard: WarehouseYardMotionValue;
}

export const createWarehouseYardTraffic = (): WarehouseYardTrafficValue => ({
  forklifts: [],
  hasParkingChanged: false,
  indexedVisits: undefined,
  lanes: [],
  queue: [],
  reservation: undefined,
  visitIds: new Set(),
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

const readTruckLane = (traffic: WarehouseYardTrafficValue, taskId: string | undefined): undefined | WarehouseYardLaneValue => {
  const { reservation } = traffic;
  if (taskId === undefined) {
    return undefined;
  }
  if (reservation !== undefined && 'truck' in reservation && reservation.truck.taskId === taskId) {
    return reservation;
  }
  let index = 0;
  while (index < traffic.lanes.length) {
    const lane = traffic.lanes[index];
    index += 1;
    if (lane?.truck.taskId === taskId) {
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

const indexExpandedVisits = (traffic: WarehouseYardTrafficValue): void => {
  const { visitIds, visits } = traffic;
  if (traffic.indexedVisits === visits) {
    return;
  }
  traffic.indexedVisits = visits;
  visitIds.clear();
  for (const visit of visits) {
    visitIds.add(visit.taskId);
  }
};

const retainExpandedParking = (traffic: WarehouseYardTrafficValue): void => {
  const { reservation, visitIds, yard } = traffic;
  const { byTask, parked } = yard;
  let written = 0;
  let index = 0;
  while (index < parked.length) {
    const truck = parked[index];
    index += 1;
    if (truck === undefined) {
      continue;
    }
    const { taskId } = truck;
    if (reservation === truck || (readTruckLane(traffic, taskId) === undefined
      && (visitIds.has(taskId) || readTaskLane(traffic, taskId) !== undefined))) {
      parked[written] = truck;
      written += 1;
    }
    else {
      byTask.delete(taskId);
      truck.taskId = '';
      yard.hasChanged = true;
    }
  }
  parked.length = written;
};

const admitExpandedParking = (
  traffic: WarehouseYardTrafficValue,
  roads: WarehouseYardRoadsValue,
  shouldSettle: boolean,
): void => {
  const { visits, yard } = traffic;
  const { parking } = roads;
  if (yard.parked.length >= parking.length) {
    return;
  }

  let slotIndex = 0;
  let visitIndex = 0;
  while (visitIndex < visits.length && slotIndex < parking.length) {
    const truck = yard.pool[slotIndex];
    const spot = parking[slotIndex];
    if (truck === undefined || spot === undefined || truck.taskId !== '') {
      slotIndex += 1;
      continue;
    }
    const taskId = visits[visitIndex]?.taskId;
    visitIndex += 1;
    if (taskId === undefined || taskId === '' || yard.byTask.has(taskId) || readTaskLane(traffic, taskId) !== undefined) {
      continue;
    }

    placeWarehouseParkingTruck(yard, roads, truck, spot, taskId, !shouldSettle);
    if (!shouldSettle) {
      traffic.reservation = truck;
      return;
    }
    slotIndex += 1;
  }
};

const reserveDeparture = (traffic: WarehouseYardTrafficValue, shouldSettle: boolean, isExpanded: boolean): void => {
  let index = 0;
  while (index < traffic.lanes.length) {
    const lane = traffic.lanes[index];
    index += 1;
    if (lane === undefined || lane === traffic.reservation) {
      continue;
    }
    const { hasConfirmedDeparture, target, truck } = lane;
    if (isExpanded && truck.taskId !== undefined && readTruckLane(traffic, truck.taskId) !== lane) {
      settleWarehouseDockTruck(truck, undefined);
      lane.hasChanged = true;
      continue;
    }
    if (truck.taskId === target && !isWarehouseDockTruckMoving(truck)) {
      continue;
    }

    const isReplacement = !hasConfirmedDeparture && truck.taskId !== target && truck.phase !== 'away' && truck.phase !== 'departing';
    if (shouldSettle || isReplacement) {
      const isWaiting = !shouldSettle && (isExpanded || readWarehouseYardTruckOffset(traffic.yard, target) !== undefined);
      const owner = readTruckLane(traffic, target);
      settleWarehouseDockTruck(truck, isWaiting || (owner !== undefined && owner !== lane) ? undefined : target);
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
  isExpanded: boolean,
): undefined | WarehouseYardLaneValue => {
  let index = 0;
  while (index < traffic.yard.parked.length) {
    const slot = traffic.yard.parked[index];
    index += 1;
    const lane = slot === undefined ? undefined : readTaskLane(traffic, slot.taskId);
    if (slot !== undefined && lane?.truck.phase === 'away' && readTruckLane(traffic, slot.taskId) === undefined) {
      startWarehouseDockApproach(lane.truck, slot.taskId, slot.offsetX, slot.offsetZ, lane.dock, isExpanded || slot.slotIndex > 0);
      return lane;
    }
  }

  index = 0;
  while (index < traffic.lanes.length) {
    const lane = traffic.lanes[index];
    index += 1;
    if (lane?.target !== undefined && lane.truck.phase === 'away'
      && !traffic.yard.byTask.has(lane.target) && readTruckLane(traffic, lane.target) === undefined) {
      startWarehouseDockApproach(lane.truck, lane.target, roads.entrance.x, roads.entrance.z, lane.dock, false);
      return lane;
    }
  }
  return undefined;
};

const advanceReservation = (
  traffic: WarehouseYardTrafficValue,
  roads: WarehouseYardRoadsValue,
  delta: number,
  isReducedMotion: boolean,
  hasPendingLayout: boolean,
): void => {
  const { reservation, yard } = traffic;
  if (reservation === undefined) {
    return;
  }
  if ('truck' in reservation) {
    if (isReducedMotion) {
      traffic.reservation = undefined;
      if (hasPendingLayout) {
        const { truck } = reservation;
        settleWarehouseDockTruck(truck, truck.phase === 'departing' ? undefined : truck.taskId);
        reservation.hasChanged = true;
      }
    }
    else {
      advanceWarehouseDockTruck(reservation.truck, roads, reservation.dock, delta);
      reservation.hasChanged = true;
      if (!isWarehouseDockTruckMoving(reservation.truck)) {
        traffic.reservation = undefined;
      }
    }
  }
  else {
    advanceWarehouseParkingArrival(yard, roads, reservation, delta, isReducedMotion);
    if (!yard.isMoving) {
      traffic.reservation = undefined;
    }
  }
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

  const isExpanded = roads.parking.length > WAREHOUSE_YARD_PARKING_LIMIT;
  advanceReservation(traffic, roads, delta, isReducedMotion, hasPendingLayout);
  if (hasPendingLayout) {
    if (!isExpanded && traffic.reservation === undefined) {
      if (isReducedMotion && yard.isMoving) {
        syncWarehouseYardMotion(yard, traffic.queue, true);
      }
      else {
        advanceWarehouseYardMotion(yard, delta);
      }
    }
    traffic.hasParkingChanged = yard.hasChanged;
    return traffic.reservation !== undefined || yard.isMoving;
  }

  const shouldSettle = isReducedMotion || (isExpanded && !yard.hasInitialized);
  reserveDeparture(traffic, shouldSettle, isExpanded);
  if (isExpanded) {
    indexExpandedVisits(traffic);
    retainExpandedParking(traffic);
  }
  else {
    syncParking(traffic, isReducedMotion);
  }

  const approach = !shouldSettle && traffic.reservation === undefined ? reserveApproach(traffic, roads, isExpanded) : undefined;
  if (approach !== undefined) {
    traffic.reservation = approach;
    approach.hasChanged = true;
    if (isExpanded) {
      retainExpandedParking(traffic);
    }
    else {
      syncParking(traffic, false);
    }
  }
  else if (traffic.reservation === undefined) {
    if (isExpanded) {
      admitExpandedParking(traffic, roads, shouldSettle);
    }
    else if (!isReducedMotion) {
      advanceWarehouseYardMotion(yard, delta);
    }
  }
  yard.hasInitialized = true;
  traffic.hasParkingChanged = yard.hasChanged;
  return traffic.reservation !== undefined || yard.isMoving;
};
