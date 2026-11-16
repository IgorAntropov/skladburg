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

import type {
  WarehouseCargoValue,
  WarehouseDockDepartureValue,
  WarehouseDockVisitValue,
} from '../model/warehouseSceneCargo';
import type { WarehouseGeometryKitValue } from './createWarehouseGeometryKit';
import type {
  WarehouseCargoVisualValue,
  WarehouseDeparturePalletValue,
} from './warehouseCargoPositions';
import type { WarehouseDockTruckValue } from './warehouseDockTruckMotion';
import type { WarehouseForkliftRigValue } from './WarehouseForklift';
import type { WarehouseForkliftPlaybackValue } from './warehouseForkliftPlayback';
import type { WarehouseLayoutValue } from './warehouseLayout';
import type { WarehouseYardMotionValue } from './warehouseYardMotion';
import type { WarehouseYardParkingRigValue } from './WarehouseYardParkingLayer';

import { retainWarehouseDockOrder } from '../model/warehouseSceneCargo';
import {
  buildWarehouseCargoTransfers,
  buildWarehouseCargoVisuals,
  buildWarehouseDepartureCargo,
  WAREHOUSE_TRUCK_SLOTS,
} from './warehouseCargoPositions';
import {
  advanceWarehouseDockTruck,
  createWarehouseDockTruck,
  isWarehouseDockTruckMoving,
  syncWarehouseDockTruck,
} from './warehouseDockTruckMotion';
import { applyWarehouseForkliftPose } from './WarehouseForklift';
import {
  advanceWarehouseForklift,
  clearWarehouseForkliftJobs,
  createWarehouseForkliftPlayback,
  MAX_WAREHOUSE_FORKLIFT_JOBS,
  queueWarehouseForkliftJobs,
} from './warehouseForkliftPlayback';
import {
  FORKLIFT_FORK_HEIGHT,
  FORKLIFT_PALLET_OFFSET,
} from './warehouseForkliftRoute';
import {
  advanceWarehouseYardMotion,
  createWarehouseYardMotion,
  readWarehouseYardTruckOffset,
  syncWarehouseYardMotion,
} from './warehouseYardMotion';
import { WAREHOUSE_YARD_PARKING_LIMIT } from './warehouseYardParking';

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
  visuals: readonly WarehouseCargoVisualValue[];
}

interface CargoSceneValue {
  departure: undefined | WarehouseDockDepartureValue;
  departureCargo: readonly WarehouseDeparturePalletValue[];
  dockTaskId: string | undefined;
  dockTripId: string | undefined;
  dockTruck: Group | null;
  hasShadows: boolean;
  isTruckShadowed: boolean;
  layout: WarehouseLayoutValue;
  paint: CargoPaintValue;
  playback: WarehouseForkliftPlaybackValue;
  refreshShadowMap: () => void;
  truck: WarehouseDockTruckValue;
  yard: WarehouseYardMotionValue;
  yardParking: null | WarehouseYardParkingRigValue;
  yardVisits: readonly WarehouseDockVisitValue[];
}

interface WarehouseCargoProps {
  balances: readonly StockBalance[] | undefined;
  cargo: WarehouseCargoValue;
  dockTruck: RefObject<Group | null>;
  forklift: RefObject<null | WarehouseForkliftRigValue>;
  geometry: BoxGeometry;
  hasShadows: boolean;
  kit: WarehouseGeometryKitValue;
  layout: WarehouseLayoutValue;
  yardParking: RefObject<null | WarehouseYardParkingRigValue>;
}

const MAX_DETAILED_PALLETS = 256;
const MAX_VISIBLE_TRUCKS = WAREHOUSE_YARD_PARKING_LIMIT + 1;
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

const readDockTarget = ({ departure, dockTaskId, playback, truck }: CargoSceneValue): string | undefined => {
  if (truck.taskId === undefined || departure === undefined) {
    return dockTaskId;
  }
  let index = 0;
  while (index < playback.jobs.length) {
    if (playback.jobs[index]?.transfer.dockTaskId === truck.taskId) {
      return truck.taskId;
    }
    index += 1;
  }
  return dockTaskId;
};

const syncSceneTrucks = (scene: CargoSceneValue, isReducedMotion: boolean): void => {
  const { departure, truck, yard, yardVisits } = scene;
  const target = readDockTarget(scene);
  const parkingOffsetZ = readWarehouseYardTruckOffset(yard, target);
  syncWarehouseDockTruck(truck, target, departure !== undefined, isReducedMotion, parkingOffsetZ);
  syncWarehouseYardMotion(yard, yardVisits, truck.taskId, isReducedMotion, truck.phase === 'away' ? undefined : truck.offsetZ);
};

const paintYard = ({ yard, yardParking }: CargoSceneValue): void => {
  if (yard.hasChanged && yardParking !== null) {
    yardParking.paint(yard.visible);
    yard.hasChanged = false;
  }
};

const paintDockTruck = (scene: CargoSceneValue): void => {
  const { dockTruck, hasShadows, truck } = scene;
  if (dockTruck === null) {
    return;
  }
  dockTruck.visible = truck.phase !== 'away';
  dockTruck.position.z = truck.offsetZ;
  const isShadowed = hasShadows && truck.phase === 'docked';
  if (scene.isTruckShadowed !== isShadowed) {
    let index = 0;
    while (index < dockTruck.children.length) {
      const part = dockTruck.children[index];
      index += 1;
      if (part !== undefined) {
        part.castShadow = isShadowed;
      }
    }
    scene.isTruckShadowed = isShadowed;
    scene.refreshShadowMap();
  }
};

const paintScene = ({ departure, departureCargo, dockTaskId, paint, playback, truck, yard }: CargoSceneValue): void => {
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
    const load = phase?.load ?? 'source';
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
      const { location, point, size } = load === 'target' ? to : from;
      if (location === 'truck' && job.transfer.dockTaskId !== truck.taskId) {
        continue;
      }
      const offsetZ = location === 'truck' ? truck.offsetZ : 0;
      writePallet(paint, count, point[0], point[1], point[2] + offsetZ, 0, size);
    }
    count += 1;
  }

  const isDeparting = truck.phase === 'departing';
  const isFinishingRouteLoad = departure === 'route' && truck.taskId !== undefined && truck.taskId !== dockTaskId;
  if (isDeparting || isFinishingRouteLoad) {
    let departureIndex = 0;
    while (departureIndex < departureCargo.length) {
      const load = departureCargo[departureIndex];
      departureIndex += 1;
      if (load !== undefined && !activeIds.has(load.id)) {
        const { point, size } = load;
        writePallet(paint, count, point[0], point[1], point[2] + truck.offsetZ, 0, size);
        count += 1;
      }
    }
  }

  let index = 0;
  while (index < visuals.length) {
    const visual = visuals[index];
    index += 1;
    if (visual === undefined || activeIds.has(visual.id) || (visual.requiresActiveDispatch === true && !hasActiveDispatch)) {
      continue;
    }

    const { point, size, stockUnitIds, truckTaskId } = visual;
    const offsetZ = truckTaskId === undefined
      ? 0
      : truckTaskId === truck.taskId && !isDeparting
        ? truck.offsetZ
        : readWarehouseYardTruckOffset(yard, truckTaskId);
    if (offsetZ === undefined) {
      continue;
    }
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

    writePallet(paint, count, point[0], point[1], point[2] + offsetZ, 0, size);
    count += 1;
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
  balances, cargo: cargoSnapshot, dockTruck, forklift, geometry, hasShadows, kit, layout, yardParking,
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
  const stagedCount = cargoSnapshot.units.reduce((count, unit) => unit.location === 'staging' ? count + 1 : count, 0);
  const truckCount = Math.min(MAX_VISIBLE_TRUCKS, 1 + (cargoSnapshot.dockVisits?.length ?? 0));
  const truckCapacity = cargoSnapshot.hasDock ? WAREHOUSE_TRUCK_SLOTS * truckCount : 0;
  const capacity = stagedCount + truckCapacity + (balances?.length ?? 0) + MAX_WAREHOUSE_FORKLIFT_JOBS;
  const bucket = 2 ** Math.ceil(Math.log2(capacity));
  const hasDetailedPallets = bucket <= MAX_DETAILED_PALLETS;

  useLayoutEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    motion.current = query;
    const handleMotionChange = (): void => {
      invalidate();
    };
    query.addEventListener('change', handleMotionChange);
    return () => {
      query.removeEventListener('change', handleMotionChange);
    };
  }, [invalidate]);

  useLayoutEffect(() => {
    if (body.current === null || skid.current === null) {
      return;
    }

    const prior = scene.current;
    const isSameLayout = prior?.layout === layout;
    const cargo = retainWarehouseDockOrder(isSameLayout ? prev.current : undefined, cargoSnapshot);
    const playback = isSameLayout ? prior.playback : createWarehouseForkliftPlayback(layout);
    const truck = isSameLayout ? prior.truck : createWarehouseDockTruck(cargo.dockTaskId);
    const yard = isSameLayout ? prior.yard : createWarehouseYardMotion();
    const reportedDeparture = truck.taskId === undefined ? undefined : cargo.dockDepartures?.get(truck.taskId);
    const previousTripId = isSameLayout && prev.current?.dockTaskId === truck.taskId ? prior.dockTripId : undefined;
    const departure = reportedDeparture === 'self-pickup' && previousTripId !== undefined ? undefined : reportedDeparture;
    const meshes = {
      boards: hasDetailedPallets ? boards.current ?? undefined : undefined,
      body: body.current,
      skid: skid.current,
    };
    const visibleUnitIds = new Set(cargo.units.map(unit => unit.id));
    const hasTruckChanged = prev.current?.dockTripId !== undefined && cargo.dockTripId !== undefined
      && prev.current.dockTripId !== cargo.dockTripId;
    const hasInterruptedJob = playback.jobs.some(({ transfer }) => {
      const usesDifferentDock = transfer.dockTaskId !== undefined && transfer.dockTaskId !== cargo.dockTaskId;
      const canFinishHandoff = transfer.dockTaskId !== undefined && transfer.dockTaskId === truck.taskId && departure !== undefined;
      const isLoadedOnRoute = canFinishHandoff && departure === 'route' && cargo.shippedUnitIds?.has(transfer.id) === true;
      if (isLoadedOnRoute) {
        return false;
      }
      return !visibleUnitIds.has(transfer.id)
        || (!canFinishHandoff && (usesDifferentDock || (transfer.dockTaskId !== undefined && hasTruckChanged)));
    });
    if (hasInterruptedJob || motion.current?.matches === true) {
      clearWarehouseForkliftJobs(playback);
    }
    if (isSameLayout && motion.current?.matches !== true) {
      const displayedDockTaskId = truck.phase === 'departing' ? undefined : truck.taskId;
      queueWarehouseForkliftJobs(playback, layout, buildWarehouseCargoTransfers(layout, prev.current, cargo, displayedDockTaskId));
    }

    const activeDispatchId = playback.jobs.find(({ transfer }) => transfer.to.location === 'truck')?.transfer.dockTaskId;
    const hasDepartedWithCargo = departure === 'route' || departure === 'self-pickup';
    const canKeepDepartureCargo = isSameLayout && (truck.phase === 'departing' || (hasDepartedWithCargo && prior.departure === departure));
    const departureCargo = truck.taskId !== undefined && hasDepartedWithCargo && prev.current?.dockTaskId === truck.taskId
      ? buildWarehouseDepartureCargo(layout, truck.taskId, prev.current, cargo.shippedUnitIds)
      : canKeepDepartureCargo ? prior.departureCargo : [];
    const yardVisits = cargo.dockVisits?.slice(0, MAX_VISIBLE_TRUCKS) ?? [];
    const current: CargoSceneValue = {
      departure,
      departureCargo,
      dockTaskId: cargo.dockTaskId,
      dockTripId: cargo.dockTripId ?? previousTripId,
      dockTruck: dockTruck.current,
      hasShadows,
      isTruckShadowed: prior?.dockTruck === dockTruck.current && prior.isTruckShadowed,
      layout,
      paint: {
        activeIds: prior?.paint.activeIds ?? new Set<string>(),
        matrix: prior?.paint.matrix ?? new Matrix4(),
        meshes,
        scale: prior?.paint.scale ?? new Vector3(),
        visuals: buildWarehouseCargoVisuals(layout, cargo, balances, activeDispatchId, new Set(yardVisits.map(visit => visit.taskId))),
      },
      playback,
      refreshShadowMap,
      truck,
      yard,
      yardParking: yardParking.current,
      yardVisits,
    };
    scene.current = current;
    prev.current = cargo;
    syncSceneTrucks(current, motion.current?.matches === true);
    paintDockTruck(current);
    paintYard(current);
    paintScene(current);
    applyWarehouseForkliftPose(forklift.current, playback.pose);
    invalidate();
  }, [
    balances, bucket, cargoSnapshot, dockTruck, forklift, hasDetailedPallets, hasShadows, invalidate, layout, refreshShadowMap, yardParking,
  ]);

  useFrame((_, delta) => {
    const current = scene.current;
    if (current === undefined) {
      return;
    }

    const { playback, truck, yard } = current;
    if (playback.jobs.length === 0 && !isWarehouseDockTruckMoving(truck) && !yard.isMoving) {
      return;
    }
    const isReducedMotion = motion.current?.matches === true;
    if (isReducedMotion) {
      clearWarehouseForkliftJobs(playback);
    }
    else {
      advanceWarehouseDockTruck(truck, delta);
      advanceWarehouseYardMotion(yard, delta);
      const job = playback.jobs[0];
      const handoff = job?.transfer.dockTaskId;
      if (handoff !== undefined && handoff !== truck.taskId && handoff !== current.dockTaskId) {
        clearWarehouseForkliftJobs(playback);
      }
      else if (job !== undefined && (handoff === undefined || (truck.phase === 'docked' && handoff === truck.taskId))) {
        advanceWarehouseForklift(playback, delta);
      }
    }
    syncSceneTrucks(current, isReducedMotion);
    paintDockTruck(current);
    paintYard(current);
    applyWarehouseForkliftPose(forklift.current, playback.pose);
    paintScene(current);
    if (playback.jobs.length > 0 || isWarehouseDockTruckMoving(truck) || yard.isMoving) {
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
