import { create } from '@bufbuild/protobuf';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createTestLocalizer } from '@/shared/i18n/index.testing';

import type { FormatCalendarDateFunction } from './formatEtaDate';

import { formatEtaDate } from './formatEtaDate';

const readFormat = async (): Promise<FormatCalendarDateFunction> => {
  const localizer = await createTestLocalizer();

  return localizer.getSnapshot().formatCalendarDate;
};

describe('formatEtaDate', () => {
  it('writes the short weekday, the day and the month', async () => {
    const formatCalendarDate = await readFormat();
    const etaDate = create(CalendarDateSchema, { day: 15, month: 10, year: 2026 });

    expect(formatEtaDate(formatCalendarDate, etaDate)).toBe('чт, 15 октября');
  });

  it('has no text for a missing or empty date', async () => {
    const formatCalendarDate = await readFormat();

    expect(formatEtaDate(formatCalendarDate, undefined)).toBeUndefined();
    expect(formatEtaDate(formatCalendarDate, create(CalendarDateSchema, {}))).toBeUndefined();
  });
});
