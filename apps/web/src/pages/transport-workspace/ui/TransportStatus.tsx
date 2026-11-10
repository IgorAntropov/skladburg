import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

import { TransportRequestStatus } from '@skladburg/contracts/logistics/v1/logistics_records';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import {
  CircleCheck,
  CircleHelp,
  Clock3,
  FileCheck,
  MapPin,
  OctagonX,
  PackageCheck,
  Truck,
} from 'lucide-react';

import type { TransportTranslate } from '../i18n/transportSection';

type StatusBadgeValue = readonly [LucideIcon, TransportStatusKey];

type TransportStatusKey = Extract<Parameters<TransportTranslate>[0],
  | 'transport.requests.cancelled'
  | 'transport.requests.open'
  | 'transport.requests.selected'
  | 'transport.trips.arrived'
  | 'transport.trips.assigned'
  | 'transport.trips.awaitingConfirmation'
  | 'transport.trips.cancelled'
  | 'transport.trips.closed'
  | 'transport.trips.confirmed'
  | 'transport.trips.delivered'
  | 'transport.trips.inTransit'
  | 'transport.trips.loaded'
  | 'transport.unknown'>;

const requestStatuses: Readonly<Partial<Record<TransportRequestStatus, StatusBadgeValue>>> = {
  [TransportRequestStatus.CANCELLED]: [OctagonX, 'transport.requests.cancelled'],
  [TransportRequestStatus.OPEN]: [Clock3, 'transport.requests.open'],
  [TransportRequestStatus.SELECTED]: [CircleCheck, 'transport.requests.selected'],
  [TransportRequestStatus.UNSPECIFIED]: [CircleHelp, 'transport.unknown'],
};

const tripStatuses: Readonly<Partial<Record<TripStatus, StatusBadgeValue>>> = {
  [TripStatus.ARRIVED]: [MapPin, 'transport.trips.arrived'],
  [TripStatus.ASSIGNED]: [Truck, 'transport.trips.assigned'],
  [TripStatus.AWAITING_CONFIRMATION]: [Clock3, 'transport.trips.awaitingConfirmation'],
  [TripStatus.CANCELLED]: [OctagonX, 'transport.trips.cancelled'],
  [TripStatus.CLOSED]: [CircleCheck, 'transport.trips.closed'],
  [TripStatus.CONFIRMED]: [FileCheck, 'transport.trips.confirmed'],
  [TripStatus.DELIVERED]: [PackageCheck, 'transport.trips.delivered'],
  [TripStatus.IN_TRANSIT]: [Truck, 'transport.trips.inTransit'],
  [TripStatus.LOADED]: [PackageCheck, 'transport.trips.loaded'],
  [TripStatus.UNSPECIFIED]: [CircleHelp, 'transport.unknown'],
};

type TransportStatusProps = (
  { kind: 'request'; status: TransportRequestStatus }
  | { kind: 'trip'; status: TripStatus }
) & { t: TransportTranslate };

export const TransportStatus = (props: TransportStatusProps): ReactElement => {
  const [Icon, label] = (props.kind === 'request' ? requestStatuses[props.status] : tripStatuses[props.status])
    ?? [CircleHelp, 'transport.unknown'];

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-on-panel">
      <Icon aria-hidden className="size-4 shrink-0" />
      {props.t(label)}
    </span>
  );
};
