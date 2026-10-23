import type { WorldPaletteKeyValue } from '@/shared/3d';

import type { WorldModelRoleValue } from './format/worldModelFormat';
import type { WorldModelGroupValue } from './worldModelCatalog';

export type WorldModelRoleKeysValue = Readonly<Record<WorldModelGroupValue, Readonly<Record<WorldModelRoleValue, WorldPaletteKeyValue>>>>;

export const WORLD_MODEL_ROLE_KEYS: WorldModelRoleKeysValue = {
  house: {
    amber: 'sand',
    dark: 'buildingRoof',
    glass: 'windowGlass',
    green: 'treeCrown',
    light: 'buildingWall',
    mid: 'buildingRoofAlt',
    orange: 'buildingRoofAlt',
    red: 'buildingRoof',
    terracotta: 'buildingRoofAlt',
    yellow: 'lampGlow',
  },
  office: {
    amber: 'sand',
    dark: 'buildingRoofAlt',
    glass: 'windowGlass',
    green: 'treeCrown',
    light: 'buildingWall',
    mid: 'buildingRoof',
    orange: 'buildingRoofAlt',
    red: 'buildingRoof',
    terracotta: 'buildingRoof',
    yellow: 'lampGlow',
  },
  warehouse: {
    amber: 'buildingRoofAlt',
    dark: 'road',
    glass: 'windowGlass',
    green: 'treeCrown',
    light: 'warehouseWall',
    mid: 'warehouseRoof',
    orange: 'buildingRoofAlt',
    red: 'buildingRoof',
    terracotta: 'buildingRoof',
    yellow: 'lampGlow',
  },
};
