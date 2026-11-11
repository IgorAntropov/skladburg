import {
  BufferAttribute,
  BufferGeometry,
} from 'three';

import type { WorldTerrainValue } from './terrainTypes';

import { readNumber } from './terrainMath';

const UV_RANGE = 65535;

export const createGroundGeometry = (terrain: WorldTerrainValue): BufferGeometry => {
  const startedAt = performance.now();
  const geometry = new BufferGeometry();
  const { groundIndex, groundPositions } = terrain;
  const water = terrain.groundGroups.find(group => group.key === 'water');
  const landCount = water?.start ?? groundIndex.length;

  geometry.setAttribute('position', new BufferAttribute(groundPositions, 3));
  geometry.setIndex(new BufferAttribute(groundIndex, 1));

  if (landCount > 0) {
    geometry.addGroup(0, landCount, 0);
  }

  if (water !== undefined) {
    geometry.addGroup(water.start, water.count, 1);
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const minX = geometry.boundingBox?.min.x ?? 0;
  const minZ = geometry.boundingBox?.min.z ?? 0;
  const rangeX = (geometry.boundingBox?.max.x ?? 1) - minX;
  const rangeZ = (geometry.boundingBox?.max.z ?? 1) - minZ;
  const uv = new Uint16Array(groundPositions.length / 3 * 2);

  for (let vertex = 0; vertex < groundPositions.length / 3; vertex += 1) {
    uv[vertex * 2] = Math.round((readNumber(groundPositions, vertex * 3) - minX) * UV_RANGE / rangeX);
    uv[vertex * 2 + 1] = Math.round((readNumber(groundPositions, vertex * 3 + 2) - minZ) * UV_RANGE / rangeZ);
  }

  const colors = new Uint8Array(groundPositions.length);
  geometry.setAttribute('uv', new BufferAttribute(uv, 2, true));
  geometry.setAttribute('color', new BufferAttribute(colors, 3, true));

  performance.measure('WorldTerrain.geometry', {
    detail: { bufferBytes: colors.byteLength + groundIndex.byteLength + groundPositions.byteLength + uv.byteLength },
    end: performance.now(),
    start: startedAt,
  });

  return geometry;
};
