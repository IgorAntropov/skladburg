import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { Truck } from 'lucide-react';

import type { NetworkMapModelValue } from '@/entities/network';

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import { AddressLink } from '@/shared/routing';
import { WidgetStates } from '@/shared/ui';

import type { NetworkTripListValue } from '../model/networkTripActor';

import { networkTripsSection } from '../i18n/networkTripsSection';
import { NETWORK_ROW_CLASS_NAME } from './networkRowStyles';
import { NetworkSiteListSkeleton } from './NetworkSiteListSkeleton';

interface NetworkTripsListProps {
  empty: ReactElement;
  model: NetworkMapModelValue | undefined;
  query: UseQueryResult<NetworkTripListValue>;
}

export const NetworkTripsList = ({ empty, model, query }: NetworkTripsListProps): ReactElement => {
  const { t: tBase } = useI18n();
  const { t } = useCatalogSection(networkTripsSection);
  const { refetch } = query;

  const handleRetry = (): void => {
    void refetch();
  };

  if (t === undefined) {
    return <NetworkSiteListSkeleton />;
  }

  return (
    <WidgetStates
      data={query.data?.rows}
      empty={empty}
      error={query.error}
      isEmpty={trips => trips.length === 0}
      isRetrying={query.isFetching}
      loadingLabel={tBase('network.trips.loadingList')}
      onRetry={handleRetry}
      skeleton={<NetworkSiteListSkeleton />}
    >
      {trips => (
        <ul className="flex min-w-0 flex-col gap-2">
          {trips.map((trip) => {
            const isLocal = trip.fromNodeId === trip.toNodeId;
            const fromSite = isLocal ? model?.sites.find(site => site.id === trip.pickupSiteId)?.label : undefined;
            const toSite = isLocal ? model?.sites.find(site => site.id === trip.deliverySiteId)?.label : undefined;
            const from = fromSite ?? model?.cities.find(city => city.id === trip.fromNodeId)?.name ?? t('networkTrips.pickup');
            const to = toSite ?? model?.cities.find(city => city.id === trip.toNodeId)?.name ?? t('networkTrips.delivery');
            const vehicle = [trip.brandLabel, trip.registrationNumber].filter(Boolean).join(' · ');

            return (
              <li key={trip.id}>
                <AddressLink
                  className={NETWORK_ROW_CLASS_NAME}
                  data-status={trip.status}
                  data-testid="network-trip-row"
                  data-trip-id={trip.id}
                  isFocusRequested
                  to={{ kind: 'object', object: { id: trip.id, type: 'trip' } }}
                >
                  <span className="font-semibold wrap-break-word text-on-panel">{t('networkTrips.route', { from, to })}</span>
                  <span className="flex items-center gap-1.5 text-sm text-on-panel-muted">
                    <Truck aria-hidden className="size-4 shrink-0" />
                    {t(`networkTrips.${trip.phase}`)}
                  </span>
                  {vehicle !== '' && <span className="text-sm wrap-break-word text-on-panel-muted" translate="no">{vehicle}</span>}
                </AddressLink>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetStates>
  );
};
