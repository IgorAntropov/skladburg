import { createContext } from 'react';

import type { IWorldGeometryRegistry } from './createWorldGeometryRegistry';

export const WorldGeometryContext = createContext<IWorldGeometryRegistry | undefined>(undefined);
