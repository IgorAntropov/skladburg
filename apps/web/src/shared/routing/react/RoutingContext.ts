import { createContext } from 'react';

import type { ILocationSource } from '../location/locationTypes';

export const RoutingContext = createContext<ILocationSource | undefined>(undefined);
