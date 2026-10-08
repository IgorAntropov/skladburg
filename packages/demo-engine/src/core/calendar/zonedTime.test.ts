import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  addCalendarDays,
  type CalendarDateValue,
  formatCalendarDateIso,
  fromEpochDay,
  toEpochDay,
} from './calendarDate';
import {
  getStartOfDayInstant,
  getZoneOffsetMs,
  toCalendarDate,
} from './zonedTime';

const RUSSIAN_TIME_ZONES: readonly string[] = [
  'Europe/Kaliningrad',
  'Europe/Moscow',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Omsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Yakutsk',
  'Asia/Vladivostok',
  'Asia/Magadan',
  'Asia/Kamchatka',
];

const HOUR_MS = 3_600_000;

describe('toCalendarDate', () => {
  it('moves 2026-12-31T15:00Z to 2027-01-01 in Vladivostok', () => {
    expect(toCalendarDate(Date.UTC(2026, 11, 31, 15, 0), 'Asia/Vladivostok')).toEqual({ day: 1, month: 1, year: 2027 });
  });

  it('keeps 2026-12-31T15:00Z on 2026-12-31 in Moscow', () => {
    expect(toCalendarDate(Date.UTC(2026, 11, 31, 15, 0), 'Europe/Moscow')).toEqual({ day: 31, month: 12, year: 2026 });
  });

  it('gives the previous day west of UTC', () => {
    expect(toCalendarDate(Date.UTC(2026, 0, 1, 3, 0), 'America/Los_Angeles')).toEqual({ day: 31, month: 12, year: 2025 });
  });

  it('gives the next day for the most eastern zone', () => {
    expect(toCalendarDate(Date.UTC(2026, 9, 12, 12, 0), 'Pacific/Kiritimati')).toEqual({ day: 13, month: 10, year: 2026 });
  });

  it('switches the day exactly at the local midnight', () => {
    const midnight = Date.UTC(2026, 9, 11, 21, 0);

    expect(toCalendarDate(midnight - 1, 'Europe/Moscow')).toEqual({ day: 11, month: 10, year: 2026 });
    expect(toCalendarDate(midnight, 'Europe/Moscow')).toEqual({ day: 12, month: 10, year: 2026 });
  });

  it('never reports hour 24 at midnight', () => {
    const midnight = Date.UTC(2026, 9, 11, 21, 0);

    expect(getZoneOffsetMs(midnight, 'Europe/Moscow')).toBe(3 * HOUR_MS);
    expect(getZoneOffsetMs(midnight + HOUR_MS, 'Europe/Moscow')).toBe(3 * HOUR_MS);
  });

  it('does not depend on the fraction of a second', () => {
    expect(toCalendarDate(Date.UTC(2026, 9, 11, 20, 59, 59, 999), 'Europe/Moscow')).toEqual({ day: 11, month: 10, year: 2026 });
  });

  it('reads instants before the epoch', () => {
    expect(toCalendarDate(-1, 'UTC')).toEqual({ day: 31, month: 12, year: 1969 });
  });

  it('is not affected by the device time zone of the test process', () => {
    expect(toCalendarDate(Date.UTC(2026, 9, 12, 0, 0), 'UTC')).toEqual({ day: 12, month: 10, year: 2026 });
  });

  it.each(['Mars/Phobos', 'Moscow', ''])('throws RangeError for the unknown time zone %j', (timeZone) => {
    expect(() => toCalendarDate(Date.UTC(2026, 0, 1), timeZone)).toThrow(RangeError);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('throws RangeError for the instant %s', (instantMs) => {
    expect(() => toCalendarDate(instantMs, 'UTC')).toThrow(RangeError);
  });
});

describe('getZoneOffsetMs', () => {
  it.each([
    ['Europe/Kaliningrad', 2],
    ['Europe/Moscow', 3],
    ['Europe/Samara', 4],
    ['Asia/Yekaterinburg', 5],
    ['Asia/Omsk', 6],
    ['Asia/Krasnoyarsk', 7],
    ['Asia/Irkutsk', 8],
    ['Asia/Yakutsk', 9],
    ['Asia/Vladivostok', 10],
    ['Asia/Magadan', 11],
    ['Asia/Kamchatka', 12],
  ])('gives the offset of %s', (timeZone, hours) => {
    expect(getZoneOffsetMs(Date.UTC(2026, 9, 12, 6, 0), timeZone)).toBe(hours * HOUR_MS);
  });

  it('gives an offset with minutes', () => {
    expect(getZoneOffsetMs(Date.UTC(2026, 9, 12, 6, 0), 'Asia/Kolkata')).toBe(5.5 * HOUR_MS);
  });

  it('follows the summer time of a zone that has it', () => {
    expect(getZoneOffsetMs(Date.UTC(2026, 0, 15, 12, 0), 'Europe/Berlin')).toBe(HOUR_MS);
    expect(getZoneOffsetMs(Date.UTC(2026, 6, 15, 12, 0), 'Europe/Berlin')).toBe(2 * HOUR_MS);
  });
});

describe('getStartOfDayInstant', () => {
  it('gives 2026-10-11T14:00Z for 2026-10-12 in Vladivostok', () => {
    expect(getStartOfDayInstant({ day: 12, month: 10, year: 2026 }, 'Asia/Vladivostok')).toBe(Date.UTC(2026, 9, 11, 14, 0));
  });

  it('gives 2026-10-11T21:00Z for 2026-10-12 in Moscow', () => {
    expect(getStartOfDayInstant({ day: 12, month: 10, year: 2026 }, 'Europe/Moscow')).toBe(Date.UTC(2026, 9, 11, 21, 0));
  });

  it('gives the same day start for UTC', () => {
    expect(getStartOfDayInstant({ day: 12, month: 10, year: 2026 }, 'UTC')).toBe(Date.UTC(2026, 9, 12, 0, 0));
  });

  it('is east of UTC the previous day and west of UTC the same day', () => {
    expect(getStartOfDayInstant({ day: 1, month: 1, year: 2027 }, 'Pacific/Kiritimati')).toBe(Date.UTC(2026, 11, 31, 10, 0));
    expect(getStartOfDayInstant({ day: 1, month: 1, year: 2027 }, 'America/Los_Angeles')).toBe(Date.UTC(2027, 0, 1, 8, 0));
  });

  it('handles an offset with minutes', () => {
    expect(getStartOfDayInstant({ day: 12, month: 10, year: 2026 }, 'Asia/Kolkata')).toBe(Date.UTC(2026, 9, 11, 18, 30));
  });

  it('gives a day of 23 hours on the spring change of summer time', () => {
    const start = getStartOfDayInstant({ day: 29, month: 3, year: 2026 }, 'Europe/Berlin');
    const next = getStartOfDayInstant({ day: 30, month: 3, year: 2026 }, 'Europe/Berlin');

    expect(start).toBe(Date.UTC(2026, 2, 28, 23, 0));
    expect(next).toBe(Date.UTC(2026, 2, 29, 22, 0));
    expect(next - start).toBe(23 * HOUR_MS);
  });

  it('gives a day of 25 hours on the autumn change of summer time', () => {
    const start = getStartOfDayInstant({ day: 25, month: 10, year: 2026 }, 'Europe/Berlin');
    const next = getStartOfDayInstant({ day: 26, month: 10, year: 2026 }, 'Europe/Berlin');

    expect(start).toBe(Date.UTC(2026, 9, 24, 22, 0));
    expect(next).toBe(Date.UTC(2026, 9, 25, 23, 0));
    expect(next - start).toBe(25 * HOUR_MS);
  });

  it('gives the first instant of a day whose midnight does not exist', () => {
    const start = getStartOfDayInstant({ day: 4, month: 11, year: 2018 }, 'America/Sao_Paulo');

    expect(start).toBe(Date.UTC(2018, 10, 4, 3, 0));
    expect(toCalendarDate(start - 1000, 'America/Sao_Paulo')).toEqual({ day: 3, month: 11, year: 2018 });
    expect(toCalendarDate(start, 'America/Sao_Paulo')).toEqual({ day: 4, month: 11, year: 2018 });
  });

  it('handles a half-hour change of summer time', () => {
    const start = getStartOfDayInstant({ day: 5, month: 4, year: 2026 }, 'Australia/Lord_Howe');

    expect(toCalendarDate(start, 'Australia/Lord_Howe')).toEqual({ day: 5, month: 4, year: 2026 });
    expect(toCalendarDate(start - 1000, 'Australia/Lord_Howe')).toEqual({ day: 4, month: 4, year: 2026 });
  });

  it.each(['Mars/Phobos', ''])('throws RangeError for the unknown time zone %j', (timeZone) => {
    expect(() => getStartOfDayInstant({ day: 1, month: 1, year: 2026 }, timeZone)).toThrow(RangeError);
  });

  it('throws RangeError for a date that does not exist', () => {
    expect(() => getStartOfDayInstant({ day: 30, month: 2, year: 2026 }, 'UTC')).toThrow(RangeError);
  });
});

describe('reversibility', () => {
  const firstDay: CalendarDateValue = { day: 1, month: 1, year: 2026 };
  const totalDays = 730;

  it.each(RUSSIAN_TIME_ZONES)('restores every day of 2026 and 2027 in %s', (timeZone) => {
    const firstEpochDay = toEpochDay(firstDay);

    for (let offset = 0; offset < totalDays; offset += 1) {
      const date = fromEpochDay(firstEpochDay + offset);
      const start = getStartOfDayInstant(date, timeZone);

      expect(formatCalendarDateIso(toCalendarDate(start, timeZone)), formatCalendarDateIso(date)).toBe(formatCalendarDateIso(date));
      expect(formatCalendarDateIso(toCalendarDate(start - 1, timeZone)), formatCalendarDateIso(date)).toBe(
        formatCalendarDateIso(addCalendarDays(date, -1)),
      );
    }
  });

  it.each(['Europe/Berlin', 'America/New_York', 'Australia/Lord_Howe', 'America/Sao_Paulo'])(
    'restores every day of 2026 and 2027 in %s that has summer time',
    (timeZone) => {
      const firstEpochDay = toEpochDay(firstDay);

      for (let offset = 0; offset < totalDays; offset += 1) {
        const date = fromEpochDay(firstEpochDay + offset);
        const start = getStartOfDayInstant(date, timeZone);

        expect(formatCalendarDateIso(toCalendarDate(start, timeZone)), formatCalendarDateIso(date)).toBe(formatCalendarDateIso(date));
        expect(formatCalendarDateIso(toCalendarDate(start - 1000, timeZone)), formatCalendarDateIso(date)).toBe(
          formatCalendarDateIso(addCalendarDays(date, -1)),
        );
      }
    },
  );
});

describe('formatter cache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds one formatter per time zone', () => {
    const constructorSpy = vi.spyOn(Intl, 'DateTimeFormat');
    const timeZone = 'Asia/Kathmandu';

    toCalendarDate(Date.UTC(2026, 0, 1), timeZone);
    toCalendarDate(Date.UTC(2026, 5, 1), timeZone);
    getZoneOffsetMs(Date.UTC(2026, 6, 1), timeZone);
    getStartOfDayInstant({ day: 1, month: 1, year: 2027 }, timeZone);

    expect(constructorSpy).toHaveBeenCalledTimes(1);
  });

  it('builds a separate formatter for another time zone', () => {
    const constructorSpy = vi.spyOn(Intl, 'DateTimeFormat');

    toCalendarDate(Date.UTC(2026, 0, 1), 'Asia/Thimphu');
    toCalendarDate(Date.UTC(2026, 0, 1), 'Asia/Thimphu');
    toCalendarDate(Date.UTC(2026, 0, 1), 'Asia/Dhaka');

    expect(constructorSpy).toHaveBeenCalledTimes(2);
  });

  it('does not keep a formatter for an unknown time zone', () => {
    const constructorSpy = vi.spyOn(Intl, 'DateTimeFormat');

    expect(() => toCalendarDate(0, 'Mars/Phobos')).toThrow(RangeError);
    expect(() => toCalendarDate(0, 'Mars/Phobos')).toThrow(RangeError);

    expect(constructorSpy).toHaveBeenCalledTimes(2);
  });
});
