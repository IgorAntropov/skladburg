import type {
  ImportJob,
  ImportTemplate,
} from '@skladburg/contracts/import/v1/import';
import type { ReactElement } from 'react';

import { timestampMs } from '@bufbuild/protobuf/wkt';
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

import { useImportHistory } from '../api/useImportQueries';
import { ImportJobAction } from './ImportJobAction';

interface HistoryItemProps extends ImportHistoryProps {
  job: ImportJob;
}

interface ImportHistoryProps {
  onSelect: (job: ImportJob) => void;
  onUpdate: (job: ImportJob) => void;
  options: ImportOptionsValue;
  template: ImportTemplate | undefined;
}

const HistoryItem = ({ job, onSelect, onUpdate, options, template }: HistoryItemProps): ReactElement => {
  const { formatDateTime, userTimeZone } = useI18n();
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [updated, setUpdated] = useState<ImportJob | undefined>(undefined);
  const { t } = options;
  const current = updated !== undefined && updated.version > job.version ? updated : job;

  const canRollback = current.status === ImportStatus.COMMITTED && current.templateId !== 'opening_stock';
  const status = current.status === ImportStatus.COMMITTED
    ? t('dataImport.status.committed')
    : current.status === ImportStatus.ROLLED_BACK ? t('dataImport.status.rolledBack') : t('dataImport.status.preview');
  const date = current.createdAt === undefined
    ? undefined
    : formatDateTime(timestampMs(current.createdAt), {
        format: { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' },
        timeZone: userTimeZone,
      });

  const handleDetails = (): void => {
    onSelect(current);
  };

  const handleUpdate = (next: ImportJob): void => {
    statusRef.current?.focus();
    setUpdated(next);
    onUpdate(next);
  };

  return (
    <li className="flex min-w-0 flex-col gap-2 border-b border-line py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 wrap-anywhere">
        <p className="font-medium">{current.fileName}</p>
        <p aria-live="polite" className="text-sm text-on-panel-muted" ref={statusRef} tabIndex={-1}>{status}</p>
      </div>
      <p className="text-sm text-on-panel-muted">
        {date === undefined ? null : `${date} · `}
        {t('dataImport.summary', { errors: current.errorCount, rows: current.rowCount })}
      </p>
      <div className="flex flex-wrap items-start gap-2">
        <Button onClick={handleDetails} variant="secondary">{t('dataImport.details')}</Button>
        {canRollback && (
          <ImportJobAction job={current} key={String(current.version)} onSuccess={handleUpdate} options={options} template={template} />
        )}
      </div>
    </li>
  );
};

export const ImportHistory = ({ onSelect, onUpdate, options, template }: ImportHistoryProps): ReactElement => {
  const { t, target } = options;
  const query = useImportHistory(target);
  const jobs = query.data?.pages.flatMap(page => page.jobs);

  const handleRetry = (): void => {
    void query.refetch();
  };

  const handleMore = (): void => {
    void query.fetchNextPage();
  };

  return (
    <section className="flex min-w-0 flex-col gap-2 border-t border-line pt-4" data-testid={`${target.kind}-import-history`}>
      <h3 className="font-semibold">{t('dataImport.history')}</h3>
      <WidgetStates
        data={jobs}
        empty={<p>{t('dataImport.emptyHistory')}</p>}
        error={query.error}
        isEmpty={items => items.length === 0}
        isRetrying={query.isFetching}
        loadingLabel={t('dataImport.loading')}
        onRetry={handleRetry}
        skeleton={<Skeleton className="h-16 w-full" />}
      >
        {items => (
          <ul>
            {items.map(job => (
              <HistoryItem job={job} key={job.id} onSelect={onSelect} onUpdate={onUpdate} options={options} template={template} />
            ))}
          </ul>
        )}
      </WidgetStates>
      {query.isRefetchError && !query.isFetchNextPageError && <ErrorNotice error={query.error} onRetry={handleRetry} />}
      {query.isFetchNextPageError
        ? <ErrorNotice error={query.error} onRetry={handleMore} />
        : query.hasNextPage && (
          <Button className="self-start" onClick={handleMore} pending={query.isFetchingNextPage} variant="secondary">
            {t('dataImport.next')}
          </Button>
        )}
    </section>
  );
};
