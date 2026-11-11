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
import {
  Button,
  ErrorNotice,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { ImportOptionsValue } from '../model/importOptions';

import { useImportRows } from '../api/useImportQueries';
import { ImportJobAction } from './ImportJobAction';
import { formatImportIssue } from './importPresentation';

interface ImportPreviewProps {
  job: ImportJob;
  onChooseFile: () => void;
  onUpdate: (job: ImportJob) => void;
  options: ImportOptionsValue;
  template: ImportTemplate | undefined;
}

interface PreviewRowProps {
  options: ImportOptionsValue;
  row: ImportRow;
  template: ImportTemplate | undefined;
}

const PreviewRow = ({ options, row, template }: PreviewRowProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { formatRow, t, target } = options;
  const description = formatRow(row);

  return (
    <li className="grid gap-1 border-b border-line py-2 wrap-anywhere last:border-b-0">
      <span className="text-sm text-on-panel-muted">{t('dataImport.row', { row: row.rowNumber })}</span>
      {description !== undefined && <p>{description}</p>}
      {row.errors.map((error, index) => (
        <p data-testid={`${target.kind}-import-row-error`} key={`${error.ruleId}:${String(index)}`}>
          {formatImportIssue(options, mainT, template, error)}
        </p>
      ))}
    </li>
  );
};

const PreviewRows = ({ hasErrorsOnly, job, options, template }: Pick<ImportPreviewProps, 'job' | 'options' | 'template'> & {
  hasErrorsOnly: boolean;
}): ReactElement => {
  const { t, target } = options;
  const query = useImportRows(target, job.id, hasErrorsOnly);
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
      empty={<p>{t('dataImport.emptyRows')}</p>}
      error={query.error}
      isEmpty={rows => rows.length === 0}
      isRetrying={query.isFetching}
      loadingLabel={t('dataImport.loading')}
      onRetry={handleRetry}
      skeleton={<Skeleton className="h-20 w-full" />}
    >
      {rows => (
        <>
          <ul>{rows.map(row => <PreviewRow key={row.rowNumber} options={options} row={row} template={template} />)}</ul>
          {isPagerShown && (
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={index === 0 || query.isFetchingNextPage} onClick={handlePrevious} variant="secondary">
                {t('dataImport.previous')}
              </Button>
              <span aria-live="polite">{t('dataImport.page', { page: index + 1 })}</span>
              <Button disabled={!canGoNext} onClick={handleNext} pending={query.isFetchingNextPage} variant="secondary">
                {t('dataImport.next')}
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

export const ImportPreview = ({ job, onChooseFile, onUpdate, options, template }: ImportPreviewProps): ReactElement => {
  const { t, target } = options;
  const summaryQuery = useImportRows(target, job.id, false);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [hasErrorsOnly, setHasErrorsOnly] = useState(false);

  const fetchedJob = summaryQuery.data?.pages[0]?.job;
  const current = fetchedJob !== undefined && fetchedJob.version >= job.version ? fetchedJob : job;
  const canCommit = current.status === ImportStatus.PREVIEW && current.errorCount === 0 && current.rowCount > 0;
  const status = current.status === ImportStatus.COMMITTED
    ? t('dataImport.status.committed')
    : current.status === ImportStatus.ROLLED_BACK ? t('dataImport.status.rolledBack') : t('dataImport.status.preview');

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
        <h3 className="font-semibold" ref={handlePreviewFocus} tabIndex={-1}>{t('dataImport.previewTitle')}</h3>
        <p className="wrap-anywhere">{current.fileName}</p>
        <div aria-live="polite" className="text-sm text-on-panel-muted">
          <p data-testid={`${target.kind}-import-status`} ref={statusRef} tabIndex={-1}>{status}</p>
          <p>{t('dataImport.summary', { errors: current.errorCount, rows: current.rowCount })}</p>
        </div>
      </div>
      {current.errorCount > 0 && (
        <Button aria-pressed={hasErrorsOnly} className="self-start" onClick={handleFilterClick} variant="secondary">
          {t('dataImport.errorsOnly')}
        </Button>
      )}
      <PreviewRows hasErrorsOnly={hasErrorsOnly} job={current} key={String(hasErrorsOnly)} options={options} template={template} />
      {canCommit && (
        <ImportJobAction
          isDisabled={summaryQuery.isError || fetchedJob === undefined}
          job={current}
          key={String(current.version)}
          onChooseFile={onChooseFile}
          onSuccess={handleUpdate}
          options={options}
          template={template}
        />
      )}
    </section>
  );
};
