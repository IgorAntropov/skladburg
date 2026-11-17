import type { WorldTerrainValue } from '@/shared/3d';

interface BoundaryOptionsValue {
  count: number;
  isWater: boolean;
  start: number;
}

interface PointValue {
  x: number;
  z: number;
}

interface VertexMoveValue {
  index: number;
  point: PointValue;
  shift: PointValue;
}

const COMPONENTS_PER_POSITION = 3;
const FIELD = 2;
const FIELD_ALT = 3;
const MAX_BOUNDARY_SHIFT = 0.84;
const MIN_TRIANGLE_AREA_SHARE = 0.38;
const SHAPE_ATTEMPTS = 4;
const FIELD_ROW_SPACING_METERS = 8.5;
const TAU = 2 * Math.PI;

const shapedTerrain = new WeakMap<WorldTerrainValue, WorldTerrainValue>();

const readPoint = (positions: Float32Array, vertex: number): PointValue => ({
  x: positions[vertex * COMPONENTS_PER_POSITION] ?? 0,
  z: positions[vertex * COMPONENTS_PER_POSITION + 2] ?? 0,
});

const pointKey = ({ x, z }: PointValue): string => `${String(x)}|${String(z)}`;

const collectBoundaryMoves = (
  terrain: WorldTerrainValue,
  { count, isWater, start }: BoundaryOptionsValue,
  moves: Map<string, PointValue>,
): void => {
  const { groundIndex, groundPositions } = terrain;
  const vertexCount = groundPositions.length / COMPONENTS_PER_POSITION;
  const edges = new Map<number, readonly [number, number]>();

  for (let index = start; index < start + count; index += 3) {
    const triangle = [groundIndex[index] ?? 0, groundIndex[index + 1] ?? 0, groundIndex[index + 2] ?? 0];

    for (let side = 0; side < 3; side += 1) {
      const a = triangle[side] ?? 0;
      const b = triangle[(side + 1) % 3] ?? 0;
      const key = Math.min(a, b) * vertexCount + Math.max(a, b);

      if (!edges.delete(key)) {
        edges.set(key, [a, b]);
      }
    }
  }

  const neighbors = new Map<number, number[]>();

  for (const [a, b] of edges.values()) {
    const from = neighbors.get(a) ?? [];
    const to = neighbors.get(b) ?? [];
    from.push(b);
    to.push(a);
    neighbors.set(a, from);
    neighbors.set(b, to);
  }

  for (const [index, adjacent] of neighbors) {
    const [a, b] = adjacent;

    if (adjacent.length !== 2 || a === undefined || b === undefined) {
      continue;
    }

    const point = readPoint(groundPositions, index);
    const left = readPoint(groundPositions, a);
    const right = readPoint(groundPositions, b);
    const dx = (left.x + right.x) / 2 - point.x;
    const dz = (left.z + right.z) / 2 - point.z;
    const smooth = isWater ? 0.52 : 0.57;
    const direction = right.x > left.x || (right.x === left.x && right.z >= left.z) ? 1 : -1;
    const tangentX = (right.x - left.x) * direction;
    const tangentZ = (right.z - left.z) * direction;
    const tangentLength = Math.hypot(tangentX, tangentZ);
    const detail = isWater ? 0 : Math.sin(point.x * 0.24 + point.z * 0.45) * 0.21;
    const across = tangentLength === 0 ? 0 : detail / tangentLength;
    const x = dx * smooth - tangentZ * across;
    const z = dz * smooth + tangentX * across;
    const scale = Math.min(1, MAX_BOUNDARY_SHIFT / (Math.hypot(x, z) || 1));

    moves.set(pointKey(point), { x: x * scale, z: z * scale });
  }
};

const readArea = (positions: Float32Array, a: number, b: number, c: number): number => {
  const ax = positions[a] ?? 0;
  const az = positions[a + 2] ?? 0;

  return ((positions[b] ?? 0) - ax) * ((positions[c + 2] ?? 0) - az)
    - ((positions[c] ?? 0) - ax) * ((positions[b + 2] ?? 0) - az);
};

const shapeBoundaries = (terrain: WorldTerrainValue): Float32Array => {
  const { groundGroups, groundIndex, groundPositions } = terrain;
  const moves = new Map<string, PointValue>();

  for (const { count, key, start } of groundGroups) {
    if (key === 'field' || key === 'fieldAlt' || key === 'water') {
      collectBoundaryMoves(terrain, { count, isWater: key === 'water', start }, moves);
    }
  }

  if (moves.size === 0) {
    return groundPositions;
  }

  const candidates = new Map<string, VertexMoveValue[]>();
  const movedVertices: VertexMoveValue[] = [];
  const isMoved = new Uint8Array(groundPositions.length / COMPONENTS_PER_POSITION);

  for (let index = 0; index < isMoved.length; index += 1) {
    const point = readPoint(groundPositions, index);
    const key = pointKey(point);
    const shift = moves.get(key);

    if (shift !== undefined && (shift.x !== 0 || shift.z !== 0)) {
      const copies = candidates.get(key) ?? [];
      copies.push({ index, point, shift });
      candidates.set(key, copies);
    }
  }

  for (const copies of candidates.values()) {
    if (copies.length > 1) {
      for (const copy of copies) {
        isMoved[copy.index] = 1;
        movedVertices.push(copy);
      }
    }
  }

  if (movedVertices.length === 0) {
    return groundPositions;
  }

  const affected: { a: number; area: number; b: number; c: number }[] = [];
  for (let i = 0; i < groundIndex.length; i += 3) {
    const first = groundIndex[i] ?? 0;
    const second = groundIndex[i + 1] ?? 0;
    const third = groundIndex[i + 2] ?? 0;

    if (isMoved[first] === 1 || isMoved[second] === 1 || isMoved[third] === 1) {
      const a = first * COMPONENTS_PER_POSITION;
      const b = second * COMPONENTS_PER_POSITION;
      const c = third * COMPONENTS_PER_POSITION;
      const area = readArea(groundPositions, a, b, c);

      if (area !== 0) {
        affected.push({ a, area, b, c });
      }
    }
  }

  const positions = groundPositions.slice();
  for (let attempt = 0; attempt < SHAPE_ATTEMPTS; attempt += 1) {
    const share = 0.5 ** attempt;

    for (const { index, point, shift } of movedVertices) {
      const offset = index * COMPONENTS_PER_POSITION;
      positions[offset] = point.x + shift.x * share;
      positions[offset + 2] = point.z + shift.z * share;
    }

    if (affected.every(({ a, area, b, c }) => readArea(positions, a, b, c) / area >= MIN_TRIANGLE_AREA_SHARE)) {
      return positions;
    }
  }

  return groundPositions;
};

const shapeFieldWeights = ({ groundPositions, groundWeights }: WorldTerrainValue): Uint8Array => {
  const weights = groundWeights.slice();
  const vertexCount = groundPositions.length / COMPONENTS_PER_POSITION;
  const stride = weights.length / vertexCount;

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const offset = vertex * stride;
    const fieldWeight = weights[offset + FIELD] ?? 0;
    const altWeight = weights[offset + FIELD_ALT] ?? 0;

    if (fieldWeight + altWeight === 0) {
      continue;
    }

    const { x, z } = readPoint(groundPositions, vertex);
    const patch = Math.sin(x * 0.12 + z * 0.09) * Math.cos(z * 0.16 - x * 0.07);
    const row = Math.cos((x * 0.53 + z * 0.85 + patch * 2.1) * TAU / FIELD_ROW_SPACING_METERS);
    const altRow = Math.cos((x * 0.89 - z * 0.45 + patch * 1.5) * TAU / FIELD_ROW_SPACING_METERS);
    const retainedField = Math.round(fieldWeight * (0.63 + patch * 0.09 + row * 0.15));
    const retainedAlt = Math.round(altWeight * (0.65 + patch * 0.09 + altRow * 0.15));
    const toGround = Math.round((fieldWeight + altWeight - retainedField - retainedAlt) * 0.73);

    weights[offset] = (weights[offset] ?? 0) + toGround;
    weights[offset + 1] = (weights[offset + 1] ?? 0) + fieldWeight + altWeight - retainedField - retainedAlt - toGround;
    weights[offset + FIELD] = retainedField;
    weights[offset + FIELD_ALT] = retainedAlt;
  }

  return weights;
};

export const shapeNetworkTerrain = (terrain: WorldTerrainValue): WorldTerrainValue => {
  const cached = shapedTerrain.get(terrain);

  if (cached !== undefined) {
    return cached;
  }

  const result: WorldTerrainValue = {
    ...terrain,
    groundPositions: shapeBoundaries(terrain),
    groundWeights: shapeFieldWeights(terrain),
  };

  shapedTerrain.set(terrain, result);

  return result;
};
