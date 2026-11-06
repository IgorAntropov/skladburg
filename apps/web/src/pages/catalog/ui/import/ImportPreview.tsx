import type {
  ImportJob,
  ImportRow,
  ImportTemplate,
} from '@skladburg/contracts/import/v1/import';
import type { ReactElement } from 'react';

import { ImportStatus } from '@skladburg/contracts/import/v1/import';
import {
  useRef,
  useState,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';
import {
  Button,
  ErrorNotice,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { ImportTranslate } from '../../i18n/import/importSection';

import { useImportRows } from '../../api/import/useImportQueries';
import { ImportJobAction } from './ImportJobAction';
import { formatImportIssue } from './importPresentation';

interface ImportPreviewProps {
  job: ImportJob;
  onUpdate: (job: ImportJob) => void;
  t: ImportTranslate;
  template: ImportTemplate | undefined;
}

interface PreviewRowProps {
  row: ImportRow;
  t: ImportTranslate;
  template: ImportTemplate | undefined;
}

const PreviewRow = ({ row, t, template }: PreviewRowProps): ReactElement => {
  const { locale, t: mainT } = useI18n();
  const price = row.price?.tiers[0]?.price;

  return (
    <li className="grid gap-1 border-b border-line py-2 wrap-anywhere last:border-b-0">
      <span className="text-sm text-on-panel-muted">{t('catalogImport.row', { row: row.rowNumber })}</span>
      {row.product !== undefined && (
        <p>
          {row.product.name}
          {' '}
          ·
          {' '}
          {row.product.sku}
          {price === undefined ? null : ` · ${formatMoney(locale, price)}`}
        </p>
      )}
      {row.errors.map((error, index) => (
        <p data-testid="catalog-import-row-error" key={`${error.ruleId}:${String(index)}`}>
          {formatImportIssue(t, mainT, template, error)}
        </p>
      ))}
    </li>
  );
};

const PreviewRows = ({ hasErrorsOnly, job, t, template }: Omit<ImportPreviewProps, 'onUpdate'> & {
  hasErrorsOnly: boolean;
}): ReactElement => {
  const query = useImportRows(job.id, hasErrorsOnly);
  const [index, setIndex] = useState(0);
  const pages = query.data?.pages;
  const current = pages?.[index] ?? pages?.at(-1);

  const handleRetry = (): void => {
    void query.refetch();
  };

  const handlePrevious = (): void => {
    setIndex(prev => prev - 1);
  };

  const handleNext = (): void => {
    if (pages !== undefined && index + 1 < pages.length) {
      setIndex(index + 1);
      return;
    }

    void query.fetchNextPage().then((result) => {
      if (result.isSuccess) {
        setIndex(index + 1);
      }
    });
  };

  const canGoNext = query.hasNextPage || (pages !== undefined && index + 1 < pages.length);
  const isPagerShown = canGoNext || index > 0;

  return (
    <WidgetStates
      data={current?.rows}
      empty={<p>{t('catalogImport.emptyRows')}</p>}
      error={query.error}
      isEmpty={rows => rows.length === 0}
      isRetrying={query.isFetching}
      loadingLabel={t('catalogImport.loading')}
      onRetry={handleRetry}
      skeleton={<Skeleton className="h-20 w-full" />}
    >
      {rows => (
        <>
          <ul>{rows.map(row => <PreviewRow key={row.rowNumber} row={row} t={t} template={template} />)}</ul>
          {isPagerShown && (
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={index === 0 || query.isFetchingNextPage} onClick={handlePrevious} variant="secondary">
                {t('catalogImport.previous')}
              </Button>
              <span aria-live="polite">{t('catalogImport.page', { page: index + 1 })}</span>
              <Button disabled={!canGoNext} onClick={handleNext} pending={query.isFetchingNextPage} variant="secondary">
                {t('catalogImport.next')}
              </Button>
            </div>
          )}
          {query.isFetchNextPageError && <ErrorNotice error={query.error} onRetry={handleNext} />}
          {query.isRefetchError && !query.isFetchNextPageError && <ErrorNotice error={query.error} onRetry={handleRetry} />}
        </>
      )}
    </WidgetStates>
  );
};

const handlePreviewFocus = (heading: HTMLHeadingElement | null): void => {
  heading?.focus();
};

export const ImportPreview = ({ job, onUpdate, t, template }: ImportPreviewProps): ReactElement => {
  const summaryQuery = useImportRows(job.id, false);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [hasErrorsOnly, setHasErrorsOnly] = useState(false);

  const fetchedJob = summaryQuery.data?.pages[0]?.job;
  const current = fetchedJob !== undefined && fetchedJob.version >= job.version ? fetchedJob : job;
  const canCommit = current.status === ImportStatus.PREVIEW && current.errorCount === 0 && current.rowCount > 0;
  const status = current.status === ImportStatus.COMMITTED
    ? t('catalogImport.status.committed')
    : current.status === ImportStatus.ROLLED_BACK ? t('catalogImport.status.rolledBack') : t('catalogImport.status.preview');

  const handleUpdate = (updated: ImportJob): void => {
    statusRef.current?.focus();
    onUpdate(updated);
  };

  const handleFilterClick = (): void => {
    setHasErrorsOnly(prev => !prev);
  };

  return (
    <section className="flex min-w-0 flex-col gap-3 border-t border-line pt-4">
      <div>
        <h3 className="font-semibold" ref={handlePreviewFocus} tabIndex={-1}>{t('catalogImport.previewTitle')}</h3>
        <p className="wrap-anywhere">{current.fileName}</p>
        <div aria-live="polite" className="text-sm text-on-panel-muted">
          <p data-testid="catalog-import-status" ref={statusRef} tabIndex={-1}>{status}</p>
          <p>{t('catalogImport.summary', { errors: current.errorCount, rows: current.rowCount })}</p>
        </div>
      </div>
      {current.errorCount > 0 && (
        <Button aria-pressed={hasErrorsOnly} className="self-start" onClick={handleFilterClick} variant="secondary">
          {t('catalogImport.errorsOnly')}
        </Button>
      )}
      <PreviewRows hasErrorsOnly={hasErrorsOnly} job={current} key={String(hasErrorsOnly)} t={t} template={template} />
      {canCommit && (
        <ImportJobAction
          isDisabled={summaryQuery.isError || fetchedJob === undefined}
          job={current}
          key={String(current.version)}
          onSuccess={handleUpdate}
          t={t}
          template={template}
        />
      )}
    </section>
  );
};
