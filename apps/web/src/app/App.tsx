import type { QueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';

import type { ApiRuntimeValue } from '@/shared/api';
import type { ILocalizer } from '@/shared/i18n';

import { ApiRuntimeProvider } from '@/shared/api';
import { LocalizerProvider } from '@/shared/i18n';

import { AppShell } from './shell/AppShell';
import { TenantSettingsGate } from './shell/TenantSettingsGate';
import './styles/index.css';

interface AppProps {
  localizer: ILocalizer;
  queryClient: QueryClient;
  runtime: ApiRuntimeValue;
}

export const App = ({ localizer, queryClient, runtime }: AppProps): ReactElement => {
  return (
    <LocalizerProvider localizer={localizer}>
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>
          <TenantSettingsGate localizer={localizer}>
            <AppShell />
          </TenantSettingsGate>
        </QueryClientProvider>
      </ApiRuntimeProvider>
    </LocalizerProvider>
  );
};
