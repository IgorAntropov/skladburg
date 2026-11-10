import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { TransportWindow } from '@skladburg/contracts/logistics/v1/logistics_records';
import type { City } from '@skladburg/contracts/network/v1/network';

import { timestampMs } from '@bufbuild/protobuf/wkt';

import type { I18nSnapshotValue } from '@/shared/i18n';

import { getOffsetLabel } from '@/shared/i18n';

import type { TransportTranslate } from '../i18n/transportSection';

export type FormatTransportTimeValue = (time: Timestamp | undefined) => string;
export type ReadTransportCityValue = (id: string) => string;

export const createTransportTimeFormatter = (
  { formatDateTime, userTimeZone }: I18nSnapshotValue,
  t: TransportTranslate,
): FormatTransportTimeValue => (time) => {
  if (time === undefined) {
    return t('transport.unknown');
  }

  const instant = timestampMs(time);
  const text = formatDateTime(instant, { format: { dateStyle: 'short', timeStyle: 'short' }, timeZone: 'UTC' });

  return getOffsetLabel(userTimeZone, instant) === 'UTC' ? t('transport.timeUtc', { time: text }) : text;
};

export const formatTransportWindow = (
  window: TransportWindow | undefined,
  formatTime: FormatTransportTimeValue,
  t: TransportTranslate,
): string => window === undefined
  ? t('transport.unknown')
  : t('transport.window', { from: formatTime(window.startsAt), to: formatTime(window.endsAt) });

export const createTransportCityReader = (cities: readonly City[] | undefined, t: TransportTranslate): ReadTransportCityValue => {
  const names = new Map(cities?.map(city => [city.id, city.name]));

  return id => names.get(id) ?? t('transport.unknown');
};
