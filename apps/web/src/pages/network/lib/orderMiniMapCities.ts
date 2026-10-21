import { compareCodeUnits } from '@skladburg/contracts/runtime';

import type { MiniMapPointValue } from './projectMiniMap';

export const orderMiniMapCities = (cities: readonly MiniMapPointValue[]): readonly MiniMapPointValue[] => cities.toSorted(
  (current, prev) => current.y - prev.y || current.x - prev.x || compareCodeUnits(current.id, prev.id),
);
