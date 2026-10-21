import type { ReactElement } from 'react';

import { Warehouse } from 'lucide-react';
import { useMemo } from 'react';

import type { NetworkMapModelValue } from '@/entities/network';
import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import { WidgetStates } from '@/shared/ui';
import { ZoneEmptyState } from '@/widgets/hud-layout';

import type { NetworkMapModelStateValue } from '../../api/useNetworkMapModel';

import { groupNetworkSites } from '../../lib/groupNetworkSites';
import { NetworkSiteListSkeleton } from '../NetworkSiteListSkeleton';
import { NetworkSiteGroup } from './NetworkSiteGroup';

interface NetworkSiteListContentProps {
  focus: ObjectRefValue | undefined;
  model: NetworkMapModelValue;
}

interface NetworkSiteListProps {
  focus: ObjectRefValue | undefined;
  state: NetworkMapModelStateValue;
}

const isModelEmpty = (model: NetworkMapModelValue): boolean => model.sites.length === 0;

const NetworkSiteListContent = ({ focus, model }: NetworkSiteListContentProps): ReactElement => {
  const { t } = useI18n();

  const groups = useMemo(() => groupNetworkSites(model.sites), [model.sites]);
  const cityNameByNodeId = useMemo(
    () => new Map(model.cities.map(city => [city.id, city.name])),
    [model.cities],
  );

  const selectedSiteId = focus?.type === 'site' ? focus.id : undefined;
  const isOwnShown = groups.own.length > 0;
  const isNetworkShown = groups.network.length > 0;

  return (
    <div className="flex flex-col gap-4" data-testid="network-site-list">
      {isOwnShown && (
        <NetworkSiteGroup
          cityNameByNodeId={cityNameByNodeId}
          selectedSiteId={selectedSiteId}
          sites={groups.own}
          title={t('network.sites.group.own')}
        />
      )}
      {isNetworkShown && (
        <NetworkSiteGroup
          cityNameByNodeId={cityNameByNodeId}
          selectedSiteId={selectedSiteId}
          sites={groups.network}
          title={t('network.sites.group.network')}
        />
      )}
    </div>
  );
};

export const NetworkSiteList = ({ focus, state }: NetworkSiteListProps): ReactElement => {
  const { t } = useI18n();

  return (
    <WidgetStates
      data={state.data}
      empty={<ZoneEmptyState icon={Warehouse} text={t('hud.lists.empty.warehouses')} />}
      error={state.error}
      isEmpty={isModelEmpty}
      isRetrying={state.isRetrying}
      loadingLabel={t('network.sites.loading')}
      onRetry={state.retry}
      skeleton={<NetworkSiteListSkeleton />}
    >
      {model => <NetworkSiteListContent focus={focus} model={model} />}
    </WidgetStates>
  );
};
