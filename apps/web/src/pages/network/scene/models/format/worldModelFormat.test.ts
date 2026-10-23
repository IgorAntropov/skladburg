import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  decodeWorldModelShade,
  encodeWorldModelShade,
  readWorldModel,
  WORLD_MODEL_FORMAT_VERSION,
  WORLD_MODEL_HEADER_BYTES,
  WORLD_MODEL_MAGIC,
  WORLD_MODEL_POSITION_STEPS,
  WORLD_MODEL_ROLES,
  WORLD_MODEL_SHADE_RANGE,
} from './worldModelFormat';

interface BytesOptionsValue {
  flags?: number;
  indexCount?: number;
  indices?: readonly number[];
  magic?: number;
  max?: readonly [number, number, number];
  min?: readonly [number, number, number];
  positions?: readonly number[];
  roles?: readonly number[];
  shades?: readonly number[];
  version?: number;
  vertexCount?: number;
}

const align = (offset: number): number => Math.ceil(offset / 4) * 4;

const buildBytes = (options: BytesOptionsValue = {}): ArrayBuffer => {
  const positions = options.positions ?? [0, 0, 0, 65535, 0, 0, 0, 65535, 65535];
  const vertexCount = options.vertexCount ?? positions.length / 3;
  const roles = options.roles ?? Array.from({ length: vertexCount }, (_, index) => index);
  const shades = options.shades ?? Array.from({ length: vertexCount }, () => 128);
  const indices = options.indices ?? [0, 1, 2];
  const isWide = ((options.flags ?? 0) & 1) !== 0;
  const rolesOffset = align(WORLD_MODEL_HEADER_BYTES + positions.length * 2);
  const indicesOffset = align(rolesOffset + vertexCount * 2);
  const buffer = new ArrayBuffer(indicesOffset + indices.length * (isWide ? 4 : 2));
  const view = new DataView(buffer);
  const min = options.min ?? [-1, 0, -2];
  const max = options.max ?? [1, 3, 2];

  view.setUint32(0, options.magic ?? WORLD_MODEL_MAGIC, true);
  view.setUint16(4, options.version ?? WORLD_MODEL_FORMAT_VERSION, true);
  view.setUint16(6, options.flags ?? 0, true);
  view.setUint32(8, vertexCount, true);
  view.setUint32(12, options.indexCount ?? indices.length, true);

  for (let axis = 0; axis < 3; axis += 1) {
    view.setFloat32(16 + axis * 4, min[axis] ?? 0, true);
    view.setFloat32(28 + axis * 4, max[axis] ?? 0, true);
  }

  for (const [index, value] of positions.entries()) {
    view.setUint16(WORLD_MODEL_HEADER_BYTES + index * 2, value, true);
  }

  for (const [index, value] of roles.entries()) {
    view.setUint8(rolesOffset + index, value);
  }

  for (const [index, value] of shades.entries()) {
    view.setUint8(rolesOffset + vertexCount + index, value);
  }

  for (const [index, value] of indices.entries()) {
    if (isWide) {
      view.setUint32(indicesOffset + index * 4, value, true);
    }
    else {
      view.setUint16(indicesOffset + index * 2, value, true);
    }
  }

  return buffer;
};

describe('readWorldModel', () => {
  it('reads positions, roles, shades and indices of a valid file', () => {
    const data = readWorldModel(buildBytes());

    expect(data.vertexCount).toBe(3);
    expect(data.triangleCount).toBe(1);
    expect([...data.roles]).toEqual([0, 1, 2]);
    expect([...data.shades]).toEqual([128, 128, 128]);
    expect([...data.indices]).toEqual([0, 1, 2]);
    expect(data.indices).toBeInstanceOf(Uint16Array);
    expect(data.bounds).toEqual({ max: [1, 3, 2], min: [-1, 0, -2] });
    expect([...data.positions]).toEqual([-1, 0, -2, 1, 0, -2, -1, 3, 2]);
  });

  it('reads wide indices when the flag is set', () => {
    const data = readWorldModel(buildBytes({ flags: 1 }));

    expect(data.indices).toBeInstanceOf(Uint32Array);
    expect([...data.indices]).toEqual([0, 1, 2]);
  });

  it('reads files whose vertex count needs alignment padding', () => {
    const data = readWorldModel(buildBytes({
      indices: [0, 1, 2, 2, 1, 3],
      positions: [0, 0, 0, 65535, 0, 0, 0, 65535, 0, 0, 0, 65535],
    }));

    expect(data.vertexCount).toBe(4);
    expect([...data.indices]).toEqual([0, 1, 2, 2, 1, 3]);
  });

  it('maps a zero-length axis to its minimum', () => {
    const data = readWorldModel(buildBytes({ max: [1, 0, 2], min: [-1, 0, -2] }));

    expect(data.positions[1]).toBe(0);
    expect(data.positions[7]).toBe(0);
  });

  it('shares memory of roles, shades and indices with the source buffer', () => {
    const buffer = buildBytes();
    const data = readWorldModel(buffer);

    expect(data.roles.buffer).toBe(buffer);
    expect(data.shades.buffer).toBe(buffer);
    expect(data.indices.buffer).toBe(buffer);
  });

  it('rejects a file shorter than the header', () => {
    expect(() => readWorldModel(new ArrayBuffer(8))).toThrow('World model: file is shorter than the header');
  });

  it('rejects a foreign signature', () => {
    expect(() => readWorldModel(buildBytes({ magic: 0x12345678 }))).toThrow('World model: wrong signature');
  });

  it('rejects another version', () => {
    expect(() => readWorldModel(buildBytes({ version: 2 }))).toThrow('World model: unsupported version 2');
  });

  it('rejects unknown flags', () => {
    expect(() => readWorldModel(buildBytes({ flags: 2 }))).toThrow('World model: unsupported flags 2');
  });

  it('rejects a length that does not match the header', () => {
    const buffer = buildBytes();

    expect(() => readWorldModel(buffer.slice(0, buffer.byteLength - 2))).toThrow('World model: length');
    expect(() => readWorldModel(buildBytes({ vertexCount: 5 }))).toThrow('World model: length');
  });

  it('rejects a role outside the list', () => {
    expect(() => readWorldModel(buildBytes({ roles: [0, WORLD_MODEL_ROLES.length, 1] }))).toThrow('World model: role 10 is out of range');
  });

  it('rejects an index outside the vertices', () => {
    expect(() => readWorldModel(buildBytes({ indices: [0, 1, 3] }))).toThrow('World model: index 3 is out of range');
  });

  it('rejects an index count that is not a multiple of 3', () => {
    expect(() => readWorldModel(buildBytes({ indices: [0, 1, 2, 1] }))).toThrow('World model: index count is not a multiple of 3');
  });
});

describe('world model shade', () => {
  const [minShade, maxShade] = WORLD_MODEL_SHADE_RANGE;

  it('maps the range ends to the byte ends', () => {
    expect(encodeWorldModelShade(minShade)).toBe(0);
    expect(encodeWorldModelShade(maxShade)).toBe(255);
    expect(decodeWorldModelShade(0)).toBeCloseTo(minShade, 10);
    expect(decodeWorldModelShade(255)).toBeCloseTo(maxShade, 10);
  });

  it('clamps values outside the range and replaces non-finite ones with the neutral shade', () => {
    expect(encodeWorldModelShade(0)).toBe(0);
    expect(encodeWorldModelShade(5)).toBe(255);
    expect(encodeWorldModelShade(Number.NaN)).toBe(encodeWorldModelShade(1));
  });

  it('survives a round trip within half a step', () => {
    const halfStep = (maxShade - minShade) / 255 / 2;

    for (const shade of [0.5, 0.8, 1, 1.3, 1.65]) {
      expect(Math.abs(decodeWorldModelShade(encodeWorldModelShade(shade)) - shade)).toBeLessThanOrEqual(halfStep + 1e-9);
    }
  });

  it('keeps the position step count in sync with the 16-bit range', () => {
    expect(WORLD_MODEL_POSITION_STEPS).toBe(0xffff);
  });
});
