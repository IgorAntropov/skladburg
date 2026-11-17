import type { WorldPaletteKeyValue } from '@/shared/3d';

import type { WorldModelRoleValue } from './format/worldModelFormat';
import type { WorldModelGroupValue } from './worldModelCatalog';

export type WorldModelMaterialGroupValue = 'scenery' | WorldModelGroupValue;

export type WorldModelRoleKeysValue = Readonly<
  Record<WorldModelMaterialGroupValue, Readonly<Record<WorldModelRoleValue, WorldPaletteKeyValue>>>
>;

export const WORLD_MODEL_ROLE_KEYS: WorldModelRoleKeysValue = {
  house: {
    amber: 'sand',
    dark: 'buildingBrick',
    glass: 'windowGlass',
    green: 'treeCrown',
    light: 'buildingWall',
    mid: 'buildingRoofAlt',
    orange: 'buildingRoofAlt',
    red: 'buildingBrick',
    terracotta: 'buildingRoofAlt',
    yellow: 'buildingRoofAlt',
  },
  office: {
    amber: 'sand',
    dark: 'buildingRoofAlt',
    glass: 'windowGlass',
    green: 'treeCrown',
    light: 'buildingWall',
    mid: 'buildingBrick',
    orange: 'buildingRoofAlt',
    red: 'buildingBrick',
    terracotta: 'buildingBrick',
    yellow: 'buildingRoofAlt',
  },
  scenery: {
    amber: 'sand',
    dark: 'road',
    glass: 'windowGlass',
    green: 'treeCrown',
    light: 'warehouseWall',
    mid: 'plaza',
    orange: 'buildingRoofAlt',
    red: 'buildingBrick',
    terracotta: 'treeTrunk',
    yellow: 'buildingRoofAlt',
  },
  warehouse: {
    amber: 'buildingRoofAlt',
    dark: 'road',
    glass: 'windowGlass',
    green: 'treeCrown',
    light: 'warehouseWall',
    mid: 'warehouseRoof',
    orange: 'buildingRoofAlt',
    red: 'buildingBrick',
    terracotta: 'buildingBrick',
    yellow: 'buildingRoofAlt',
  },
};
