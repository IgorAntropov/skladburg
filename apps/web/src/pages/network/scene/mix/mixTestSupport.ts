import type { NetworkSceneBuildingValue } from '../layout';
import type { WorldModelDataValue } from '../models/format/worldModelFormat';

import { WORLD_MODEL_CATALOG } from '../models/worldModelCatalog';
import { createTestWorldModel } from '../models/worldModelTestSupport';

export const createMixBuilding = (
  id: string,
  overrides: Partial<NetworkSceneBuildingValue> = {},
): NetworkSceneBuildingValue => ({
  cityId: 'city',
  depth: 1.2,
  height: 1.4,
  id,
  isCompany: false,
  isOwn: false,
  kind: 'house',
  rank: 0.5,
  rotation: 0.3,
  side: undefined,
  siteId: undefined,
  width: 1.3,
  x: 4,
  z: -2,
  ...overrides,
});

export const createCatalogModels = (): Map<string, WorldModelDataValue> => new Map(
  WORLD_MODEL_CATALOG.map((entry): [string, WorldModelDataValue] => [entry.id, createTestWorldModel()]),
);

export const createSyntheticBuildings = (
  count: number,
  overrides: Partial<NetworkSceneBuildingValue> = {},
): NetworkSceneBuildingValue[] => Array.from(
  { length: count },
  (_, index) => createMixBuilding(`decor:synthetic:${String(index)}`, overrides),
);
