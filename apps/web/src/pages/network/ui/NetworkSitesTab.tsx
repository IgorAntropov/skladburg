import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';

import type { NetworkMapModelStateValue } from '../api/useNetworkMapModel';

import { loadNetworkSites } from './loadNetworkSites';
import { NetworkChunkSlot } from './NetworkChunkSlot';
import { NetworkSiteListSkeleton } from './NetworkSiteListSkeleton';

interface NetworkSitesTabProps {
  focus: ObjectRefValue | undefined;
  state: NetworkMapModelStateValue;
}

export const NetworkSitesTab = ({ focus, state }: NetworkSitesTabProps): ReactElement => {
  const { t } = useI18n();

  const isModelPending = state.data === undefined && state.error === null;

  return (
    <NetworkChunkSlot
      isPending={isModelPending}
      loader={loadNetworkSites}
      loadingLabel={t('network.sites.loading')}
      skeleton={<NetworkSiteListSkeleton />}
    >
      {({ NetworkSitesPanel }) => <NetworkSitesPanel focus={focus} state={state} />}
    </NetworkChunkSlot>
  );
};
