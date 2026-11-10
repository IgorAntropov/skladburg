import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';
import type { ReactElement } from 'react';

import {
  ChevronRight,
  ClipboardPen,
  Truck,
} from 'lucide-react';

import type { ObjectRefValue } from '@/shared/routing';

import {
  useTransportRequests,
  useTrips,
} from '@/entities/transport';
import { cn } from '@/shared/lib/cn';
import { AddressLink } from '@/shared/routing';

import type { TransportTranslate } from '../i18n/transportSection';
import type {
  FormatTransportTimeValue,
  ReadTransportCityValue,
} from '../model/transportFormatting';

import { formatTransportWindow } from '../model/transportFormatting';
import { TransportData } from './TransportData';
import { TransportStatus } from './TransportStatus';

interface TransportListProps {
  focus: ObjectRefValue | undefined;
  formatTime: FormatTransportTimeValue;
  readCity: ReadTransportCityValue;
  t: TransportTranslate;
}

interface TransportRowProps {
  focus: ObjectRefValue;
  isCurrent: boolean;
  route: string;
  status: ReactElement;
  testId: string;
  time: string;
}

const TransportRow = ({ focus, isCurrent, route, status, testId, time }: TransportRowProps): ReactElement => (
  <li>
    <AddressLink
      aria-current={isCurrent ? 'true' : undefined}
      className={cn(
        'flex min-h-14 min-w-0 items-center justify-between gap-3 rounded-control border px-3 py-2',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-safe:transition-colors',
        isCurrent ? 'border-indicator bg-hover' : 'border-line hover:bg-hover',
      )}
      data-testid={testId}
      data-transport-row={focus.id}
      isFocusRequested
      to={{ kind: 'object', object: focus }}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold wrap-break-word text-on-panel">{route}</span>
        <span className="text-sm text-on-panel-muted tabular-nums">{time}</span>
        {status}
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-on-panel-muted" />
    </AddressLink>
  </li>
);

export const TransportRequestList = ({ focus, formatTime, readCity, t }: TransportListProps): ReactElement => {
  const query = useTransportRequests(true);

  return (
    <TransportData
      emptyLabel={t('transport.requests.empty')}
      icon={ClipboardPen}
      isEmpty={requests => requests.every(({ summary }) => summary === undefined)}
      query={query}
      t={t}
    >
      {requests => (
        <ul className="flex min-w-0 flex-col gap-2">
          {requests.flatMap(({ summary }) => summary === undefined
            ? []
            : (
                <TransportRow
                  focus={{ id: summary.id, type: 'transport_request' }}
                  isCurrent={focus?.type === 'transport_request' && focus.id === summary.id}
                  key={summary.id}
                  route={t('transport.route', { from: readCity(summary.fromCityId), to: readCity(summary.toCityId) })}
                  status={<TransportStatus kind="request" status={summary.status} t={t} />}
                  testId="transport-request-row"
                  time={formatTransportWindow(summary.pickupWindow, formatTime, t)}
                />
              ))}
        </ul>
      )}
    </TransportData>
  );
};

const formatTripListTime = (trip: Trip, formatTime: FormatTransportTimeValue, t: TransportTranslate): string => {
  const { arrivedAt, departedAt, plannedArrivalAt, plannedDepartureAt, transportOrder } = trip;
  const time = arrivedAt ?? (departedAt === undefined ? plannedDepartureAt : plannedArrivalAt ?? departedAt);

  return time === undefined ? formatTransportWindow(transportOrder?.pickupWindow, formatTime, t) : formatTime(time);
};

export const TransportTripList = ({ focus, formatTime, readCity, t }: TransportListProps): ReactElement => {
  const query = useTrips(true);

  return (
    <TransportData emptyLabel={t('transport.trips.empty')} icon={Truck} isEmpty={trips => trips.length === 0} query={query} t={t}>
      {trips => (
        <ul className="flex min-w-0 flex-col gap-2">
          {trips.map(trip => (
            <TransportRow
              focus={{ id: trip.id, type: 'trip' }}
              isCurrent={focus?.type === 'trip' && focus.id === trip.id}
              key={trip.id}
              route={t('transport.route', { from: readCity(trip.pickup?.cityId ?? ''), to: readCity(trip.delivery?.cityId ?? '') })}
              status={<TransportStatus kind="trip" status={trip.status} t={t} />}
              testId="transport-trip-row"
              time={formatTripListTime(trip, formatTime, t)}
            />
          ))}
        </ul>
      )}
    </TransportData>
  );
};
