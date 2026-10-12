import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  bundledLocales,
  catalogLoaders,
  defaultLocaleCatalog,
  defaultTenant,
} from 'virtual:build-profile';

import type { ILocalizer } from '@/shared/i18n';
import type { ChunkRecoveryValue } from '@/shared/lib/module-loader';

import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import {
  ChunkLoadError,
  createCachedModuleLoader,
  getChunkRecovery,
} from '@/shared/lib/module-loader';
import { observeLongTasks } from '@/shared/lib/performance';
import {
  createHashLocation,
  parseAddressPath,
  RoutingProvider,
} from '@/shared/routing';
import {
  bindThemeToDocument,
  createThemePreferenceStore,
  getDeviceStorage,
} from '@/shared/theme';

import { BOOT_SKELETON_TIMING } from '../shell/bootSkeletonTiming';
import { ShellSkeleton } from '../shell/ShellSkeleton';
import { StartErrorScreen } from '../shell/StartErrorScreen';
import '../styles/index.css';
import { readColorSchemeQuery } from './readColorSchemeQuery';
import { readDeviceTimeZone } from './readDeviceTimeZone';

type MountAppFunction = typeof import('./mountApp').mountApp;

type StartPartsOutcomeValue
  = | { error: unknown; kind: 'failed' }
    | { kind: 'loaded'; parts: StartPartsValue };

interface StartPartsValue {
  appLocalizer: ILocalizer;
  mountApp: MountAppFunction;
}

const getStartRecovery = (error: unknown): ChunkRecoveryValue => {
  return error instanceof ChunkLoadError ? getChunkRecovery(error) : 'retry';
};

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
  const loadMountApp = createCachedModuleLoader(() => import('./mountApp'));

  let localizer: ILocalizer | undefined;
  let startErrorLocalizer: ILocalizer | undefined;
  let releaseApp: (() => void) | undefined;

  const getStartErrorLocalizer = async (): Promise<ILocalizer> => {
    startErrorLocalizer ??= await createStartErrorLocalizer(userTimeZone);

    return startErrorLocalizer;
  };

  const loadStartParts = async (): Promise<StartPartsValue> => {
    const [appLocalizer, { mountApp }] = await Promise.all([
      localizer ?? createProfileLocalizer(userTimeZone),
      loadMountApp(),
    ]);
    localizer = appLocalizer;

    return { appLocalizer, mountApp };
  };

  const beginLoadingStartParts = (): Promise<StartPartsOutcomeValue> => {
    return loadStartParts().then(
      (parts): StartPartsOutcomeValue => ({ kind: 'loaded', parts }),
      (error: unknown): StartPartsOutcomeValue => ({ error, kind: 'failed' }),
    );
  };

  const renderSkeleton = async (): Promise<void> => {
    try {
      const skeletonLocalizer = await getStartErrorLocalizer();

      root.render(
        <StrictMode>
          <LocalizerProvider localizer={skeletonLocalizer}>
            <ShellSkeleton address={parseAddressPath(locationSource.read().path)} timing={BOOT_SKELETON_TIMING} />
          </LocalizerProvider>
        </StrictMode>,
      );
    }
    catch (error) {
      console.error('> startApp -> renderSkeleton:', { error, tenantId: defaultTenant.tenantId });
    }
  };

  const renderStartError = async (onRetry: () => Promise<void>, recovery: ChunkRecoveryValue): Promise<void> => {
    try {
      const errorLocalizer = localizer ?? await getStartErrorLocalizer();

      root.render(
        <StrictMode>
          <RoutingProvider location={locationSource}>
            <LocalizerProvider localizer={errorLocalizer}>
              <StartErrorScreen onRetry={onRetry} recovery={recovery} />
            </LocalizerProvider>
          </RoutingProvider>
        </StrictMode>,
      );
    }
    catch (error) {
      console.error('> startApp -> renderStartError:', { error, tenantId: defaultTenant.tenantId });
    }
  };

  const tryStart = async (loadingParts: Promise<StartPartsOutcomeValue> = beginLoadingStartParts()): Promise<void> => {
    releaseApp?.();
    releaseApp = undefined;

    try {
      const outcome = await loadingParts;

      if (outcome.kind === 'failed') {
        throw outcome.error;
      }

      releaseApp = await outcome.parts.mountApp({
        localizer: outcome.parts.appLocalizer,
        locationSource,
        root,
        themeStore,
      });
    }
    catch (error) {
      console.error('> startApp -> tryStart:', { error, tenantId: defaultTenant.tenantId });
      await renderStartError(() => tryStart(), getStartRecovery(error));
    }
  };

  if (import.meta.env.DEV) {
    observeLongTasks();
  }

  const firstLoadingParts = beginLoadingStartParts();

  await renderSkeleton();
  await tryStart(firstLoadingParts);
};
