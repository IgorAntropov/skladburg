import type { SelectionFrameValue } from './selectionFrame';

import { writeBoxMatrix } from './composeInstanceMatrix';
import {
  CORNER_BASE_HEIGHT_METERS,
  CORNER_DARK_THICKNESS_METERS,
  CORNER_LIGHT_THICKNESS_METERS,
  CORNER_OUTLINE_METERS,
} from './networkSceneMetrics';

export const SELECTION_CORNER_COUNT = 4;

export const SELECTION_CORNER_INSTANCE_COUNT = SELECTION_CORNER_COUNT * 2;

interface BarValue {
  centerX: number;
  centerZ: number;
  sizeX: number;
  sizeZ: number;
}

const LIGHT_LAYER = { grow: 0, thickness: CORNER_LIGHT_THICKNESS_METERS } as const;
const DARK_LAYER = { grow: CORNER_OUTLINE_METERS, thickness: CORNER_DARK_THICKNESS_METERS } as const;

const DIRECTIONS_X: readonly number[] = [-1, 1, 1, -1];
const DIRECTIONS_Z: readonly number[] = [-1, -1, 1, 1];

const scratchCenter = { x: 0, y: CORNER_BASE_HEIGHT_METERS, z: 0 };
const scratchSize = { x: 0, y: 0, z: 0 };

const writeBar = (
  target: Float32Array,
  index: number,
  bar: BarValue,
  layer: { grow: number; thickness: number },
): void => {
  scratchCenter.x = bar.centerX;
  scratchCenter.z = bar.centerZ;
  scratchSize.x = bar.sizeX + 2 * layer.grow;
  scratchSize.y = layer.thickness;
  scratchSize.z = bar.sizeZ + 2 * layer.grow;
  writeBoxMatrix(target, index, scratchCenter, scratchSize);
};

const writeBarPair = (light: Float32Array, dark: Float32Array, index: number, bar: BarValue): void => {
  writeBar(light, index, bar, LIGHT_LAYER);
  writeBar(dark, index, bar, DARK_LAYER);
};

const scratchBar: BarValue = { centerX: 0, centerZ: 0, sizeX: 0, sizeZ: 0 };

export const writeSelectionCorners = (
  frame: SelectionFrameValue,
  spread: number,
  light: Float32Array,
  dark: Float32Array,
  frameIndex: number,
): void => {
  const firstInstance = frameIndex * SELECTION_CORNER_INSTANCE_COUNT;
  const { barLength, barWidth, centerX, centerZ, innerHalfX, innerHalfZ } = frame;
  const outerHalfX = innerHalfX + barWidth;

  for (let corner = 0; corner < SELECTION_CORNER_COUNT; corner += 1) {
    const directionX = DIRECTIONS_X[corner] ?? 1;
    const directionZ = DIRECTIONS_Z[corner] ?? 1;
    const shiftX = centerX + directionX * spread;
    const shiftZ = centerZ + directionZ * spread;

    scratchBar.centerX = shiftX + directionX * (outerHalfX - barLength / 2);
    scratchBar.centerZ = shiftZ + directionZ * (innerHalfZ + barWidth / 2);
    scratchBar.sizeX = barLength;
    scratchBar.sizeZ = barWidth;
    writeBarPair(light, dark, firstInstance + corner * 2, scratchBar);

    scratchBar.centerX = shiftX + directionX * (innerHalfX + barWidth / 2);
    scratchBar.centerZ = shiftZ + directionZ * (innerHalfZ - (barLength - barWidth) / 2);
    scratchBar.sizeX = barWidth;
    scratchBar.sizeZ = barLength - barWidth;
    writeBarPair(light, dark, firstInstance + corner * 2 + 1, scratchBar);
  }
};

export const writeSelectionFrames = (
  frames: readonly SelectionFrameValue[],
  spread: number,
  light: Float32Array,
  dark: Float32Array,
): void => {
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];

    if (frame !== undefined) {
      writeSelectionCorners(frame, spread, light, dark, frameIndex);
    }
  }
};
