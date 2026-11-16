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
import type { WarehouseCargoVisualValue } from './warehouseCargoPositions';
import type { WarehouseForkliftRigValue } from './WarehouseForklift';
import type { WarehouseForkliftPlaybackValue } from './warehouseForkliftPlayback';
import type { WarehouseLayoutValue } from './warehouseLayout';

import {
  buildWarehouseCargoTransfers,
  buildWarehouseCargoVisuals,
  WAREHOUSE_TRUCK_SLOTS,
} from './warehouseCargoPositions';
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
  dockTruck: Group | null;
  hasParkedTruck: boolean;
  layout: WarehouseLayoutValue;
  paint: CargoPaintValue;
  playback: WarehouseForkliftPlaybackValue;
  refreshShadowMap: () => void;
}

interface WarehouseCargoProps {
  balances: readonly StockBalance[] | undefined;
  cargo: WarehouseCargoValue;
  dockTruck: RefObject<Group | null>;
  forklift: RefObject<null | WarehouseForkliftRigValue>;
  geometry: BoxGeometry;
  kit: WarehouseGeometryKitValue;
  layout: WarehouseLayoutValue;
}

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

const paintScene = ({ dockTruck, hasParkedTruck, paint, playback, refreshShadowMap }: CargoSceneValue): void => {
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
      const { point, size } = load === 'target' ? to : from;
      writePallet(paint, count, point[0], point[1], point[2], 0, size);
    }
    count += 1;
  }

  const isTruckVisible = hasParkedTruck || hasActiveDispatch;
  if (dockTruck !== null && dockTruck.visible !== isTruckVisible) {
    dockTruck.visible = isTruckVisible;
    refreshShadowMap();
  }

  let index = 0;
  while (index < visuals.length) {
    const visual = visuals[index];
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

  meshes.body.count = count;
  meshes.skid.count = count;
  meshes.body.instanceMatrix.needsUpdate = true;
  meshes.skid.instanceMatrix.needsUpdate = true;
  if (meshes.boards !== undefined) {
    meshes.boards.count = count;
    meshes.boards.instanceMatrix.needsUpdate = true;
  }
};

export const WarehouseCargo = ({ balances, cargo, dockTruck, forklift, geometry, kit, layout }: WarehouseCargoProps): ReactElement => {
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
  const stagedCount = cargo.units.reduce((count, unit) => unit.location === 'staging' ? count + 1 : count, 0);
  const truckCapacity = cargo.hasDock ? WAREHOUSE_TRUCK_SLOTS : 0;
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
    const playback = isSameLayout ? prior.playback : createWarehouseForkliftPlayback(layout);
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
      const isLocalDispatch = transfer.to.location === 'truck' && cargo.dockTaskId === undefined;
      return !visibleUnitIds.has(transfer.id) || (transfer.dockTaskId !== undefined && hasTruckChanged)
        || (usesDifferentDock && !isLocalDispatch);
    });
    if (hasInterruptedJob || motion.current?.matches === true) {
      clearWarehouseForkliftJobs(playback);
    }
    if (isSameLayout && motion.current?.matches !== true) {
      queueWarehouseForkliftJobs(playback, layout, buildWarehouseCargoTransfers(layout, prev.current, cargo));
    }

    const activeDispatchId = playback.jobs.find(({ transfer }) => transfer.to.location === 'truck')?.transfer.dockTaskId;
    const current = {
      dockTruck: dockTruck.current,
      hasParkedTruck: cargo.dockTaskId !== undefined,
      layout,
      paint: {
        activeIds: prior?.paint.activeIds ?? new Set<string>(),
        matrix: prior?.paint.matrix ?? new Matrix4(),
        meshes,
        scale: prior?.paint.scale ?? new Vector3(),
        visuals: buildWarehouseCargoVisuals(layout, cargo, balances, activeDispatchId),
      },
      playback,
      refreshShadowMap,
    };
    scene.current = current;
    prev.current = cargo;
    paintScene(current);
    applyWarehouseForkliftPose(forklift.current, playback.pose);
    invalidate();
  }, [balances, bucket, cargo, dockTruck, forklift, hasDetailedPallets, invalidate, layout, refreshShadowMap]);

  useFrame((_, delta) => {
    const current = scene.current;
    if (current === undefined || current.playback.jobs.length === 0) {
      return;
    }

    const { playback } = current;
    if (motion.current?.matches === true) {
      clearWarehouseForkliftJobs(playback);
    }
    else {
      advanceWarehouseForklift(playback, delta);
    }
    applyWarehouseForkliftPose(forklift.current, playback.pose);
    paintScene(current);
    if (playback.jobs.length > 0) {
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
