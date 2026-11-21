import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type {
  ReactElement,
  RefObject,
} from 'react';
import type { InstancedMesh } from 'three';

import {
  useFrame,
  useThree,
} from '@react-three/fiber';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { Object3D } from 'three';

import type { WorldPaletteKeyValue } from '@/shared/3d';

import { useWorldMaterial } from '@/shared/3d';

import type {
  WarehouseSceneEquipmentValue,
  WarehouseSceneInteractionValue,
} from '../model/warehouseSceneInteraction';
import type { WarehouseStaffLabelBoundsValue } from './createWarehouseStaffOverlay';
import type { WarehouseYardPlaybackClockValue } from './warehouseDockPlayback';
import type {
  WarehouseEquipmentActorValue,
  WarehouseEquipmentBayValue,
} from './warehouseEquipmentMotion';
import type {
  WarehouseBoxValue,
  WarehouseLayoutValue,
} from './warehouseLayout';
import type { WarehouseYardTrafficValue } from './warehouseYardTraffic';

import { createWarehouseEquipmentOverlay } from './createWarehouseEquipmentOverlay';
import {
  advanceWarehouseEquipmentActor,
  placeWarehouseEquipmentBays,
  prepareWarehouseEquipmentRoutes,
  releaseWarehouseEquipmentCargo,
  syncWarehouseEquipmentActors,
  syncWarehouseEquipmentCargo,
} from './warehouseEquipmentMotion';
import { addWarehouseBox } from './warehouseFloorLayout';
import {
  applyWarehouseForkliftPose,
  createWarehouseForkliftGeometries,
} from './WarehouseForklift';
import { FORKLIFT_SCALE } from './warehouseForkliftRoute';
import { readWarehouseFloor } from './warehouseRackGeometry';

interface WarehouseEquipmentLayerProps {
  clock: RefObject<WarehouseYardPlaybackClockValue>;
  fleet: WarehouseSceneEquipmentValue;
  host: WarehouseSceneInteractionValue['staffOverlayHost'];
  layout: WarehouseLayoutValue;
  onSelect: WarehouseSceneInteractionValue['onEquipmentSelect'];
  renderFloor: (layout: WarehouseLayoutValue) => ReactElement;
  staffBounds: RefObject<readonly WarehouseStaffLabelBoundsValue[]>;
  topology: WarehouseTopology;
  traffic: WarehouseYardTrafficValue;
}

const addStations = (layout: WarehouseLayoutValue, bays: readonly WarehouseEquipmentBayValue[]): WarehouseLayoutValue => {
  const parts = new Map<WorldPaletteKeyValue, WarehouseBoxValue[]>();
  for (const { cabinet: { x, z } } of bays) {
    addWarehouseBox(parts, 'road', [x, 0.07, z], [0.62, 0.14, 0.79]);
    addWarehouseBox(parts, 'warehouseRoof', [x, 0.62, z], [0.4, 1.02, 0.68]);
    addWarehouseBox(parts, 'buildingRoofAlt', [x + 0.22, 0.84, z], [0.05, 0.33, 0.49]);
    addWarehouseBox(parts, 'road', [x + 0.24, 0.55, z], [0.095, 0.18, 0.23]);
    for (const side of [-1, 1]) {
      addWarehouseBox(parts, 'sand', [x + 1.19, 0.05, z + side * 0.58], [1.65, 0.015, 0.05]);
    }
  }
  const floor = new Map(layout.floor);
  for (const [key, boxes] of parts) {
    floor.set(key, [...floor.get(key) ?? [], ...boxes]);
  }
  return { ...layout, floor };
};

const PARTS = ['body', 'chassis', 'carriage', 'mast', 'tines'] as const;
type PartValue = typeof PARTS[number];

const createRig = (): Record<PartValue, Object3D> => {
  const body = new Object3D();
  const chassis = new Object3D();
  const carriage = new Object3D();
  const mast = new Object3D();
  const tines = new Object3D();
  body.add(chassis, carriage, mast);
  carriage.add(tines);
  body.scale.setScalar(FORKLIFT_SCALE);
  return { body, carriage, chassis, mast, tines };
};

const WarehouseEquipmentLayer = ({
  clock, fleet, host, layout, onSelect, renderFloor, staffBounds, topology, traffic,
}: WarehouseEquipmentLayerProps): ReactElement => {
  const canvas = useThree(state => state.gl.domElement);
  const invalidate = useThree(state => state.invalidate);
  const accent = useWorldMaterial('buildingRoofAlt');
  const dark = useWorldMaterial('road');
  const steel = useWorldMaterial('warehouseRoof');
  const materials = { body: accent, carriage: steel, chassis: dark, mast: steel, tines: steel };
  const geometries = useMemo(() => createWarehouseForkliftGeometries(), []);
  const rig = useMemo(() => createRig(), []);
  const meshes = useRef<Partial<Record<PartValue, InstancedMesh | null>>>({});
  const actors = useMemo(() => new Map<string, WarehouseEquipmentActorValue>(), []);
  const overlay = useRef<ReturnType<typeof createWarehouseEquipmentOverlay>>(undefined);
  const motion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), []);
  const stationIds = fleet.stations.map(station => station.id).join(',');
  const bays = useMemo(() => placeWarehouseEquipmentBays(
    layout, readWarehouseFloor(topology.bounds), stationIds.length === 0 ? [] : stationIds.split(','),
  ), [layout, topology.bounds, stationIds]);
  const floor = useMemo(() => addStations(layout, bays), [layout, bays]);

  const handleCargoRelease = useCallback((): void => {
    prepareWarehouseEquipmentRoutes(actors, layout);
    if (!document.hidden) {
      invalidate();
    }
  }, [actors, invalidate, layout]);

  useEffect(() => (): void => {
    for (const part of PARTS) {
      geometries[part].dispose();
    }
  }, [geometries]);

  useLayoutEffect(() => {
    const parent = host?.current;
    if (parent == null) {
      return undefined;
    }
    const current = createWarehouseEquipmentOverlay(canvas, parent);
    overlay.current = current;
    return (): void => {
      current.dispose();
      overlay.current = undefined;
    };
  }, [canvas, host]);

  useLayoutEffect(() => {
    syncWarehouseEquipmentActors(actors, fleet, bays, layout);
    overlay.current?.update(actors, bays, fleet, onSelect);
    if (!document.hidden) {
      invalidate();
    }
  }, [actors, bays, canvas, fleet, host, invalidate, layout, onSelect]);

  useLayoutEffect(() => (): void => {
    releaseWarehouseEquipmentCargo(traffic.cargoPlaybacks);
  }, [traffic]);

  useFrame(() => {
    if (!clock.current.isPaused && !document.hidden && syncWarehouseEquipmentCargo(actors, traffic.cargoPlaybacks)) {
      queueMicrotask(handleCargoRelease);
    }
  }, -0.5);

  useFrame(({ camera, size }) => {
    if (clock.current.isPaused || document.hidden) {
      return;
    }
    let index = 0;
    let isMoving = false;
    for (const actor of actors.values()) {
      const cargo = traffic.cargoPlaybacks[actor.cargoLane];
      if (cargo?.pose !== undefined && cargo.jobs[0] === actor.cargoJob) {
        Object.assign(actor.pose, cargo.pose);
      }
      else if (actor.cargoLane === -1 && advanceWarehouseEquipmentActor(actor, clock.current.delta, motion.matches)) {
        isMoving = true;
      }
      applyWarehouseForkliftPose(rig, actor.pose);
      rig.body.updateMatrixWorld();
      for (const part of PARTS) {
        meshes.current[part]?.setMatrixAt(index, rig[part].matrixWorld);
      }
      index += 1;
    }
    for (const part of PARTS) {
      const mesh = meshes.current[part];
      if (mesh != null) {
        mesh.count = index;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    overlay.current?.project(camera, size.width, size.height, staffBounds.current);
    if (isMoving) {
      invalidate();
    }
  });

  return (
    <>
      {renderFloor(floor)}
      {fleet.units.length > 0 && PARTS.map(part => (
        <instancedMesh
          args={[geometries[part], materials[part], fleet.units.length]}
          frustumCulled={false}
          key={part}
          receiveShadow
          ref={(mesh) => { meshes.current[part] = mesh; }}
        />
      ))}
    </>
  );
};

export default WarehouseEquipmentLayer;
