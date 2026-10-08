import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  I18nSnapshotValue,
  TenantLocalizationValue,
} from '../localizer/localizationTypes';

import { catalog } from '../catalogs/ru';
import { createSnapshot } from './createSnapshot';

const VLADIVOSTOK_INSTANT = Date.UTC(2026, 9, 12, 6);

const createTenant = (termOverrides: TenantLocalizationValue['termOverrides'] = {}): TenantLocalizationValue => ({
  availableLocales: ['ru'],
  defaultLocale: 'ru',
  termOverrides,
});

const createUserSnapshot = (
  userTimeZone: string,
  tenant: TenantLocalizationValue = createTenant(),
): I18nSnapshotValue => {
  return createSnapshot('ru', catalog, tenant, userTimeZone);
};

describe('formatDateTime', () => {
  it('formats the instant in the object zone and names the zone when it differs from the user zone', () => {
    const snapshot = createUserSnapshot('Europe/Moscow');

    const text = snapshot.formatDateTime(VLADIVOSTOK_INSTANT, { placeName: 'Владивосток', timeZone: 'Asia/Vladivostok' });

    expect(text).toBe('16:00 (Владивосток, UTC+10)');
  });

  it('names only the offset when the place is not given', () => {
    const snapshot = createUserSnapshot('Europe/Moscow');

    expect(snapshot.formatDateTime(VLADIVOSTOK_INSTANT, { timeZone: 'Asia/Vladivostok' })).toBe('16:00 (UTC+10)');
    expect(snapshot.formatDateTime(VLADIVOSTOK_INSTANT, { placeName: '', timeZone: 'Asia/Vladivostok' })).toBe('16:00 (UTC+10)');
  });

  it('adds nothing when both zones have the same offset at the instant', () => {
    const snapshot = createUserSnapshot('Europe/Kirov');

    expect(snapshot.formatDateTime(VLADIVOSTOK_INSTANT, { placeName: 'Москва', timeZone: 'Europe/Moscow' })).toBe('09:00');
    expect(createUserSnapshot('Europe/Moscow').formatDateTime(VLADIVOSTOK_INSTANT, { timeZone: 'Europe/Moscow' })).toBe('09:00');
  });

  it('writes offsets with minutes', () => {
    const snapshot = createUserSnapshot('Europe/Moscow');

    expect(snapshot.formatDateTime(VLADIVOSTOK_INSTANT, { timeZone: 'Asia/Kolkata' })).toBe('11:30 (UTC+5:30)');
  });

  it('writes the zero offset and negative offsets', () => {
    const snapshot = createUserSnapshot('Europe/Moscow');

    expect(snapshot.formatDateTime(VLADIVOSTOK_INSTANT, { timeZone: 'UTC' })).toBe('06:00 (UTC)');
    expect(snapshot.formatDateTime(VLADIVOSTOK_INSTANT, { timeZone: 'America/Sao_Paulo' })).toBe('03:00 (UTC-3)');
  });

  it('compares offsets at the instant, not by zone name', () => {
    const winter = Date.UTC(2026, 0, 15, 12);
    const summer = Date.UTC(2026, 6, 15, 12);
    const snapshot = createUserSnapshot('Europe/London');

    expect(snapshot.formatDateTime(winter, { timeZone: 'Africa/Lagos' })).toBe('13:00 (UTC+1)');
    expect(snapshot.formatDateTime(summer, { timeZone: 'Africa/Lagos' })).toBe('13:00');
    expect(snapshot.formatDateTime(winter, { timeZone: 'Europe/Lisbon' })).toBe('12:00');
    expect(snapshot.formatDateTime(summer, { timeZone: 'Europe/Paris' })).toBe('14:00 (UTC+2)');
  });

  it('accepts a Date and a custom format', () => {
    const snapshot = createUserSnapshot('Europe/Moscow');

    expect(snapshot.formatDateTime(new Date(VLADIVOSTOK_INSTANT), {
      format: { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'long' },
      placeName: 'Владивосток',
      timeZone: 'Asia/Vladivostok',
    })).toBe('12 октября в 16:00 (Владивосток, UTC+10)');
  });

  it('moves to the next day in the object zone', () => {
    const snapshot = createUserSnapshot('Europe/Moscow');

    expect(snapshot.formatDateTime(Date.UTC(2026, 9, 12, 20), {
      format: { day: 'numeric', month: 'long' },
      timeZone: 'Asia/Vladivostok',
    })).toBe('13 октября (UTC+10)');
  });

  it('applies the company override of the whole zoned time string', () => {
    const tenant = createTenant({
      ru: {
        'time.zoned_offset_only': '{offset}: {time}',
        'time.zoned_with_place': '{place}, {offset}: {time}',
      },
    });
    const snapshot = createUserSnapshot('Europe/Moscow', tenant);

    const withPlace = snapshot.formatDateTime(VLADIVOSTOK_INSTANT, { placeName: 'Владивосток', timeZone: 'Asia/Vladivostok' });

    expect(withPlace).toBe('Владивосток, UTC+10: 16:00');
    expect(snapshot.formatDateTime(VLADIVOSTOK_INSTANT, { timeZone: 'Asia/Vladivostok' })).toBe('UTC+10: 16:00');
    expect(snapshot.formatDateTime(VLADIVOSTOK_INSTANT, { timeZone: 'Europe/Moscow' })).toBe('09:00');
  });
});

describe('formatCalendarDate', () => {
  it.each(['Pacific/Kiritimati', 'America/Los_Angeles', 'UTC'])('does not depend on the user zone %s', (userTimeZone) => {
    expect(createUserSnapshot(userTimeZone).formatCalendarDate({ day: 1, month: 1, year: 2027 })).toBe('1 января 2027 г.');
  });

  it('formats with a custom format', () => {
    const snapshot = createUserSnapshot('Pacific/Kiritimati');

    const text = snapshot.formatCalendarDate({ day: 29, month: 2, year: 2028 }, { day: 'numeric', month: 'short', weekday: 'long' });

    expect(text).toBe('вторник, 29 февр.');
  });
});
