import type { TerrainContextValue } from './terrainContext';
import type { TerrainWarpValue } from './terrainShoreWarp';
import type {
  TerrainGroundMeshValue,
  TerrainSurfaceGroupValue,
} from './terrainTypes';

import {
  TERRAIN_SURFACE_KEYS,
  TERRAIN_SURFACE_SAND,
  TERRAIN_SURFACE_WATER,
} from './terrainConstants';
import {
  readNumber,
  smoothstep,
} from './terrainMath';

const NEIGHBOR_BLEND = 0.68;
const SHOULDER_STRENGTH = 0.43;
const SHOULDER_FADE_START_METERS = -0.9;
const SHOULDER_FADE_END_METERS = 1.6;
const FULL_WEIGHT = 255;
const UINT16_VERTEX_CAPACITY = 65535;

const writeLandWeights = (
  weights: Uint8Array,
  target: number,
  surface: number,
  incidences: Uint8Array,
  source: number,
  corridorDistance: number,
): void => {
  let total = 0;

  for (let key = 0; key < TERRAIN_SURFACE_WATER; key += 1) {
    total += readNumber(incidences, source + key);
  }

  const shoulder = SHOULDER_STRENGTH * (1 - smoothstep(SHOULDER_FADE_START_METERS, SHOULDER_FADE_END_METERS, corridorDistance));
  const neighborScale = NEIGHBOR_BLEND / total * (1 - shoulder);
  const ownerWeight = (1 - NEIGHBOR_BLEND) * (1 - shoulder);
  let cumulative = 0;
  let assigned = 0;

  for (let key = 0; key < TERRAIN_SURFACE_WATER; key += 1) {
    cumulative += readNumber(incidences, source + key) * neighborScale;
    cumulative += key === surface ? ownerWeight : 0;
    cumulative += key === TERRAIN_SURFACE_SAND ? shoulder : 0;

    const next = Math.round(cumulative * FULL_WEIGHT);
    weights[target + key] = next - assigned;
    assigned = next;
  }
};

export const buildGroundMesh = (
  context: TerrainContextValue,
  triangleSurface: Uint8Array,
  heights: Float32Array,
  warp: Pick<TerrainWarpValue, 'meshX' | 'meshZ'>,
): TerrainGroundMeshValue => {
  const { grid, triangleVertices, vertexCorridorDistance } = context;
  const { meshX, meshZ } = warp;
  const surfaceCount = TERRAIN_SURFACE_KEYS.length;
  const triangleCounts = new Uint32Array(surfaceCount);
  const incidences = new Uint8Array(grid.vertexCount * surfaceCount);
  let vertexCount = 0;

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    const surface = readNumber(triangleSurface, triangle);
    triangleCounts[surface] = readNumber(triangleCounts, surface) + 1;

    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = readNumber(triangleVertices, triangle * 3 + corner);
      const slot = vertex * surfaceCount + surface;
      const count = readNumber(incidences, slot);

      vertexCount += count === 0 ? 1 : 0;
      incidences[slot] = count + 1;
    }
  }

  const groundGroups: TerrainSurfaceGroupValue[] = [];
  const cursors = new Uint32Array(surfaceCount);
  let start = 0;

  for (let surface = 0; surface < surfaceCount; surface += 1) {
    const count = readNumber(triangleCounts, surface) * 3;
    const key = TERRAIN_SURFACE_KEYS[surface];
    cursors[surface] = start;

    if (count > 0 && key !== undefined) {
      groundGroups.push({ count, key, start });
    }

    start += count;
  }

  const groundIndex = vertexCount <= UINT16_VERTEX_CAPACITY ? new Uint16Array(start) : new Uint32Array(start);
  const groundPositions = new Float32Array(vertexCount * 3);
  const groundWeights = new Uint8Array(vertexCount * TERRAIN_SURFACE_WATER);
  const vertexIndices = new Uint32Array(incidences.length);
  let nextVertex = 0;

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    const surface = readNumber(triangleSurface, triangle);
    const destination = readNumber(cursors, surface);
    cursors[surface] = destination + 3;

    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = readNumber(triangleVertices, triangle * 3 + corner);
      const source = vertex * surfaceCount;
      const slot = source + surface;
      let index = readNumber(vertexIndices, slot) - 1;

      if (index < 0) {
        index = nextVertex;
        nextVertex += 1;
        vertexIndices[slot] = nextVertex;
        groundPositions[index * 3] = readNumber(meshX, vertex);
        groundPositions[index * 3 + 1] = readNumber(heights, vertex);
        groundPositions[index * 3 + 2] = readNumber(meshZ, vertex);

        if (surface !== TERRAIN_SURFACE_WATER) {
          writeLandWeights(
            groundWeights,
            index * TERRAIN_SURFACE_WATER,
            surface,
            incidences,
            source,
            readNumber(vertexCorridorDistance, vertex),
          );
        }
      }

      groundIndex[destination + corner] = index;
    }
  }

  return { groundGroups, groundIndex, groundPositions, groundWeights };
};
