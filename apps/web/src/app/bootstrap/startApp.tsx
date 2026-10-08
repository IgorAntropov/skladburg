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
  syncQueriesWithRealtime,
} from '@/shared/api';
import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import { observeLongTasks } from '@/shared/lib/performance';

import { App } from '../App';
import { StartErrorScreen } from '../shell/StartErrorScreen';

const createProfileLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales,
  catalogLoaders,
  requestedLocale: undefined,
  tenant: defaultTenant,
});

const createStartErrorLocalizer = (): Promise<ILocalizer> => {
  const { defaultLocale } = defaultTenant;

  return createLocalizer({
    bundledLocales: [defaultLocale],
    catalogLoaders: { [defaultLocale]: () => Promise.resolve(defaultLocaleCatalog) },
    requestedLocale: undefined,
    tenant: { availableLocales: [defaultLocale], defaultLocale, termOverrides: {} },
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
  const root = createRoot(rootElement);

  let localizer: ILocalizer | undefined;
  let runtime: ApiRuntimeValue | undefined;
  let stopSync: (() => void) | undefined;

  const releaseRuntime = (): void => {
    const releasedStopSync = stopSync;
    const releasedRuntime = runtime;

    stopSync = undefined;
    runtime = undefined;
    runReleaseStep('stopSync', releasedStopSync);
    runReleaseStep('close', releasedRuntime === undefined
      ? undefined
      : () => {
          releasedRuntime.close();
        });
  };

  const renderStartError = async (onRetry: () => Promise<void>): Promise<void> => {
    try {
      const startErrorLocalizer = localizer ?? await createStartErrorLocalizer();

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
      const appLocalizer = localizer ?? await createProfileLocalizer();
      localizer = appLocalizer;

      const nextRuntime = await createApiRuntime({ defaultOrganizationId: defaultTenant.tenantId });
      runtime = nextRuntime;

      const queryClient = createQueryClient({ networkMode: nextRuntime.networkMode });
      stopSync = syncQueriesWithRealtime({
        demoControl: nextRuntime.demoControl,
        queryClient,
        realtime: nextRuntime.realtime,
      });

      root.render(
        <StrictMode>
          <App localizer={appLocalizer} queryClient={queryClient} runtime={nextRuntime} />
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
