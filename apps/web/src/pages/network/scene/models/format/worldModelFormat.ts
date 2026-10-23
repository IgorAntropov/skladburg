export const WORLD_MODEL_MAGIC = 0x4c444d57;

export const WORLD_MODEL_FORMAT_VERSION = 1;

export const WORLD_MODEL_HEADER_BYTES = 40;

export const WORLD_MODEL_ROLES = [
  'light',
  'mid',
  'dark',
  'glass',
  'green',
  'orange',
  'amber',
  'yellow',
  'red',
  'terracotta',
] as const;

export type WorldModelRoleValue = (typeof WORLD_MODEL_ROLES)[number];

export const WORLD_MODEL_SHADE_RANGE = [0.45, 1.7] as const;

export const WORLD_MODEL_POSITION_STEPS = 65535;

export const WORLD_MODEL_WIDE_INDEX_FLAG = 1;

export interface WorldModelBoundsValue {
  max: readonly [number, number, number];
  min: readonly [number, number, number];
}

export interface WorldModelDataValue {
  bounds: WorldModelBoundsValue;
  indices: Uint16Array | Uint32Array;
  positions: Float32Array;
  roles: Uint8Array;
  shades: Uint8Array;
  triangleCount: number;
  vertexCount: number;
}

const VERSION_OFFSET = 4;

const FLAGS_OFFSET = 6;

const VERTEX_COUNT_OFFSET = 8;

const INDEX_COUNT_OFFSET = 12;

const BOUNDS_MIN_OFFSET = 16;

const BOUNDS_MAX_OFFSET = 28;

const AXIS_COUNT = 3;

const FLOAT32_BYTES = 4;

const UINT16_BYTES = 2;

const UINT32_BYTES = 4;

const ALIGNMENT_BYTES = 4;

const SHADE_STEPS = 255;

const TRIANGLE_CORNERS = 3;

const [MIN_SHADE, MAX_SHADE] = WORLD_MODEL_SHADE_RANGE;

const createError = (reason: string): Error => new Error(`World model: ${reason}`);

const alignUp = (offset: number): number => Math.ceil(offset / ALIGNMENT_BYTES) * ALIGNMENT_BYTES;

const readVector = (view: DataView, offset: number): [number, number, number] => [
  view.getFloat32(offset, true),
  view.getFloat32(offset + FLOAT32_BYTES, true),
  view.getFloat32(offset + FLOAT32_BYTES * 2, true),
];

export const encodeWorldModelShade = (shade: number): number => {
  if (!Number.isFinite(shade)) {
    return encodeWorldModelShade(1);
  }

  const scaled = Math.round(((shade - MIN_SHADE) / (MAX_SHADE - MIN_SHADE)) * SHADE_STEPS);

  return Math.min(SHADE_STEPS, Math.max(0, scaled));
};

export const decodeWorldModelShade = (value: number): number => MIN_SHADE + (value / SHADE_STEPS) * (MAX_SHADE - MIN_SHADE);

export const readWorldModel = (buffer: ArrayBuffer): WorldModelDataValue => {
  if (buffer.byteLength < WORLD_MODEL_HEADER_BYTES) {
    throw createError('file is shorter than the header');
  }

  const view = new DataView(buffer);

  if (view.getUint32(0, true) !== WORLD_MODEL_MAGIC) {
    throw createError('wrong signature');
  }

  const version = view.getUint16(VERSION_OFFSET, true);

  if (version !== WORLD_MODEL_FORMAT_VERSION) {
    throw createError(`unsupported version ${String(version)}`);
  }

  const flags = view.getUint16(FLAGS_OFFSET, true);

  if ((flags & ~WORLD_MODEL_WIDE_INDEX_FLAG) !== 0) {
    throw createError(`unsupported flags ${String(flags)}`);
  }

  const vertexCount = view.getUint32(VERTEX_COUNT_OFFSET, true);
  const indexCount = view.getUint32(INDEX_COUNT_OFFSET, true);

  if (indexCount % TRIANGLE_CORNERS !== 0) {
    throw createError('index count is not a multiple of 3');
  }

  const isWideIndex = (flags & WORLD_MODEL_WIDE_INDEX_FLAG) !== 0;
  const indexBytes = isWideIndex ? UINT32_BYTES : UINT16_BYTES;
  const positionsOffset = WORLD_MODEL_HEADER_BYTES;
  const rolesOffset = alignUp(positionsOffset + vertexCount * AXIS_COUNT * UINT16_BYTES);
  const shadesOffset = rolesOffset + vertexCount;
  const indicesOffset = alignUp(shadesOffset + vertexCount);
  const expectedLength = indicesOffset + indexCount * indexBytes;

  if (buffer.byteLength !== expectedLength) {
    throw createError(`length ${String(buffer.byteLength)} does not match ${String(expectedLength)}`);
  }

  const min = readVector(view, BOUNDS_MIN_OFFSET);
  const max = readVector(view, BOUNDS_MAX_OFFSET);
  const positions = new Float32Array(vertexCount * AXIS_COUNT);

  for (let index = 0; index < positions.length; index += 1) {
    const axis = index % AXIS_COUNT;
    const axisMin = min[axis] ?? 0;
    const axisMax = max[axis] ?? 0;
    const quantized = view.getUint16(positionsOffset + index * UINT16_BYTES, true);

    positions[index] = axisMin + (quantized / WORLD_MODEL_POSITION_STEPS) * (axisMax - axisMin);
  }

  const roles = new Uint8Array(buffer, rolesOffset, vertexCount);
  const shades = new Uint8Array(buffer, shadesOffset, vertexCount);
  const indices = isWideIndex ? new Uint32Array(buffer, indicesOffset, indexCount) : new Uint16Array(buffer, indicesOffset, indexCount);

  for (const role of roles) {
    if (role >= WORLD_MODEL_ROLES.length) {
      throw createError(`role ${String(role)} is out of range`);
    }
  }

  for (const index of indices) {
    if (index >= vertexCount) {
      throw createError(`index ${String(index)} is out of range`);
    }
  }

  return {
    bounds: { max, min },
    indices,
    positions,
    roles,
    shades,
    triangleCount: indexCount / TRIANGLE_CORNERS,
    vertexCount,
  };
};
