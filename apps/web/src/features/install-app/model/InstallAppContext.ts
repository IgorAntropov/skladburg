import { createContext } from 'react';

import type { IInstallPromptSource } from './installTypes';

export const InstallAppContext = createContext<IInstallPromptSource | undefined>(undefined);
