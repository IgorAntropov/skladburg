import type { QueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';

import type { IInstallPromptSource } from '@/features/install-app';
import type { ApiRuntimeValue } from '@/shared/api';
import type { ILocalizer } from '@/shared/i18n';
import type { ILocationSource } from '@/shared/routing';
import type { IThemePreferenceStore } from '@/shared/theme';

import { InstallAppProvider } from '@/features/install-app';
import { ApiRuntimeProvider } from '@/shared/api';
import { LocalizerProvider } from '@/shared/i18n';
import { RoutingProvider } from '@/shared/routing';
import { ThemePreferenceProvider } from '@/shared/theme';
import {
  FocusHandoffProvider,
  LiveRegionProvider,
} from '@/shared/ui';

import type { IAppUpdateSource } from './pwa';
import type { SectionLoadersValue } from './routing/sectionPages';

import { AppUpdateProvider } from './pwa';
import { DEFAULT_SECTION_LOADERS } from './routing/sectionPages';
import { ActingContextBoundary } from './shell/ActingContextBoundary';
import { AppShell } from './shell/AppShell';
import { TenantSettingsGate } from './shell/TenantSettingsGate';
import './styles/index.css';

interface AppProps {
  appUpdate?: IAppUpdateSource | undefined;
  installPromptSource?: IInstallPromptSource | undefined;
  localizer: ILocalizer;
  location: ILocationSource;
  queryClient: QueryClient;
  runtime: ApiRuntimeValue;
  sectionLoaders?: SectionLoadersValue | undefined;
  themeStore: IThemePreferenceStore;
}

export const App = ({
  appUpdate,
  installPromptSource,
  localizer,
  location,
  queryClient,
  runtime,
  sectionLoaders = DEFAULT_SECTION_LOADERS,
  themeStore,
}: AppProps): ReactElement => {
  return (
    <ThemePreferenceProvider store={themeStore}>
      <RoutingProvider location={location}>
        <LocalizerProvider localizer={localizer}>
          <ApiRuntimeProvider runtime={runtime}>
            <QueryClientProvider client={queryClient}>
              <LiveRegionProvider>
                <FocusHandoffProvider>
                  <AppUpdateProvider source={appUpdate}>
                    <InstallAppProvider source={installPromptSource}>
                      <ActingContextBoundary>
                        <TenantSettingsGate localizer={localizer}>
                          <AppShell sectionLoaders={sectionLoaders} />
                        </TenantSettingsGate>
                      </ActingContextBoundary>
                    </InstallAppProvider>
                  </AppUpdateProvider>
                </FocusHandoffProvider>
              </LiveRegionProvider>
            </QueryClientProvider>
          </ApiRuntimeProvider>
        </LocalizerProvider>
      </RoutingProvider>
    </ThemePreferenceProvider>
  );
};
