import type { ReactElement } from 'react';
import type { BufferGeometry } from 'three';

import { useMemo } from 'react';

import type {
  WarehouseBoxValue,
  WarehouseCellVisualValue,
} from './warehouseLayout';

import { WarehouseInstances } from './WarehouseInstances';

interface WarehouseSelectedCellProps {
  cell: WarehouseCellVisualValue;
  geometry: BufferGeometry;
}

const WarehouseSelectedCell = ({ cell, geometry }: WarehouseSelectedCellProps): ReactElement => {
  const boxes = useMemo((): WarehouseBoxValue[] => {
    const { position: [x, y, z], size: [width, , depth] } = cell;
    const line = Math.min(0.055, width / 8);
    return [
      { position: [x, y + 0.03, z - depth / 2], size: [width, 0.034, line] },
      { position: [x, y + 0.03, z + depth / 2], size: [width, 0.034, line] },
      { position: [x - width / 2, y + 0.03, z], size: [line, 0.034, depth] },
      { position: [x + width / 2, y + 0.03, z], size: [line, 0.034, depth] },
    ];
  }, [cell]);
  return <WarehouseInstances boxes={boxes} geometry={geometry} materialKey="lampGlow" />;
};

export default WarehouseSelectedCell;
