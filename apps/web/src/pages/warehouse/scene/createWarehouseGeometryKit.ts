import {
  BufferGeometry,
  Float32BufferAttribute,
} from 'three';

import warehouseKit from './warehouseKit.json';

export type WarehouseGeometryKitValue = ReturnType<typeof createWarehouseGeometryKit>;

interface WarehouseKitPartValue {
  indices: number[];
  positions: number[];
}

const createGeometry = ({ indices, positions }: WarehouseKitPartValue): BufferGeometry => {
  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
};

export const createWarehouseGeometryKit = (): Record<keyof typeof warehouseKit, BufferGeometry> => ({
  palletBase: createGeometry(warehouseKit.palletBase),
  palletBoards: createGeometry(warehouseKit.palletBoards),
  palletLoad: createGeometry(warehouseKit.palletLoad),
  rackDeck: createGeometry(warehouseKit.rackDeck),
  rackDeckLow: createGeometry(warehouseKit.rackDeckLow),
  rackFrame: createGeometry(warehouseKit.rackFrame),
  rackFrameLow: createGeometry(warehouseKit.rackFrameLow),
  rackRail: createGeometry(warehouseKit.rackRail),
  rackRailLow: createGeometry(warehouseKit.rackRailLow),
});
