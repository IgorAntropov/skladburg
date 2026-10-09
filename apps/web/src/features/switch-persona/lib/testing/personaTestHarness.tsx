import type { QueryClient } from '@tanstack/react-query';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { defaultLocaleCatalog } from 'virtual:build-profile';

import type {
  ApiRuntimeValue,
  DemoPersonaListItemValue,
  IDemoControl,
} from '@/shared/api';
import type { ILocalizer } from '@/shared/i18n';

import { ApiRuntimeProvider } from '@/shared/api';
import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import {
  FocusHandoffProvider,
  LiveRegionProvider,
} from '@/shared/ui';

interface PersonaProvidersProps {
  children: ReactNode;
  localizer: ILocalizer;
  queryClient: QueryClient;
  runtime: ApiRuntimeValue;
}

export const createPersonaTestLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

export const createPersonaDemoControl = (listPersonas: IDemoControl['listPersonas']): IDemoControl => ({
  listPersonas,
  onReset: () => () => undefined,
  onStatus: () => () => undefined,
  reset: () => Promise.resolve(),
});

export const setActingPersona = (runtime: ApiRuntimeValue, persona: DemoPersonaListItemValue): void => {
  runtime.actingContext.set({ organizationId: persona.organizationId, userId: persona.userId });
};

export const PersonaProviders = ({ children, localizer, queryClient, runtime }: PersonaProvidersProps): ReactElement => (
  <LocalizerProvider localizer={localizer}>
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>
        <LiveRegionProvider>
          <FocusHandoffProvider>{children}</FocusHandoffProvider>
        </LiveRegionProvider>
      </QueryClientProvider>
    </ApiRuntimeProvider>
  </LocalizerProvider>
);
