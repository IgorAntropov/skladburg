import type { QueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';

import type { ApiRuntimeValue } from '@/shared/api';
import type { ILocalizer } from '@/shared/i18n';
import type { ILocationSource } from '@/shared/routing';

import { ApiRuntimeProvider } from '@/shared/api';
import { LocalizerProvider } from '@/shared/i18n';
import { RoutingProvider } from '@/shared/routing';

import type { SectionLoadersValue } from './routing/sectionPages';

import { DEFAULT_SECTION_LOADERS } from './routing/sectionPages';
import { AppShell } from './shell/AppShell';
import { TenantSettingsGate } from './shell/TenantSettingsGate';
import './styles/index.css';

interface AppProps {
  localizer: ILocalizer;
  location: ILocationSource;
  queryClient: QueryClient;
  runtime: ApiRuntimeValue;
  sectionLoaders?: SectionLoadersValue | undefined;
}

export const App = ({
  localizer,
  location,
  queryClient,
  runtime,
  sectionLoaders = DEFAULT_SECTION_LOADERS,
}: AppProps): ReactElement => {
  return (
    <RoutingProvider location={location}>
      <LocalizerProvider localizer={localizer}>
        <ApiRuntimeProvider runtime={runtime}>
          <QueryClientProvider client={queryClient}>
            <TenantSettingsGate localizer={localizer}>
              <AppShell sectionLoaders={sectionLoaders} />
            </TenantSettingsGate>
          </QueryClientProvider>
        </ApiRuntimeProvider>
      </LocalizerProvider>
    </RoutingProvider>
  );
};
