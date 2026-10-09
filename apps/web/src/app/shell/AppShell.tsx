import type { ReactElement } from 'react';

import type { SectionLoadersValue } from '../routing/sectionPages';

import { SessionSectionsProvider } from '../access';
import { useDocumentSync } from '../lib/useDocumentSync';
import { AppRoutes } from '../routing/AppRoutes';
import { AppTopBar } from './AppTopBar';

interface AppShellProps {
  sectionLoaders: SectionLoadersValue;
}

export const AppShell = ({ sectionLoaders }: AppShellProps): ReactElement => {
  useDocumentSync();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-on-canvas">
      <SessionSectionsProvider>
        <AppTopBar />
        <AppRoutes sectionLoaders={sectionLoaders} />
      </SessionSectionsProvider>
    </div>
  );
};
