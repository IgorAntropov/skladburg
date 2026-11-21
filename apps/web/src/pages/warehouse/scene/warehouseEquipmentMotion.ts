import { WarehouseEquipmentStatus } from '@skladburg/contracts/wms/v1/warehouse_equipment';

import type { WarehouseSceneEquipmentValue } from '../model/warehouseSceneInteraction';
import type { WarehouseAislePointValue } from './warehouseAislePath';
import type { WarehouseForkliftPlaybackValue } from './warehouseForkliftPlayback';
import type {
  WarehouseForkliftJobValue,
  WarehouseForkliftPoseValue,
} from './warehouseForkliftRoute';
import type {
  WarehouseFloorValue,
  WarehouseLayoutValue,
} from './warehouseLayout';

import {
  findWarehouseAislePath,
  isWarehouseAislePointOpen,
} from './warehouseAislePath';
import {
  findWarehouseForkliftParking,
  FORKLIFT_CLEARANCE,
} from './warehouseForkliftRoute';

export interface WarehouseEquipmentActorValue {
  cargoJob: undefined | WarehouseForkliftJobValue;
  cargoLane: number;
  isCatchingUp: boolean;
  needsRoute: boolean;
  nextCargoLane: number;
  path: readonly WarehouseAislePointValue[];
  pose: WarehouseForkliftPoseValue;
  step: number;
  target: WarehouseForkliftPoseValue;
  unit: EquipmentUnitValue;
}

export interface WarehouseEquipmentBayValue {
  cabinet: WarehouseAislePointValue;
  parking: WarehouseForkliftPoseValue;
  stationId: string;
}

const METRES_PER_SECOND = 3;
const MAX_STEP_SECONDS = 0.25;

type EquipmentUnitValue = WarehouseSceneEquipmentValue['units'][number];

const poseAt = (x: number, z: number, yaw: number): WarehouseForkliftPoseValue => ({ lift: 0, reach: 0, x, yaw, z });

export const placeWarehouseEquipmentBays = (
  layout: WarehouseLayoutValue, building: undefined | WarehouseFloorValue, stationIds: readonly string[],
): WarehouseEquipmentBayValue[] => {
  const { bounds, obstacles } = layout.navigation;
  const wallX = building?.x ?? bounds.minX - 0.19;
  const minZ = Math.max(building?.z ?? bounds.minZ, bounds.minZ) + 1;
  const maxZ = Math.min(building === undefined ? bounds.maxZ : building.z + building.depth, bounds.maxZ) - 1;
  const bays: WarehouseEquipmentBayValue[] = [];
  for (let z = minZ; z <= maxZ && bays.length < stationIds.length; z += 1.75) {
    const stationId = stationIds[bays.length];
    const parking = poseAt(wallX + 1.48, z, -Math.PI / 2);
    if (stationId !== undefined && isWarehouseAislePointOpen(bounds, obstacles, parking, FORKLIFT_CLEARANCE)) {
      bays.push({ cabinet: { x: wallX + 0.34, z }, parking, stationId });
    }
  }
  return bays;
};

export const syncWarehouseEquipmentActors = (
  actors: Map<string, WarehouseEquipmentActorValue>, fleet: WarehouseSceneEquipmentValue,
  bays: readonly WarehouseEquipmentBayValue[], layout: WarehouseLayoutValue,
): void => {
  for (const id of actors.keys()) {
    if (!fleet.units.some(unit => unit.id === id)) {
      actors.delete(id);
    }
  }
  const { bounds, obstacles } = layout.navigation;
  for (const [index, unit] of fleet.units.entries()) {
    const dock = layout.receiving?.docks[index];
    const defaultHome = findWarehouseForkliftParking(layout, dock);
    if (defaultHome === undefined) {
      continue;
    }
    let home = defaultHome;
    if (dock === undefined && index > 0) {
      const offset = poseAt(home.x, home.z + index * 1.4, home.yaw);
      if (isWarehouseAislePointOpen(bounds, obstacles, offset, FORKLIFT_CLEARANCE)) {
        home = offset;
      }
    }
    const bay = bays.find(point => point.stationId === unit.chargingStationId);
    let target = bay?.parking ?? home;
    if (unit.status === WarehouseEquipmentStatus.WAITING_FOR_CHARGE && bays[0] !== undefined) {
      const waiting = poseAt(bays[0].parking.x + 1.65, bays[0].parking.z + index * 1.25, -Math.PI / 2);
      if (isWarehouseAislePointOpen(bounds, obstacles, waiting, FORKLIFT_CLEARANCE)) {
        target = waiting;
      }
    }
    const actor = actors.get(unit.id);
    if (actor === undefined) {
      actors.set(unit.id, {
        cargoJob: undefined, cargoLane: -1, isCatchingUp: false, needsRoute: false, nextCargoLane: -1,
        path: [], pose: { ...target }, step: 0, target, unit,
      });
    }
    else {
      actor.unit = unit;
      if (actor.target.x !== target.x || actor.target.z !== target.z || actor.target.yaw !== target.yaw) {
        setWarehouseEquipmentDestination(actor, target, layout);
      }
    }
  }
};

const setWarehouseEquipmentDestination = (
  actor: WarehouseEquipmentActorValue, target: WarehouseForkliftPoseValue, layout: WarehouseLayoutValue,
): void => {
  actor.isCatchingUp = !actor.needsRoute && actor.step < actor.path.length;
  actor.target = target;
  actor.needsRoute = false;
  const { bounds, obstacles } = layout.navigation;
  actor.path = findWarehouseAislePath(bounds, obstacles, actor.pose, target, FORKLIFT_CLEARANCE) ?? [];
  actor.step = 1;
  if (actor.path.length === 0) {
    Object.assign(actor.pose, target);
  }
};

export const advanceWarehouseEquipmentActor = (actor: WarehouseEquipmentActorValue, delta: number, isReducedMotion: boolean): boolean => {
  if (actor.needsRoute || actor.step >= actor.path.length) {
    return false;
  }
  const rate = actor.isCatchingUp ? 2 : 1;
  let distance = Math.min(delta * rate, MAX_STEP_SECONDS) * METRES_PER_SECOND;
  while (!isReducedMotion) {
    const next = actor.path[actor.step];
    if (next === undefined) {
      break;
    }
    const dx = next.x - actor.pose.x;
    const dz = next.z - actor.pose.z;
    const remaining = Math.hypot(dx, dz);
    if (remaining > distance) {
      actor.pose.x += dx * distance / remaining;
      actor.pose.z += dz * distance / remaining;
      actor.pose.yaw = Math.atan2(dx, dz);
      return true;
    }
    actor.pose.x = next.x;
    actor.pose.z = next.z;
    actor.step += 1;
    distance -= remaining;
  }
  actor.step = actor.path.length;
  actor.isCatchingUp = false;
  Object.assign(actor.pose, actor.target);
  return false;
};

export const prepareWarehouseEquipmentRoutes = (
  actors: Map<string, WarehouseEquipmentActorValue>, layout: WarehouseLayoutValue,
): void => {
  for (const actor of actors.values()) {
    if (actor.needsRoute && actor.cargoLane === -1) {
      setWarehouseEquipmentDestination(actor, actor.target, layout);
    }
  }
};

const hasWork = ({ status }: EquipmentUnitValue): boolean => status === WarehouseEquipmentStatus.TO_TASK
  || status === WarehouseEquipmentStatus.CARRYING || status === WarehouseEquipmentStatus.HANDLING;

export const syncWarehouseEquipmentCargo = (
  actors: Map<string, WarehouseEquipmentActorValue>, lanes: readonly (undefined | WarehouseForkliftPlaybackValue)[],
): boolean => {
  for (const actor of actors.values()) {
    actor.nextCargoLane = -1;
  }
  for (let index = 0; index < lanes.length; index += 1) {
    const lane = lanes[index];
    if (lane === undefined) {
      continue;
    }
    lane.equipmentJob = null;
    const job = lane.jobs[0];
    if (job === undefined || lane.unassignedJob === job) {
      continue;
    }
    for (const actor of actors.values()) {
      if (actor.nextCargoLane === -1 && hasWork(actor.unit) && actor.unit.taskId === job.transfer.taskId) {
        actor.nextCargoLane = index;
        break;
      }
    }
  }
  for (const actor of actors.values()) {
    const job = actor.cargoJob;
    if (actor.nextCargoLane !== -1 || job === undefined || hasWork(actor.unit)
      || lanes[actor.cargoLane]?.jobs[0] !== job) {
      continue;
    }
    let hasNewOwner = false;
    for (const other of actors.values()) {
      hasNewOwner ||= other.nextCargoLane === actor.cargoLane;
    }
    if (!hasNewOwner) {
      actor.nextCargoLane = actor.cargoLane;
    }
  }
  let hasNewRoutes = false;
  for (const actor of actors.values()) {
    const lane = lanes[actor.nextCargoLane];
    if (lane?.pose !== undefined) {
      lane.equipmentJob = lane.jobs[0];
      actor.needsRoute = false;
    }
    else if (actor.cargoLane !== -1) {
      actor.needsRoute = true;
      hasNewRoutes = true;
    }
    actor.cargoLane = actor.nextCargoLane;
    actor.cargoJob = lane?.jobs[0];
  }
  return hasNewRoutes;
};

export const releaseWarehouseEquipmentCargo = (lanes: readonly (undefined | WarehouseForkliftPlaybackValue)[]): void => {
  for (const lane of lanes) {
    if (lane !== undefined) {
      lane.equipmentJob = undefined;
    }
  }
};
