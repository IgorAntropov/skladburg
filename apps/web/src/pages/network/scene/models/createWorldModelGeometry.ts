import {
  BufferAttribute,
  BufferGeometry,
} from 'three';

import type { WorldModelDataValue } from './format/worldModelFormat';

import {
  decodeWorldModelShade,
  WORLD_MODEL_ROLES,
} from './format/worldModelFormat';

const POSITION_ITEM_SIZE = 3;
const UV_ITEM_SIZE = 2;
const COLOR_ITEM_SIZE = 3;
const TEXEL_CENTER = 0.5;
const SHADE_GAMMA = 2.2;

export const createWorldModelGeometry = (data: WorldModelDataValue): BufferGeometry => {
  const uvs = new Float32Array(data.vertexCount * UV_ITEM_SIZE);
  const colors = new Float32Array(data.vertexCount * COLOR_ITEM_SIZE);

  for (let vertex = 0; vertex < data.vertexCount; vertex += 1) {
    const brightness = decodeWorldModelShade(data.shades[vertex] ?? 0) ** SHADE_GAMMA;

    uvs[vertex * UV_ITEM_SIZE] = ((data.roles[vertex] ?? 0) + TEXEL_CENTER) / WORLD_MODEL_ROLES.length;
    uvs[vertex * UV_ITEM_SIZE + 1] = TEXEL_CENTER;
    colors.fill(brightness, vertex * COLOR_ITEM_SIZE, (vertex + 1) * COLOR_ITEM_SIZE);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new BufferAttribute(data.positions, POSITION_ITEM_SIZE));
  geometry.setAttribute('uv', new BufferAttribute(uvs, UV_ITEM_SIZE));
  geometry.setAttribute('color', new BufferAttribute(colors, COLOR_ITEM_SIZE));
  geometry.setIndex(new BufferAttribute(data.indices, 1));
  geometry.computeBoundingSphere();

  return geometry;
};
