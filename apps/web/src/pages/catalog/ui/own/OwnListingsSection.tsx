import type {
  ChangeEvent,
  ReactElement,
} from 'react';

import { useMemo } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useOwnListingsQuery } from '@/entities/listing';
import { WidgetStates } from '@/shared/ui';

import type { OwnListingPairValue } from '../../lib/toOwnListingPairs';

import { toOwnListingPairs } from '../../lib/toOwnListingPairs';
import { useDebouncedText } from '../../lib/useDebouncedText';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { useEditLauncher } from '../../model/useEditLauncher';
import { CatalogResultList } from '../CatalogResultList';
import { CatalogSearchField } from '../CatalogSearchField';
import { EditLauncherButton } from '../EditLauncherButton';
import { loadImportPanel } from '../loadImportPanel';
import { OwnListSkeleton } from '../skeleton/OwnListSkeleton';
import { OwnEmpty } from './OwnEmpty';
import { OwnListingsPage } from './OwnListingsPage';

type OwnListingPagesValue = readonly (readonly OwnListingPairValue[])[];

interface OwnListingsSectionProps {
  focus: ObjectRefValue | undefined;
}

const isCatalogEmpty = (pages: OwnListingPagesValue): boolean => pages.every(page => page.length === 0);

export const OwnListingsSection = ({ focus }: OwnListingsSectionProps): ReactElement => {
  const { t } = useCatalogTexts();
  const { appliedText, setText } = useDebouncedText(250);
  const listQuery = useOwnListingsQuery(appliedText);
  const launcher = useEditLauncher(loadImportPanel, 'catalog-import');
  const ImportPanel = launcher.module?.ImportPanel;

  const sourcePages = listQuery.data?.pages;
  const pages = useMemo(() => sourcePages?.map(page => toOwnListingPairs(page.items)), [sourcePages]);
  const rowCount = pages?.reduce((total, page) => total + page.length, 0);

  const title = t('catalog.own.listTitle');
  const selectedListingId = focus?.type === 'listing' ? focus.id : undefined;

  const handleSearch = (event: ChangeEvent<HTMLInputElement>): void => {
    setText(event.currentTarget.value.trim());
  };

  const handleRetry = (): void => {
    void listQuery.refetch();
  };

  return (
    <>
      {ImportPanel !== undefined && <ImportPanel onClose={launcher.close} />}
      <section aria-label={title} className="@container space-y-2" hidden={ImportPanel !== undefined}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base leading-6 font-semibold text-on-panel">{title}</h2>
          {ImportPanel === undefined && (
            <EditLauncherButton
              data-testid="catalog-import-open"
              failureMessage={t('catalog.import.openError')}
              label={t('catalog.import.open')}
              launcher={launcher}
            />
          )}
        </div>
        <CatalogSearchField name="catalog-own-search" onChange={handleSearch} />
        <WidgetStates
          data={pages}
          empty={appliedText === '' ? <OwnEmpty /> : <p>{t('catalog.empty.filtered.text')}</p>}
          error={listQuery.error}
          isEmpty={isCatalogEmpty}
          isRetrying={listQuery.isFetching}
          loadingLabel={t('catalog.own.loading')}
          onRetry={handleRetry}
          skeleton={<OwnListSkeleton />}
        >
          {loadedPages => (
            <CatalogResultList count={rowCount ?? 0} isBusy={listQuery.isRefetching} query={listQuery} testId="catalog-own">
              {loadedPages.map((pairs, pageIndex) => (
                <OwnListingsPage
                  key={pairs[0]?.listing.id ?? pageIndex}
                  pairs={pairs}
                  selectedListingId={selectedListingId}
                />
              ))}
            </CatalogResultList>
          )}
        </WidgetStates>
      </section>
    </>
  );
};
