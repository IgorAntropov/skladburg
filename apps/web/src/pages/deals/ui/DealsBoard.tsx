import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { ReactElement } from 'react';

import { useQuery } from '@tanstack/react-query';

import { AssistantPortrait } from '@/entities/assistant';
import { useApiClient } from '@/shared/api';
import {
  EmptyState,
  Skeleton,
  Tabs,
  WidgetStates,
} from '@/shared/ui';

import type { DealsTranslate } from '../i18n/dealsSection';

import { createDealsQueryOptions } from '../api/dealQueryOptions';
import { getDealCounterpartyId } from '../lib/getDealCounterpartyId';
import { groupDeals } from '../lib/groupDeals';
import { DealRow } from './DealRow';

interface DealsBoardProps {
  names: ReadonlyMap<string, string>;
  organizationId: string;
  selectedId: string | undefined;
  t: DealsTranslate;
  userId: string;
}

const TAB_IDS = ['mine', 'active', 'closed'] as const;

export const DealsBoardSkeleton = (): ReactElement => (
  <div aria-hidden className="flex flex-col gap-2">
    <Skeleton className="h-11 w-64 max-w-full" />
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-20 w-full" />
  </div>
);

const DealsTabs = ({
  deals,
  names,
  organizationId,
  selectedId,
  t,
}: Omit<DealsBoardProps, 'userId'> & { deals: readonly Deal[] }): ReactElement => {
  const grouped = groupDeals(deals, organizationId);
  const selectedGroup = TAB_IDS.find(id => grouped[id].some(deal => deal.id === selectedId));
  const defaultTabId = selectedGroup ?? (grouped.mine.length > 0 ? 'mine' : 'active');

  return (
    <Tabs
      defaultTabId={defaultTabId}
      items={TAB_IDS.map(id => ({
        content: (
          <div className="flex flex-1 flex-col" data-testid={`deals-group-${id}`}>
            {grouped[id].length === 0
              ? (
                  <EmptyState
                    className="min-h-36"
                    data-testid="deals-empty"
                    media={<AssistantPortrait size="sm" />}
                    text={t(`deals.empty.${id}`)}
                  />
                )
              : (
                  <ul className="flex flex-col gap-2">
                    {grouped[id].map(deal => (
                      <DealRow
                        counterpartyName={names.get(getDealCounterpartyId(deal, organizationId))}
                        deal={deal}
                        isSelected={deal.id === selectedId}
                        key={deal.id}
                        organizationId={organizationId}
                        t={t}
                      />
                    ))}
                  </ul>
                )}
          </div>
        ),
        count: grouped[id].length,
        id,
        label: t(`deals.tab.${id}`),
      }))}
      label={t('deals.board.label')}
    />
  );
};

export const DealsBoard = ({ names, organizationId, selectedId, t, userId }: DealsBoardProps): ReactElement => {
  const client = useApiClient();
  const { data, error, isFetching, refetch } = useQuery(createDealsQueryOptions({ client, organizationId, userId }, true));

  const handleRetry = (): void => {
    void refetch();
  };

  return (
    <WidgetStates
      data={data}
      error={error}
      isRetrying={isFetching}
      loadingLabel={t('deals.loading')}
      onRetry={handleRetry}
      skeleton={<DealsBoardSkeleton />}
    >
      {deals => <DealsTabs deals={deals} names={names} organizationId={organizationId} selectedId={selectedId} t={t} />}
    </WidgetStates>
  );
};
