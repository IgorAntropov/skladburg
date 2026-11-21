import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type {
  ReactElement,
  RefObject,
} from 'react';
import type { BufferGeometry } from 'three';

import {
  useFrame,
  useThree,
} from '@react-three/fiber';
import {
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import type {
  WarehouseSceneInteractionValue,
  WarehouseSceneStaffAreaValue,
} from '../model/warehouseSceneInteraction';
import type { WarehouseStaffLabelBoundsValue } from './createWarehouseStaffOverlay';
import type { WarehouseLayoutValue } from './warehouseLayout';

import { createWarehouseStaffOverlay } from './createWarehouseStaffOverlay';
import { WarehouseFloor } from './WarehouseFloor';
import { buildWarehouseStaffLayout } from './warehouseStaffLayout';

interface WarehouseStaffFloorProps {
  areas: readonly WarehouseSceneStaffAreaValue[];
  bounds: RefObject<readonly WarehouseStaffLabelBoundsValue[]>;
  geometry: BufferGeometry;
  hasShadows: boolean;
  interaction: WarehouseSceneInteractionValue;
  layout: WarehouseLayoutValue;
  topology: WarehouseTopology;
}

const WarehouseStaffFloor = ({
  areas, bounds, geometry, hasShadows, interaction, layout, topology,
}: WarehouseStaffFloorProps): ReactElement => {
  const canvas = useThree(state => state.gl.domElement);
  const invalidate = useThree(state => state.invalidate);
  const overlay = useRef<ReturnType<typeof createWarehouseStaffOverlay>>(undefined);
  const placement = useMemo(() => buildWarehouseStaffLayout(areas, topology, layout), [areas, layout, topology]);
  const { formatStaffOverflow, onStaffSelect, selectedStaffId, staffOverlayHost } = interaction;

  useLayoutEffect(() => {
    const host = staffOverlayHost?.current;
    if (host == null) {
      return undefined;
    }
    const current = createWarehouseStaffOverlay(canvas, host, bounds);
    overlay.current = current;
    return (): void => {
      current.dispose();
      overlay.current = undefined;
    };
  }, [bounds, canvas, staffOverlayHost]);

  useLayoutEffect(() => {
    overlay.current?.update(placement, { formatStaffOverflow, onStaffSelect, selectedStaffId });
    invalidate();
  }, [canvas, formatStaffOverflow, invalidate, onStaffSelect, placement, selectedStaffId, staffOverlayHost]);

  useFrame(({ camera, size }) => {
    overlay.current?.project(camera, size.width, size.height);
  }, -0.25);

  return <WarehouseFloor batches={placement.floor} geometry={geometry} hasShadows={hasShadows} />;
};

export default WarehouseStaffFloor;
