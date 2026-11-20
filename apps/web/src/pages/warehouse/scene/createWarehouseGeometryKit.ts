import {
  BufferGeometry,
  Float32BufferAttribute,
} from 'three';

import warehouseKit from './warehouseKit.json';

export type WarehouseGeometryKitValue = Record<'palletBase' | 'palletBoards' | 'palletLoad', BufferGeometry>;

interface WarehouseKitPartValue {
  indices: number[];
  positions: number[];
}

export const createWarehousePartGeometry = ({ indices, positions }: WarehouseKitPartValue): BufferGeometry => {
  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
};

export const createWarehouseGeometryKit = (): WarehouseGeometryKitValue => ({
  palletBase: createWarehousePartGeometry(warehouseKit.palletBase),
  palletBoards: createWarehousePartGeometry(warehouseKit.palletBoards),
  palletLoad: createWarehousePartGeometry(warehouseKit.palletLoad),
});
