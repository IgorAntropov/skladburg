import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  bundledLocales,
  catalogLoaders,
  defaultLocaleCatalog,
  defaultTenant,
} from 'virtual:build-profile';

import type { ILocalizer } from '@/shared/i18n';

import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';

import { App } from '../App';
import { StartErrorScreen } from '../shell/StartErrorScreen';
import { loadAppContext } from './loadAppContext';

const createStartErrorLocalizer = (): Promise<ILocalizer> => {
  const { defaultLocale } = defaultTenant;

  return createLocalizer({
    bundledLocales: [defaultLocale],
    catalogLoaders: { [defaultLocale]: () => Promise.resolve(defaultLocaleCatalog) },
    requestedLocale: undefined,
    tenant: { availableLocales: [defaultLocale], defaultLocale, termOverrides: {} },
  });
};

export const startApp = async (rootElement: HTMLElement): Promise<void> => {
  const root = createRoot(rootElement);

  const tryRenderApp = async (): Promise<boolean> => {
    try {
      const { localizer, tenantSettings } = await loadAppContext({ bundledLocales, catalogLoaders, defaultTenant });

      root.render(
        <StrictMode>
          <App localizer={localizer} tenantSettings={tenantSettings} />
        </StrictMode>,
      );

      return true;
    }
    catch (error) {
      console.error('> startApp -> tryRenderApp:', { error, tenantId: defaultTenant.tenantId });

      return false;
    }
  };

  const retryRenderApp = async (): Promise<void> => {
    await tryRenderApp();
  };

  const isStarted = await tryRenderApp();

  if (isStarted) {
    return;
  }

  try {
    const startErrorLocalizer = await createStartErrorLocalizer();

    root.render(
      <StrictMode>
        <LocalizerProvider localizer={startErrorLocalizer}>
          <StartErrorScreen onRetry={retryRenderApp} />
        </LocalizerProvider>
      </StrictMode>,
    );
  }
  catch (error) {
    console.error('> startApp -> renderStartError:', { error, tenantId: defaultTenant.tenantId });
  }
};
