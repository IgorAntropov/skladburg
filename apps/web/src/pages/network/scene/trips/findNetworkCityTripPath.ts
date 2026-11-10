import type {
  LayoutPointValue,
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
} from '../layout';

import { getBuildingFootprint } from '../layout';
import {
  TRUCK_BOX,
  TRUCK_CAB,
} from './networkTruckDimensions';

interface BuildingObstacleValue extends LayoutPointValue {
  halfDepth: number;
  halfWidth: number;
}

const CLEARANCE_METERS = 0.035;
const TRUCK_HALF_WIDTH_METERS = Math.max(TRUCK_BOX.width / 2, 0.505) + CLEARANCE_METERS;
const TRUCK_HALF_LENGTH_METERS = Math.max(TRUCK_BOX.depth / 2 - TRUCK_BOX.z, TRUCK_CAB.depth / 2 + TRUCK_CAB.z) + CLEARANCE_METERS;
const CORNER_CLEARANCES = [TRUCK_HALF_WIDTH_METERS, Math.hypot(TRUCK_HALF_WIDTH_METERS, TRUCK_HALF_LENGTH_METERS)] as const;
const DISTANCE_EPSILON = 1e-6;

const toObstacle = (building: NetworkSceneBuildingValue): BuildingObstacleValue => {
  const corners = getBuildingFootprint(building);

  return {
    halfDepth: Math.max(...corners.map(corner => Math.abs(corner.z - building.z))),
    halfWidth: Math.max(...corners.map(corner => Math.abs(corner.x - building.x))),
    x: building.x,
    z: building.z,
  };
};

const isClear = (
  from: LayoutPointValue,
  to: LayoutPointValue,
  length: number,
  obstacles: readonly BuildingObstacleValue[],
): boolean => {
  if (length < DISTANCE_EPSILON) {
    return true;
  }

  const forwardX = (to.x - from.x) / length;
  const forwardZ = (to.z - from.z) / length;
  const alongX = Math.abs(forwardX);
  const alongZ = Math.abs(forwardZ);
  const halfLength = length / 2 + TRUCK_HALF_LENGTH_METERS;
  const halfWidth = TRUCK_HALF_WIDTH_METERS;
  const centerX = (from.x + to.x) / 2;
  const centerZ = (from.z + to.z) / 2;

  return obstacles.every((obstacle) => {
    const x = obstacle.x - centerX;
    const z = obstacle.z - centerZ;

    return Math.abs(x) >= obstacle.halfWidth + alongX * halfLength + alongZ * halfWidth
      || Math.abs(z) >= obstacle.halfDepth + alongZ * halfLength + alongX * halfWidth
      || Math.abs(x * forwardX + z * forwardZ) >= halfLength + alongX * obstacle.halfWidth + alongZ * obstacle.halfDepth
      || Math.abs(x * forwardZ - z * forwardX) >= halfWidth + alongZ * obstacle.halfWidth + alongX * obstacle.halfDepth;
  });
};

const readCornerPoints = (obstacles: readonly BuildingObstacleValue[], city: NetworkSceneCityValue): LayoutPointValue[] => {
  const points: LayoutPointValue[] = [];

  for (const { halfDepth, halfWidth, x, z } of obstacles) {
    for (const clearance of CORNER_CLEARANCES) {
      const dx = halfWidth + clearance + DISTANCE_EPSILON;
      const dz = halfDepth + clearance + DISTANCE_EPSILON;
      points.push(
        { x: x - dx, z: z - dz },
        { x: x + dx, z: z - dz },
        { x: x - dx, z: z + dz },
        { x: x + dx, z: z + dz },
      );
    }
  }

  return points.filter(point => Math.hypot(point.x - city.x, point.z - city.z) <= city.radius);
};

export const findNetworkCityTripPath = (
  city: NetworkSceneCityValue,
  buildings: readonly NetworkSceneBuildingValue[],
  starts: readonly LayoutPointValue[],
  ends: readonly LayoutPointValue[],
): readonly LayoutPointValue[] | undefined => {
  const obstacles = buildings.filter(building => building.cityId === city.id).map(toObstacle);
  const points = [...starts, ...ends, ...readCornerPoints(obstacles, city)];
  const distances = points.map((_, index) => index < starts.length ? 0 : Number.POSITIVE_INFINITY);
  const previous = new Map<number, number>();
  const visited = new Set<number>();

  for (;;) {
    let current = -1;
    let shortest = Number.POSITIVE_INFINITY;

    for (const [index, distance] of distances.entries()) {
      if (!visited.has(index) && distance < shortest) {
        shortest = distance;
        current = index;
      }
    }

    const point = points[current];

    if (point === undefined) {
      return undefined;
    }

    if (current >= starts.length && current < starts.length + ends.length) {
      const path = [point];
      let predecessor = previous.get(current);

      while (predecessor !== undefined) {
        const step = points[predecessor];

        if (step !== undefined) {
          path.push(step);
        }

        predecessor = previous.get(predecessor);
      }

      return path.reverse();
    }

    visited.add(current);

    for (const [index, target] of points.entries()) {
      const length = Math.hypot(target.x - point.x, target.z - point.z);
      const distance = shortest + length;

      if (!visited.has(index) && distance < (distances[index] ?? Number.POSITIVE_INFINITY) && isClear(point, target, length, obstacles)) {
        distances[index] = distance;
        previous.set(index, current);
      }
    }
  }
};
