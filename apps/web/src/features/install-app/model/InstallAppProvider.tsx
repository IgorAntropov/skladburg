import type {
  ReactElement,
  ReactNode,
} from 'react';

import type { IInstallPromptSource } from './installTypes';

import { InstallAppContext } from './InstallAppContext';

interface InstallAppProviderProps {
  children: ReactNode;
  source: IInstallPromptSource | undefined;
}

export const InstallAppProvider = ({ children, source }: InstallAppProviderProps): ReactElement => {
  return <InstallAppContext value={source}>{children}</InstallAppContext>;
};
