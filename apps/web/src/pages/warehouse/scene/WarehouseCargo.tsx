import type { StockBalance } from '@skladburg/contracts/wms/v1/stock';
import type {
  ReactElement,
  RefObject,
} from 'react';
import type {
  BoxGeometry,
  Group,
  InstancedMesh,
} from 'three';

import {
  useFrame,
  useThree,
} from '@react-three/fiber';
import {
  useLayoutEffect,
  useRef,
} from 'react';
import {
  DynamicDrawUsage,
  Matrix4,
  Vector3,
} from 'three';

import {
  useShadowMapRefresh,
  useWorldMaterial,
} from '@/shared/3d';

import type { WarehouseCargoValue } from '../model/warehouseSceneCargo';
import type { WarehouseGeometryKitValue } from './createWarehouseGeometryKit';
import type { WarehouseCargoVisualLayersValue } from './warehouseCargoPositions';
import type {
  WarehouseDockStepValue,
  WarehouseYardPlaybackClockValue,
} from './warehouseDockPlayback';
import type { WarehouseDockTruckValue } from './warehouseDockTruckMotion';
import type { WarehouseForkliftRigValue } from './WarehouseForklift';
import type { WarehouseForkliftPlaybackValue } from './warehouseForkliftPlayback';
import type {
  WarehouseDockPointValue,
  WarehouseLayoutValue,
} from './warehouseLayout';
import type { WarehouseYardMotionValue } from './warehouseYardMotion';
import type { WarehouseYardParkingRigValue } from './WarehouseYardParkingLayer';
import type {
  WarehouseYardLaneValue,
  WarehouseYardTrafficValue,
} from './warehouseYardTraffic';

import {
  readWarehouseDockDeparture,
  retainWarehouseDockDuringShipment,
  retainWarehouseDockOrder,
} from '../model/warehouseSceneCargo';
import {
  buildWarehouseCargoTransfers,
  buildWarehouseCargoVisuals,
  groupWarehouseCargoVisuals,
  WAREHOUSE_TRUCK_SLOTS,
} from './warehouseCargoPositions';
import {
  advanceWarehouseDockSteps,
  hasPendingWarehouseDockStep,
  retainWarehouseDockLoads,
  syncWarehouseDockSteps,
} from './warehouseDockPlayback';
import { createWarehouseDockTruck } from './warehouseDockTruckMotion';
import { applyWarehouseForkliftPose } from './WarehouseForklift';
import {
  advanceWarehouseForklift,
  advanceWarehouseUnassignedCargo,
  clearWarehouseForkliftJobs,
  createWarehouseForkliftPlayback,
  getWarehouseCargoEndpointWeight,
  MAX_WAREHOUSE_FORKLIFT_JOBS,
  queueWarehouseForkliftJobs,
  truncateWarehouseForkliftJobs,
} from './warehouseForkliftPlayback';
import {
  FORKLIFT_FORK_HEIGHT,
  FORKLIFT_PALLET_OFFSET,
} from './warehouseForkliftRoute';
import { canAdvanceWarehouseForklift } from './warehouseForkliftTraffic';
import { readWarehouseYardTruckPose } from './warehouseYardMotion';
import { WAREHOUSE_TRUCK_CENTER_Z } from './warehouseYardRoads';
import {
  setWarehouseCargoPlayback,
  setWarehouseYardForklift,
  setWarehouseYardLane,
  setWarehouseYardVisits,
  WAREHOUSE_YARD_CATCH_UP_RATE,
} from './warehouseYardTraffic';

interface CargoMeshesValue {
  boards: InstancedMesh | undefined;
  body: InstancedMesh;
  skid: InstancedMesh;
}

interface CargoPaintValue {
  activeIds: Set<string>;
  matrix: Matrix4;
  meshes: CargoMeshesValue;
  scale: Vector3;
  visuals: WarehouseCargoVisualLayersValue;
}

interface CargoSceneValue {
  dock: undefined | WarehouseDockPointValue;
  dockSteps: WarehouseDockStepValue[];
  dockTaskId: string | undefined;
  dockTruck: Group | null;
  hasShadows: boolean;
  isTruckShadowed: boolean;
  lane: undefined | WarehouseYardLaneValue;
  layout: WarehouseLayoutValue;
  paint: CargoPaintValue;
  playback: WarehouseForkliftPlaybackValue;
  playbackClock: WarehouseYardPlaybackClockValue;
  refreshShadowMap: () => void;
  truck: WarehouseDockTruckValue;
  yard: WarehouseYardMotionValue;
  yardParking: null | WarehouseYardParkingRigValue;
}

interface WarehouseCargoProps {
  balances: readonly StockBalance[] | undefined;
  cargo: WarehouseCargoValue;
  dock: undefined | WarehouseDockPointValue;
  dockTruck: RefObject<Group | null>;
  forklift: RefObject<null | WarehouseForkliftRigValue>;
  geometry: BoxGeometry;
  hasAssignedDocks: boolean;
  hasShadows: boolean;
  kit: WarehouseGeometryKitValue;
  laneIndex: number;
  layout: WarehouseLayoutValue;
  playbackClock: RefObject<WarehouseYardPlaybackClockValue>;
  traffic: WarehouseYardTrafficValue;
  yardParking: RefObject<null | WarehouseYardParkingRigValue>;
}

type WarehouseTruckCargoPoseValue = Pick<WarehouseDockTruckValue, 'offsetX' | 'offsetZ' | 'taskId' | 'yaw'>;

const MAX_DETAILED_PALLETS = 256;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const writePallet = (paint: CargoPaintValue, index: number, x: number, y: number, z: number, yaw: number, size: number): void => {
  const { matrix, meshes, scale } = paint;
  if (meshes.boards === undefined) {
    matrix.makeRotationY(yaw).scale(scale.set(size, size * 0.78, size * 0.86)).setPosition(x, y + size * 0.48, z);
    meshes.body.setMatrixAt(index, matrix);
    matrix.makeRotationY(yaw).scale(scale.set(size * 1.08, size * 0.1, size * 0.95)).setPosition(x, y + size * 0.05, z);
  }
  else {
    matrix.makeRotationY(yaw).scale(scale.set(size * 1.08, size * 0.88, size * 0.95)).setPosition(x, y + size * 0.44, z);
    meshes.body.setMatrixAt(index, matrix);
    meshes.boards.setMatrixAt(index, matrix);
  }
  meshes.skid.setMatrixAt(index, matrix);
};

const updateDockTarget = (scene: CargoSceneValue, isReducedMotion: boolean): boolean => {
  const { dockSteps, dockTaskId, lane, playback, playbackClock, truck } = scene;
  if (lane === undefined) {
    return false;
  }
  if (isReducedMotion) {
    dockSteps.length = 0;
  }
  const step = dockSteps[0];
  let hasHandoff = false;
  let index = 0;
  while (step !== undefined && index < playback.jobs.length && !hasHandoff) {
    hasHandoff = playback.jobs[index]?.transfer.dockTaskId === step.taskId;
    index += 1;
  }
  const target = step === undefined ? dockTaskId : advanceWarehouseDockSteps(dockSteps, truck.phase, truck.taskId, hasHandoff);
  const hasChanged = target !== lane.target;
  const current = dockSteps[0];
  lane.dockSteps = dockSteps;
  lane.hasConfirmedDeparture = current?.departure !== undefined;
  lane.isCatchingUp = playbackClock.isCatchingUp || current?.isCatchingUp === true;
  lane.target = target;
  return hasChanged;
};

const readReadyForklift = (scene: CargoSceneValue): undefined | WarehouseForkliftPlaybackValue => {
  const { dockSteps, dockTaskId, playback, playbackClock, truck } = scene;
  const job = playback.jobs[0];
  const handoff = job?.transfer.dockTaskId;
  if (handoff !== undefined && handoff !== truck.taskId && handoff !== dockTaskId && !hasPendingWarehouseDockStep(dockSteps, handoff)) {
    clearWarehouseForkliftJobs(playback, document.hidden || playbackClock.isPaused);
    return undefined;
  }
  if (job !== undefined && (handoff === undefined || (truck.phase === 'docked' && handoff === truck.taskId))) {
    return playback;
  }
  return undefined;
};

const paintYard = ({ yard, yardParking }: CargoSceneValue): void => {
  if (yard.hasChanged && yardParking !== null) {
    yardParking.paint(yard.parked);
    yard.hasChanged = false;
  }
};

const paintDockTruck = (scene: CargoSceneValue): void => {
  const { dock, dockTruck, hasShadows, truck } = scene;
  if (dockTruck === null || dock === undefined) {
    return;
  }
  dockTruck.visible = truck.phase !== 'away';
  dockTruck.position.x = dock.x + truck.offsetX;
  dockTruck.position.z = dock.z + truck.offsetZ + WAREHOUSE_TRUCK_CENTER_Z;
  dockTruck.rotation.y = truck.yaw;
  const isShadowed = hasShadows && truck.phase === 'docked';
  if (scene.isTruckShadowed !== isShadowed) {
    let index = 0;
    const parts = dockTruck.children[0]?.children;
    while (parts !== undefined && index < parts.length) {
      const part = parts[index];
      index += 1;
      if (part !== undefined) {
        part.castShadow = isShadowed;
      }
    }
    scene.isTruckShadowed = isShadowed;
    scene.refreshShadowMap();
  }
};

const writeTruckPallet = (
  paint: CargoPaintValue,
  index: number,
  point: readonly [number, number, number],
  size: number,
  dock: undefined | WarehouseDockPointValue,
  truck: WarehouseTruckCargoPoseValue,
  offsetX = truck.offsetX,
): void => {
  if (dock === undefined || truck.yaw === 0) {
    writePallet(paint, index, point[0] + offsetX, point[1], point[2] + truck.offsetZ, 0, size);
    return;
  }

  const pivotZ = dock.z + WAREHOUSE_TRUCK_CENTER_Z;
  const x = point[0] - dock.x;
  const z = point[2] - pivotZ;
  const cosine = Math.cos(truck.yaw);
  const sine = Math.sin(truck.yaw);
  writePallet(
    paint, index, dock.x + offsetX + x * cosine + z * sine,
    point[1], pivotZ + truck.offsetZ + z * cosine - x * sine, truck.yaw, size,
  );
};

const paintTruckCargo = (
  paint: CargoPaintValue,
  count: number,
  dock: undefined | WarehouseDockPointValue,
  truck: WarehouseTruckCargoPoseValue,
  hasActiveDispatch: boolean,
  offsetX = truck.offsetX,
): number => {
  const visuals = truck.taskId === undefined ? undefined : paint.visuals.trucks.get(truck.taskId);
  if (visuals === undefined) {
    return count;
  }

  let written = count;
  let index = 0;
  while (index < visuals.length) {
    const visual = visuals[index];
    index += 1;
    if (visual !== undefined && !paint.activeIds.has(visual.id) && (hasActiveDispatch || visual.requiresActiveDispatch !== true)) {
      writeTruckPallet(paint, written, visual.point, visual.size, dock, truck, offsetX);
      written += 1;
    }
  }
  return written;
};

const paintScene = (scene: CargoSceneValue): void => {
  const { dock, dockSteps, dockTaskId, layout, paint, playback, truck, yard } = scene;
  const parkingOffsetX = dock === undefined ? 0 : (layout.receiving?.dock?.x ?? dock.x) - dock.x;
  const { activeIds, meshes, visuals } = paint;
  const { jobs, phaseIndex, pose } = playback;
  activeIds.clear();
  let hasActiveDispatch = false;
  let count = 0;

  for (let index = 0; index < jobs.length; index += 1) {
    const job = jobs[index];
    if (job === undefined || activeIds.has(job.transfer.id)) {
      continue;
    }

    const { from, id, to } = job.transfer;
    hasActiveDispatch ||= to.location === 'truck';
    const phase = index === 0 ? job.phases[phaseIndex] : undefined;
    const hasForklift = playback.equipmentJob === undefined || playback.equipmentJob === job;
    const isUnassigned = index === 0 && (!hasForklift || playback.unassignedJob === job);
    const weight = isUnassigned ? getWarehouseCargoEndpointWeight(playback.elapsed) : 1;
    const load = isUnassigned ? (weight < 0 ? 'source' : 'target') : phase?.load ?? 'source';
    activeIds.add(id);
    if ((load === 'forks' || load === 'handoff') && pose !== undefined && phase !== undefined) {
      const distance = FORKLIFT_PALLET_OFFSET + pose.reach;
      const x = pose.x + Math.sin(pose.yaw) * distance;
      const y = FORKLIFT_FORK_HEIGHT + pose.lift;
      const z = pose.z + Math.cos(pose.yaw) * distance;
      if (load === 'handoff') {
        const progress = playback.elapsed / phase.seconds;
        const isDispatch = to.location === 'truck';
        const reachProgress = isDispatch ? 1 - progress : progress;
        const { point, size } = isDispatch ? to : from;
        writePallet(paint, count, point[0] + (x - point[0]) * reachProgress, y, point[2] + (z - point[2]) * reachProgress, pose.yaw, size);
      }
      else {
        writePallet(paint, count, x, y, z, pose.yaw, to.size);
      }
    }
    else {
      const endpoint = load === 'target' ? to : from;
      const { location, point } = endpoint;
      const size = endpoint.size * Math.abs(weight);
      if (location === 'truck') {
        const parked = job.transfer.dockTaskId === truck.taskId ? truck : readWarehouseYardTruckPose(yard, job.transfer.dockTaskId);
        if (parked === undefined) {
          continue;
        }
        writeTruckPallet(paint, count, point, size, dock, parked, parked.offsetX + (parked === truck ? 0 : parkingOffsetX));
      }
      else {
        writePallet(paint, count, point[0], point[1], point[2], 0, size);
      }
    }
    count += 1;
  }

  const isDeparting = truck.phase === 'departing';
  const step = dockSteps[0];
  const departureCargo = step?.taskId === truck.taskId ? step?.load : undefined;
  const isFinishingLoad = truck.phase === 'docked' && truck.taskId !== dockTaskId;
  if (departureCargo !== undefined && (isDeparting || isFinishingLoad)) {
    let departureIndex = 0;
    while (departureIndex < departureCargo.length) {
      const load = departureCargo[departureIndex];
      departureIndex += 1;
      if (load !== undefined && !activeIds.has(load.id)) {
        const { point, size } = load;
        writeTruckPallet(paint, count, point, size, dock, truck);
        activeIds.add(load.id);
        count += 1;
      }
    }
  }

  let index = 0;
  while (index < visuals.ground.length) {
    const visual = visuals.ground[index];
    index += 1;
    if (visual === undefined || activeIds.has(visual.id) || (visual.requiresActiveDispatch === true && !hasActiveDispatch)) {
      continue;
    }

    const { point, size, stockUnitIds } = visual;
    if (stockUnitIds !== undefined) {
      let hasVisibleStock = false;
      let unit = 0;
      while (unit < stockUnitIds.length) {
        const id = stockUnitIds[unit];
        unit += 1;
        if (id !== undefined && !activeIds.has(id)) {
          hasVisibleStock = true;
          break;
        }
      }
      if (!hasVisibleStock) {
        continue;
      }
    }

    writePallet(paint, count, point[0], point[1], point[2], 0, size);
    count += 1;
  }

  if (!isDeparting) {
    count = paintTruckCargo(paint, count, dock, truck, hasActiveDispatch);
  }
  let slot = 0;
  while (slot < yard.parked.length) {
    const parked = yard.parked[slot];
    slot += 1;
    if (parked !== undefined && parked.taskId !== truck.taskId) {
      count = paintTruckCargo(paint, count, dock, parked, hasActiveDispatch, parkingOffsetX + parked.offsetX);
    }
  }

  meshes.body.count = count;
  meshes.skid.count = count;
  meshes.body.instanceMatrix.needsUpdate = true;
  meshes.skid.instanceMatrix.needsUpdate = true;
  if (meshes.boards !== undefined) {
    meshes.boards.count = count;
    meshes.boards.instanceMatrix.needsUpdate = true;
  }
};

export const WarehouseCargo = ({
  balances, cargo: cargoSnapshot, dock, dockTruck, forklift, geometry, hasAssignedDocks, hasShadows, kit,
  laneIndex, layout, playbackClock, traffic, yardParking,
}: WarehouseCargoProps): ReactElement => {
  const invalidate = useThree(state => state.invalidate);
  const refreshShadowMap = useShadowMapRefresh();
  const bodyMaterial = useWorldMaterial('buildingRoofAlt');
  const boardsMaterial = useWorldMaterial('buildingWall');
  const skidMaterial = useWorldMaterial('treeTrunk');
  const body = useRef<InstancedMesh>(null);
  const boards = useRef<InstancedMesh>(null);
  const skid = useRef<InstancedMesh>(null);
  const prev = useRef<WarehouseCargoValue>(undefined);
  const motion = useRef<MediaQueryList | undefined>(undefined);
  const scene = useRef<CargoSceneValue>(undefined);
  const isYardOwner = laneIndex === 0;
  let stagedCount = 0;
  let truckUnitCount = 0;
  for (const { location, truckSlot } of cargoSnapshot.units) {
    stagedCount += Number(location === 'staging');
    truckUnitCount += Number(location === 'truck' && truckSlot < WAREHOUSE_TRUCK_SLOTS);
  }
  const parkingCapacity = isYardOwner ? layout.yard?.parking.length ?? 0 : 0;
  const truckCapacity = Math.min(truckUnitCount, (parkingCapacity + 1) * WAREHOUSE_TRUCK_SLOTS);
  const departureCapacity = cargoSnapshot.hasDock ? WAREHOUSE_TRUCK_SLOTS : 0;
  const capacity = stagedCount + truckCapacity + departureCapacity + (balances?.length ?? 0) + MAX_WAREHOUSE_FORKLIFT_JOBS;
  const bucket = 2 ** Math.ceil(Math.log2(capacity));
  const hasDetailedPallets = bucket <= MAX_DETAILED_PALLETS;

  useLayoutEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    motion.current = query;
    const handleMotionChange = (): void => {
      const current = scene.current;
      const cargo = prev.current;
      if (current !== undefined && cargo !== undefined) {
        if (!query.matches) {
          syncWarehouseDockSteps(current.dockSteps, cargo);
        }
        updateDockTarget(current, query.matches);
      }
      if (!document.hidden) {
        invalidate();
      }
    };
    query.addEventListener('change', handleMotionChange);
    return () => {
      query.removeEventListener('change', handleMotionChange);
    };
  }, [invalidate]);

  useLayoutEffect(() => (): void => {
    setWarehouseCargoPlayback(traffic, laneIndex, undefined);
    setWarehouseYardForklift(traffic, laneIndex, undefined);
    setWarehouseYardLane(traffic, laneIndex, undefined);
  }, [laneIndex, traffic]);

  useLayoutEffect(() => {
    if (body.current === null || skid.current === null) {
      return;
    }

    const prior = scene.current;
    const isSameLayout = prior?.layout.topologyKey === layout.topologyKey;
    const previousCargo = isSameLayout ? prev.current : undefined;
    const orderedCargo = hasAssignedDocks ? cargoSnapshot : retainWarehouseDockOrder(previousCargo, cargoSnapshot);
    const displayedTruckId = isSameLayout && prior.truck.phase !== 'departing' ? prior.truck.taskId : undefined;
    const cargo = retainWarehouseDockDuringShipment(previousCargo, orderedCargo, displayedTruckId);
    const isReducedMotion = motion.current?.matches === true;
    const dockSteps = isSameLayout ? prior.dockSteps : [];
    if (!isReducedMotion) {
      syncWarehouseDockSteps(dockSteps, cargo);
      retainWarehouseDockLoads(dockSteps, layout, previousCargo, cargo.shippedUnitIds, dock);
    }
    const playback = isSameLayout ? prior.playback : createWarehouseForkliftPlayback(layout, dock);
    setWarehouseCargoPlayback(traffic, laneIndex, playback);
    const { yard } = traffic;
    const truck = isSameLayout ? prior.truck : createWarehouseDockTruck(yard.hasInitialized ? undefined : cargo.dockTaskId);
    const primaryDock = layout.receiving?.dock;
    const lane = !cargo.hasDock || dock === undefined || primaryDock === undefined
      ? undefined
      : (isSameLayout ? prior.lane : undefined) ?? {
          dock: { x: dock.x - primaryDock.x, z: dock.z - primaryDock.z },
          hasChanged: true,
          hasConfirmedDeparture: false,
          target: cargo.dockTaskId,
          truck,
        };
    setWarehouseYardLane(traffic, laneIndex, lane);
    const truckTaskId = truck.taskId ?? dockSteps[0]?.taskId;
    const meshes = {
      boards: hasDetailedPallets ? boards.current ?? undefined : undefined,
      body: body.current,
      skid: skid.current,
    };
    const visibleUnitIds = new Set(cargo.units.map(unit => unit.id));
    const hasTruckChanged = prev.current?.dockTripId !== undefined && cargo.dockTripId !== undefined
      && prev.current.dockTripId !== cargo.dockTripId;
    const interruptedJob = playback.jobs.findIndex(({ transfer }) => {
      const usesDifferentDock = transfer.dockTaskId !== undefined && transfer.dockTaskId !== cargo.dockTaskId;
      const canFinishHandoff = hasPendingWarehouseDockStep(dockSteps, transfer.dockTaskId)
        || (transfer.dockTaskId !== undefined && transfer.dockTaskId === truck.taskId && dockSteps[0]?.departure !== undefined);
      const isLoadedOnRoute = canFinishHandoff && readWarehouseDockDeparture(cargo, transfer.dockTaskId) === 'route'
        && cargo.shippedUnitIds?.has(transfer.id) === true;
      if (isLoadedOnRoute) {
        return false;
      }
      return !visibleUnitIds.has(transfer.id)
        || (!canFinishHandoff && (usesDifferentDock || (transfer.dockTaskId !== undefined && hasTruckChanged)));
    });
    if (interruptedJob === 0 || isReducedMotion) {
      clearWarehouseForkliftJobs(playback, document.hidden);
    }
    else if (interruptedJob > 0) {
      truncateWarehouseForkliftJobs(playback, interruptedJob);
    }
    if (isSameLayout && !isReducedMotion) {
      const previousTaskId = previousCargo?.dockTaskId;
      const displayedDockTaskId = hasPendingWarehouseDockStep(dockSteps, previousTaskId)
        ? previousTaskId
        : truck.phase === 'departing' ? undefined : truckTaskId;
      queueWarehouseForkliftJobs(playback, layout, buildWarehouseCargoTransfers(layout, prev.current, cargo, displayedDockTaskId, dock));
    }

    const activeDispatchId = playback.jobs.find(({ transfer }) => transfer.to.location === 'truck')?.transfer.dockTaskId;
    const yardVisits = cargo.dockVisits ?? [];
    const current: CargoSceneValue = {
      dock,
      dockSteps,
      dockTaskId: cargo.dockTaskId,
      dockTruck: dockTruck.current,
      hasShadows,
      isTruckShadowed: prior?.dockTruck === dockTruck.current && prior.isTruckShadowed,
      lane,
      layout,
      paint: {
        activeIds: prior?.paint.activeIds ?? new Set<string>(),
        matrix: prior?.paint.matrix ?? new Matrix4(),
        meshes,
        scale: prior?.paint.scale ?? new Vector3(),
        visuals: groupWarehouseCargoVisuals(buildWarehouseCargoVisuals(
          layout, cargo, balances, activeDispatchId, new Set(yardVisits.map(visit => visit.taskId)), dock,
        )),
      },
      playback,
      playbackClock: playbackClock.current,
      refreshShadowMap,
      truck,
      yard,
      yardParking: yardParking.current,
    };
    scene.current = current;
    prev.current = cargo;
    updateDockTarget(current, isReducedMotion);
    if (isYardOwner) {
      setWarehouseYardVisits(traffic, yardVisits);
    }
    setWarehouseYardForklift(traffic, laneIndex, readReadyForklift(current));
    paintDockTruck(current);
    if (isYardOwner) {
      paintYard(current);
    }
    paintScene(current);
    applyWarehouseForkliftPose(forklift.current, playback.jobs.length > 0 ? playback.pose : undefined);
    if (!document.hidden) {
      invalidate();
    }
  }, [
    balances, bucket, cargoSnapshot, dock, dockTruck, forklift, hasAssignedDocks, hasDetailedPallets, hasShadows, invalidate,
    isYardOwner, laneIndex, layout, playbackClock, refreshShadowMap, traffic, yardParking,
  ]);

  useFrame(() => {
    const current = scene.current;
    const clock = playbackClock.current;
    if (current === undefined || clock.isPaused) {
      return;
    }

    const { lane, playback, yard } = current;
    const isParkingRelevant = isYardOwner || current.dockSteps.length > 0 || readWarehouseYardTruckPose(yard, lane?.target) !== undefined;
    if (playback.jobs.length === 0 && lane?.hasChanged !== true && !(traffic.hasParkingChanged && isParkingRelevant)) {
      return;
    }

    const isReducedMotion = motion.current?.matches === true;
    let isForkliftMoving = false;
    if (isReducedMotion) {
      clearWarehouseForkliftJobs(playback);
      setWarehouseYardForklift(traffic, laneIndex, undefined);
    }
    else {
      const ready = readReadyForklift(current);
      setWarehouseYardForklift(traffic, laneIndex, ready);
      if (ready !== undefined && (!hasAssignedDocks || canAdvanceWarehouseForklift(traffic.forklifts, laneIndex))) {
        const isCatchingUp = clock.isCatchingUp || lane?.isCatchingUp === true || ready.jobs.length > 1;
        if (ready.equipmentJob === null || ready.unassignedJob === ready.jobs[0]) {
          advanceWarehouseUnassignedCargo(ready, clock.delta);
        }
        else {
          advanceWarehouseForklift(ready, clock.delta, hasAssignedDocks, isCatchingUp ? WAREHOUSE_YARD_CATCH_UP_RATE : 1);
        }
        isForkliftMoving = true;
        setWarehouseYardForklift(traffic, laneIndex, readReadyForklift(current));
      }
    }
    const hasNewDockTarget = updateDockTarget(current, isReducedMotion);
    paintDockTruck(current);
    if (isYardOwner) {
      paintYard(current);
    }
    applyWarehouseForkliftPose(forklift.current, playback.jobs.length > 0 ? playback.pose : undefined);
    paintScene(current);
    if (hasNewDockTarget || isForkliftMoving) {
      invalidate();
    }
  });

  return (
    <group name="warehouse-cargo">
      <instancedMesh
        args={[hasDetailedPallets ? kit.palletLoad : geometry, bodyMaterial, bucket]}
        frustumCulled={false}
        instanceMatrix-usage={DynamicDrawUsage}
        receiveShadow
        ref={body}
      />
      {hasDetailedPallets && (
        <instancedMesh
          args={[kit.palletBoards, boardsMaterial, bucket]}
          frustumCulled={false}
          instanceMatrix-usage={DynamicDrawUsage}
          receiveShadow
          ref={boards}
        />
      )}
      <instancedMesh
        args={[hasDetailedPallets ? kit.palletBase : geometry, skidMaterial, bucket]}
        frustumCulled={false}
        instanceMatrix-usage={DynamicDrawUsage}
        receiveShadow
        ref={skid}
      />
    </group>
  );
};
