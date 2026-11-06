import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  Button,
  ErrorNotice,
} from '@/shared/ui';

import { useFocusNewRows } from '../lib/useFocusNewRows';
import { useCatalogTexts } from '../model/useCatalogTexts';

interface CatalogResultListProps {
  children: ReactNode;
  count: number;
  isBusy: boolean;
  query: CatalogResultQueryValue;
  testId: 'catalog-own' | 'catalog-showcase';
}

interface CatalogResultQueryValue {
  error: Error | null;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
}

export const CatalogResultList = ({ children, count, isBusy, query, testId }: CatalogResultListProps): ReactElement => {
  const { t } = useCatalogTexts();
  const { expectNewRows, listRef } = useFocusNewRows(count);

  const handleMore = (): void => {
    expectNewRows();
    void query.fetchNextPage();
  };

  return (
    <div className="@container flex flex-col gap-3">
      <p aria-live="polite" className="sr-only">{t('catalog.showcase.shown', { count })}</p>
      <ul aria-busy={isBusy || undefined} className="flex flex-col gap-2" data-testid={`${testId}-list`} ref={listRef}>
        {children}
      </ul>
      {query.isFetchNextPageError
        ? <ErrorNotice error={query.error} isRetrying={query.isFetchingNextPage} onRetry={handleMore} />
        : query.hasNextPage && (
          <Button
            className="self-center"
            data-testid={testId === 'catalog-own' ? 'catalog-own-show-more' : 'catalog-show-more'}
            onClick={handleMore}
            pending={query.isFetchingNextPage}
            pendingLabel={t('catalog.showcase.moreLoading')}
            variant="secondary"
          >
            {t('catalog.showcase.more')}
          </Button>
        )}
    </div>
  );
};
