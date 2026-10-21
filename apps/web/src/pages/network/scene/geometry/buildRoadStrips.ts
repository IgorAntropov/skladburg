import type { NetworkSceneRoadValue } from '../layout';

export interface RoadStripsValue {
  indices: Uint16Array;
  normals: Float32Array;
  positions: Float32Array;
}

const CORNERS_PER_STRIP = 4;
const INDICES_PER_STRIP = 6;
const COMPONENTS_PER_VERTEX = 3;
const MIN_LENGTH_METERS = 1e-6;

type RoadEndsValue = Pick<NetworkSceneRoadValue, 'from' | 'to'>;

export const buildRoadStrips = (roads: readonly RoadEndsValue[], width: number, height: number): RoadStripsValue => {
  const strips = roads.filter(road => Math.hypot(road.to.x - road.from.x, road.to.z - road.from.z) > MIN_LENGTH_METERS);
  const positions = new Float32Array(strips.length * CORNERS_PER_STRIP * COMPONENTS_PER_VERTEX);
  const normals = new Float32Array(positions.length);
  const indices = new Uint16Array(strips.length * INDICES_PER_STRIP);
  const halfWidth = width / 2;

  for (const [index, road] of strips.entries()) {
    const length = Math.hypot(road.to.x - road.from.x, road.to.z - road.from.z);
    const sideX = (-(road.to.z - road.from.z) / length) * halfWidth;
    const sideZ = ((road.to.x - road.from.x) / length) * halfWidth;
    const corners = [
      [road.from.x - sideX, road.from.z - sideZ],
      [road.to.x - sideX, road.to.z - sideZ],
      [road.to.x + sideX, road.to.z + sideZ],
      [road.from.x + sideX, road.from.z + sideZ],
    ] as const;
    const firstVertex = index * CORNERS_PER_STRIP;

    for (const [cornerIndex, corner] of corners.entries()) {
      const offset = (firstVertex + cornerIndex) * COMPONENTS_PER_VERTEX;

      positions[offset] = corner[0];
      positions[offset + 1] = height;
      positions[offset + 2] = corner[1];
      normals[offset + 1] = 1;
    }

    indices.set([
      firstVertex,
      firstVertex + 2,
      firstVertex + 1,
      firstVertex,
      firstVertex + 3,
      firstVertex + 2,
    ], index * INDICES_PER_STRIP);
  }

  return { indices, normals, positions };
};
