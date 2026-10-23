import type { PreparedModelValue } from './prepareModel.ts';

import {
  WORLD_MODEL_FORMAT_VERSION,
  WORLD_MODEL_HEADER_BYTES,
  WORLD_MODEL_MAGIC,
  WORLD_MODEL_WIDE_INDEX_FLAG,
} from '../src/pages/network/scene/models/format/worldModelFormat.ts';

type WritableModelValue = Pick<
  PreparedModelValue,
  'bounds' | 'indices' | 'positions' | 'roles' | 'shades' | 'triangleCount' | 'vertexCount'
>;

const MAX_NARROW_VERTEX_COUNT = 65536;

const AXIS_COUNT = 3;

const FLOAT32_BYTES = 4;

const UINT16_BYTES = 2;

const UINT32_BYTES = 4;

const ALIGNMENT_BYTES = 4;

const TRIANGLE_CORNERS = 3;

const alignUp = (offset: number): number => Math.ceil(offset / ALIGNMENT_BYTES) * ALIGNMENT_BYTES;

export const writeWorldModel = (model: WritableModelValue): Uint8Array<ArrayBuffer> => {
  const isWideIndex = model.vertexCount > MAX_NARROW_VERTEX_COUNT;
  const indexCount = model.triangleCount * TRIANGLE_CORNERS;
  const indexBytes = isWideIndex ? UINT32_BYTES : UINT16_BYTES;
  const rolesOffset = alignUp(WORLD_MODEL_HEADER_BYTES + model.vertexCount * AXIS_COUNT * UINT16_BYTES);
  const shadesOffset = rolesOffset + model.vertexCount;
  const indicesOffset = alignUp(shadesOffset + model.vertexCount);
  const bytes = new Uint8Array(indicesOffset + indexCount * indexBytes);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, WORLD_MODEL_MAGIC, true);
  view.setUint16(4, WORLD_MODEL_FORMAT_VERSION, true);
  view.setUint16(6, isWideIndex ? WORLD_MODEL_WIDE_INDEX_FLAG : 0, true);
  view.setUint32(8, model.vertexCount, true);
  view.setUint32(12, indexCount, true);

  for (let axis = 0; axis < AXIS_COUNT; axis += 1) {
    view.setFloat32(16 + axis * FLOAT32_BYTES, model.bounds.min[axis] ?? 0, true);
    view.setFloat32(28 + axis * FLOAT32_BYTES, model.bounds.max[axis] ?? 0, true);
  }

  for (let index = 0; index < model.vertexCount * AXIS_COUNT; index += 1) {
    view.setUint16(WORLD_MODEL_HEADER_BYTES + index * UINT16_BYTES, model.positions[index] ?? 0, true);
  }

  bytes.set(model.roles, rolesOffset);
  bytes.set(model.shades, shadesOffset);

  for (let index = 0; index < indexCount; index += 1) {
    const value = model.indices[index] ?? 0;

    if (isWideIndex) {
      view.setUint32(indicesOffset + index * UINT32_BYTES, value, true);
    }
    else {
      view.setUint16(indicesOffset + index * UINT16_BYTES, value, true);
    }
  }

  return bytes;
};
