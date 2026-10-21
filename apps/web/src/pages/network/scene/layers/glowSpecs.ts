import type { WorldGlowMaterialSpecValue } from '@/shared/3d';

import {
  LAMP_HALO_SHELL_STRENGTH,
  LAMP_POOL_DISC_STRENGTH,
} from '../night';

export const UNLIT_SIDE_SPECS = {
  carrier: { key: 'sideCarrier', kind: 'unlit' },
  customer: { key: 'sideCustomer', kind: 'unlit' },
  supplier: { key: 'sideSupplier', kind: 'unlit' },
} as const satisfies Record<string, WorldGlowMaterialSpecValue>;

export const UNLIT_RIM_SPEC: WorldGlowMaterialSpecValue = { key: 'sideRim', kind: 'unlit' };

export const UNLIT_ROAD_SPEC: WorldGlowMaterialSpecValue = { key: 'road', kind: 'unlit' };

export const WINDOW_GLOW_SPEC: WorldGlowMaterialSpecValue = {
  key: 'windowGlow',
  kind: 'nightOpaque',
  offKey: 'windowGlass',
};

export const LAMP_HEAD_GLOW_SPEC: WorldGlowMaterialSpecValue = {
  key: 'lampGlow',
  kind: 'nightOpaque',
  offKey: 'road',
};

export const LAMP_POOL_GLOW_SPEC: WorldGlowMaterialSpecValue = {
  key: 'lightPool',
  kind: 'nightAdditive',
  strength: LAMP_POOL_DISC_STRENGTH,
};

export const LAMP_HALO_GLOW_SPEC: WorldGlowMaterialSpecValue = {
  key: 'lightPool',
  kind: 'nightAdditive',
  strength: LAMP_HALO_SHELL_STRENGTH,
};
