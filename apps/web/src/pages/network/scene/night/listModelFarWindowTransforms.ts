import type { InstanceTransformValue } from '../geometry/composeInstanceMatrix';
import type { NetworkSceneBuildingValue } from '../layout';
import type { ModelWindowSourceValue } from '../mix/createModelWindowSources';
import type { WallWindowOptionsValue } from './listWallWindows';

import { fitWorldModelToFootprint } from '../models/fitWorldModelToFootprint';
import { listWallWindows } from './listWallWindows';
import { FAR_WINDOW_SCALE } from './nightConstants';
import { placeModelWindow } from './placeModelWindow';

const FAR_WALL_OPTIONS: WallWindowOptionsValue = { isClippedToWallLength: true, scale: FAR_WINDOW_SCALE };

export const listModelFarWindowTransforms = (
  building: NetworkSceneBuildingValue,
  source: ModelWindowSourceValue,
): InstanceTransformValue[] => {
  const fit = fitWorldModelToFootprint(source.bounds, building);

  return listWallWindows(source, source.farWalls, fit, FAR_WALL_OPTIONS).map(window => placeModelWindow(window, fit, building));
};
