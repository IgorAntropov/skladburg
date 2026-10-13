import type { SceneBoundsValue } from './sceneBounds';

import {
  DEFAULT_HOME_RADIUS_METERS,
  DEFAULT_WORLD_MAX_HEIGHT_METERS,
} from './worldConstants';

export interface SceneHomeAreaValue {
  centerX: number;
  centerZ: number;
  radius: number;
}

export interface SceneWorldValue {
  bounds: SceneBoundsValue;
  home: SceneHomeAreaValue;
  maxHeight: number;
}

export const createSquareWorld = (size: number): SceneWorldValue => {
  const half = size / 2;

  return {
    bounds: { maxX: half, maxZ: half, minX: -half, minZ: -half },
    home: { centerX: 0, centerZ: 0, radius: Math.min(DEFAULT_HOME_RADIUS_METERS, half) },
    maxHeight: DEFAULT_WORLD_MAX_HEIGHT_METERS,
  };
};
