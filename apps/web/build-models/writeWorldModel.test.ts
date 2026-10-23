import {
  describe,
  expect,
  it,
} from 'vitest';

import type { PreparedModelValue } from './prepareModel.ts';

import {
  decodeWorldModelShade,
  readWorldModel,
  WORLD_MODEL_HEADER_BYTES,
  WORLD_MODEL_POSITION_STEPS,
  WORLD_MODEL_ROLES,
} from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import { writeWorldModel } from './writeWorldModel.ts';

const createModel = (vertexCount: number, triangleCount: number): PreparedModelValue => {
  const positions = new Uint16Array(vertexCount * 3);
  const roles = new Uint8Array(vertexCount);
  const shades = new Uint8Array(vertexCount);
  const indices = new Uint32Array(triangleCount * 3);

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    positions[vertex * 3] = (vertex * 7) % (WORLD_MODEL_POSITION_STEPS + 1);
    positions[vertex * 3 + 1] = (vertex * 13) % (WORLD_MODEL_POSITION_STEPS + 1);
    positions[vertex * 3 + 2] = (vertex * 29) % (WORLD_MODEL_POSITION_STEPS + 1);
    roles[vertex] = vertex % WORLD_MODEL_ROLES.length;
    shades[vertex] = (vertex * 5) % 256;
  }

  for (let index = 0; index < indices.length; index += 1) {
    indices[index] = (index * 3 + 1) % vertexCount;
  }

  return {
    bounds: { max: [1.5, 3, 2.25], min: [-1.5, 0, -2.25] },
    indices,
    positions,
    roles,
    shades,
    stats: {
      degenerateTriangles: 0,
      downFaceTriangles: 0,
      flippedTriangles: 0,
      keptVertices: vertexCount,
      sourceSize: [3, 3, 4.5],
      sourceTriangles: triangleCount,
      sourceVertices: vertexCount,
    },
    triangleCount,
    vertexCount,
  };
};

describe('writeWorldModel', () => {
  it.each([3, 4, 5, 6])('reads back the same data for %i vertices', (vertexCount) => {
    const model = createModel(vertexCount, 4);
    const data = readWorldModel(writeWorldModel(model).buffer);

    expect(data.vertexCount).toBe(vertexCount);
    expect(data.triangleCount).toBe(4);
    expect([...data.roles]).toEqual([...model.roles]);
    expect([...data.shades]).toEqual([...model.shades]);
    expect([...data.indices]).toEqual([...model.indices]);
    expect(data.indices).toBeInstanceOf(Uint16Array);
  });

  it('restores positions within one quantization step', () => {
    const model = createModel(40, 6);
    const data = readWorldModel(writeWorldModel(model).buffer);

    for (let index = 0; index < model.positions.length; index += 1) {
      const axis = index % 3;
      const range = (model.bounds.max[axis] ?? 0) - (model.bounds.min[axis] ?? 0);
      const expected = (model.bounds.min[axis] ?? 0) + ((model.positions[index] ?? 0) / WORLD_MODEL_POSITION_STEPS) * range;

      expect(Math.abs((data.positions[index] ?? 0) - expected)).toBeLessThanOrEqual(range / WORLD_MODEL_POSITION_STEPS);
    }
  });

  it('stores the bounds and decodes shades into the range', () => {
    const data = readWorldModel(writeWorldModel(createModel(5, 2)).buffer);

    expect(data.bounds).toEqual({ max: [1.5, 3, 2.25], min: [-1.5, 0, -2.25] });
    expect(decodeWorldModelShade(data.shades[1] ?? 0)).toBeGreaterThan(0.45);
  });

  it('switches to 32-bit indices above 65536 vertices', () => {
    const model = createModel(70000, 2);
    const bytes = writeWorldModel(model);
    const data = readWorldModel(bytes.buffer);

    expect(data.indices).toBeInstanceOf(Uint32Array);
    expect([...data.indices]).toEqual([...model.indices]);
    expect(data.vertexCount).toBe(70000);
  });

  it('keeps 16-bit indices at exactly 65536 vertices', () => {
    const model = createModel(65536, 1);
    const data = readWorldModel(writeWorldModel(model).buffer);

    expect(data.indices).toBeInstanceOf(Uint16Array);
  });

  it('pads blocks to 4 bytes and ends exactly after the indices', () => {
    const odd = writeWorldModel(createModel(5, 2));
    const even = writeWorldModel(createModel(4, 2));

    expect(odd.length).toBe(WORLD_MODEL_HEADER_BYTES + 30 + 2 + 5 + 5 + 2 + 12);
    expect(even.length).toBe(WORLD_MODEL_HEADER_BYTES + 24 + 4 + 4 + 12);
  });
});
