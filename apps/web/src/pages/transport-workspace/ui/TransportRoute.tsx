import type { TransportWindow } from '@skladburg/contracts/logistics/v1/logistics_records';
import type { TripPoint } from '@skladburg/contracts/logistics/v1/trip_records';
import type { ReactElement } from 'react';

import {
  MapPin,
  Navigation2,
} from 'lucide-react';

import type { TransportTranslate } from '../i18n/transportSection';
import type { FormatTransportTimeValue } from '../model/transportFormatting';

import { formatTransportWindow } from '../model/transportFormatting';

interface TransportRouteProps {
  delivery?: TripPoint | undefined;
  deliveryWindow: TransportWindow | undefined;
  formatTime: FormatTransportTimeValue;
  from: string;
  pickup?: TripPoint | undefined;
  pickupWindow: TransportWindow | undefined;
  t: TransportTranslate;
  to: string;
}

export const TransportRoute = ({
  delivery,
  deliveryWindow,
  formatTime,
  from,
  pickup,
  pickupWindow,
  t,
  to,
}: TransportRouteProps): ReactElement => {
  const points = [
    { city: from, icon: Navigation2, label: t('transport.pickup'), point: pickup, window: pickupWindow },
    { city: to, icon: MapPin, label: t('transport.delivery'), point: delivery, window: deliveryWindow },
  ];

  return (
    <ol className="flex flex-col gap-3 rounded-control border border-line p-3">
      {points.map(({ city, icon: Icon, label, point, window }) => (
        <li className="flex min-w-0 items-start gap-2" key={label}>
          <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-on-panel-muted" />
          <div className="min-w-0">
            <p className="text-sm text-on-panel-muted">{label}</p>
            <p className="font-semibold wrap-break-word text-on-panel">{city}</p>
            {point?.organizationName && <p className="wrap-break-word text-on-panel">{point.organizationName}</p>}
            {point?.address && <p className="wrap-break-word text-on-panel">{point.address}</p>}
            {window !== undefined && (
              <p className="text-sm text-on-panel-muted tabular-nums">{formatTransportWindow(window, formatTime, t)}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
};
