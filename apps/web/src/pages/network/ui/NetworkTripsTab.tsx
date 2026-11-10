import type { ReactElement } from 'react';

import type { NetworkMapModelValue } from '@/entities/network';

import { AssistantPortrait } from '@/entities/assistant';
import { useI18n } from '@/shared/i18n';
import { EmptyState } from '@/shared/ui';

import type { NetworkTripsStateValue } from '../api/useNetworkTrips';

import { loadNetworkTripsList } from './loadNetworkTripsList';
import { NetworkChunkSlot } from './NetworkChunkSlot';
import { NetworkSiteListSkeleton } from './NetworkSiteListSkeleton';

interface NetworkTripsTabProps {
  model: NetworkMapModelValue | undefined;
  state: NetworkTripsStateValue;
}

export const NetworkTripsTab = ({ model, state }: NetworkTripsTabProps): ReactElement => {
  const { t } = useI18n();
  const empty = (
    <div data-testid="network-trip-empty">
      <EmptyState media={<AssistantPortrait size="sm" />} text={t('hud.lists.empty.trips')} />
    </div>
  );

  if (!state.canView || state.query.data?.rows.length === 0) {
    return empty;
  }

  return (
    <NetworkChunkSlot loader={loadNetworkTripsList} loadingLabel={t('network.trips.loadingList')} skeleton={<NetworkSiteListSkeleton />}>
      {({ NetworkTripsList }) => <NetworkTripsList empty={empty} model={model} query={state.query} />}
    </NetworkChunkSlot>
  );
};
