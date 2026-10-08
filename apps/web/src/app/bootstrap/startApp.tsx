import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  bundledLocales,
  catalogLoaders,
  defaultLocaleCatalog,
  defaultTenant,
} from 'virtual:build-profile';

import type { ApiRuntimeValue } from '@/shared/api';
import type { ILocalizer } from '@/shared/i18n';

import {
  createApiRuntime,
  createQueryClient,
  getTabStorage,
  persistActingContext,
  readPersistedActingContext,
  syncQueriesWithRealtime,
} from '@/shared/api';
import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import { observeLongTasks } from '@/shared/lib/performance';
import { createHashLocation } from '@/shared/routing';
import {
  bindThemeToDocument,
  createThemePreferenceStore,
  getDeviceStorage,
} from '@/shared/theme';

import { App } from '../App';
import { StartErrorScreen } from '../shell/StartErrorScreen';
import { readColorSchemeQuery } from './readColorSchemeQuery';
import { readDeviceTimeZone } from './readDeviceTimeZone';
import { removeSearchParam } from './removeSearchParam';

const PERSONA_PARAM = 'as';

const createProfileLocalizer = (userTimeZone: string): Promise<ILocalizer> => createLocalizer({
  bundledLocales,
  catalogLoaders,
  requestedLocale: undefined,
  tenant: defaultTenant,
  userTimeZone,
});

const createStartErrorLocalizer = (userTimeZone: string): Promise<ILocalizer> => {
  const { defaultLocale } = defaultTenant;

  return createLocalizer({
    bundledLocales: [defaultLocale],
    catalogLoaders: { [defaultLocale]: () => Promise.resolve(defaultLocaleCatalog) },
    requestedLocale: undefined,
    tenant: { availableLocales: [defaultLocale], defaultLocale, termOverrides: {} },
    userTimeZone,
  });
};

const runReleaseStep = (step: string, release: (() => void) | undefined): void => {
  try {
    release?.();
  }
  catch (error) {
    console.error('> startApp -> release:', { error, step, tenantId: defaultTenant.tenantId });
  }
};

export const startApp = async (rootElement: HTMLElement): Promise<void> => {
  const themeStore = createThemePreferenceStore({
    colorSchemeQuery: readColorSchemeQuery(window),
    storage: getDeviceStorage(window),
    storageEvents: window,
  });

  bindThemeToDocument(themeStore, document.documentElement);

  const root = createRoot(rootElement);
  const userTimeZone = readDeviceTimeZone();
  const locationSource = createHashLocation(window);
  const tabStorage = getTabStorage(window);

  let localizer: ILocalizer | undefined;
  let runtime: ApiRuntimeValue | undefined;
  let stopSync: (() => void) | undefined;
  let stopPersist: (() => void) | undefined;

  const releaseRuntime = (): void => {
    const releasedStopSync = stopSync;
    const releasedStopPersist = stopPersist;
    const releasedRuntime = runtime;

    stopSync = undefined;
    stopPersist = undefined;
    runtime = undefined;
    runReleaseStep('stopSync', releasedStopSync);
    runReleaseStep('stopPersist', releasedStopPersist);
    runReleaseStep('close', releasedRuntime === undefined
      ? undefined
      : () => {
          releasedRuntime.close();
        });
  };

  const renderStartError = async (onRetry: () => Promise<void>): Promise<void> => {
    try {
      const startErrorLocalizer = localizer ?? await createStartErrorLocalizer(userTimeZone);

      root.render(
        <StrictMode>
          <LocalizerProvider localizer={startErrorLocalizer}>
            <StartErrorScreen onRetry={onRetry} />
          </LocalizerProvider>
        </StrictMode>,
      );
    }
    catch (error) {
      console.error('> startApp -> renderStartError:', { error, tenantId: defaultTenant.tenantId });
    }
  };

  const tryStart = async (): Promise<void> => {
    releaseRuntime();

    try {
      const appLocalizer = localizer ?? await createProfileLocalizer(userTimeZone);
      localizer = appLocalizer;

      const addressSnapshot = locationSource.read();
      const nextRuntime = await createApiRuntime({
        defaultOrganizationId: defaultTenant.tenantId,
        preferredContext: readPersistedActingContext(tabStorage),
        preferredPersonaId: addressSnapshot.searchParams.get(PERSONA_PARAM) ?? undefined,
      });
      runtime = nextRuntime;
      stopPersist = persistActingContext(nextRuntime.actingContext, tabStorage);

      if (nextRuntime.demoControl !== undefined && addressSnapshot.searchParams.has(PERSONA_PARAM)) {
        locationSource.navigate(removeSearchParam(addressSnapshot, PERSONA_PARAM), { isReplace: true });
      }

      const queryClient = createQueryClient({ networkMode: nextRuntime.networkMode });
      stopSync = syncQueriesWithRealtime({
        demoControl: nextRuntime.demoControl,
        queryClient,
        realtime: nextRuntime.realtime,
      });

      root.render(
        <StrictMode>
          <App
            localizer={appLocalizer}
            location={locationSource}
            queryClient={queryClient}
            runtime={nextRuntime}
            themeStore={themeStore}
          />
        </StrictMode>,
      );
    }
    catch (error) {
      console.error('> startApp -> tryStart:', { error, tenantId: defaultTenant.tenantId });
      releaseRuntime();
      await renderStartError(tryStart);
    }
  };

  if (import.meta.env.DEV) {
    observeLongTasks();
  }

  await tryStart();
};
