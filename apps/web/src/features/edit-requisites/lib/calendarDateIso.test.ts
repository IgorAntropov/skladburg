import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  formatIsoCalendarDate,
  parseIsoCalendarDate,
} from './calendarDateIso';

describe('calendarDateIso', () => {
  it('turns the text of a date field into the parts of a date', () => {
    expect(parseIsoCalendarDate('2026-01-12')).toEqual({ day: 12, month: 1, year: 2026 });
  });

  it('keeps a year of five or six digits so that the server can report it', () => {
    expect(parseIsoCalendarDate('20260-03-04')).toEqual({ day: 4, month: 3, year: 20_260 });
    expect(parseIsoCalendarDate('275760-09-13')).toEqual({ day: 13, month: 9, year: 275_760 });
  });

  it('keeps a day that does not exist in the month: the existence is checked by the server', () => {
    expect(parseIsoCalendarDate('2027-02-31')).toEqual({ day: 31, month: 2, year: 2027 });
  });

  it.each(['', ' ', 'abc', '2026-1-5', '26-01-12', '2026/01/12', '2026-01-12 ', '2026-01', '1234567-01-01'])(
    'returns nothing for a text that is not a date: "%s"',
    (value) => {
      expect(parseIsoCalendarDate(value)).toBeUndefined();
    },
  );

  it('writes the parts with leading zeros', () => {
    expect(formatIsoCalendarDate({ day: 2, month: 1, year: 2026 })).toBe('2026-01-02');
    expect(formatIsoCalendarDate({ day: 31, month: 12, year: 2100 })).toBe('2100-12-31');
  });

  it('pads a short year to four digits', () => {
    expect(formatIsoCalendarDate({ day: 1, month: 1, year: 999 })).toBe('0999-01-01');
  });

  it('gives back the same text after a round trip', () => {
    const text = '2026-10-05';
    const parsed = parseIsoCalendarDate(text);

    expect(parsed === undefined ? undefined : formatIsoCalendarDate(parsed)).toBe(text);
  });
});
