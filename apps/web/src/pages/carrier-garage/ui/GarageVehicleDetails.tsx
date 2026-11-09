import type { VehicleDetails } from '@skladburg/contracts/fleet/v1/fleet';
import type { City } from '@skladburg/contracts/network/v1/network';
import type { ReactElement } from 'react';

import {
  VehicleBodyType,
  VehicleCargoKind,
} from '@skladburg/contracts/fleet/v1/fleet';

import { useI18n } from '@/shared/i18n';
import { formatMinorAsDecimal } from '@/shared/lib/money';

import type { GarageTranslate } from '../i18n/garageSection';

import {
  VEHICLE_BODY_LABELS,
  VEHICLE_CARGO_LABELS,
} from '../vehicle/vehicleLabels';

interface GarageVehicleDetailsProps {
  cities: readonly City[];
  details: VehicleDetails;
  t: GarageTranslate;
}

const UTC_DATE_TIME_OPTIONS = {
  format: { day: '2-digit', hour: '2-digit', minute: '2-digit', month: '2-digit', year: 'numeric' },
  timeZone: 'UTC',
} as const;

const DETAIL_LABEL_CLASS_NAME = 'text-sm text-on-panel-muted';

const formatMeasuredQuantity = (value: bigint, fractionDigits: number): string =>
  formatMinorAsDecimal(value, fractionDigits).replace(/,0+$/u, '').replace(/(,\d*[1-9])0+$/u, '$1');

export const GarageVehicleDetails = ({ cities, details, t }: GarageVehicleDetailsProps): ReactElement => {
  const { formatDateTime, formatNumber } = useI18n();

  const bodyKey = details.bodyType === VehicleBodyType.UNSPECIFIED ? undefined : VEHICLE_BODY_LABELS[details.bodyType];
  const body = bodyKey === undefined ? undefined : t(bodyKey);
  const cargo = details.cargoKinds.flatMap((kind): string[] => {
    const label = kind === VehicleCargoKind.UNSPECIFIED ? undefined : VEHICLE_CARGO_LABELS[kind];
    const name = label === undefined ? undefined : t(label);

    return name === undefined ? [] : [name];
  });
  const { temperature } = details;

  return (
    <>
      {body !== undefined && <p className={DETAIL_LABEL_CLASS_NAME}>{body}</p>}
      <details className="rounded-control border border-line px-3 py-1">
        <summary className="min-h-11 cursor-pointer content-center rounded-control font-medium focus-visible:outline-focus">
          {t('garage.details.show')}
        </summary>
        <dl className="grid grid-cols-1 gap-2 pb-2 text-sm sm:grid-cols-2">
          <div>
            <dt className={DETAIL_LABEL_CLASS_NAME}>{t('garage.details.payload')}</dt>
            <dd>{t('garage.details.payloadValue', { value: formatMeasuredQuantity(details.payloadGrams, 3) })}</dd>
          </div>
          <div>
            <dt className={DETAIL_LABEL_CLASS_NAME}>{t('garage.details.volume')}</dt>
            <dd>{t('garage.details.volumeValue', { value: formatMeasuredQuantity(details.volumeCubicCentimeters, 6) })}</dd>
          </div>
          <div>
            <dt className={DETAIL_LABEL_CLASS_NAME}>{t('garage.details.dimensions')}</dt>
            <dd>
              {t('garage.details.dimensionsValue', {
                height: formatNumber(details.heightMillimeters),
                length: formatNumber(details.lengthMillimeters),
                width: formatNumber(details.widthMillimeters),
              })}
            </dd>
          </div>
          <div>
            <dt className={DETAIL_LABEL_CLASS_NAME}>{t('garage.details.palletPlaces')}</dt>
            <dd>{formatNumber(details.palletPlaces)}</dd>
          </div>
          <div>
            <dt className={DETAIL_LABEL_CLASS_NAME}>{t('garage.details.cargo')}</dt>
            <dd>{cargo.join(', ') || t('garage.unknown')}</dd>
          </div>
          {temperature !== undefined && (
            <div>
              <dt className={DETAIL_LABEL_CLASS_NAME}>{t('garage.details.temperature')}</dt>
              <dd>
                {t('garage.details.temperatureValue', {
                  max: formatNumber(temperature.maxCelsius),
                  min: formatNumber(temperature.minCelsius),
                })}
              </dd>
            </div>
          )}
          <div className="sm:col-span-2">
            <dt className={DETAIL_LABEL_CLASS_NAME}>{t('garage.details.availability')}</dt>
            <dd>
              {details.availability.length === 0
                ? t('garage.details.noAvailability')
                : (
                    <ul className="flex flex-col gap-1">
                      {details.availability.map(({ cityId, endsAt, startsAt }) => {
                        if (startsAt === undefined || endsAt === undefined) {
                          return null;
                        }

                        const city = cities.find(item => item.id === cityId)?.name ?? t('garage.unknown');
                        const start = formatDateTime(Number(startsAt.seconds) * 1_000, UTC_DATE_TIME_OPTIONS);
                        const end = formatDateTime(Number(endsAt.seconds) * 1_000, UTC_DATE_TIME_OPTIONS);

                        return (
                          <li key={`${cityId}:${String(startsAt.seconds)}:${String(startsAt.nanos)}`}>
                            {t('garage.details.window', { city, end, start })}
                          </li>
                        );
                      })}
                    </ul>
                  )}
            </dd>
          </div>
        </dl>
      </details>
    </>
  );
};
