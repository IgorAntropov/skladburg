import type { UseQueryResult } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { ClipboardPen } from 'lucide-react';

import { isReadAccessDenied } from '@/shared/api';
import {
  EmptyState,
  ErrorNotice,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { TransportTranslate } from '../i18n/transportSection';

interface TransportDataProps<TData> {
  children: (data: TData) => ReactNode;
  emptyLabel?: string | undefined;
  icon?: LucideIcon | undefined;
  isEmpty?: ((data: TData) => boolean) | undefined;
  query: UseQueryResult<TData>;
  t: TransportTranslate;
  unavailableTestId?: string | undefined;
}

export const TransportSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-3">
    <Skeleton className="h-5 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-4 w-2/3" />
  </div>
);

export function TransportData<TData>({
  children,
  emptyLabel,
  icon = ClipboardPen,
  isEmpty,
  query,
  t,
  unavailableTestId,
}: TransportDataProps<TData>): ReactElement {
  const handleRetry = (): void => {
    void query.refetch();
  };

  if (isReadAccessDenied(query.error)) {
    return <EmptyState data-testid={unavailableTestId} icon={icon} text={t('transport.unavailable')} />;
  }

  return (
    <WidgetStates
      data={query.data}
      empty={emptyLabel === undefined ? undefined : <EmptyState icon={icon} text={emptyLabel} />}
      error={query.error}
      isEmpty={query.isError ? undefined : isEmpty}
      isRetrying={query.isFetching}
      loadingLabel={t('transport.loading')}
      onRetry={handleRetry}
      skeleton={<TransportSkeleton />}
    >
      {data => (
        <>
          {query.isRefetchError && <ErrorNotice error={query.error} isRetrying={query.isFetching} onRetry={handleRetry} />}
          {children(data)}
        </>
      )}
    </WidgetStates>
  );
}
