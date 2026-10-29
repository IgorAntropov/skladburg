import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ErrorJournalEntryValue } from './errorJournal';

import { createErrorJournal } from './errorJournal';

const createEntry = (occurredAt: number): ErrorJournalEntryValue => ({
  code: ErrorCode.INTERNAL,
  method: 'deal.v1.DealService/ApproveDeal',
  occurredAt,
  params: { case: undefined },
  traceId: `trace-${String(occurredAt)}`,
});

describe('createErrorJournal', () => {
  it('lists records from the oldest to the newest', () => {
    const journal = createErrorJournal();

    journal.record(createEntry(1));
    journal.record(createEntry(2));

    expect(journal.list().map(entry => entry.occurredAt)).toEqual([1, 2]);
  });

  it('keeps the last 20 records by default and drops the oldest', () => {
    const journal = createErrorJournal();

    for (let moment = 1; moment <= 25; moment += 1) {
      journal.record(createEntry(moment));
    }

    const moments = journal.list().map(entry => entry.occurredAt);

    expect(moments).toHaveLength(20);
    expect(moments[0]).toBe(6);
    expect(moments[19]).toBe(25);
  });

  it('keeps as many records as the capacity says', () => {
    const journal = createErrorJournal(2);

    journal.record(createEntry(1));
    journal.record(createEntry(2));
    journal.record(createEntry(3));

    expect(journal.list().map(entry => entry.occurredAt)).toEqual([2, 3]);
  });

  it('gives a listener each new record until it unsubscribes', () => {
    const journal = createErrorJournal();
    const listener = vi.fn<(entry: ErrorJournalEntryValue) => void>();
    const unsubscribe = journal.subscribe(listener);

    journal.record(createEntry(1));
    unsubscribe();
    journal.record(createEntry(2));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(createEntry(1));
  });

  it('forgets the records on clear and still gives new ones to the listeners', () => {
    const journal = createErrorJournal();
    const listener = vi.fn<(entry: ErrorJournalEntryValue) => void>();

    journal.subscribe(listener);
    journal.record(createEntry(1));
    journal.clear();

    expect(journal.list()).toEqual([]);

    journal.record(createEntry(2));

    expect(journal.list().map(entry => entry.occurredAt)).toEqual([2]);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(createEntry(2));
  });

  it('keeps the record and the other listeners when a listener throws', () => {
    const journal = createErrorJournal();
    const next = vi.fn<(entry: ErrorJournalEntryValue) => void>();

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    journal.subscribe(() => {
      throw new Error('listener failed');
    });
    journal.subscribe(next);

    expect(() => {
      journal.record(createEntry(1));
    }).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
    expect(journal.list()).toHaveLength(1);
  });
});
