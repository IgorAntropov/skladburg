import type { InstanceTransformValue } from '../geometry/composeInstanceMatrix';
import type { NetworkSceneBuildingValue } from '../layout';
import type { ModelWindowSourceValue } from '../mix/createModelWindowSources';
import type { WallWindowOptionsValue } from './listWallWindows';

import { fitWorldModelToFootprint } from '../models/fitWorldModelToFootprint';
import { listWallWindows } from './listWallWindows';
import { placeModelWindow } from './placeModelWindow';

const NEAR_WALL_OPTIONS: WallWindowOptionsValue = { isClippedToWallLength: false, scale: 1 };

export const listModelWindowTransforms = (
  building: NetworkSceneBuildingValue,
  source: ModelWindowSourceValue,
): InstanceTransformValue[] => {
  const fit = fitWorldModelToFootprint(source.bounds, building);
  const windows = source.walls === undefined
    ? source.glass
    : [...source.glass, ...listWallWindows(source, source.walls, fit, NEAR_WALL_OPTIONS)];

  return windows.map(window => placeModelWindow(window, fit, building));
};
