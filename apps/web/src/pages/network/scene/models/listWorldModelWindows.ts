import type { WorldModelDataValue } from './format/worldModelFormat';
import type { WorldModelFaceValue } from './worldModelCatalog';

import { WORLD_MODEL_ROLES } from './format/worldModelFormat';

export interface WorldModelWindowValue {
  center: readonly [number, number, number];
  face: WorldModelFaceValue;
  height: number;
  width: number;
}

interface GlassGroupValue {
  area: number;
  max: [number, number, number];
  min: [number, number, number];
  normal: [number, number, number];
}

const AXIS_COUNT = 3;
const TRIANGLE_CORNERS = 3;
const GLASS_ROLE = WORLD_MODEL_ROLES.indexOf('glass');
const POSITION_PRECISION = 1000;
const FLAT_TOLERANCE = 0.002;
const AREA_TOLERANCE = 0.02;
const TILT_TOLERANCE = 0.01;
const MIN_SIDE = 0.001;
const FACE_ORDER: readonly WorldModelFaceValue[] = ['positiveZ', 'positiveX', 'negativeZ', 'negativeX'];

const windowsByModel = new WeakMap<WorldModelDataValue, readonly WorldModelWindowValue[]>();

const findRoot = (parents: Int32Array, start: number): number => {
  let root = start;

  while ((parents[root] ?? root) !== root) {
    root = parents[root] ?? root;
  }

  let node = start;

  while ((parents[node] ?? node) !== root) {
    const next = parents[node] ?? node;

    parents[node] = root;
    node = next;
  }

  return root;
};

const joinRoots = (parents: Int32Array, current: number, prev: number): void => {
  const currentRoot = findRoot(parents, current);
  const prevRoot = findRoot(parents, prev);

  if (currentRoot !== prevRoot) {
    parents[Math.max(currentRoot, prevRoot)] = Math.min(currentRoot, prevRoot);
  }
};

const readCorner = (data: WorldModelDataValue, vertex: number): [number, number, number] => [
  data.positions[vertex * AXIS_COUNT] ?? 0,
  data.positions[vertex * AXIS_COUNT + 1] ?? 0,
  data.positions[vertex * AXIS_COUNT + 2] ?? 0,
];

const buildPositionKey = (corner: readonly number[]): string => corner
  .map(value => Math.round(value * POSITION_PRECISION))
  .join(',');

const isGlassTriangle = (data: WorldModelDataValue, triangle: number): boolean => {
  for (let corner = 0; corner < TRIANGLE_CORNERS; corner += 1) {
    const vertex = data.indices[triangle * TRIANGLE_CORNERS + corner] ?? 0;

    if (data.roles[vertex] !== GLASS_ROLE) {
      return false;
    }
  }

  return true;
};

const readTriangleCorners = (
  data: WorldModelDataValue,
  triangle: number,
): [[number, number, number], [number, number, number], [number, number, number]] => [
  readCorner(data, data.indices[triangle * TRIANGLE_CORNERS] ?? 0),
  readCorner(data, data.indices[triangle * TRIANGLE_CORNERS + 1] ?? 0),
  readCorner(data, data.indices[triangle * TRIANGLE_CORNERS + 2] ?? 0),
];

const computeCross = (
  first: readonly number[],
  second: readonly number[],
  third: readonly number[],
): [number, number, number] => {
  const ux = (second[0] ?? 0) - (first[0] ?? 0);
  const uy = (second[1] ?? 0) - (first[1] ?? 0);
  const uz = (second[2] ?? 0) - (first[2] ?? 0);
  const vx = (third[0] ?? 0) - (first[0] ?? 0);
  const vy = (third[1] ?? 0) - (first[1] ?? 0);
  const vz = (third[2] ?? 0) - (first[2] ?? 0);

  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
};

const listGlassTriangles = (data: WorldModelDataValue): number[] => {
  const triangles: number[] = [];

  for (let triangle = 0; triangle < data.triangleCount; triangle += 1) {
    if (isGlassTriangle(data, triangle)) {
      triangles.push(triangle);
    }
  }

  return triangles;
};

const buildGlassGroups = (data: WorldModelDataValue): GlassGroupValue[] => {
  const glassTriangles = listGlassTriangles(data);
  const parents = Int32Array.from({ length: data.triangleCount }, (_, index) => index);
  const triangleByPosition = new Map<string, number>();

  for (const triangle of glassTriangles) {
    for (const corner of readTriangleCorners(data, triangle)) {
      const key = buildPositionKey(corner);
      const known = triangleByPosition.get(key);

      if (known === undefined) {
        triangleByPosition.set(key, triangle);
      }
      else {
        joinRoots(parents, triangle, known);
      }
    }
  }

  const groupByRoot = new Map<number, GlassGroupValue>();

  for (const triangle of glassTriangles) {
    const root = findRoot(parents, triangle);
    const corners = readTriangleCorners(data, triangle);
    const cross = computeCross(...corners);
    const group = groupByRoot.get(root) ?? {
      area: 0,
      max: [-Infinity, -Infinity, -Infinity],
      min: [Infinity, Infinity, Infinity],
      normal: [0, 0, 0],
    };

    group.area += Math.hypot(...cross) / 2;

    for (let axis = 0; axis < AXIS_COUNT; axis += 1) {
      group.normal[axis] = (group.normal[axis] ?? 0) + (cross[axis] ?? 0);

      for (const corner of corners) {
        group.min[axis] = Math.min(group.min[axis] ?? Infinity, corner[axis] ?? 0);
        group.max[axis] = Math.max(group.max[axis] ?? -Infinity, corner[axis] ?? 0);
      }
    }

    groupByRoot.set(root, group);
  }

  return [...groupByRoot.values()];
};

const toWindow = (group: GlassGroupValue): undefined | WorldModelWindowValue => {
  const [normalX, normalY, normalZ] = group.normal;
  const length = Math.hypot(normalX, normalY, normalZ);

  if (length === 0) {
    return undefined;
  }

  const isAlongX = Math.abs(normalX) > Math.abs(normalZ);
  const dominant = isAlongX ? normalX : normalZ;
  const side = isAlongX ? normalZ : normalX;

  if (Math.abs(normalY) > TILT_TOLERANCE * length || Math.abs(side) > TILT_TOLERANCE * length) {
    return undefined;
  }

  const normalAxis = isAlongX ? 0 : 2;
  const horizontalAxis = isAlongX ? 2 : 0;
  const thickness = group.max[normalAxis] - group.min[normalAxis];
  const width = group.max[horizontalAxis] - group.min[horizontalAxis];
  const height = group.max[1] - group.min[1];

  if (thickness > FLAT_TOLERANCE || width < MIN_SIDE || height < MIN_SIDE) {
    return undefined;
  }

  if (Math.abs(width * height - group.area) > AREA_TOLERANCE * width * height) {
    return undefined;
  }

  const face: WorldModelFaceValue = isAlongX
    ? (dominant > 0 ? 'positiveX' : 'negativeX')
    : (dominant > 0 ? 'positiveZ' : 'negativeZ');

  return {
    center: [
      (group.min[0] + group.max[0]) / 2,
      (group.min[1] + group.max[1]) / 2,
      (group.min[2] + group.max[2]) / 2,
    ],
    face,
    height,
    width,
  };
};

const compareWindows = (current: WorldModelWindowValue, prev: WorldModelWindowValue): number => (
  FACE_ORDER.indexOf(current.face) - FACE_ORDER.indexOf(prev.face)
  || current.center[1] - prev.center[1]
  || current.center[0] - prev.center[0]
  || current.center[2] - prev.center[2]
);

export const listWorldModelWindows = (data: WorldModelDataValue): readonly WorldModelWindowValue[] => {
  const cached = windowsByModel.get(data);

  if (cached !== undefined) {
    return cached;
  }

  const windows = buildGlassGroups(data)
    .map(toWindow)
    .filter((window): window is WorldModelWindowValue => window !== undefined)
    .toSorted(compareWindows);

  windowsByModel.set(data, windows);

  return windows;
};
