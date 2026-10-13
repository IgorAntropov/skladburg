import type {
  TerrainCorridorValue,
  TerrainReservedValue,
} from './terrainTypes';

export const EMPTY_TERRAIN_RESERVED: TerrainReservedValue = { areas: [], corridors: [] };

const getSegmentDistance = (
  x: number,
  z: number,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): number => {
  const directionX = toX - fromX;
  const directionZ = toZ - fromZ;
  const lengthSquared = directionX * directionX + directionZ * directionZ;
  const projection = lengthSquared > 0 ? ((x - fromX) * directionX + (z - fromZ) * directionZ) / lengthSquared : 0;
  const clamped = Math.min(1, Math.max(0, projection));
  const offsetX = x - (fromX + directionX * clamped);
  const offsetZ = z - (fromZ + directionZ * clamped);

  return Math.sqrt(offsetX * offsetX + offsetZ * offsetZ);
};

const getCorridorDistance = (corridor: TerrainCorridorValue, x: number, z: number): number => {
  const halfWidth = corridor.width / 2;
  let distance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < corridor.points.length; index += 1) {
    const from = corridor.points[index];
    const to = corridor.points[index + 1] ?? from;

    if (from !== undefined && to !== undefined) {
      distance = Math.min(distance, getSegmentDistance(x, z, from.x, from.z, to.x, to.z) - halfWidth);
    }
  }

  return distance;
};

export const getReserveDistance = (reserved: TerrainReservedValue, x: number, z: number): number => {
  let distance = Number.POSITIVE_INFINITY;

  for (const area of reserved.areas) {
    const offsetX = x - area.x;
    const offsetZ = z - area.z;
    distance = Math.min(distance, Math.sqrt(offsetX * offsetX + offsetZ * offsetZ) - area.radius);
  }

  for (const corridor of reserved.corridors) {
    distance = Math.min(distance, getCorridorDistance(corridor, x, z));
  }

  return distance;
};
