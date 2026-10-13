import {
  BufferAttribute,
  BufferGeometry,
} from 'three';

import type { WorldTerrainValue } from './terrainTypes';

export const createGroundGeometry = (terrain: WorldTerrainValue): BufferGeometry => {
  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new BufferAttribute(terrain.groundPositions, 3));
  terrain.groundGroups.forEach((group, materialIndex) => {
    geometry.addGroup(group.start, group.count, materialIndex);
  });
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
};
