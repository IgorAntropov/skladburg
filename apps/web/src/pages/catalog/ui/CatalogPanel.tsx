import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { WidgetStates } from '@/shared/ui';

import { useCatalogAccess } from '../api/useCatalogAccess';
import { useCatalogTexts } from '../model/useCatalogTexts';
import { CatalogHeading } from './CatalogHeading';
import { CatalogTabs } from './CatalogTabs';
import { CatalogTextsGate } from './CatalogTextsGate';
import { ShowcasePanelSkeleton } from './showcase/ShowcasePanelSkeleton';

interface CatalogPanelProps {
  focus: ObjectRefValue | undefined;
}

const CatalogPanelContent = ({ focus }: CatalogPanelProps): ReactElement => {
  const { t } = useCatalogTexts();
  const { access, error, isRetrying, retry } = useCatalogAccess();

  return (
    <>
      <CatalogHeading description={t('catalog.description')} />
      <WidgetStates
        data={access}
        error={error}
        isRetrying={isRetrying}
        loadingLabel={t('catalog.showcase.loading')}
        onRetry={retry}
        skeleton={<ShowcasePanelSkeleton />}
      >
        {resolvedAccess => <CatalogTabs access={resolvedAccess} focus={focus} />}
      </WidgetStates>
    </>
  );
};

export const CatalogPanel = ({ focus }: CatalogPanelProps): ReactElement => (
  <div className="flex min-h-0 flex-1 flex-col gap-4">
    <CatalogTextsGate
      skeleton={(
        <>
          <CatalogHeading description={undefined} />
          <ShowcasePanelSkeleton />
        </>
      )}
    >
      <CatalogPanelContent focus={focus} />
    </CatalogTextsGate>
  </div>
);
