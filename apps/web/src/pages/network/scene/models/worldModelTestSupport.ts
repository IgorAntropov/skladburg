import type { WorldPaletteValue } from '@/shared/3d';

import { readWorldPalette } from '@/shared/3d';

import type {
  WorldModelBoundsValue,
  WorldModelDataValue,
} from './format/worldModelFormat';

import {
  WORLD_MODEL_FORMAT_VERSION,
  WORLD_MODEL_HEADER_BYTES,
  WORLD_MODEL_MAGIC,
} from './format/worldModelFormat';

interface TestWorldModelOptionsValue {
  bounds?: WorldModelBoundsValue;
  roles?: readonly number[];
  shades?: readonly number[];
}

const DEFAULT_BOUNDS: WorldModelBoundsValue = { max: [1, 1, 0.5], min: [-1, 0, -0.5] };
const CHANNEL_STEPS = [7, 13, 29] as const;
const CHANNEL_RANGE = 256;
const TEST_ROLES_OFFSET = 60;
const TEST_INDICES_OFFSET = 68;
const TEST_BYTES_LENGTH = 74;

export const createTestWorldModel = (options: TestWorldModelOptionsValue = {}): WorldModelDataValue => {
  const roles = Uint8Array.from(options.roles ?? [0, 3, 9]);
  const shades = Uint8Array.from(options.shades ?? [0, 128, 255]);

  return {
    bounds: options.bounds ?? DEFAULT_BOUNDS,
    indices: Uint16Array.from([0, 1, 2]),
    positions: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    roles,
    shades,
    triangleCount: 1,
    vertexCount: roles.length,
  };
};

export const createTestWorldModelBytes = (): ArrayBuffer => {
  const buffer = new ArrayBuffer(TEST_BYTES_LENGTH);
  const view = new DataView(buffer);

  view.setUint32(0, WORLD_MODEL_MAGIC, true);
  view.setUint16(4, WORLD_MODEL_FORMAT_VERSION, true);
  view.setUint32(8, 3, true);
  view.setUint32(12, 3, true);
  view.setFloat32(16, -1, true);
  view.setFloat32(24, -0.5, true);
  view.setFloat32(28, 1, true);
  view.setFloat32(32, 1, true);
  view.setFloat32(36, 0.5, true);
  view.setUint16(WORLD_MODEL_HEADER_BYTES + 6, 65535, true);
  view.setUint16(WORLD_MODEL_HEADER_BYTES + 14, 65535, true);
  view.setUint8(TEST_ROLES_OFFSET + 1, 1);
  view.setUint8(TEST_ROLES_OFFSET + 2, 2);
  view.setUint16(TEST_INDICES_OFFSET + 2, 1, true);
  view.setUint16(TEST_INDICES_OFFSET + 4, 2, true);

  return buffer;
};

export const createTestPalette = (offset: number): WorldPaletteValue => {
  const indexByName = new Map<string, number>();

  return readWorldPalette((name) => {
    const index = indexByName.get(name) ?? indexByName.size;

    indexByName.set(name, index);

    const [red, green, blue] = CHANNEL_STEPS.map(step => (index * step + offset) % CHANNEL_RANGE);

    return `rgb(${String(red)} ${String(green)} ${String(blue)})`;
  });
};
