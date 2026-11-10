import type { TransportCargo } from '@skladburg/contracts/logistics/v1/logistics_records';
import type { ReactElement } from 'react';

import {
  VehicleBodyType,
  VehicleCargoKind,
} from '@skladburg/contracts/fleet/v1/fleet';

import { useI18n } from '@/shared/i18n';
import { formatMinorAsDecimal } from '@/shared/lib/money';

import type { TransportTranslate } from '../i18n/transportSection';

import { TransportProperty } from './TransportProperty';

type BodyTypeKey = Extract<Parameters<TransportTranslate>[0],
  | 'transport.cargo.curtainSide'
  | 'transport.cargo.flatbed'
  | 'transport.cargo.insulated'
  | 'transport.cargo.longHaul'
  | 'transport.cargo.lowLoader'
  | 'transport.cargo.refrigerated'
  | 'transport.unknown'>;

type CargoKindKey = Extract<Parameters<TransportTranslate>[0],
  | 'transport.cargo.general'
  | 'transport.cargo.oversize'
  | 'transport.cargo.temperatureControlled'
  | 'transport.unknown'>;

const cargoKinds: Readonly<Partial<Record<VehicleCargoKind, CargoKindKey>>> = {
  [VehicleCargoKind.GENERAL]: 'transport.cargo.general',
  [VehicleCargoKind.OVERSIZE]: 'transport.cargo.oversize',
  [VehicleCargoKind.TEMPERATURE_CONTROLLED]: 'transport.cargo.temperatureControlled',
  [VehicleCargoKind.UNSPECIFIED]: 'transport.unknown',
};

const bodyTypes: Readonly<Partial<Record<VehicleBodyType, BodyTypeKey>>> = {
  [VehicleBodyType.CURTAIN_SIDE]: 'transport.cargo.curtainSide',
  [VehicleBodyType.FLATBED]: 'transport.cargo.flatbed',
  [VehicleBodyType.INSULATED]: 'transport.cargo.insulated',
  [VehicleBodyType.LONG_HAUL]: 'transport.cargo.longHaul',
  [VehicleBodyType.LOW_LOADER]: 'transport.cargo.lowLoader',
  [VehicleBodyType.REFRIGERATED]: 'transport.cargo.refrigerated',
  [VehicleBodyType.UNSPECIFIED]: 'transport.unknown',
};

const formatMeasuredQuantity = (value: bigint, fractionDigits: number): string =>
  formatMinorAsDecimal(value, fractionDigits).replace(/,0+$/u, '').replace(/(,\d*[1-9])0+$/u, '$1');

interface TransportCargoDetailsProps {
  cargo: TransportCargo;
  t: TransportTranslate;
}

export const TransportCargoDetails = ({ cargo, t }: TransportCargoDetailsProps): ReactElement => {
  const { formatNumber } = useI18n();
  const { temperature } = cargo;

  return (
    <section className="flex flex-col gap-2 border-t border-line pt-3">
      <h3 className="font-semibold text-on-panel">{t('transport.cargo.title')}</h3>
      <dl className="grid grid-cols-1 gap-2 @xs:grid-cols-2">
        <TransportProperty label={t('transport.cargo.kind')}>
          {t(cargoKinds[cargo.cargoKind] ?? 'transport.unknown')}
        </TransportProperty>
        <TransportProperty label={t('transport.cargo.bodyTypes')}>
          {cargo.bodyTypes.map(type => t(bodyTypes[type] ?? 'transport.unknown')).join(', ')}
        </TransportProperty>
        <TransportProperty label={t('transport.cargo.weight')}>
          {t('transport.cargo.weightValue', { value: formatMeasuredQuantity(cargo.weightGrams, 3) })}
        </TransportProperty>
        <TransportProperty label={t('transport.cargo.volume')}>
          {t('transport.cargo.volumeValue', {
            value: formatMeasuredQuantity(cargo.volumeCubicCentimeters, 6),
          })}
        </TransportProperty>
        <TransportProperty label={t('transport.cargo.dimensions')}>
          {t('transport.cargo.dimensionsValue', {
            height: formatNumber(cargo.heightMillimeters),
            length: formatNumber(cargo.lengthMillimeters),
            width: formatNumber(cargo.widthMillimeters),
          })}
        </TransportProperty>
        <TransportProperty label={t('transport.cargo.palletPlaces')}>
          {formatNumber(cargo.palletPlaces)}
        </TransportProperty>
        {temperature !== undefined && (
          <TransportProperty label={t('transport.cargo.temperature')}>
            {t('transport.cargo.temperatureRange', {
              max: formatNumber(temperature.maxCelsius),
              min: formatNumber(temperature.minCelsius),
            })}
          </TransportProperty>
        )}
      </dl>
    </section>
  );
};
