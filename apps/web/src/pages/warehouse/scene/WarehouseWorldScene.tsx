import type { ThreeEvent } from '@react-three/fiber';
import type { ReactElement } from 'react';

import {
  useFrame,
  useThree,
} from '@react-three/fiber';
import {
  lazy,
  Suspense,
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
import type { WarehouseYardPlaybackClockValue } from './warehouseDockPlayback';
import type { WarehouseLayoutValue } from './warehouseLayout';
import type { WarehouseTruckModelValue } from './warehouseTruckModel';
import type { IWarehouseYardLightingRig } from './WarehouseYardLightingLayer';

import { createWarehouseGeometryKit } from './createWarehouseGeometryKit';
import { splitWarehouseDockCargo } from './warehouseDockCargo';
import { WarehouseDockLane } from './WarehouseDockLane';
import { WarehouseFloor } from './WarehouseFloor';
import { WarehouseInstances } from './WarehouseInstances';
import { getWarehouseLayout } from './warehouseLayout';
import { useWarehouseTruckModel } from './warehouseTruckModel';
import {
  advanceWarehouseYardTraffic,
  createWarehouseYardTraffic,
} from './warehouseYardTraffic';

const TAP_SLOP_PX = 5;
let WarehouseRacks: typeof import('./WarehouseRacks').default | undefined;
const WarehouseSelectedCell = lazy(() => import('./WarehouseSelectedCell'));
const WarehouseStaffFloor = lazy(() => import('./WarehouseStaffFloor'));
const WarehouseYardDragLayer = lazy(() => import('./WarehouseYardDragLayer'));
const WarehouseYardLightingLayer = lazy(() => import('./WarehouseYardLightingLayer'));
const WarehouseYardMarkings = lazy(() => import('./WarehouseYardMarkings'));

export const prepare = async ({ parkingCapacity, topology }: WarehouseSceneDataValue): Promise<void> => {
  if (getWarehouseLayout(topology, parkingCapacity).racks.frames.length > 0 && WarehouseRacks === undefined) {
    WarehouseRacks = (await import('./WarehouseRacks')).default;
  }
};

export const resolveIsNight = ({ isNight }: WarehouseSceneInteractionValue): boolean => isNight;

export const resolveWorld = ({ parkingCapacity, topology }: WarehouseSceneDataValue): SceneWorldValue =>
  getWarehouseLayout(topology, parkingCapacity).world;

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
  const lighting = useRef<IWarehouseYardLightingRig>(null);
  const playbackClock = useRef<WarehouseYardPlaybackClockValue>({
    delta: 0, isCatchingUp: false, isPaused: false, isResuming: false,
  });
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const kit = useMemo(() => createWarehouseGeometryKit(), []);
  const baseTruckModel = useWarehouseTruckModel();
  const [markedTruckModel, setMarkedTruckModel] = useState<WarehouseTruckModelValue>();
  const { hasShadows } = QUALITY_LEVEL_SETTINGS[level];
  const lastFocus = useRef<{ request: number; scan: WarehouseSceneInteractionValue['scannedCell'] }>(undefined);
  const {
    balances, cargo, construction, constructionLayer: ConstructionLayer, focusRequest, onCellSelect, scannedCell, selectedCellId, yardDrag,
  } = interaction;
  const layout = motionLayout ?? desiredLayout;
  const hasPendingLayout = layout !== desiredLayout || data.parkingCapacity !== interaction.parkingCapacity;
  const floor = <WarehouseFloor batches={layout.floor} geometry={geometry} hasShadows={hasShadows} />;
  const staffAreas = layout === desiredLayout ? interaction.staffAreas : undefined;
  const docks = layout.receiving?.docks;
  const primaryDock = layout.receiving?.dock;
  const lanes = useMemo(() => splitWarehouseDockCargo(cargo, balances, docks?.map(dock => dock.id) ?? []), [balances, cargo, docks]);
  const hasAssignedDocks = (docks?.length ?? 0) > 1;
  const activeCellId = scannedCell?.cellId ?? selectedCellId;
  const selection = activeCellId === undefined ? undefined : layout.cellsById.get(activeCellId);
  const canDragInYard = yardDrag !== undefined && yardDrag.options.size > 0 && docks !== undefined && layout.yard !== undefined
    && !hasPendingLayout && interaction.isRefreshingYardFacts !== true;

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
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        playbackClock.current.isPaused = true;
        playbackClock.current.isResuming = true;
      }
      else {
        invalidate();
      }
    };
    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [invalidate]);

  useEffect(() => {
    if (interaction.isRefreshingYardFacts !== true && !document.hidden) {
      invalidate();
    }
  }, [interaction.isRefreshingYardFacts, invalidate]);

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
    const clock = playbackClock.current;
    clock.isPaused = document.hidden || interaction.isRefreshingYardFacts === true;
    if (clock.isPaused) {
      clock.isResuming = true;
      return;
    }
    const isResuming = clock.isResuming;
    clock.delta = isResuming ? 0 : delta;
    clock.isCatchingUp ||= isResuming;
    clock.isResuming = false;
    const isMoving = advanceWarehouseYardTraffic(
      traffic, layout.yard, clock.delta, motion.current?.matches === true, hasPendingLayout, clock.isCatchingUp,
    );
    lighting.current?.paint();
    if (isMoving) {
      invalidate();
    }
    else if (!traffic.forklifts.some(Boolean)) {
      clock.isCatchingUp = false;
    }
    if (isMoving !== isYardActive.current) {
      isYardActive.current = isMoving;
      queueMicrotask(handleYardActivityChange);
    }
  }, -1);

  return (
    <>
      {staffAreas !== undefined && staffAreas.length > 0
        ? (
            <Suspense fallback={floor}>
              <WarehouseStaffFloor
                areas={staffAreas}
                geometry={geometry}
                hasShadows={hasShadows}
                interaction={interaction}
                layout={layout}
                topology={data.topology}
              />
            </Suspense>
          )
        : floor}
      {layout.racks.frames.length > 0 && WarehouseRacks !== undefined && (
        <WarehouseRacks box={geometry} layout={layout.racks} level={level} />
      )}
      {construction !== undefined && (
        <ConstructionLayer construction={construction} geometry={geometry} instances={WarehouseInstances} topology={data.topology} />
      )}
      {layout.cells.length > 0 && (
        <WarehouseInstances boxes={layout.cells} geometry={geometry} materialKey="buildingWall" onClick={handleCellClick} />
      )}
      {lanes.map((lane, index) => (
        <WarehouseDockLane
          dock={docks?.[index] ?? primaryDock}
          geometry={geometry}
          hasAssignedDocks={hasAssignedDocks}
          hasShadows={hasShadows}
          key={docks?.[index]?.id ?? 'warehouse'}
          kit={kit}
          lane={lane}
          laneIndex={index}
          layout={layout}
          playbackClock={playbackClock}
          traffic={traffic}
          truckModel={markedTruckModel ?? baseTruckModel}
        />
      ))}
      {primaryDock !== undefined && docks !== undefined && layout.yard !== undefined && (
        <Suspense fallback={null}>
          <WarehouseYardLightingLayer
            dock={primaryDock}
            docks={docks}
            geometry={geometry}
            level={level}
            rig={lighting}
            roads={layout.yard}
            traffic={traffic}
          />
        </Suspense>
      )}
      {primaryDock !== undefined && interaction.isCameraReady === true && (
        <Suspense fallback={null}>
          <WarehouseYardMarkings
            geometry={baseTruckModel.geometry}
            markings={interaction.vehicleMarkings}
            material={baseTruckModel.material}
            onModelChange={setMarkedTruckModel}
            traffic={traffic}
          />
        </Suspense>
      )}
      {canDragInYard && (
        <Suspense fallback={null}>
          <WarehouseYardDragLayer
            docks={docks}
            drag={yardDrag}
            geometry={geometry}
            receivingArea={data.topology.receivingArea}
            yard={traffic.yard}
          />
        </Suspense>
      )}
      {selection !== undefined && (
        <Suspense fallback={null}>
          <WarehouseSelectedCell cell={selection} geometry={geometry} />
        </Suspense>
      )}
    </>
  );
};

export default WarehouseWorldScene;
