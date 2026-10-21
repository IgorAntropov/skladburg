import type {
  LayoutPointValue,
  NetworkSceneBuildingValue,
} from './networkSceneTypes';

export const getBuildingFootprint = (
  building: Pick<NetworkSceneBuildingValue, 'depth' | 'rotation' | 'width' | 'x' | 'z'>,
): readonly LayoutPointValue[] => {
  const halfWidth = building.width / 2;
  const halfDepth = building.depth / 2;
  const cosine = Math.cos(building.rotation);
  const sine = Math.sin(building.rotation);
  const offsets: readonly (readonly [number, number])[] = [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ];

  return offsets.map(([localX, localZ]) => ({
    x: building.x + localX * cosine + localZ * sine,
    z: building.z - localX * sine + localZ * cosine,
  }));
};
