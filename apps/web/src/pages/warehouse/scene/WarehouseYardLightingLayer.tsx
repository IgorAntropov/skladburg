import type {
  ReactElement,
  RefObject,
} from 'react';
import type { InstancedMesh } from 'three';

import { useThree } from '@react-three/fiber';
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  Matrix4,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import type { QualityLevelValue } from '@/shared/3d';

import {
  QUALITY_LEVEL_SETTINGS,
  useWorldGlowMaterial,
  WORLD_GLOW_DELAY_ATTRIBUTE,
} from '@/shared/3d';

import type {
  WarehouseBoxValue,
  WarehouseDockPointValue,
} from './warehouseLayout';
import type { WarehouseYardRoadsValue } from './warehouseYardRoads';
import type { WarehouseYardTrafficValue } from './warehouseYardTraffic';

import { isWarehouseDockTruckMoving } from './warehouseDockTruckMotion';
import { WarehouseInstances } from './WarehouseInstances';
import {
  buildWarehouseYardLamps,
  isWarehouseParkingTruckMoving,
  readWarehouseYardHeadlightBeamOwner,
  writeWarehouseHeadlightMatrix,
} from './warehouseYardLighting';
import { WAREHOUSE_YARD_PARKING_LIMIT } from './warehouseYardParking';
import { WAREHOUSE_TRUCK_CENTER_Z } from './warehouseYardRoads';

export interface IWarehouseYardLightingRig {
  paint: () => void;
}

interface WarehouseYardLightingLayerProps {
  dock: WarehouseDockPointValue;
  docks: readonly WarehouseDockPointValue[];
  geometry: BoxGeometry;
  level: QualityLevelValue;
  rig: RefObject<IWarehouseYardLightingRig | null>;
  roads: WarehouseYardRoadsValue;
  traffic: WarehouseYardTrafficValue;
}

const DIMMED_LENS = new Color(0.55, 0.55, 0.55);
const ACTIVE_LENS = new Color(1, 1, 1);

const createGlowGeometry = (geometry: BufferGeometry, count: number, delay: number): BufferGeometry => {
  geometry.setAttribute(WORLD_GLOW_DELAY_ATTRIBUTE, new InstancedBufferAttribute(new Float32Array(count).fill(delay), 1));
  return geometry;
};

const mergeGlowParts = (parts: BufferGeometry[], count: number, delay: number): BufferGeometry => {
  const geometry = mergeGeometries(parts);
  for (const part of parts) {
    part.dispose();
  }
  return createGlowGeometry(geometry, count, delay);
};

const createBeamFootprint = (width: number, depth: number): BufferGeometry => new BufferGeometry()
  .setAttribute('position', new Float32BufferAttribute([
    -0.66, 0, 0, 0.66, 0, 0, width, 0, -depth, -width, 0, -depth,
  ], 3))
  .setIndex([0, 1, 2, 0, 2, 3]);

const createHeadlightPainter = (
  traffic: WarehouseYardTrafficValue,
  isCompactYard: boolean,
  lenses: InstancedMesh,
  beam: InstancedMesh | null,
): (() => void) => {
  const matrix = new Matrix4();
  const capacity = lenses.instanceMatrix.count;
  const lastPoses = new Float64Array((capacity / 2) * 3).fill(Number.NaN);
  const lastMotion = new Uint8Array(capacity / 2).fill(2);
  const lensColors = lenses.instanceColor
    ?? new InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3).setUsage(DynamicDrawUsage);
  lenses.instanceColor = lensColors;
  let lensCount = 0;
  let hasNewColors = false;

  const paintTruck = (x: number, z: number, yaw: number, isMoving: boolean, hasBeam: boolean): boolean => {
    const truckIndex = lensCount / 2;
    const offset = truckIndex * 3;
    const hasChanged = lastPoses[offset] !== x || lastPoses[offset + 1] !== z || lastPoses[offset + 2] !== yaw;
    if (hasChanged) {
      lastPoses[offset] = x;
      lastPoses[offset + 1] = z;
      lastPoses[offset + 2] = yaw;
      writeWarehouseHeadlightMatrix(matrix, x, z, yaw, -1);
      lenses.setMatrixAt(lensCount, matrix);
      writeWarehouseHeadlightMatrix(matrix, x, z, yaw, 1);
      lenses.setMatrixAt(lensCount + 1, matrix);
    }
    if (lastMotion[truckIndex] !== Number(isMoving)) {
      lastMotion[truckIndex] = Number(isMoving);
      const color = isMoving ? ACTIVE_LENS : DIMMED_LENS;
      lenses.setColorAt(lensCount, color);
      lenses.setColorAt(lensCount + 1, color);
      hasNewColors = true;
    }
    lensCount += 2;
    if (beam !== null && hasBeam) {
      writeWarehouseHeadlightMatrix(matrix, x, z, yaw, 0);
      beam.setMatrixAt(0, matrix);
      beam.instanceMatrix.needsUpdate = true;
      beam.count = 1;
    }
    return hasChanged;
  };

  return () => {
    lensCount = 0;
    const beamOwner = beam === null ? undefined : readWarehouseYardHeadlightBeamOwner(traffic, isCompactYard);
    if (beam !== null) {
      beam.count = 0;
    }
    let hasChanged = false;
    for (const truck of traffic.yard.parked) {
      const isMoving = isWarehouseParkingTruckMoving(truck, traffic, isCompactYard);
      hasChanged = paintTruck(truck.offsetX, truck.offsetZ, truck.yaw, isMoving, truck === beamOwner) || hasChanged;
    }
    for (const lane of traffic.lanes) {
      if (lane !== undefined && lane.truck.phase !== 'away') {
        const { dock, truck } = lane;
        hasChanged = paintTruck(
          dock.x + truck.offsetX, dock.z + truck.offsetZ, truck.yaw, isWarehouseDockTruckMoving(truck), lane === beamOwner,
        ) || hasChanged;
      }
    }
    lenses.count = lensCount;
    if (hasChanged) {
      lenses.instanceMatrix.needsUpdate = true;
    }
    if (hasNewColors) {
      lensColors.needsUpdate = true;
      hasNewColors = false;
    }
  };
};

const WarehouseYardLightingLayer = ({
  dock, docks, geometry, level, rig, roads, traffic,
}: WarehouseYardLightingLayerProps): ReactElement => {
  const gl = useThree(state => state.gl);
  const camera = useThree(state => state.camera);
  const scene = useThree(state => state.scene);
  const invalidate = useThree(state => state.invalidate);
  const isBasic = level === 'low';
  const isCompactYard = roads.parking.length <= WAREHOUSE_YARD_PARKING_LIMIT;
  const { hasGlowHalo } = QUALITY_LEVEL_SETTINGS[level];
  const lensCapacity = 2 * (roads.parking.length + docks.length);
  const headMaterial = useWorldGlowMaterial({ key: 'lampGlow', kind: 'nightOpaque', offKey: 'road' });
  const poolMaterial = useWorldGlowMaterial({ key: 'lightPool', kind: 'nightAdditive', strength: isBasic ? 0.21 : 0.1 });
  const haloMaterial = useWorldGlowMaterial({ key: 'lightPool', kind: 'nightAdditive', strength: 0.11 });
  const lensMaterial = useWorldGlowMaterial({ key: 'windowGlow', kind: 'nightOpaque', offKey: 'windowGlass' });
  const beamMaterial = useWorldGlowMaterial({ key: 'lampGlow', kind: 'nightAdditive', strength: 0.17 });
  const heads = useRef<InstancedMesh>(null);
  const pools = useRef<InstancedMesh>(null);
  const halos = useRef<InstancedMesh>(null);
  const lenses = useRef<InstancedMesh>(null);
  const beam = useRef<InstancedMesh>(null);
  const lamps = useMemo(() => buildWarehouseYardLamps(dock, docks, roads), [dock, docks, roads]);
  const litLamps = useMemo(() => lamps.filter(lamp => !isBasic || lamp.isEssential), [isBasic, lamps]);
  const masts = useMemo(() => lamps.filter(lamp => lamp.hasMast).map(({ height, x, z }): WarehouseBoxValue => ({
    position: [x, height / 2, z], size: [0.11, height, 0.11],
  })), [lamps]);
  const headGeometry = useMemo(() => createGlowGeometry(new BoxGeometry(0.36, 0.15, 0.29), litLamps.length, 0.37), [litLamps.length]);
  const poolGeometry = useMemo(() => mergeGlowParts((isBasic ? [1] : [1, 0.76, 0.52]).map(radius =>
    new CircleGeometry(radius, 16).rotateX(-Math.PI / 2)), litLamps.length, 0.37), [isBasic, litLamps.length]);
  const haloGeometry = useMemo(() => hasGlowHalo ? createGlowGeometry(new IcosahedronGeometry(0.48), litLamps.length, 0.37) : undefined,
    [hasGlowHalo, litLamps.length]);
  const lensGeometry = useMemo(() => createGlowGeometry(new BoxGeometry(0.3, 0.155, 0.045), lensCapacity, 0.48), [lensCapacity]);
  const beamGeometry = useMemo(() => isBasic
    ? undefined
    : mergeGlowParts([
        createBeamFootprint(1.8, 5.2), createBeamFootprint(1.12, 3.7),
      ], 1, 0.48),
  [isBasic]);

  useImperativeHandle(rig, (): IWarehouseYardLightingRig => {
    const currentBeam = beam.current?.geometry === beamGeometry ? beam.current : null;
    const paint = lenses.current?.geometry === lensGeometry
      ? createHeadlightPainter(traffic, isCompactYard, lenses.current, currentBeam)
      : (): void => undefined;
    paint();
    return { paint };
  }, [beamGeometry, isCompactYard, lensGeometry, traffic]);

  useLayoutEffect(() => {
    const matrix = new Matrix4();
    for (const [index, { height, poolX, poolZ, radius, x, z }] of litLamps.entries()) {
      matrix.makeTranslation(x, height, z);
      heads.current?.setMatrixAt(index, matrix);
      halos.current?.setMatrixAt(index, matrix);
      matrix.makeScale(radius, 1, radius * 1.08).setPosition(poolX, 0.048, poolZ);
      pools.current?.setMatrixAt(index, matrix);
    }
    for (const mesh of [heads.current, pools.current, halos.current]) {
      if (mesh !== null) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    }
    invalidate();
  }, [haloGeometry, headGeometry, invalidate, litLamps, poolGeometry]);

  useEffect(() => (): void => {
    headGeometry.dispose();
  }, [headGeometry]);
  useEffect(() => (): void => {
    poolGeometry.dispose();
  }, [poolGeometry]);
  useEffect(() => (): void => haloGeometry?.dispose(), [haloGeometry]);
  useEffect(() => (): void => {
    lensGeometry.dispose();
  }, [lensGeometry]);
  useEffect(() => (): void => beamGeometry?.dispose(), [beamGeometry]);

  useEffect(() => {
    let isCancelled = false;
    const payFirstUse = (): void => {
      if (!isCancelled) {
        for (const program of gl.info.programs ?? []) {
          program.getUniforms();
        }
      }
    };
    void gl.compileAsync(scene, camera).then(payFirstUse, () => undefined);
    return () => {
      isCancelled = true;
    };
  }, [camera, gl, isBasic, scene]);

  return (
    <>
      <group name="warehouse-yard-lamps">
        <WarehouseInstances boxes={masts} geometry={geometry} materialKey="road" />
        <instancedMesh args={[headGeometry, headMaterial, litLamps.length]} name="warehouse-yard-lamp-heads" ref={heads} />
        <instancedMesh args={[poolGeometry, poolMaterial, litLamps.length]} name="warehouse-yard-lamp-pools" ref={pools} />
        {haloGeometry !== undefined && (
          <instancedMesh args={[haloGeometry, haloMaterial, litLamps.length]} name="warehouse-yard-lamp-halo" ref={halos} />
        )}
      </group>
      <group position={[dock.x, 0, dock.z + WAREHOUSE_TRUCK_CENTER_Z]}>
        <instancedMesh
          args={[lensGeometry, lensMaterial, lensCapacity]}
          count={0}
          frustumCulled={false}
          instanceMatrix-usage={DynamicDrawUsage}
          name="warehouse-yard-headlight-lenses"
          ref={lenses}
        />
        {beamGeometry !== undefined && (
          <instancedMesh
            args={[beamGeometry, beamMaterial, 1]}
            count={0}
            frustumCulled={false}
            instanceMatrix-usage={DynamicDrawUsage}
            name="warehouse-yard-headlight-beam"
            ref={beam}
          />
        )}
      </group>
    </>
  );
};

export default WarehouseYardLightingLayer;
