import type { WorldModelBoundsValue } from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import type { VertexStyleValue } from './createVertexStyleResolver.ts';
import type { GlbMeshValue } from './parseGlb.ts';

import {
  WORLD_MODEL_POSITION_STEPS,
  WORLD_MODEL_ROLES,
} from '../src/pages/network/scene/models/format/worldModelFormat.ts';

export interface PreparedModelValue {
  bounds: WorldModelBoundsValue;
  indices: Uint32Array;
  positions: Uint16Array;
  roles: Uint8Array;
  shades: Uint8Array;
  stats: PrepareStatsValue;
  triangleCount: number;
  vertexCount: number;
}

export interface PrepareStatsValue {
  degenerateTriangles: number;
  downFaceTriangles: number;
  flippedTriangles: number;
  keptVertices: number;
  sourceSize: readonly [number, number, number];
  sourceTriangles: number;
  sourceVertices: number;
}

export const DOWN_FACE_NORMAL_Y = -0.98;

const AXIS_COUNT = 3;

const TRIANGLE_CORNERS = 3;

const getAxisSize = (positions: Float32Array, vertexIds: Iterable<number>): { max: number[]; min: number[] } => {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

  for (const vertexId of vertexIds) {
    for (let axis = 0; axis < AXIS_COUNT; axis += 1) {
      const value = positions[vertexId * AXIS_COUNT + axis] ?? 0;

      min[axis] = Math.min(min[axis] ?? value, value);
      max[axis] = Math.max(max[axis] ?? value, value);
    }
  }

  return { max, min };
};

const readVector = (values: Float32Array, vertexId: number): [number, number, number] => [
  values[vertexId * AXIS_COUNT] ?? 0,
  values[vertexId * AXIS_COUNT + 1] ?? 0,
  values[vertexId * AXIS_COUNT + 2] ?? 0,
];

const subtract = (current: readonly number[], prev: readonly number[]): [number, number, number] => [
  (current[0] ?? 0) - (prev[0] ?? 0),
  (current[1] ?? 0) - (prev[1] ?? 0),
  (current[2] ?? 0) - (prev[2] ?? 0),
];

const cross = (current: readonly number[], prev: readonly number[]): [number, number, number] => [
  (current[1] ?? 0) * (prev[2] ?? 0) - (current[2] ?? 0) * (prev[1] ?? 0),
  (current[2] ?? 0) * (prev[0] ?? 0) - (current[0] ?? 0) * (prev[2] ?? 0),
  (current[0] ?? 0) * (prev[1] ?? 0) - (current[1] ?? 0) * (prev[0] ?? 0),
];

const dot = (current: readonly number[], prev: readonly number[]): number => (
  (current[0] ?? 0) * (prev[0] ?? 0) + (current[1] ?? 0) * (prev[1] ?? 0) + (current[2] ?? 0) * (prev[2] ?? 0)
);

const sumNormals = (normals: Float32Array, corners: readonly number[]): [number, number, number] => {
  const total: [number, number, number] = [0, 0, 0];

  for (const corner of corners) {
    const normal = readVector(normals, corner);

    total[0] += normal[0];
    total[1] += normal[1];
    total[2] += normal[2];
  }

  return total;
};

export const prepareModel = (
  mesh: GlbMeshValue,
  resolveStyle: (u: number, v: number) => VertexStyleValue,
): PreparedModelValue => {
  const sourceTriangleCount = mesh.indices.length / TRIANGLE_CORNERS;
  const keptCorners: number[] = [];
  let flippedTriangles = 0;
  let downFaceTriangles = 0;

  for (let triangle = 0; triangle < sourceTriangleCount; triangle += 1) {
    const corners = [
      mesh.indices[triangle * TRIANGLE_CORNERS] ?? 0,
      mesh.indices[triangle * TRIANGLE_CORNERS + 1] ?? 0,
      mesh.indices[triangle * TRIANGLE_CORNERS + 2] ?? 0,
    ];
    const [first = 0, second = 0, third = 0] = corners;
    const geometricNormal = cross(
      subtract(readVector(mesh.positions, second), readVector(mesh.positions, first)),
      subtract(readVector(mesh.positions, third), readVector(mesh.positions, first)),
    );
    const setNormal = sumNormals(mesh.normals, corners);
    const setNormalLength = Math.hypot(...setNormal);

    if (setNormalLength > 0 && setNormal[1] / setNormalLength <= DOWN_FACE_NORMAL_Y) {
      downFaceTriangles += 1;
      continue;
    }

    if (dot(geometricNormal, setNormal) < 0) {
      flippedTriangles += 1;
      keptCorners.push(first, third, second);
    }
    else {
      keptCorners.push(first, second, third);
    }
  }

  if (keptCorners.length === 0) {
    throw new Error('Prepare: no triangles left');
  }

  const keptVertexIds = new Set(keptCorners);
  const sourceExtent = getAxisSize(mesh.positions, Array.from({ length: mesh.vertexCount }, (_, index) => index));
  const keptExtent = getAxisSize(mesh.positions, keptVertexIds);
  const size = keptExtent.max.map((value, axis) => value - (keptExtent.min[axis] ?? 0));
  const origin = [
    ((keptExtent.max[0] ?? 0) + (keptExtent.min[0] ?? 0)) / 2,
    keptExtent.min[1] ?? 0,
    ((keptExtent.max[2] ?? 0) + (keptExtent.min[2] ?? 0)) / 2,
  ];
  const boundsMin: [number, number, number] = [Math.fround(-(size[0] ?? 0) / 2), 0, Math.fround(-(size[2] ?? 0) / 2)];
  const boundsMax: [number, number, number] = [Math.fround((size[0] ?? 0) / 2), Math.fround(size[1] ?? 0), Math.fround((size[2] ?? 0) / 2)];

  const quantizeVertex = (vertexId: number): [number, number, number] => {
    const quantized: [number, number, number] = [0, 0, 0];

    for (let axis = 0; axis < AXIS_COUNT; axis += 1) {
      const centered = (mesh.positions[vertexId * AXIS_COUNT + axis] ?? 0) - (origin[axis] ?? 0);
      const axisMin = boundsMin[axis] ?? 0;
      const range = (boundsMax[axis] ?? 0) - axisMin;
      const step = range === 0 ? 0 : Math.round(((centered - axisMin) / range) * WORLD_MODEL_POSITION_STEPS);

      quantized[axis] = Math.min(WORLD_MODEL_POSITION_STEPS, Math.max(0, step));
    }

    return quantized;
  };

  const vertexIdByKey = new Map<string, number>();
  const positions: number[] = [];
  const roles: number[] = [];
  const shades: number[] = [];
  const indices: number[] = [];
  let degenerateTriangles = 0;

  for (let triangle = 0; triangle < keptCorners.length / TRIANGLE_CORNERS; triangle += 1) {
    const corners = keptCorners.slice(triangle * TRIANGLE_CORNERS, triangle * TRIANGLE_CORNERS + TRIANGLE_CORNERS);
    const cornerData = corners.map((vertexId) => {
      const quantized = quantizeVertex(vertexId);
      const style = resolveStyle(mesh.uvs[vertexId * 2] ?? 0, mesh.uvs[vertexId * 2 + 1] ?? 0);
      const role = WORLD_MODEL_ROLES.indexOf(style.role);

      return { key: `${quantized.join(',')}|${String(role)}|${String(style.shadeByte)}`, quantized, role, shadeByte: style.shadeByte };
    });
    const [first, second, third] = cornerData;

    if (first === undefined || second === undefined || third === undefined) {
      continue;
    }

    const isRepeated = first.key === second.key || second.key === third.key || first.key === third.key;
    const areaVector = cross(subtract(second.quantized, first.quantized), subtract(third.quantized, first.quantized));

    if (isRepeated || areaVector.every(component => component === 0)) {
      degenerateTriangles += 1;
      continue;
    }

    for (const corner of cornerData) {
      let welded = vertexIdByKey.get(corner.key);

      if (welded === undefined) {
        welded = vertexIdByKey.size;
        vertexIdByKey.set(corner.key, welded);
        positions.push(...corner.quantized);
        roles.push(corner.role);
        shades.push(corner.shadeByte);
      }

      indices.push(welded);
    }
  }

  if (indices.length === 0) {
    throw new Error('Prepare: no triangles left');
  }

  return {
    bounds: { max: boundsMax, min: boundsMin },
    indices: Uint32Array.from(indices),
    positions: Uint16Array.from(positions),
    roles: Uint8Array.from(roles),
    shades: Uint8Array.from(shades),
    stats: {
      degenerateTriangles,
      downFaceTriangles,
      flippedTriangles,
      keptVertices: keptVertexIds.size,
      sourceSize: [
        (sourceExtent.max[0] ?? 0) - (sourceExtent.min[0] ?? 0),
        (sourceExtent.max[1] ?? 0) - (sourceExtent.min[1] ?? 0),
        (sourceExtent.max[2] ?? 0) - (sourceExtent.min[2] ?? 0),
      ],
      sourceTriangles: sourceTriangleCount,
      sourceVertices: mesh.vertexCount,
    },
    triangleCount: indices.length / TRIANGLE_CORNERS,
    vertexCount: vertexIdByKey.size,
  };
};
