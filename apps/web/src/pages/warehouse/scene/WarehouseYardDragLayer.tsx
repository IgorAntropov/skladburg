import type { WarehouseReceivingArea } from '@skladburg/contracts/wms/v1/topology';
import type { ReactElement } from 'react';
import type { BoxGeometry } from 'three';

import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { WarehouseYardDragValue } from '../model/warehouseYardDockChoice';
import type {
  IWarehouseYardDragBinding,
  WarehouseYardDragContextValue,
} from './bindWarehouseYardDrag';
import type {
  WarehouseBoxValue,
  WarehouseDockLayoutValue,
} from './warehouseLayout';
import type { WarehouseYardGrabValue } from './warehouseYardDrag';
import type { WarehouseYardMotionValue } from './warehouseYardMotion';

import { bindWarehouseYardDrag } from './bindWarehouseYardDrag';
import { WarehouseInstances } from './WarehouseInstances';
import {
  readWarehouseYardGrabDocks,
  WAREHOUSE_YARD_TARGET_HALF_DEPTH,
  WAREHOUSE_YARD_TARGET_HALF_WIDTH,
  WAREHOUSE_YARD_TARGET_HEIGHT,
  WAREHOUSE_YARD_TARGET_OFFSET_Z,
} from './warehouseYardDrag';

interface WarehouseYardDragLayerProps {
  docks: readonly WarehouseDockLayoutValue[];
  drag: WarehouseYardDragValue;
  geometry: BoxGeometry;
  receivingArea: undefined | WarehouseReceivingArea;
  yard: WarehouseYardMotionValue;
}

const TARGET_LINE_SIZE = 0.085;
const YARD_TARGET_CLASS = [
  'select-none whitespace-nowrap rounded-control border border-indicator bg-panel-solid px-2 py-0.5',
  'text-xs font-semibold tabular-nums text-on-panel shadow-panel data-[hovered=true]:ring-2 data-[hovered=true]:ring-indicator',
].join(' ');

const buildDockTargetBoxes = ({ x, z }: WarehouseDockLayoutValue): WarehouseBoxValue[] => {
  const centerZ = z + WAREHOUSE_YARD_TARGET_OFFSET_Z;
  const width = WAREHOUSE_YARD_TARGET_HALF_WIDTH;
  const depth = WAREHOUSE_YARD_TARGET_HALF_DEPTH;
  return [
    { position: [x - width, WAREHOUSE_YARD_TARGET_HEIGHT, centerZ], size: [TARGET_LINE_SIZE, 0.04, 2 * depth] },
    { position: [x + width, WAREHOUSE_YARD_TARGET_HEIGHT, centerZ], size: [TARGET_LINE_SIZE, 0.04, 2 * depth] },
    { position: [x, WAREHOUSE_YARD_TARGET_HEIGHT, centerZ - depth], size: [2 * width, 0.04, TARGET_LINE_SIZE] },
    { position: [x, WAREHOUSE_YARD_TARGET_HEIGHT, centerZ + depth], size: [2 * width, 0.04, TARGET_LINE_SIZE] },
  ];
};

const WarehouseYardDragLayer = ({ docks, drag, geometry, receivingArea, yard }: WarehouseYardDragLayerProps): ReactElement => {
  const canvas = useThree(state => state.gl.domElement);
  const eventSource = useThree((state): HTMLElement | undefined => {
    const connected: unknown = state.events.connected;
    return connected instanceof HTMLElement ? connected : undefined;
  });
  const getScene = useThree(state => state.get);
  const latest = useRef<WarehouseYardDragContextValue>({ docks, drag });
  const binding = useRef<IWarehouseYardDragBinding>(undefined);
  const [grabbed, setGrabbed] = useState<WarehouseYardGrabValue>();
  const [hoveredDock, setHoveredDock] = useState<string>();
  const targetIds = grabbed === undefined ? undefined : readWarehouseYardGrabDocks(grabbed, drag.options);
  const targets = useMemo(() => docks.filter(dock => targetIds?.includes(dock.id) === true), [docks, targetIds]);
  const boxes = useMemo(() => targets.flatMap(buildDockTargetBoxes), [targets]);
  const dockCodes = useMemo(() => new Map(
    [receivingArea?.unloadingPoint, ...(receivingArea?.additionalUnloadingPoints ?? [])].map(point => [point?.id, point?.code]),
  ), [receivingArea]);

  useLayoutEffect(() => {
    latest.current = { docks, drag };
    binding.current?.sync();
  }, [docks, drag]);

  useLayoutEffect(() => {
    const controller = bindWarehouseYardDrag({
      canvas,
      getContext: () => latest.current,
      getScene,
      onGrabChange: setGrabbed,
      onHoverChange: setHoveredDock,
      root: eventSource ?? canvas,
      yard,
    });
    binding.current = controller;
    return () => {
      binding.current = undefined;
      controller.dispose();
    };
  }, [canvas, eventSource, getScene, yard]);

  return (
    <>
      <WarehouseInstances boxes={boxes} geometry={geometry} materialKey="lampGlow" />
      {targets.map(dock => (
        <Html
          center
          key={dock.id}
          position={[dock.x, WAREHOUSE_YARD_TARGET_HEIGHT, dock.z + WAREHOUSE_YARD_TARGET_OFFSET_Z]}
          wrapperClass="pointer-events-none"
        >
          <span
            aria-hidden
            className={YARD_TARGET_CLASS}
            data-dock-id={dock.id}
            data-hovered={hoveredDock === dock.id}
            data-testid="warehouse-yard-dock-target"
            translate="no"
          >
            {dockCodes.get(dock.id)}
          </span>
        </Html>
      ))}
    </>
  );
};

export default WarehouseYardDragLayer;
