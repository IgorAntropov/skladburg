import { createContext } from 'react';

import type { AvailableSectionsValue } from './availableSectionsTypes';

export const AvailableSectionsContext = createContext<AvailableSectionsValue | undefined>(undefined);
