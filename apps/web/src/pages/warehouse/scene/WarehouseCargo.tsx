import type { StockBalance } from '@skladburg/contracts/wms/v1/stock';
import type { ReactElement } from 'react';
import type {
  BoxGeometry,
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
} from 'three';

import { useWorldMaterial } from '@/shared/3d';

import type { WarehouseCargoValue } from '../model/warehouseSceneCargo';
import type { getWarehouseLayout } from './warehouseLayout';

import { buildWarehouseCargoVisuals } from './warehouseCargoPositions';

interface CargoActorValue {
  elapsed: number;
  path: WarehouseCargoVisualValue['path'];
  visual: WarehouseCargoVisualValue;
}

interface CargoMeshesValue {
  body: InstancedMesh;
  skid: InstancedMesh;
  visibleCargoIds: Set<string>;
}

interface WarehouseCargoProps {
  balances: readonly StockBalance[] | undefined;
  cargo: WarehouseCargoValue;
  geometry: BoxGeometry;
  layout: ReturnType<typeof getWarehouseLayout>;
}

type WarehouseCargoVisualValue = ReturnType<typeof buildWarehouseCargoVisuals>[number];

const LEG_SECONDS = 0.54;
const MAX_FRAME_DELTA = 1 / 25;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const paint = (meshes: CargoMeshesValue, actors: readonly CargoActorValue[], matrix: Matrix4): void => {
  const visibleCargoIds = meshes.visibleCargoIds;
  visibleCargoIds.clear();
  for (const { elapsed, path, visual } of actors) {
    if (visual.stockUnitIds === undefined && (visual.stays || elapsed < (path.length - 1) * LEG_SECONDS)) {
      visibleCargoIds.add(visual.id);
    }
  }

  let count = 0;
  for (const { elapsed, path, visual } of actors) {
    const isMoving = elapsed < (path.length - 1) * LEG_SECONDS;
    if (!isMoving && !visual.stays) {
      continue;
    }

    if (visual.stockUnitIds !== undefined) {
      let hasOtherStock = false;
      for (const id of visual.stockUnitIds) {
        if (!visibleCargoIds.has(id)) {
          hasOtherStock = true;
          break;
        }
      }
      if (!hasOtherStock) {
        continue;
      }
    }

    const step = elapsed / LEG_SECONDS;
    const segment = Math.floor(step);
    const from = isMoving ? path[segment] : undefined;
    const to = isMoving ? path[segment + 1] : undefined;
    const fraction = step - segment;
    const ease = fraction * fraction * (3 - 2 * fraction);
    const [targetX, targetY, targetZ] = visual.point;
    const x = from === undefined || to === undefined ? targetX : from[0] + (to[0] - from[0]) * ease;
    const y = from === undefined || to === undefined ? targetY : from[1] + (to[1] - from[1]) * ease + Math.sin(fraction * Math.PI) * 0.1;
    const z = from === undefined || to === undefined ? targetZ : from[2] + (to[2] - from[2]) * ease;
    const { size } = visual;
    matrix.makeScale(size, size * 0.78, size * 0.86).setPosition(x, y + size * 0.48, z);
    meshes.body.setMatrixAt(count, matrix);
    matrix.makeScale(size * 1.08, size * 0.1, size * 0.95).setPosition(x, y + size * 0.05, z);
    meshes.skid.setMatrixAt(count, matrix);
    count += 1;
  }
  meshes.body.count = count;
  meshes.skid.count = count;
  meshes.body.instanceMatrix.needsUpdate = true;
  meshes.skid.instanceMatrix.needsUpdate = true;
};

const advanceCargo = (
  actors: readonly CargoActorValue[],
  meshes: CargoMeshesValue,
  matrix: Matrix4,
  delta: number,
  hasReducedMotion: boolean,
): boolean => {
  let hasPaint = false;
  let isMoving = false;
  for (const actor of actors) {
    const duration = (actor.path.length - 1) * LEG_SECONDS;
    if (actor.elapsed >= duration) {
      continue;
    }
    actor.elapsed = hasReducedMotion ? duration : Math.min(duration, actor.elapsed + Math.min(delta, MAX_FRAME_DELTA));
    isMoving ||= actor.elapsed < duration;
    hasPaint = true;
  }
  if (hasPaint) {
    paint(meshes, actors, matrix);
  }
  return isMoving;
};

export const WarehouseCargo = ({ balances, cargo, geometry, layout }: WarehouseCargoProps): ReactElement => {
  const invalidate = useThree(state => state.invalidate);
  const bodyMaterial = useWorldMaterial('sand');
  const skidMaterial = useWorldMaterial('buildingBrick');
  const body = useRef<InstancedMesh>(null);
  const skid = useRef<InstancedMesh>(null);
  const prev = useRef<WarehouseCargoValue>(undefined);
  const motion = useRef<MediaQueryList | undefined>(undefined);
  const actors = useRef<CargoActorValue[]>([]);
  const meshes = useRef<CargoMeshesValue | undefined>(undefined);
  const scratch = useRef<Matrix4 | undefined>(undefined);
  const capacity = cargo.units.length + (balances?.length ?? 0) + 1;
  const bucket = 2 ** Math.ceil(Math.log2(capacity));

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
    const currentMeshes = { body: body.current, skid: skid.current, visibleCargoIds: new Set<string>() };
    meshes.current = currentMeshes;
    const matrix = scratch.current ?? new Matrix4();
    scratch.current = matrix;
    const previousActors = new Map(actors.current.map(actor => [actor.visual.id, actor] as const));
    const visuals = buildWarehouseCargoVisuals(layout, prev.current, cargo, balances);
    const hasReducedMotion = motion.current?.matches === true;
    const nextActors: CargoActorValue[] = visuals.map((visual) => {
      const prior = previousActors.get(visual.id);
      if (prior === undefined || hasReducedMotion) {
        return { elapsed: hasReducedMotion ? Infinity : 0, path: visual.path, visual };
      }
      if (visual.path.length > 1) {
        if (!visual.stays && prior.visual.stays && prior.elapsed < (prior.path.length - 1) * LEG_SECONDS) {
          return { elapsed: prior.elapsed, path: [...prior.path, visual.point], visual };
        }
        return { elapsed: 0, path: visual.path, visual };
      }
      return { elapsed: prior.elapsed, path: prior.path, visual };
    });

    if (!hasReducedMotion) {
      const nextIds = new Set(visuals.map(visual => visual.id));
      for (const actor of actors.current) {
        if (!actor.visual.stays && actor.elapsed < (actor.path.length - 1) * LEG_SECONDS && !nextIds.has(actor.visual.id)) {
          nextActors.push(actor);
        }
      }
    }

    actors.current = nextActors;
    prev.current = cargo;
    paint(currentMeshes, nextActors, matrix);
    invalidate();
  }, [balances, bucket, cargo, invalidate, layout]);

  useFrame((_, delta) => {
    const matrix = scratch.current;
    const currentMeshes = meshes.current;
    if (matrix === undefined || currentMeshes === undefined) {
      return;
    }
    if (advanceCargo(actors.current, currentMeshes, matrix, delta, motion.current?.matches === true)) {
      invalidate();
    }
  });

  return (
    <>
      <instancedMesh
        args={[geometry, bodyMaterial, bucket]}
        frustumCulled={false}
        instanceMatrix-usage={DynamicDrawUsage}
        receiveShadow
        ref={body}
      />
      <instancedMesh
        args={[geometry, skidMaterial, bucket]}
        frustumCulled={false}
        instanceMatrix-usage={DynamicDrawUsage}
        receiveShadow
        ref={skid}
      />
    </>
  );
};
