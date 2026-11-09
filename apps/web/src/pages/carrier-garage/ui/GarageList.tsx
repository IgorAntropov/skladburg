import type { DescMethod } from '@bufbuild/protobuf';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { Plus } from 'lucide-react';

import type { CommandAccessValue } from '@/shared/api';

import { useCommandAccess } from '@/entities/session';
import { isReadAccessDenied } from '@/shared/api';
import {
  AccessButton,
  EmptyState,
  ErrorNotice,
  WidgetStates,
} from '@/shared/ui';

import type {
  FleetListKindValue,
  FleetPageReader,
} from '../api/useFleetList';
import type { GarageTranslate } from '../i18n/garageSection';

import { useFleetList } from '../api/useFleetList';
import { GarageSkeleton } from './GarageSkeleton';

interface GarageListProps<TRecord> {
  addLabel: string;
  emptyLabel: string;
  fetchPage: FleetPageReader<TRecord>;
  kind: FleetListKindValue;
  method: DescMethod;
  onEdit: (record: TRecord | undefined) => void;
  renderRecord: (record: TRecord, access: CommandAccessValue) => ReactNode;
  t: GarageTranslate;
  testId: string;
}

export function GarageList<TRecord extends { id: string }>({
  addLabel,
  emptyLabel,
  fetchPage,
  kind,
  method,
  onEdit,
  renderRecord,
  t,
  testId,
}: GarageListProps<TRecord>): ReactElement {
  const query = useFleetList(kind, fetchPage);
  const access = useCommandAccess(method, { kind: 'organization' });
  const data = isReadAccessDenied(query.error) ? undefined : query.data;

  const handleAdd = (): void => {
    onEdit(undefined);
  };

  const handleRetry = (): void => {
    void query.refetch();
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3" data-testid={testId}>
      <AccessButton access={access} data-testid={`${testId}-add`} onClick={handleAdd}>
        <Plus aria-hidden className="size-4" />
        {addLabel}
      </AccessButton>
      <WidgetStates
        data={data}
        empty={<EmptyState icon={Plus} text={emptyLabel} />}
        error={query.error}
        isEmpty={records => records.length === 0 && !query.isError}
        isRetrying={query.isFetching}
        loadingLabel={t('garage.loading')}
        onRetry={handleRetry}
        skeleton={<GarageSkeleton />}
      >
        {records => (
          <>
            {query.isRefetchError && <ErrorNotice error={query.error} isRetrying={query.isFetching} onRetry={handleRetry} />}
            <ul className="flex min-w-0 flex-col gap-2">
              {records.map(record => (
                <li className="rounded-control border border-line px-3 py-2" key={record.id}>
                  {renderRecord(record, access)}
                </li>
              ))}
            </ul>
          </>
        )}
      </WidgetStates>
    </div>
  );
}
