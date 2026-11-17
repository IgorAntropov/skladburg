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

type RoadEndsValue = Pick<NetworkSceneRoadValue, 'from' | 'to'> & { endHeight?: number | undefined };

export const buildRoadStrips = (roads: readonly RoadEndsValue[], width: number, height: number, endExtension = 0): RoadStripsValue => {
  const strips = roads.filter(road => Math.hypot(road.to.x - road.from.x, road.to.z - road.from.z) > MIN_LENGTH_METERS);
  const positions = new Float32Array(strips.length * CORNERS_PER_STRIP * COMPONENTS_PER_VERTEX);
  const normals = new Float32Array(positions.length);
  const indices = new Uint16Array(strips.length * INDICES_PER_STRIP);
  const halfWidth = width / 2;

  for (const [index, road] of strips.entries()) {
    const dx = road.to.x - road.from.x;
    const dz = road.to.z - road.from.z;
    const length = Math.hypot(dx, dz);
    const endHeight = road.endHeight ?? height;
    const dy = endHeight - height;
    const run = length + 2 * endExtension;
    const slopeLength = Math.hypot(run, dy);
    const normalX = -dx / length * dy / slopeLength;
    const normalZ = -dz / length * dy / slopeLength;
    const sideX = -dz / length * halfWidth;
    const sideZ = dx / length * halfWidth;
    const endX = dx / length * endExtension;
    const endZ = dz / length * endExtension;
    const corners = [
      [road.from.x - sideX - endX, road.from.z - sideZ - endZ],
      [road.to.x - sideX + endX, road.to.z - sideZ + endZ],
      [road.to.x + sideX + endX, road.to.z + sideZ + endZ],
      [road.from.x + sideX - endX, road.from.z + sideZ - endZ],
    ] as const;
    const firstVertex = index * CORNERS_PER_STRIP;

    for (const [cornerIndex, corner] of corners.entries()) {
      const offset = (firstVertex + cornerIndex) * COMPONENTS_PER_VERTEX;

      positions[offset] = corner[0];
      positions[offset + 1] = cornerIndex === 1 || cornerIndex === 2 ? endHeight : height;
      positions[offset + 2] = corner[1];
      normals[offset] = normalX || 0;
      normals[offset + 1] = run / slopeLength;
      normals[offset + 2] = normalZ || 0;
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
