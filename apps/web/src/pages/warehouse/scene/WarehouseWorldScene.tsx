import type { ThreeEvent } from '@react-three/fiber';
import type { ReactElement } from 'react';

import {
  useFrame,
  useThree,
} from '@react-three/fiber';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BoxGeometry } from 'three';

import type {
  SceneContentProps,
  SceneWorldValue,
} from '@/shared/3d';

import {
  QUALITY_LEVEL_SETTINGS,
  useSceneCameraRig,
} from '@/shared/3d';

import type {
  WarehouseSceneDataValue,
  WarehouseSceneInteractionValue,
} from '../model/warehouseSceneInteraction';
import type {
  WarehouseBoxValue,
  WarehouseCellVisualValue,
  WarehouseLayoutValue,
} from './warehouseLayout';

import { createWarehouseGeometryKit } from './createWarehouseGeometryKit';
import { useWarehouseTruckModel } from './useWarehouseTruckModel';
import { splitWarehouseDockCargo } from './warehouseDockCargo';
import { WarehouseDockLane } from './WarehouseDockLane';
import { WarehouseFloor } from './WarehouseFloor';
import { WarehouseInstances } from './WarehouseInstances';
import { getWarehouseLayout } from './warehouseLayout';
import { WarehouseRacks } from './WarehouseRacks';
import {
  advanceWarehouseYardTraffic,
  createWarehouseYardTraffic,
} from './warehouseYardTraffic';

const TAP_SLOP_PX = 5;

export const prepare = ({ parkingCapacity, topology }: WarehouseSceneDataValue): Promise<void> => {
  getWarehouseLayout(topology, parkingCapacity);
  return Promise.resolve();
};

export const resolveWorld = ({ parkingCapacity, topology }: WarehouseSceneDataValue): SceneWorldValue =>
  getWarehouseLayout(topology, parkingCapacity).world;

const buildSelectionBoxes = (selection: undefined | WarehouseCellVisualValue): WarehouseBoxValue[] => {
  if (selection === undefined) {
    return [];
  }

  const { position: [x, y, z], size: [width, , depth] } = selection;
  const line = Math.min(0.055, width / 8);
  return [
    { position: [x, y + 0.03, z - depth / 2], size: [width, 0.034, line] },
    { position: [x, y + 0.03, z + depth / 2], size: [width, 0.034, line] },
    { position: [x - width / 2, y + 0.03, z], size: [line, 0.034, depth] },
    { position: [x + width / 2, y + 0.03, z], size: [line, 0.034, depth] },
  ];
};

const WarehouseWorldScene = ({
  data, interaction, level,
}: SceneContentProps<WarehouseSceneDataValue, WarehouseSceneInteractionValue>): ReactElement => {
  const rig = useSceneCameraRig();
  const invalidate = useThree(state => state.invalidate);
  const motion = useRef<MediaQueryList | undefined>(undefined);
  const isYardActive = useRef(false);
  const desiredLayout = getWarehouseLayout(data.topology, data.parkingCapacity);
  const [motionLayout, setMotionLayout] = useState<WarehouseLayoutValue>();
  const traffic = useMemo(() => createWarehouseYardTraffic(), []);
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const kit = useMemo(() => createWarehouseGeometryKit(), []);
  const truckModel = useWarehouseTruckModel();
  const { hasShadows } = QUALITY_LEVEL_SETTINGS[level];
  const lastFocus = useRef<{ request: number; scan: WarehouseSceneInteractionValue['scannedCell'] }>(undefined);
  const {
    balances, cargo, construction, constructionLayer: ConstructionLayer, focusRequest, onCellSelect, scannedCell, selectedCellId,
  } = interaction;
  const layout = motionLayout ?? desiredLayout;
  const hasPendingLayout = layout !== desiredLayout || data.parkingCapacity !== interaction.parkingCapacity;
  const docks = layout.receiving?.docks;
  const lanes = useMemo(() => splitWarehouseDockCargo(cargo, balances, docks?.map(dock => dock.id) ?? []), [balances, cargo, docks]);
  const hasAssignedDocks = (docks?.length ?? 0) > 1;
  const activeCellId = scannedCell?.cellId ?? selectedCellId;
  const selection = activeCellId === undefined ? undefined : layout.cellsById.get(activeCellId);
  const selectionBoxes = useMemo(() => buildSelectionBoxes(selection), [selection]);

  const handleCellClick = (event: ThreeEvent<MouseEvent>): void => {
    const cell = event.instanceId === undefined ? undefined : layout.cells[event.instanceId];
    if (cell !== undefined && event.delta <= TAP_SLOP_PX) {
      event.stopPropagation();
      onCellSelect(cell.id);
    }
  };

  const handleYardActivityChange = (): void => {
    setMotionLayout(isYardActive.current ? layout : undefined);
  };

  useEffect(() => (): void => {
    geometry.dispose();
    for (const part of Object.values(kit)) {
      part.dispose();
    }
  }, [geometry, kit]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (): void => {
      invalidate();
    };
    motion.current = query;
    query.addEventListener('change', handleMotionChange);
    invalidate();
    return () => {
      query.removeEventListener('change', handleMotionChange);
    };
  }, [invalidate]);

  useEffect(() => {
    const prev = lastFocus.current;
    const isRequested = prev?.request !== focusRequest || (scannedCell !== undefined && prev.scan !== scannedCell);
    lastFocus.current = { request: focusRequest, scan: scannedCell };

    if (isRequested && selection !== undefined) {
      const [x, y, z] = selection.position;
      rig.current?.flyTo({ x, y, z });
    }
  }, [focusRequest, rig, scannedCell, selection]);

  useFrame((_, delta) => {
    if (advanceWarehouseYardTraffic(traffic, layout.yard, delta, motion.current?.matches === true, hasPendingLayout)) {
      invalidate();
    }
    const isMoving = traffic.reservation !== undefined || traffic.yard.isMoving;
    if (isMoving !== isYardActive.current) {
      isYardActive.current = isMoving;
      queueMicrotask(handleYardActivityChange);
    }
  }, -1);

  return (
    <>
      <WarehouseFloor batches={layout.floor} geometry={geometry} hasShadows={hasShadows} />
      <WarehouseRacks box={geometry} kit={kit} layout={layout.racks} level={level} />
      {construction !== undefined && (
        <ConstructionLayer construction={construction} geometry={geometry} instances={WarehouseInstances} topology={data.topology} />
      )}
      {layout.cells.length > 0 && (
        <WarehouseInstances boxes={layout.cells} geometry={geometry} materialKey="buildingWall" onClick={handleCellClick} />
      )}
      {lanes.map((lane, index) => (
        <WarehouseDockLane
          dock={docks?.[index] ?? layout.receiving?.dock}
          geometry={geometry}
          hasAssignedDocks={hasAssignedDocks}
          hasShadows={hasShadows}
          key={docks?.[index]?.id ?? 'warehouse'}
          kit={kit}
          lane={lane}
          laneIndex={index}
          layout={layout}
          traffic={traffic}
          truckModel={truckModel}
        />
      ))}
      {selectionBoxes.length > 0 && <WarehouseInstances boxes={selectionBoxes} geometry={geometry} materialKey="lampGlow" />}
    </>
  );
};

export default WarehouseWorldScene;
