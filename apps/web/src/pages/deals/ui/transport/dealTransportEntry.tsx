import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';
import type { ReactElement } from 'react';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { LogisticsService } from '@skladburg/contracts/logistics/v1/logistics';
import { TransportRequestStatus } from '@skladburg/contracts/logistics/v1/logistics_records';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import {
  ClipboardPen,
  FileText,
  Truck,
} from 'lucide-react';

import {
  useCan,
  useCommandAccess,
} from '@/entities/session';
import {
  useTransportRequests,
  useTrips,
} from '@/entities/transport';
import { isReadAccessDenied } from '@/shared/api';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';
import { AddressLink } from '@/shared/routing';
import {
  AccessButton,
  buttonClassName,
  ErrorNotice,
  Skeleton,
  SkeletonGroup,
  WidgetStates,
} from '@/shared/ui';

import type { DealTransportTranslate } from './dealTransportSection';
import type { DealTransportProps } from './dealTransportTypes';

import { dealTransportSection } from './dealTransportSection';

const REQUEST_STATUS_KEYS = {
  [TransportRequestStatus.CANCELLED]: 'dealTransport.request.cancelled',
  [TransportRequestStatus.OPEN]: 'dealTransport.request.open',
  [TransportRequestStatus.SELECTED]: 'dealTransport.request.selected',
  [TransportRequestStatus.UNSPECIFIED]: 'dealTransport.request.unknown',
} as const satisfies Record<TransportRequestStatus, Parameters<DealTransportTranslate>[0]>;

const TRIP_STATUS_KEYS = {
  [TripStatus.ARRIVED]: 'dealTransport.trip.arrived',
  [TripStatus.ASSIGNED]: 'dealTransport.trip.assigned',
  [TripStatus.AWAITING_CONFIRMATION]: 'dealTransport.trip.awaitingConfirmation',
  [TripStatus.CANCELLED]: 'dealTransport.trip.cancelled',
  [TripStatus.CLOSED]: 'dealTransport.trip.closed',
  [TripStatus.CONFIRMED]: 'dealTransport.trip.confirmed',
  [TripStatus.DELIVERED]: 'dealTransport.trip.delivered',
  [TripStatus.IN_TRANSIT]: 'dealTransport.trip.inTransit',
  [TripStatus.LOADED]: 'dealTransport.trip.loaded',
  [TripStatus.UNSPECIFIED]: 'dealTransport.trip.unknown',
} as const satisfies Record<TripStatus, Parameters<DealTransportTranslate>[0]>;

const UTC_FORMAT_OPTIONS = {
  format: { day: '2-digit', hour: '2-digit', minute: '2-digit', month: '2-digit', year: 'numeric' },
  timeZone: 'UTC',
} as const;

const CARD_CLASS_NAME = 'flex min-w-0 flex-col items-start gap-2 rounded-control border border-line p-3';
const LINK_CLASS_NAME = buttonClassName({ variant: 'secondary' });

interface TransportReadProps {
  dealId: string;
  t: DealTransportTranslate;
}

const DealTransportRequest = ({ dealId, t }: TransportReadProps): null | ReactElement => {
  const canView = useCan(PermissionCode.TRANSPORT_REQUEST_VIEW, { kind: 'organization' });
  const query = useTransportRequests(canView);
  const summary = query.data?.find(request => request.perspective.case === 'deal' && request.perspective.value.dealId === dealId)?.summary;

  const handleRetry = (): void => {
    void query.refetch();
  };

  if (!canView || isReadAccessDenied(query.error)) {
    return null;
  }

  return (
    <WidgetStates
      data={query.data}
      error={query.error}
      isRetrying={query.isFetching}
      loadingLabel={t('dealTransport.request')}
      onRetry={handleRetry}
      skeleton={<Skeleton className="h-12" />}
    >
      {() => summary === undefined
        ? <p className="text-sm text-on-panel-muted">{t('dealTransport.request.empty')}</p>
        : (
            <section className={CARD_CLASS_NAME}>
              <h3 className="flex items-center gap-2 font-semibold">
                <ClipboardPen aria-hidden className="size-4 shrink-0" />
                {t('dealTransport.request')}
              </h3>
              <p className="text-sm text-on-panel-muted">{t(REQUEST_STATUS_KEYS[summary.status])}</p>
              <AddressLink
                className={LINK_CLASS_NAME}
                data-testid="deal-transport-request-link"
                isFocusRequested
                to={{ kind: 'object', object: { id: summary.id, type: 'transport_request' } }}
              >
                {t('dealTransport.requestLink')}
              </AddressLink>
            </section>
          )}
    </WidgetStates>
  );
};

interface TripCardProps {
  t: DealTransportTranslate;
  trip: Trip;
}

const DealTripCard = ({ t, trip }: TripCardProps): ReactElement => {
  const { formatDateTime, locale } = useI18n();
  const { plannedArrivalAt, plannedDepartureAt, transportOrder } = trip;
  const formatUtc = (value: Timestamp): string => formatDateTime(timestampMs(value), UTC_FORMAT_OPTIONS);
  const Icon = transportOrder === undefined ? Truck : FileText;

  return (
    <section className={CARD_CLASS_NAME}>
      <h3 className="flex items-center gap-2 font-semibold">
        <Icon aria-hidden className="size-4 shrink-0" />
        {t(transportOrder === undefined ? 'dealTransport.trip' : 'dealTransport.tripOrder')}
      </h3>
      <p className="text-sm text-on-panel-muted">{t(TRIP_STATUS_KEYS[trip.status])}</p>
      <dl className="flex w-full flex-col gap-1 text-sm wrap-break-word">
        {transportOrder?.amount !== undefined && (
          <div className="flex flex-wrap justify-between gap-x-2">
            <dt className="text-on-panel-muted">{t('dealTransport.tripOrderAmount')}</dt>
            <dd>{formatMoney(locale, transportOrder.amount)}</dd>
          </div>
        )}
        {transportOrder?.confirmedAt !== undefined && (
          <div className="flex flex-wrap justify-between gap-x-2">
            <dt className="text-on-panel-muted">{t('dealTransport.tripOrderConfirmation')}</dt>
            <dd>{formatUtc(transportOrder.confirmedAt)}</dd>
          </div>
        )}
        {plannedDepartureAt !== undefined && (
          <div className="flex flex-wrap justify-between gap-x-2">
            <dt className="text-on-panel-muted">{t('dealTransport.tripDeparture')}</dt>
            <dd>{formatUtc(plannedDepartureAt)}</dd>
          </div>
        )}
        {plannedArrivalAt !== undefined && (
          <div className="flex flex-wrap justify-between gap-x-2">
            <dt className="text-on-panel-muted">{t('dealTransport.tripArrival')}</dt>
            <dd>{formatUtc(plannedArrivalAt)}</dd>
          </div>
        )}
      </dl>
      <AddressLink
        className={LINK_CLASS_NAME}
        data-testid="deal-transport-trip-link"
        isFocusRequested
        to={{ kind: 'object', object: { id: trip.id, type: 'trip' } }}
      >
        {t('dealTransport.tripLink')}
      </AddressLink>
    </section>
  );
};

const DealTrip = ({ dealId, t }: TransportReadProps): null | ReactElement => {
  const canView = useCan(PermissionCode.TRIP_VIEW, { kind: 'organization' });
  const query = useTrips(canView);
  const trip = query.data?.find(item => item.dealId === dealId);

  const handleRetry = (): void => {
    void query.refetch();
  };

  if (!canView || isReadAccessDenied(query.error)) {
    return null;
  }

  return (
    <WidgetStates
      data={query.data}
      error={query.error}
      isRetrying={query.isFetching}
      loadingLabel={t('dealTransport.trip')}
      onRetry={handleRetry}
      skeleton={<Skeleton className="h-12" />}
    >
      {() => trip === undefined
        ? <p className="text-sm text-on-panel-muted">{t('dealTransport.trip.empty')}</p>
        : <DealTripCard t={t} trip={trip} />}
    </WidgetStates>
  );
};

interface PublishButtonProps {
  onOpen: () => void;
  t: DealTransportTranslate;
}

const PublishButton = ({ onOpen, t }: PublishButtonProps): ReactElement => {
  const access = useCommandAccess(LogisticsService.method.publishTransportRequest, { kind: 'organization' });

  return (
    <AccessButton
      access={access}
      data-deal-action="publishTransport"
      data-testid="deal-transport-publish-open"
      onClick={onOpen}
      variant="secondary"
    >
      {t('dealTransport.publish')}
    </AccessButton>
  );
};

export const DealTransport = (props: DealTransportProps): ReactElement => {
  const { t: baseT } = useI18n();
  const { retry, status, t } = useCatalogSection(dealTransportSection);

  if (t === undefined) {
    return status === 'error'
      ? <ErrorNotice error={null} onRetry={retry} />
      : <SkeletonGroup isFilled label={baseT('routing.section.loading')}><Skeleton className="h-12" /></SkeletonGroup>;
  }
  if (props.kind === 'publish') {
    return <PublishButton onOpen={props.onOpen} t={t} />;
  }

  return props.kind === 'request' ? <DealTransportRequest dealId={props.dealId} t={t} /> : <DealTrip dealId={props.dealId} t={t} />;
};
