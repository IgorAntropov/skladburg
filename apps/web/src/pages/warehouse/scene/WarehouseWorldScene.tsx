import type { ThreeEvent } from '@react-three/fiber';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { ReactElement } from 'react';

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
import type {
  WarehouseBoxValue,
  WarehouseCellVisualValue,
} from './warehouseLayout';

import { WarehouseCargo } from './WarehouseCargo';
import { WarehouseInstances } from './WarehouseInstances';
import { getWarehouseLayout } from './warehouseLayout';

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
  }, [geometry]);

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
      {[...layout.boxes].map(([key, boxes]) => (
        <WarehouseInstances
          boxes={boxes}
          geometry={geometry}
          isShadowed={hasShadows && key !== 'ground'}
          key={key}
          materialKey={key}
        />
      ))}
      {layout.cells.length > 0 && (
        <WarehouseInstances boxes={layout.cells} geometry={geometry} materialKey="warehouseWall" onClick={handleCellClick} />
      )}
      {cargo?.dockTaskId !== undefined && [...layout.truck].map(([key, boxes]) => (
        <WarehouseInstances boxes={boxes} geometry={geometry} isShadowed={hasShadows} key={key} materialKey={key} />
      ))}
      <WarehouseCargo
        balances={balances}
        cargo={cargo ?? EMPTY_CARGO}
        geometry={geometry}
        key={cargo === undefined ? 'stock' : 'receiving'}
        layout={layout}
      />
      {selectionBoxes.length > 0 && <WarehouseInstances boxes={selectionBoxes} geometry={geometry} materialKey="lampGlow" />}
    </>
  );
};

export default WarehouseWorldScene;
