import { create } from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { WarehouseSchema } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { RU_BUSINESS_CALENDAR } from '../../calendar/ruBusinessCalendar';
import {
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import { createDealDeadlines } from './dealDeadlines';
import {
  createEffectsDeal,
  createEffectsHarness,
} from './testing/dealEffectsFixtures';

describe('deal deadlines', () => {
  it.each([
    [Date.UTC(2026, 9, 15, 20, 59), Date.UTC(2026, 9, 16, 20, 59, 59, 999), '2026.1'],
    [Date.UTC(2026, 9, 16, 9), Date.UTC(2026, 9, 19, 20, 59, 59, 999), '2026.1'],
    [Date.UTC(2026, 11, 30, 9), Date.UTC(2027, 0, 11, 20, 59, 59, 999), '2026.1;2027.1'],
  ] as const)('ends the next working day after %s in the receiving warehouse time zone', async (now, expected, version) => {
    const deal = createEffectsDeal();
    const harness = await createEffectsHarness(deal);
    vi.spyOn(harness.clock, 'now').mockReturnValue(now);

    const deadlines = await harness.runtime.command(transaction => createDealDeadlines(harness.runtime, transaction, deal, 'confirmation'));

    expect(deadlines.confirmationDueAt === undefined ? undefined : timestampMs(deadlines.confirmationDueAt)).toBe(expected);
    expect(deadlines.counterOfferDueAt).toBeUndefined();
    expect(deadlines.calendarVersion).toBe(version);
    expect(deadlines.timeZone).toBe('Europe/Moscow');
  });

  it('uses the receiving warehouse zone when its date is already the next day', async () => {
    const deal = createEffectsDeal();
    const harness = await createEffectsHarness(deal);
    vi.spyOn(harness.clock, 'now').mockReturnValue(Date.UTC(2026, 9, 15, 18));

    const deadlines = await harness.runtime.command((transaction) => {
      const warehouse = create(WarehouseSchema, transaction.get('warehouses', deal.shipToWarehouseId));
      warehouse.timeZone = 'Asia/Tomsk';
      transaction.put('warehouses', warehouse);

      return createDealDeadlines(harness.runtime, transaction, deal, 'counterOffer');
    });

    expect(deadlines.counterOfferDueAt === undefined ? undefined : timestampMs(deadlines.counterOfferDueAt))
      .toBe(Date.UTC(2026, 9, 19, 16, 59, 59, 999));
    expect(deadlines.confirmationDueAt).toBeUndefined();
    expect(deadlines.timeZone).toBe('Asia/Tomsk');
  });

  it('retains calendar provenance after the active deadline is cleared', async () => {
    const deal = createEffectsDeal();
    const harness = await createEffectsHarness(deal);

    const deadlines = await harness.runtime.command((transaction) => {
      deal.deadlines = createDealDeadlines(harness.runtime, transaction, deal, 'confirmation');

      return createDealDeadlines(harness.runtime, transaction, deal, 'clear');
    });

    expect(deadlines.confirmationDueAt).toBeUndefined();
    expect(deadlines.counterOfferDueAt).toBeUndefined();
    expect(deadlines.calendarVersion).toBe(RU_BUSINESS_CALENDAR.getCalendarDay({ day: 15, month: 10, year: 2026 }).version);
    expect(deadlines.timeZone).toBe('Europe/Moscow');
  });

  it('fails explicitly when the calendar does not cover the next working day', async () => {
    const deal = createEffectsDeal();
    const harness = await createEffectsHarness(deal);
    vi.spyOn(harness.clock, 'now').mockReturnValue(Date.UTC(2027, 11, 31, 9));

    const error = await captureError(harness.runtime.command(transaction =>
      createDealDeadlines(harness.runtime, transaction, deal, 'confirmation'),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.UNAVAILABLE);
  });
});
