import type { ReactElement } from 'react';

import type { SectionLoadersValue } from '../routing/sectionPages';

import { SessionSectionsProvider } from '../access';
import { AppUpdateNotice } from '../pwa';
import { AppRoutes } from '../routing/AppRoutes';
import { AppTopBar } from './AppTopBar';

interface AppShellProps {
  sectionLoaders: SectionLoadersValue;
}

export const AppShell = ({ sectionLoaders }: AppShellProps): ReactElement => (
  <div className="flex min-h-dvh flex-col bg-canvas text-on-canvas">
    <SessionSectionsProvider>
      <AppTopBar />
      <AppUpdateNotice />
      <AppRoutes sectionLoaders={sectionLoaders} />
    </SessionSectionsProvider>
  </div>
);
