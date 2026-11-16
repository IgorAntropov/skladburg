import type { ThreeEvent } from '@react-three/fiber';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { ReactElement } from 'react';
import type { Group } from 'three';

import {
  useEffect,
  useMemo,
  useRef,
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

import type { WarehouseCargoValue } from '../model/warehouseSceneCargo';
import type { WarehouseSceneInteractionValue } from '../model/warehouseSceneInteraction';
import type { WarehouseForkliftRigValue } from './WarehouseForklift';
import type {
  WarehouseBoxValue,
  WarehouseCellVisualValue,
} from './warehouseLayout';

import { createWarehouseGeometryKit } from './createWarehouseGeometryKit';
import { WarehouseCargo } from './WarehouseCargo';
import { WarehouseFloor } from './WarehouseFloor';
import { WarehouseForklift } from './WarehouseForklift';
import { WarehouseInstances } from './WarehouseInstances';
import { getWarehouseLayout } from './warehouseLayout';
import { WarehouseRacks } from './WarehouseRacks';

const TAP_SLOP_PX = 5;
const EMPTY_CARGO: WarehouseCargoValue = { dockTaskId: undefined, hasDock: false, units: [] };

export const prepare = (topology: WarehouseTopology): Promise<void> => {
  getWarehouseLayout(topology);
  return Promise.resolve();
};

export const resolveWorld = (topology: WarehouseTopology): SceneWorldValue => getWarehouseLayout(topology).world;

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
}: SceneContentProps<WarehouseTopology, WarehouseSceneInteractionValue>): ReactElement => {
  const rig = useSceneCameraRig();
  const layout = getWarehouseLayout(data);
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const kit = useMemo(() => createWarehouseGeometryKit(), []);
  const dockTruck = useRef<Group>(null);
  const forklift = useRef<WarehouseForkliftRigValue>(null);
  const { hasShadows } = QUALITY_LEVEL_SETTINGS[level];
  const lastFocus = useRef<{ request: number; scan: WarehouseSceneInteractionValue['scannedCell'] }>(undefined);
  const { balances, cargo, focusRequest, onCellSelect, scannedCell, selectedCellId } = interaction;
  const activeCellId = scannedCell?.cellId ?? selectedCellId;
  const selection = activeCellId === undefined ? undefined : layout.cellsById.get(activeCellId);
  const selectionBoxes = buildSelectionBoxes(selection);

  const handleCellClick = (event: ThreeEvent<MouseEvent>): void => {
    const cell = event.instanceId === undefined ? undefined : layout.cells[event.instanceId];
    if (cell !== undefined && event.delta <= TAP_SLOP_PX) {
      event.stopPropagation();
      onCellSelect(cell.id);
    }
  };

  useEffect(() => (): void => {
    geometry.dispose();
    for (const part of Object.values(kit)) {
      part.dispose();
    }
  }, [geometry, kit]);

  useEffect(() => {
    const prev = lastFocus.current;
    const isRequested = prev?.request !== focusRequest || (scannedCell !== undefined && prev.scan !== scannedCell);
    lastFocus.current = { request: focusRequest, scan: scannedCell };

    if (isRequested && selection !== undefined) {
      const [x, y, z] = selection.position;
      rig.current?.flyTo({ x, y, z });
    }
  }, [focusRequest, rig, scannedCell, selection]);

  return (
    <>
      <WarehouseFloor batches={layout.floor} geometry={geometry} hasShadows={hasShadows} />
      <WarehouseRacks box={geometry} kit={kit} layout={layout.racks} level={level} />
      {layout.cells.length > 0 && (
        <WarehouseInstances boxes={layout.cells} geometry={geometry} materialKey="buildingWall" onClick={handleCellClick} />
      )}
      {cargo?.hasDock === true && (
        <group name="warehouse-dock-truck" ref={dockTruck} visible={false}>
          {[...layout.truck].map(([key, boxes]) => (
            <WarehouseInstances boxes={boxes} geometry={geometry} key={key} materialKey={key} />
          ))}
        </group>
      )}
      <WarehouseForklift rig={forklift} />
      <WarehouseCargo
        balances={balances}
        cargo={cargo ?? EMPTY_CARGO}
        dockTruck={dockTruck}
        forklift={forklift}
        geometry={geometry}
        hasShadows={hasShadows}
        key={cargo === undefined ? 'stock' : 'receiving'}
        kit={kit}
        layout={layout}
      />
      {selectionBoxes.length > 0 && <WarehouseInstances boxes={selectionBoxes} geometry={geometry} materialKey="lampGlow" />}
    </>
  );
};

export default WarehouseWorldScene;
