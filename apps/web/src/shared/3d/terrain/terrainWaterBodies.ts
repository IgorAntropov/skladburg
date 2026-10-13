import type { TerrainContextValue } from './terrainContext';

import {
  TERRAIN_SAND_RINGS_PER_LAKE_RADIUS,
  TERRAIN_SHORE_SMOOTH_ROUNDS,
  TERRAIN_SURFACE_GROUND,
  TERRAIN_SURFACE_SAND,
  TERRAIN_SURFACE_WATER,
  TERRAIN_WATER_EDGE_CLEAR_METERS,
} from './terrainConstants';

const findRoot = (parents: Int32Array, vertex: number): number => {
  let root = vertex;

  while ((parents[root] ?? root) !== root) {
    root = parents[root] ?? root;
  }

  let current = vertex;

  while (current !== root) {
    const next = parents[current] ?? root;
    parents[current] = root;
    current = next;
  }

  return root;
};

export const drainSmallWaterBodies = (
  context: TerrainContextValue,
  triangleSurface: Uint8Array,
  minTriangles: number,
): Uint8Array => {
  const { grid, triangleVertices } = context;
  const parents = new Int32Array(grid.vertexCount);
  const isDrainedVertex = new Uint8Array(grid.vertexCount);

  for (let vertex = 0; vertex < grid.vertexCount; vertex += 1) {
    parents[vertex] = vertex;
  }

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    if (triangleSurface[triangle] === TERRAIN_SURFACE_WATER) {
      const base = triangle * 3;
      const rootA = findRoot(parents, triangleVertices[base] ?? 0);
      const rootB = findRoot(parents, triangleVertices[base + 1] ?? 0);
      const rootC = findRoot(parents, triangleVertices[base + 2] ?? 0);
      parents[rootB] = rootA;
      parents[rootC] = rootA;
    }
  }

  const sizes = new Uint32Array(grid.vertexCount);

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    if (triangleSurface[triangle] === TERRAIN_SURFACE_WATER) {
      const root = findRoot(parents, triangleVertices[triangle * 3] ?? 0);
      sizes[root] = (sizes[root] ?? 0) + 1;
    }
  }

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    if (triangleSurface[triangle] === TERRAIN_SURFACE_WATER) {
      const base = triangle * 3;
      const root = findRoot(parents, triangleVertices[base] ?? 0);

      if ((sizes[root] ?? 0) < minTriangles) {
        triangleSurface[triangle] = TERRAIN_SURFACE_GROUND;
        isDrainedVertex[triangleVertices[base] ?? 0] = 1;
        isDrainedVertex[triangleVertices[base + 1] ?? 0] = 1;
        isDrainedVertex[triangleVertices[base + 2] ?? 0] = 1;
      }
    }
  }

  return isDrainedVertex;
};

const countWaterNeighbors = (context: TerrainContextValue, isWater: Uint8Array, triangle: number): number => {
  const { cellsX, cellsZ } = context.grid;
  const cell = triangle >> 1;
  const column = cell % cellsX;
  const row = (cell - column) / cellsX;
  const isEven = ((column + row) & 1) === 0;
  const isSecond = (triangle & 1) === 1;
  let count = isWater[isSecond ? triangle - 1 : triangle + 1] ?? 0;

  if (isSecond) {
    count += column < cellsX - 1 ? isWater[triangle + 1] ?? 0 : 0;
  }
  else {
    count += column > 0 ? isWater[triangle - 1] ?? 0 : 0;
  }

  const isTopEdge = isSecond === isEven;

  if (isTopEdge) {
    count += row > 0 ? isWater[triangle - cellsX * 2] ?? 0 : 0;
  }
  else {
    count += row < cellsZ - 1 ? isWater[triangle + cellsX * 2] ?? 0 : 0;
  }

  return count;
};

export const smoothShoreline = (context: TerrainContextValue, triangleSurface: Uint8Array): void => {
  const { cellEdgeDistance, grid } = context;
  const isWater = new Uint8Array(grid.triangleCount);

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    isWater[triangle] = triangleSurface[triangle] === TERRAIN_SURFACE_WATER ? 1 : 0;
  }

  for (let round = 0; round < TERRAIN_SHORE_SMOOTH_ROUNDS; round += 1) {
    const filled = isWater.slice();

    for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
      const isEligible = (cellEdgeDistance[triangle >> 1] ?? 0) >= TERRAIN_WATER_EDGE_CLEAR_METERS;

      if (isWater[triangle] === 0 && isEligible && countWaterNeighbors(context, isWater, triangle) >= 2) {
        filled[triangle] = 1;
      }
    }

    const pruned = filled.slice();

    for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
      if (filled[triangle] === 1 && countWaterNeighbors(context, filled, triangle) <= 1) {
        pruned[triangle] = 0;
      }
    }

    isWater.set(pruned);
  }

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    triangleSurface[triangle] = isWater[triangle] === 1 ? TERRAIN_SURFACE_WATER : TERRAIN_SURFACE_GROUND;
  }
};

export const fillSandNotches = (context: TerrainContextValue, triangleSurface: Uint8Array): void => {
  const { cellEdgeDistance, grid } = context;
  const isWet = new Uint8Array(grid.triangleCount);

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    const surface = triangleSurface[triangle];
    isWet[triangle] = surface === TERRAIN_SURFACE_WATER || surface === TERRAIN_SURFACE_SAND ? 1 : 0;
  }

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    const isEligible = (cellEdgeDistance[triangle >> 1] ?? 0) >= TERRAIN_WATER_EDGE_CLEAR_METERS;

    if (
      isEligible
      && triangleSurface[triangle] === TERRAIN_SURFACE_GROUND
      && countWaterNeighbors(context, isWet, triangle) >= 2
    ) {
      triangleSurface[triangle] = TERRAIN_SURFACE_SAND;
    }
  }
};

export const paintLakeSand = (context: TerrainContextValue, triangleSurface: Uint8Array): void => {
  const { grid, triangleVertices } = context;
  const parents = new Int32Array(grid.vertexCount);

  for (let vertex = 0; vertex < grid.vertexCount; vertex += 1) {
    parents[vertex] = vertex;
  }

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    if (triangleSurface[triangle] === TERRAIN_SURFACE_WATER) {
      const base = triangle * 3;
      const rootA = findRoot(parents, triangleVertices[base] ?? 0);
      parents[findRoot(parents, triangleVertices[base + 1] ?? 0)] = rootA;
      parents[findRoot(parents, triangleVertices[base + 2] ?? 0)] = rootA;
    }
  }

  const sizes = new Uint32Array(grid.vertexCount);

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    if (triangleSurface[triangle] === TERRAIN_SURFACE_WATER) {
      const root = findRoot(parents, triangleVertices[triangle * 3] ?? 0);
      sizes[root] = (sizes[root] ?? 0) + 1;
    }
  }

  let reach = new Uint8Array(grid.vertexCount);
  let maxRings = 0;

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    if (triangleSurface[triangle] === TERRAIN_SURFACE_WATER) {
      const base = triangle * 3;
      const radiusCells = Math.sqrt((sizes[findRoot(parents, triangleVertices[base] ?? 0)] ?? 0) / (2 * Math.PI));
      const rings = Math.max(1, Math.round(radiusCells * TERRAIN_SAND_RINGS_PER_LAKE_RADIUS));
      maxRings = Math.max(maxRings, rings);

      for (let corner = 0; corner < 3; corner += 1) {
        const vertex = triangleVertices[base + corner] ?? 0;
        reach[vertex] = Math.max(reach[vertex] ?? 0, rings);
      }
    }
  }

  for (let ring = 0; ring < maxRings; ring += 1) {
    const next = reach.slice();

    for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
      if (triangleSurface[triangle] === TERRAIN_SURFACE_GROUND) {
        const base = triangle * 3;
        const a = triangleVertices[base] ?? 0;
        const b = triangleVertices[base + 1] ?? 0;
        const c = triangleVertices[base + 2] ?? 0;
        const best = Math.max(reach[a] ?? 0, reach[b] ?? 0, reach[c] ?? 0);

        if (best >= 1) {
          triangleSurface[triangle] = TERRAIN_SURFACE_SAND;
          next[a] = Math.max(next[a] ?? 0, best - 1);
          next[b] = Math.max(next[b] ?? 0, best - 1);
          next[c] = Math.max(next[c] ?? 0, best - 1);
        }
      }
    }

    reach = next;
  }
};

export const fillWaterIslands = (context: TerrainContextValue, triangleSurface: Uint8Array, maxTriangles: number): void => {
  const { grid, triangleVertices } = context;
  const parents = new Int32Array(grid.vertexCount);

  for (let vertex = 0; vertex < grid.vertexCount; vertex += 1) {
    parents[vertex] = vertex;
  }

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    if (triangleSurface[triangle] !== TERRAIN_SURFACE_WATER) {
      const base = triangle * 3;
      const rootA = findRoot(parents, triangleVertices[base] ?? 0);
      parents[findRoot(parents, triangleVertices[base + 1] ?? 0)] = rootA;
      parents[findRoot(parents, triangleVertices[base + 2] ?? 0)] = rootA;
    }
  }

  const sizes = new Uint32Array(grid.vertexCount);

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    if (triangleSurface[triangle] !== TERRAIN_SURFACE_WATER) {
      const root = findRoot(parents, triangleVertices[triangle * 3] ?? 0);
      sizes[root] = (sizes[root] ?? 0) + 1;
    }
  }

  for (let triangle = 0; triangle < grid.triangleCount; triangle += 1) {
    if (triangleSurface[triangle] !== TERRAIN_SURFACE_WATER) {
      const root = findRoot(parents, triangleVertices[triangle * 3] ?? 0);

      if ((sizes[root] ?? 0) < maxTriangles) {
        triangleSurface[triangle] = TERRAIN_SURFACE_WATER;
      }
    }
  }
};
