import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  parseDealReminderMark,
  serializeDealReminderMark,
} from './dealReminderRecords';

describe('deal reminder record storage', () => {
  it('round trips both processed deadlines and absent marks without losing zero', () => {
    for (const instant of [undefined, 0, 1_791_965_000_000]) {
      const mark = { confirmationDueAtMs: instant, counterOfferDueAtMs: instant, id: 'deal' };

      expect(parseDealReminderMark(serializeDealReminderMark(mark))).toEqual(mark);
    }
  });

  it('rejects malformed stored values', () => {
    expect(() => parseDealReminderMark(new Uint8Array())).toThrow(TypeError);
    expect(() => parseDealReminderMark({ confirmationDueAtMs: null, counterOfferDueAtMs: null, id: 1 })).toThrow(TypeError);

    for (const instant of [Number.NaN, Number.POSITIVE_INFINITY, 0.5, Number.MAX_SAFE_INTEGER + 1, '0']) {
      expect(() => parseDealReminderMark({ confirmationDueAtMs: instant, counterOfferDueAtMs: null, id: 'deal' })).toThrow(TypeError);
      expect(() => parseDealReminderMark({ confirmationDueAtMs: null, counterOfferDueAtMs: instant, id: 'deal' })).toThrow(TypeError);
    }
  });
});
