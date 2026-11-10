import type { Money } from '@skladburg/contracts/common/v1/money';
import type {
  Trip,
  TripTemperatureReading,
} from '@skladburg/contracts/logistics/v1/logistics';
import type { TransportOrder } from '@skladburg/contracts/logistics/v1/trip_records';
import type { TransportPaymentBreakdown } from '@skladburg/contracts/payment/v1/payment';
import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { PayoutStatus } from '@skladburg/contracts/payment/v1/payment';
import {
  Thermometer,
  Truck,
} from 'lucide-react';
import {
  useCallback,
  useRef,
} from 'react';

import { useCan } from '@/entities/session';
import { useTrip } from '@/entities/transport';
import {
  isReadAccessDenied,
  useActingContext,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';

import type { TransportTranslate } from '../i18n/transportSection';
import type { FormatTransportTimeValue } from '../model/transportFormatting';
import type { TransportInspectorProps } from './TransportInspectorSlot';

import { useAssignmentFleet } from '../api/useAssignmentFleet';
import { TransportCargoDetails } from './TransportCargoDetails';
import { TransportData } from './TransportData';
import { TransportProperty } from './TransportProperty';
import { TransportRoute } from './TransportRoute';
import { TransportStatus } from './TransportStatus';
import { TransportTripActions } from './TransportTripActions';

interface OrderDetailsProps extends TripDetailProps {
  order: TransportOrder;
  status: TripStatus;
}

interface PaymentDetailsProps extends TripDetailProps {
  payment: TransportPaymentBreakdown;
}

interface TemperatureDetailsProps extends TripDetailProps {
  reading: TripTemperatureReading | undefined;
}

interface TripContentProps extends TransportInspectorProps {
  trip: Trip;
}

interface TripDetailProps {
  formatTime: FormatTransportTimeValue;
  t: TransportTranslate;
}

interface TripScheduleProps extends TripDetailProps {
  trip: Trip;
}

const OrderDetails = ({ formatTime, order, status, t }: OrderDetailsProps): ReactElement => {
  const { locale } = useI18n();

  return (
    <section className="flex flex-col gap-2 rounded-control border border-line p-3" data-testid="transport-trip-order">
      <h3 className="font-semibold">{t('transport.trips.order')}</h3>
      <dl className="flex flex-col gap-2">
        <TransportProperty label={t('transport.trips.orderAmount')}>
          {order.amount === undefined ? t('transport.unknown') : formatMoney(locale, order.amount)}
        </TransportProperty>
        {order.confirmedAt === undefined
          ? undefined
          : <TransportProperty label={t('transport.trips.orderConfirmedAt')}>{formatTime(order.confirmedAt)}</TransportProperty>}
      </dl>
      {status === TripStatus.AWAITING_CONFIRMATION && <p className="text-sm text-on-panel-muted">{t('transport.trips.orderPending')}</p>}
    </section>
  );
};

const PaymentDetails = ({ formatTime, payment, t }: PaymentDetailsProps): ReactElement => {
  const { formatNumber, locale } = useI18n();
  const { carrierPayout } = payment;
  const format = (amount: Money | undefined): string => amount === undefined ? t('transport.unknown') : formatMoney(locale, amount);
  const rate = formatNumber(payment.commissionRateBasisPoints / 10_000, { maximumFractionDigits: 2, style: 'percent' });
  const isPaid = carrierPayout?.status === PayoutStatus.PAID;

  return (
    <section className="flex flex-col gap-2 border-t border-line pt-3" data-testid="transport-trip-payment">
      <h3 className="font-semibold">{t('transport.trips.payment')}</h3>
      <dl className="flex flex-col gap-2 tabular-nums">
        <TransportProperty label={t('transport.trips.shipping')}>{format(payment.shippingAmount)}</TransportProperty>
        <TransportProperty label={t('transport.trips.commission', { rate })}>{format(payment.commissionAmount)}</TransportProperty>
        {carrierPayout !== undefined && (
          <TransportProperty label={t('transport.trips.payout')}>
            <p className="font-semibold">{format(carrierPayout.amount)}</p>
            <p className="text-sm text-on-panel-muted">
              {isPaid && carrierPayout.paidAt !== undefined
                ? t('transport.trips.paidAt', { time: formatTime(carrierPayout.paidAt) })
                : t(isPaid ? 'transport.trips.paid' : 'transport.trips.payoutPending')}
            </p>
          </TransportProperty>
        )}
      </dl>
    </section>
  );
};

const TemperatureDetails = ({ formatTime, reading, t }: TemperatureDetailsProps): ReactElement => {
  const { formatNumber } = useI18n();

  return (
    <section className="flex flex-col gap-2 border-t border-line pt-3">
      <h3 className="inline-flex items-center gap-2 font-semibold">
        <Thermometer aria-hidden className="size-4 shrink-0" />
        {t('transport.trips.temperature')}
      </h3>
      {reading === undefined
        ? <p className="text-sm text-on-panel-muted">{t('transport.trips.temperatureEmpty')}</p>
        : (
            <dl className="flex flex-col gap-1" data-testid="transport-trip-temperature">
              <TransportProperty label={t('transport.trips.temperatureDemo')}>
                <span className="font-semibold tabular-nums">
                  {t('transport.cargo.temperatureValue', {
                    value: formatNumber(reading.deciCelsius / 10, { maximumFractionDigits: 1 }),
                  })}
                </span>
              </TransportProperty>
              {reading.measuredAt !== undefined && (
                <TransportProperty label={t('transport.trips.temperatureMeasuredAt')}>{formatTime(reading.measuredAt)}</TransportProperty>
              )}
            </dl>
          )}
    </section>
  );
};

const TripSchedule = ({ formatTime, t, trip }: TripScheduleProps): ReactElement | undefined => {
  const canViewFleet = useCan(PermissionCode.FLEET_VIEW, { kind: 'organization' });
  const fleet = useAssignmentFleet(trip.ownAssignment !== undefined && canViewFleet);
  const driver = canViewFleet && !isReadAccessDenied(fleet.error)
    ? fleet.data?.drivers.find(record => record.id === trip.ownAssignment?.driverId)
    : undefined;
  const times = [
    { label: t('transport.trips.plannedDeparture'), value: trip.plannedDepartureAt },
    { label: t('transport.trips.plannedArrival'), value: trip.plannedArrivalAt },
    { label: t('transport.trips.departed'), value: trip.departedAt },
    { label: t('transport.trips.arrivedAt'), value: trip.arrivedAt },
  ].filter(({ value }) => value !== undefined);

  if (times.length === 0 && trip.ownAssignment === undefined) {
    return undefined;
  }

  return (
    <section className="flex flex-col gap-2 border-t border-line pt-3">
      <h3 className="font-semibold">{t('transport.trips.schedule')}</h3>
      <dl className="grid gap-2 @xs:grid-cols-2">
        {times.map(({ label, value }) => (
          <TransportProperty key={label} label={label}>{formatTime(value)}</TransportProperty>
        ))}
        {trip.ownAssignment !== undefined && (
          <TransportProperty label={t('transport.trips.vehicle')}>
            <span translate="no">{trip.ownAssignment.registrationNumber || t('transport.unknown')}</span>
          </TransportProperty>
        )}
        {driver !== undefined && <TransportProperty label={t('transport.trips.driver')}>{driver.displayName}</TransportProperty>}
      </dl>
    </section>
  );
};

const TripContent = ({ formatTime, readCity, t, trip }: TripContentProps): ReactElement => {
  const { organizationId } = useActingContext();
  const statusRef = useRef<HTMLDivElement>(null);
  const { transportOrder } = trip;
  const isCarrier = organizationId !== undefined && transportOrder?.carrierOrganizationId === organizationId;

  const handleStatusFocus = useCallback((): void => {
    statusRef.current?.focus();
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-3" data-status={trip.status} data-testid="transport-trip-inspector">
      <div ref={statusRef} tabIndex={-1}><TransportStatus kind="trip" status={trip.status} t={t} /></div>
      <TransportRoute
        delivery={trip.delivery}
        deliveryWindow={transportOrder?.deliveryWindow}
        formatTime={formatTime}
        from={readCity(trip.pickup?.cityId ?? '')}
        pickup={trip.pickup}
        pickupWindow={transportOrder?.pickupWindow}
        t={t}
        to={readCity(trip.delivery?.cityId ?? '')}
      />
      {transportOrder !== undefined && <OrderDetails formatTime={formatTime} order={transportOrder} status={trip.status} t={t} />}
      {isCarrier && <TransportTripActions onStatusFocus={handleStatusFocus} t={t} trip={trip} />}
      <TripSchedule formatTime={formatTime} t={t} trip={trip} />
      <TemperatureDetails formatTime={formatTime} reading={trip.bodyTemperature} t={t} />
      {transportOrder?.cargo !== undefined && <TransportCargoDetails cargo={transportOrder.cargo} t={t} />}
      {trip.carrierPayment !== undefined && <PaymentDetails formatTime={formatTime} payment={trip.carrierPayment} t={t} />}
    </div>
  );
};

export const TransportTripInspector = (props: TransportInspectorProps): ReactElement => {
  const { id, t } = props;
  const query = useTrip(id, true, true);

  return (
    <TransportData icon={Truck} query={query} t={t} unavailableTestId="transport-trip-unavailable">
      {trip => <TripContent {...props} trip={trip} />}
    </TransportData>
  );
};
