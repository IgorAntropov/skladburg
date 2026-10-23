import type { NetworkSceneBuildingValue } from '../layout';
import type { WorldModelBoundsValue } from './format/worldModelFormat';

export interface WorldModelFitValue {
  rotationY: number;
  scale: readonly [number, number, number];
}

const QUARTER_TURN = Math.PI / 2;

const measureStretch = (scaleX: number, scaleZ: number): number => Math.max(scaleX, scaleZ) / Math.min(scaleX, scaleZ);

export const fitWorldModelToFootprint = (
  bounds: WorldModelBoundsValue,
  building: Pick<NetworkSceneBuildingValue, 'depth' | 'height' | 'rotation' | 'width'>,
): WorldModelFitValue => {
  const modelWidth = bounds.max[0] - bounds.min[0];
  const modelHeight = bounds.max[1] - bounds.min[1];
  const modelDepth = bounds.max[2] - bounds.min[2];
  const straightX = building.width / modelWidth;
  const straightZ = building.depth / modelDepth;
  const turnedX = building.depth / modelWidth;
  const turnedZ = building.width / modelDepth;
  const isTurned = measureStretch(turnedX, turnedZ) < measureStretch(straightX, straightZ);
  const scaleX = isTurned ? turnedX : straightX;
  const scaleZ = isTurned ? turnedZ : straightZ;
  const scaleY = Math.min((scaleX + scaleZ) / 2, building.height / modelHeight);

  return {
    rotationY: building.rotation + (isTurned ? QUARTER_TURN : 0),
    scale: [scaleX, scaleY, scaleZ],
  };
};
