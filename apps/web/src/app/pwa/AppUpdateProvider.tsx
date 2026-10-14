import type {
  ReactElement,
  ReactNode,
} from 'react';

import type { IAppUpdateSource } from './appUpdateTypes';

import { AppUpdateContext } from './AppUpdateContext';

interface AppUpdateProviderProps {
  children: ReactNode;
  source: IAppUpdateSource | undefined;
}

export const AppUpdateProvider = ({ children, source }: AppUpdateProviderProps): ReactElement => {
  return <AppUpdateContext value={source}>{children}</AppUpdateContext>;
};
