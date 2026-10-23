import {
  describe,
  expect,
  it,
} from 'vitest';

import type { VertexStyleValue } from './createVertexStyleResolver.ts';
import type { GlbMeshValue } from './parseGlb.ts';
import type { PreparedModelValue } from './prepareModel.ts';

import { WORLD_MODEL_POSITION_STEPS } from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import { prepareModel } from './prepareModel.ts';
import { writeWorldModel } from './writeWorldModel.ts';

interface TriangleValue {
  normal: VectorValue;
  points: readonly [VectorValue, VectorValue, VectorValue];
  uv?: readonly [number, number];
}

type VectorValue = readonly [number, number, number];

const UP: VectorValue = [0, 1, 0];

const FRONT: VectorValue = [0, 0, 1];

const resolveStyle = (u: number, v: number): VertexStyleValue => ({
  role: v < 0.5 ? 'mid' : 'dark',
  shadeByte: Math.round(u * 100),
});

const createMesh = (triangles: readonly TriangleValue[]): GlbMeshValue => {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (const triangle of triangles) {
    for (const point of triangle.points) {
      indices.push(positions.length / 3);
      positions.push(...point);
      normals.push(...triangle.normal);
      uvs.push(...(triangle.uv ?? [0.25, 0.25]));
    }
  }

  return {
    indices: Uint32Array.from(indices),
    normals: Float32Array.from(normals),
    positions: Float32Array.from(positions),
    uvs: Float32Array.from(uvs),
    vertexCount: positions.length / 3,
  };
};

const decodePoint = (model: PreparedModelValue, vertex: number): number[] => [0, 1, 2].map((axis) => {
  const range = (model.bounds.max[axis] ?? 0) - (model.bounds.min[axis] ?? 0);

  return (model.bounds.min[axis] ?? 0) + ((model.positions[vertex * 3 + axis] ?? 0) / WORLD_MODEL_POSITION_STEPS) * range;
});

const getTriangleNormal = (model: PreparedModelValue, triangle: number): number[] => {
  const [a = [], b = [], c = []] = [0, 1, 2].map(corner => decodePoint(model, model.indices[triangle * 3 + corner] ?? 0));
  const first = [(b[0] ?? 0) - (a[0] ?? 0), (b[1] ?? 0) - (a[1] ?? 0), (b[2] ?? 0) - (a[2] ?? 0)];
  const second = [(c[0] ?? 0) - (a[0] ?? 0), (c[1] ?? 0) - (a[1] ?? 0), (c[2] ?? 0) - (a[2] ?? 0)];

  return [
    (first[1] ?? 0) * (second[2] ?? 0) - (first[2] ?? 0) * (second[1] ?? 0),
    (first[2] ?? 0) * (second[0] ?? 0) - (first[0] ?? 0) * (second[2] ?? 0),
    (first[0] ?? 0) * (second[1] ?? 0) - (first[1] ?? 0) * (second[0] ?? 0),
  ];
};

const frontTriangle: TriangleValue = { normal: FRONT, points: [[0, 0, 0], [1, 0, 0], [1, 1, 0]] };

const upTriangle: TriangleValue = { normal: UP, points: [[0, 0, 0], [0, 0, 1], [1, 0, 0]] };

describe('prepareModel', () => {
  it('keeps the winding that already follows the set normals', () => {
    const model = prepareModel(createMesh([frontTriangle]), resolveStyle);

    expect(model.stats.flippedTriangles).toBe(0);
    expect(getTriangleNormal(model, 0)[2]).toBeGreaterThan(0);
  });

  it('flips a triangle wound against its normals', () => {
    const reversed: TriangleValue = { ...frontTriangle, points: [[0, 0, 0], [1, 1, 0], [1, 0, 0]] };
    const model = prepareModel(createMesh([reversed]), resolveStyle);

    expect(model.stats.flippedTriangles).toBe(1);
    expect(getTriangleNormal(model, 0)[2]).toBeGreaterThan(0);
  });

  it('removes faces looking straight down and keeps nearly flat ones', () => {
    const down: TriangleValue = { normal: [0, -1, 0], points: [[0, 0, 0], [1, 0, 0], [0, 0, 1]] };
    const nearlyDown: TriangleValue = { normal: [0, -0.99, 0.141], points: [[0, 0, 0], [1, 0, 0], [0, 0, 1]] };
    const almostDown: TriangleValue = { normal: [0, -0.97, 0.243], points: [[2, 0, 0], [3, 0, 0], [2, 0, 1]] };
    const model = prepareModel(createMesh([frontTriangle, down, nearlyDown, almostDown]), resolveStyle);

    expect(model.stats.downFaceTriangles).toBe(2);
    expect(model.stats.sourceTriangles).toBe(4);
    expect(model.triangleCount).toBe(2);
  });

  it('measures bounds only over faces that stay', () => {
    const lowDown: TriangleValue = { normal: [0, -1, 0], points: [[0, -5, 0], [1, -5, 0], [0, -5, 1]] };
    const model = prepareModel(createMesh([frontTriangle, lowDown]), resolveStyle);

    expect(model.bounds.max[1]).toBe(1);
    expect(model.stats.sourceSize[1]).toBe(6);
  });

  it('centres the model on X and Z and puts its bottom at Y = 0', () => {
    const shifted: TriangleValue = { normal: FRONT, points: [[2, 3, 10], [4, 3, 14], [4, 5, 14]] };
    const model = prepareModel(createMesh([shifted]), resolveStyle);

    expect(model.bounds).toEqual({ max: [1, 2, 2], min: [-1, 0, -2] });
    expect(decodePoint(model, 0)).toEqual([-1, 0, -2]);
    expect(decodePoint(model, 1)[0]).toBeCloseTo(1, 4);
    expect(decodePoint(model, 2)[1]).toBeCloseTo(2, 4);
  });

  it('quantizes the extremes to the ends of the 16-bit range', () => {
    const shifted: TriangleValue = { normal: FRONT, points: [[2, 3, 10], [4, 3, 14], [4, 5, 14]] };
    const model = prepareModel(createMesh([shifted]), resolveStyle);

    expect([...model.positions.subarray(0, 3)]).toEqual([0, 0, 0]);
    expect([...model.positions.subarray(6, 9)]).toEqual(Array.from({ length: 3 }, () => WORLD_MODEL_POSITION_STEPS));
  });

  it('welds vertices with the same position, role and shade', () => {
    const second: TriangleValue = { normal: FRONT, points: [[0, 0, 0], [1, 1, 0], [0, 1, 0]] };
    const model = prepareModel(createMesh([frontTriangle, second]), resolveStyle);

    expect(model.vertexCount).toBe(4);
    expect(model.triangleCount).toBe(2);
    expect([...model.indices]).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('does not weld vertices that differ in role or shade', () => {
    const otherRole: TriangleValue = { normal: FRONT, points: [[0, 0, 0], [1, 1, 0], [0, 1, 0]], uv: [0.25, 0.75] };
    const otherShade: TriangleValue = { normal: FRONT, points: [[0, 0, 0], [1, 1, 0], [0, 1, 0]], uv: [0.5, 0.25] };

    expect(prepareModel(createMesh([frontTriangle, otherRole]), resolveStyle).vertexCount).toBe(6);
    expect(prepareModel(createMesh([frontTriangle, otherShade]), resolveStyle).vertexCount).toBe(6);
  });

  it('welds vertices that fall into the same quantization step', () => {
    const nearby: TriangleValue = { normal: FRONT, points: [[0.000005, 0, 0], [1, 1, 0], [0, 1, 0]] };
    const model = prepareModel(createMesh([frontTriangle, nearby]), resolveStyle);

    expect(model.vertexCount).toBe(4);
  });

  it('removes triangles that collapse to a line or a point and leaves their vertices out', () => {
    const point: TriangleValue = { normal: FRONT, points: [[5, 5, 0], [5, 5, 0], [5, 5, 0]] };
    const sliver: TriangleValue = { normal: FRONT, points: [[0, 0, 0], [0.5, 0.5, 0], [1, 1, 0]] };
    const merged: TriangleValue = { normal: FRONT, points: [[0, 0, 0], [0, 0, 0], [1, 1, 0]] };
    const model = prepareModel(createMesh([frontTriangle, point, sliver, merged]), resolveStyle);

    expect(model.stats.degenerateTriangles).toBe(3);
    expect(model.triangleCount).toBe(1);
    expect(model.vertexCount).toBe(3);
  });

  it('numbers vertices in the order of first use', () => {
    const otherShade: TriangleValue = { ...frontTriangle, uv: [0.5, 0.25] };
    const model = prepareModel(createMesh([upTriangle, otherShade]), resolveStyle);

    expect(decodePoint(model, 0)[0]).toBeCloseTo(model.bounds.min[0], 4);
    expect([...model.indices.subarray(0, 3)]).toEqual([0, 1, 2]);
    expect([...model.indices.subarray(3, 6)]).toEqual([3, 4, 5]);
  });

  it('writes identical bytes on two runs', () => {
    const third: TriangleValue = { normal: FRONT, points: [[0, 0, 0], [1, 1, 0], [0, 1, 0]] };
    const triangles = [frontTriangle, upTriangle, third];
    const first = writeWorldModel(prepareModel(createMesh(triangles), resolveStyle));
    const second = writeWorldModel(prepareModel(createMesh(triangles), resolveStyle));

    expect(second).toEqual(first);
  });

  it('refuses a model where nothing is left', () => {
    const down: TriangleValue = { normal: [0, -1, 0], points: [[0, 0, 0], [1, 0, 0], [0, 0, 1]] };

    expect(() => prepareModel(createMesh([down]), resolveStyle)).toThrow('Prepare: no triangles left');
  });
});
