import type { WarehouseAislePointValue } from './warehouseAislePath';
import type {
  WarehouseCargoEndpointValue,
  WarehouseCargoTransferValue,
} from './warehouseCargoPositions';
import type { WarehouseLayoutValue } from './warehouseLayout';

import {
  findWarehouseAislePath,
  isWarehouseAislePointOpen,
  isWarehouseAisleSegmentOpen,
} from './warehouseAislePath';
import {
  WAREHOUSE_DOCK_HANDOFF_Z,
  WAREHOUSE_DOCK_RAMP_END,
} from './warehouseLayout';

export const FORKLIFT_SCALE = 0.36;

export const FORKLIFT_FORK_HEIGHT = 0.11 * FORKLIFT_SCALE;

export const FORKLIFT_PALLET_OFFSET = 0.36;

export const FORKLIFT_CLEARANCE = 0.67;

const APPROACH_MARGIN = 0.035;
const MAX_EXTENSION = 1.25;
const MAX_JOB_SECONDS = 15;
const FORK_HALF_WIDTH = 0.3 * FORKLIFT_SCALE;
const SPEED_METERS_PER_SECOND = 3.15;
const RADIANS_PER_SECOND = 9;
const FLOAT_TOLERANCE = 0.0001;

export interface WarehouseForkliftJobValue {
  finish: WarehouseForkliftPoseValue;
  phases: readonly WarehouseForkliftPhaseValue[];
  transfer: WarehouseCargoTransferValue;
}

export interface WarehouseForkliftPhaseValue {
  from: WarehouseForkliftPoseValue;
  load: LoadPhaseValue;
  seconds: number;
  to: WarehouseForkliftPoseValue;
}

export interface WarehouseForkliftPoseValue extends WarehouseAislePointValue {
  lift: number;
  reach: number;
  yaw: number;
}

type LoadPhaseValue = 'forks' | 'handoff' | 'source' | 'target';

const createPose = (x: number, z: number, yaw: number): WarehouseForkliftPoseValue => ({
  lift: 0, reach: 0, x, yaw, z,
});

const toHeading = (current: number, target: number): number =>
  current + Math.atan2(Math.sin(target - current), Math.cos(target - current));

const getDistance = (from: WarehouseAislePointValue, to: WarehouseAislePointValue): number =>
  Math.hypot(to.x - from.x, to.z - from.z);

const readDockPose = (layout: WarehouseLayoutValue): undefined | WarehouseForkliftPoseValue => {
  const dock = layout.receiving?.dock;
  return dock === undefined
    ? undefined
    : createPose(dock.x, dock.z + WAREHOUSE_DOCK_RAMP_END + FORKLIFT_CLEARANCE + APPROACH_MARGIN, Math.PI);
};

const isOpen = (layout: WarehouseLayoutValue, point: WarehouseAislePointValue): boolean => {
  const { bounds, obstacles } = layout.navigation;
  return isWarehouseAislePointOpen(bounds, obstacles, point, FORKLIFT_CLEARANCE);
};

export const findWarehouseForkliftParking = (layout: WarehouseLayoutValue): undefined | WarehouseForkliftPoseValue => {
  const dock = readDockPose(layout);
  if (dock !== undefined && isOpen(layout, dock)) {
    return dock;
  }

  const receiving = layout.receiving;
  if (receiving === undefined) {
    return undefined;
  }

  const x = receiving.x + receiving.width / 2;
  const candidates = [0.5, 0.83, 0.17].map(fraction => createPose(x, receiving.z + receiving.depth * fraction, Math.PI));
  return candidates.find(point => isOpen(layout, point));
};

const readStations = (
  layout: WarehouseLayoutValue,
  endpoint: WarehouseCargoEndpointValue,
): WarehouseForkliftPoseValue[] => {
  const [x, y, z] = endpoint.point;
  const lift = Math.max(0, y - FORKLIFT_FORK_HEIGHT);
  if (endpoint.location === 'truck') {
    const dock = readDockPose(layout);
    const reach = WAREHOUSE_DOCK_RAMP_END + FORKLIFT_CLEARANCE + APPROACH_MARGIN - FORKLIFT_PALLET_OFFSET - WAREHOUSE_DOCK_HANDOFF_Z;
    return dock !== undefined && isOpen(layout, dock) ? [{ ...dock, lift, reach }] : [];
  }

  const cell = endpoint.cellId === undefined ? undefined : layout.cellsById.get(endpoint.cellId);
  if (cell !== undefined && cell.size[0] / 2 < FORK_HALF_WIDTH + APPROACH_MARGIN) {
    return [];
  }
  const { bounds, obstacles } = layout.navigation;
  const serviceObstacles = cell === undefined ? obstacles : obstacles.filter(obstacle => obstacle !== cell.rack);
  const candidates = cell === undefined
    ? [
        createPose(x, z + FORKLIFT_PALLET_OFFSET, Math.PI),
        createPose(x - FORKLIFT_PALLET_OFFSET, z, Math.PI / 2),
        createPose(x + FORKLIFT_PALLET_OFFSET, z, -Math.PI / 2),
        createPose(x, z - FORKLIFT_PALLET_OFFSET, 0),
      ]
    : [
        createPose(x, cell.rack.maxZ + FORKLIFT_CLEARANCE + APPROACH_MARGIN, Math.PI),
        createPose(x, cell.rack.minZ - FORKLIFT_CLEARANCE - APPROACH_MARGIN, 0),
      ];
  const target = { x, z };
  const margin = Math.max(FORK_HALF_WIDTH, endpoint.size * 0.55);

  return candidates.flatMap((candidate): WarehouseForkliftPoseValue[] => {
    const reach = Math.max(0, getDistance(candidate, target) - FORKLIFT_PALLET_OFFSET);
    return reach <= MAX_EXTENSION && isOpen(layout, candidate)
      && isWarehouseAisleSegmentOpen(bounds, serviceObstacles, candidate, target, margin)
      ? [{ ...candidate, lift, reach }]
      : [];
  });
};

const createJob = (
  start: WarehouseForkliftPoseValue,
  pickup: WarehouseForkliftPoseValue,
  dropoff: WarehouseForkliftPoseValue,
  toPickup: readonly WarehouseAislePointValue[],
  toDropoff: readonly WarehouseAislePointValue[],
  transfer: WarehouseCargoTransferValue,
): undefined | WarehouseForkliftJobValue => {
  const phases: WarehouseForkliftPhaseValue[] = [];
  let duration = 0;
  let current = start;

  const addPhase = (to: WarehouseForkliftPoseValue, load: LoadPhaseValue, seconds: number): void => {
    phases.push({ from: current, load, seconds, to });
    duration += seconds;
    current = to;
  };

  const turn = (heading: number, load: LoadPhaseValue): void => {
    const yaw = toHeading(current.yaw, heading);
    const distance = Math.abs(yaw - current.yaw);
    if (distance > FLOAT_TOLERANCE) {
      addPhase({ ...current, yaw }, load, Math.max(0.09, distance / RADIANS_PER_SECOND));
    }
  };

  const drive = (path: readonly WarehouseAislePointValue[], load: LoadPhaseValue): void => {
    for (const point of path) {
      const distance = getDistance(current, point);
      if (distance > FLOAT_TOLERANCE) {
        turn(Math.atan2(point.x - current.x, point.z - current.z), load);
        addPhase({ ...current, x: point.x, z: point.z }, load, Math.max(0.07, distance / SPEED_METERS_PER_SECOND));
      }
    }
  };

  drive(toPickup, 'source');
  turn(pickup.yaw, 'source');
  addPhase({ ...current, lift: pickup.lift }, 'source', 0.18 + pickup.lift * 0.2);
  if (pickup.reach > 0) {
    addPhase({ ...current, reach: pickup.reach }, 'source', 0.14 + pickup.reach * 0.22);
  }
  if (transfer.from.location === 'truck') {
    addPhase(current, 'handoff', 0.38);
  }
  addPhase({ ...current, reach: 0 }, 'forks', 0.14 + pickup.reach * 0.18);
  addPhase({ ...current, lift: 0 }, 'forks', 0.14 + pickup.lift * 0.22);
  drive(toDropoff, 'forks');
  turn(dropoff.yaw, 'forks');
  addPhase({ ...current, lift: dropoff.lift }, 'forks', 0.14 + dropoff.lift * 0.28);
  addPhase({ ...current, reach: dropoff.reach }, 'forks', 0.14 + dropoff.reach * 0.17);
  addPhase({ ...current, reach: 0 }, 'target', 0.14 + dropoff.reach * 0.15);
  addPhase({ ...current, lift: 0 }, 'target', 0.14 + dropoff.lift * 0.22);

  return duration <= MAX_JOB_SECONDS ? { finish: current, phases, transfer } : undefined;
};

export const planWarehouseForkliftJob = (
  layout: WarehouseLayoutValue,
  start: WarehouseForkliftPoseValue,
  transfer: WarehouseCargoTransferValue,
): undefined | WarehouseForkliftJobValue => {
  const { bounds, obstacles } = layout.navigation;
  const dropoffs = readStations(layout, transfer.to);
  const pickups = readStations(layout, transfer.from).sort((current, prev) => getDistance(start, current) - getDistance(start, prev));
  for (const pickup of pickups) {
    const toPickup = findWarehouseAislePath(bounds, obstacles, start, pickup, FORKLIFT_CLEARANCE);
    if (toPickup === undefined) {
      continue;
    }

    for (const dropoff of dropoffs) {
      const toDropoff = findWarehouseAislePath(bounds, obstacles, pickup, dropoff, FORKLIFT_CLEARANCE);
      if (toDropoff !== undefined) {
        const job = createJob(start, pickup, dropoff, toPickup, toDropoff, transfer);
        if (job !== undefined) {
          return job;
        }
      }
    }
  }
  return undefined;
};
