import { createContext } from 'react';

import type { ILocalizer } from '../localizer/localizationTypes';

export const LocalizerContext = createContext<ILocalizer | undefined>(undefined);
