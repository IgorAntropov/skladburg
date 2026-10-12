import type { ReactElement } from 'react';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { createLazyComponent } from '@/shared/lib/module-loader';
import {
  getAddressSection,
  useAddress,
} from '@/shared/routing';
import { useDelayedVisibility } from '@/shared/ui';

import type { SectionLoadersValue } from './sectionPages';

import { useAvailableSections } from '../access';
import { useBootSkeletonTiming } from '../shell/bootSkeletonTiming';
import { createCachedSectionLoaders } from './createCachedSectionLoaders';
import { NoSectionsScreen } from './NoSectionsScreen';
import { ReadyRoutes } from './ReadyRoutes';
import { RouteFrame } from './RouteFrame';
import { createSectionPages } from './sectionPages';
import { SectionRetryContext } from './SectionRetryContext';
import { getSkeletonZones } from './sectionSkeletonZones';
import { SessionErrorScreen } from './SessionErrorScreen';
import { SessionPendingScreen } from './SessionPendingScreen';

const SESSION_ERROR_RESET_KEY = 'session-error';
const NO_SECTIONS_RESET_KEY = 'no-sections';

interface AppRoutesProps {
  sectionLoaders: SectionLoadersValue;
}

export const AppRoutes = ({ sectionLoaders }: AppRoutesProps): ReactElement => {
  const { address, path } = useAddress();
  const availableSections = useAvailableSections();

  const [cachedLoaders] = useState(() => createCachedSectionLoaders(sectionLoaders));
  const [sectionPages, setSectionPages] = useState(() => createSectionPages(cachedLoaders));
  const skeletonTiming = useBootSkeletonTiming();

  const isSessionLoading = availableSections.kind === 'loading';
  const isSkeletonHeld = useDelayedVisibility(isSessionLoading);
  const isSessionPending = isSessionLoading || isSkeletonHeld;
  const sectionToPrewarm = isSessionLoading && address !== undefined ? getAddressSection(address) : undefined;

  const handleSectionRetry = useCallback((section: AppSectionValue): void => {
    console.log('> AppRoutes -> handleSectionRetry:', { section });
    setSectionPages(current => ({ ...current, [section]: createLazyComponent(cachedLoaders[section]) }));
  }, [cachedLoaders]);

  useEffect(() => {
    const prewarmSection = (section: AppSectionValue): void => {
      Promise.resolve(cachedLoaders[section]()).catch((error: unknown) => {
        console.error('> AppRoutes -> prewarmSection:', { error, section });
      });
    };

    if (sectionToPrewarm !== undefined) {
      prewarmSection(sectionToPrewarm);
    }
  }, [cachedLoaders, sectionToPrewarm]);

  if (isSessionPending) {
    return <SessionPendingScreen timing={skeletonTiming} zones={getSkeletonZones(address)} />;
  }

  switch (availableSections.kind) {
    case 'empty':
      return (
        <RouteFrame errorResetKey={NO_SECTIONS_RESET_KEY} path={path}>
          <NoSectionsScreen />
        </RouteFrame>
      );
    case 'error':
      return (
        <RouteFrame errorResetKey={SESSION_ERROR_RESET_KEY} path={path}>
          <SessionErrorScreen
            error={availableSections.error}
            isRetrying={availableSections.isRetrying}
            onRetry={availableSections.onRetry}
          />
        </RouteFrame>
      );
    case 'ready':
      return (
        <SectionRetryContext value={handleSectionRetry}>
          <ReadyRoutes
            cachedLoaders={cachedLoaders}
            landingSection={availableSections.landingSection}
            sectionPages={sectionPages}
            sections={availableSections.sections}
          />
        </SectionRetryContext>
      );
    default: {
      const unhandledSections: never = availableSections;

      return unhandledSections;
    }
  }
};
