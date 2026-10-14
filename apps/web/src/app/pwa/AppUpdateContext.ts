import { createContext } from 'react';

import type { IAppUpdateSource } from './appUpdateTypes';

export const AppUpdateContext = createContext<IAppUpdateSource | undefined>(undefined);
