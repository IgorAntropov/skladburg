import { createContext } from 'react';

import type { WorldPaletteValue } from '../palette/worldPaletteKeys';
import type { IWorldMaterialRegistry } from './createWorldMaterialRegistry';

export interface WorldMaterialsContextValue {
  palette: WorldPaletteValue;
  registry: IWorldMaterialRegistry;
}

export const WorldMaterialsContext = createContext<undefined | WorldMaterialsContextValue>(undefined);
