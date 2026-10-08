import type { ReactElement } from 'react';

import { useState } from 'react';

import { useAddress } from '@/shared/routing';

import type { SectionLoadersValue } from './sectionPages';

import { useAvailableSections } from '../access';
import { createCachedSectionLoaders } from './createCachedSectionLoaders';
import { NoSectionsScreen } from './NoSectionsScreen';
import { ReadyRoutes } from './ReadyRoutes';
import { RouteFrame } from './RouteFrame';
import { createSectionPages } from './sectionPages';
import { SessionErrorScreen } from './SessionErrorScreen';
import { SessionPendingScreen } from './SessionPendingScreen';

const SESSION_ERROR_RESET_KEY = 'session-error';
const NO_SECTIONS_RESET_KEY = 'no-sections';

interface AppRoutesProps {
  sectionLoaders: SectionLoadersValue;
}

export const AppRoutes = ({ sectionLoaders }: AppRoutesProps): ReactElement => {
  const { path } = useAddress();
  const availableSections = useAvailableSections();

  const [cachedLoaders] = useState(() => createCachedSectionLoaders(sectionLoaders));
  const [sectionPages] = useState(() => createSectionPages(cachedLoaders));

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
    case 'loading':
      return <SessionPendingScreen />;
    case 'ready':
      return (
        <ReadyRoutes
          cachedLoaders={cachedLoaders}
          landingSection={availableSections.landingSection}
          sectionPages={sectionPages}
          sections={availableSections.sections}
        />
      );
    default: {
      const unhandledSections: never = availableSections;

      return unhandledSections;
    }
  }
};
