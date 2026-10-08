import type {
  ReactElement,
  ReactNode,
} from 'react';

import type { ApiRuntimeValue } from '../runtime/apiRuntimeTypes';

import { ApiRuntimeContext } from './ApiRuntimeContext';

interface ApiRuntimeProviderProps {
  children: ReactNode;
  runtime: ApiRuntimeValue;
}

export const ApiRuntimeProvider = ({ children, runtime }: ApiRuntimeProviderProps): ReactElement => {
  return <ApiRuntimeContext value={runtime}>{children}</ApiRuntimeContext>;
};
