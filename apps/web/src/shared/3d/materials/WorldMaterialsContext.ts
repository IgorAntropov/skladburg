import { createContext } from 'react';

import type { WorldPaletteValue } from '../palette/worldPaletteKeys';
import type { IWorldGlowMaterialRegistry } from './createWorldGlowMaterialRegistry';
import type { IWorldMaterialRegistry } from './createWorldMaterialRegistry';

export interface WorldMaterialsContextValue {
  glow: IWorldGlowMaterialRegistry;
  palette: WorldPaletteValue;
  registry: IWorldMaterialRegistry;
}

export const WorldMaterialsContext = createContext<undefined | WorldMaterialsContextValue>(undefined);
