import { createContext } from 'react';

import type { ApiRuntimeValue } from '../runtime/apiRuntimeTypes';

export const ApiRuntimeContext = createContext<ApiRuntimeValue | undefined>(undefined);
