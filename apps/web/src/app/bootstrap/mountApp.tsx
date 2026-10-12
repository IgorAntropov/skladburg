import type { Root } from 'react-dom/client';

import { StrictMode } from 'react';
import { defaultTenant } from 'virtual:build-profile';

import type { ILocalizer } from '@/shared/i18n';
import type { ILocationSource } from '@/shared/routing';
import type { IThemePreferenceStore } from '@/shared/theme';

import {
  createApiRuntime,
  createQueryClient,
  getTabStorage,
  persistActingContext,
  readPersistedActingContext,
  returnToDefaultPersonaOnDemoReset,
  syncQueriesWithRealtime,
} from '@/shared/api';

import { App } from '../App';
import { removeSearchParam } from './removeSearchParam';

const PERSONA_PARAM = 'as';

export interface MountAppOptionsValue {
  localizer: ILocalizer;
  locationSource: ILocationSource;
  root: Root;
  themeStore: IThemePreferenceStore;
}

interface ReleaseStepValue {
  release: () => void;
  step: string;
}

const runReleaseStep = ({ release, step }: ReleaseStepValue): void => {
  try {
    release();
  }
  catch (error) {
    console.error('> mountApp -> release:', { error, step, tenantId: defaultTenant.tenantId });
  }
};

export const mountApp = async ({
  localizer,
  locationSource,
  root,
  themeStore,
}: MountAppOptionsValue): Promise<() => void> => {
  const tabStorage = getTabStorage(window);
  const releaseSteps: ReleaseStepValue[] = [];

  const release = (): void => {
    for (const releaseStep of releaseSteps.splice(0).reverse()) {
      runReleaseStep(releaseStep);
    }
  };

  try {
    const addressSnapshot = locationSource.read();
    const runtime = await createApiRuntime({
      defaultOrganizationId: defaultTenant.tenantId,
      preferredContext: readPersistedActingContext(tabStorage),
      preferredPersonaId: addressSnapshot.searchParams.get(PERSONA_PARAM) ?? undefined,
    });

    releaseSteps.push({
      release: () => {
        runtime.close();
      },
      step: 'close',
    });
    releaseSteps.push({
      release: persistActingContext(runtime.actingContext, tabStorage),
      step: 'stopPersist',
    });

    if (runtime.demoControl !== undefined && addressSnapshot.searchParams.has(PERSONA_PARAM)) {
      locationSource.navigate(removeSearchParam(addressSnapshot, PERSONA_PARAM), { isReplace: true });
    }

    const queryClient = createQueryClient({ networkMode: runtime.networkMode });

    releaseSteps.push({
      release: syncQueriesWithRealtime({
        demoControl: runtime.demoControl,
        queryClient,
        realtime: runtime.realtime,
      }),
      step: 'stopSync',
    });
    releaseSteps.push({
      release: returnToDefaultPersonaOnDemoReset({
        actingContext: runtime.actingContext,
        defaultOrganizationId: defaultTenant.tenantId,
        demoControl: runtime.demoControl,
        queryClient,
      }),
      step: 'stopReturnToDefaultPersona',
    });

    root.render(
      <StrictMode>
        <App
          localizer={localizer}
          location={locationSource}
          queryClient={queryClient}
          runtime={runtime}
          themeStore={themeStore}
        />
      </StrictMode>,
    );
  }
  catch (error) {
    release();
    throw error;
  }

  return release;
};
