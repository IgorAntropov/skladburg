import type { ErrorCode } from '@skladburg/contracts/common/v1/error';

import type { ApiErrorValue } from './apiErrorTypes';

export const ERROR_JOURNAL_CAPACITY = 20;

export interface ErrorJournalEntryValue {
  code: ErrorCode;
  method: string;
  occurredAt: number;
  params: ApiErrorValue['params'];
  traceId: string | undefined;
}

export interface IErrorJournal {
  clear: () => void;
  list: () => readonly ErrorJournalEntryValue[];
  record: (entry: ErrorJournalEntryValue) => void;
  subscribe: (listener: (entry: ErrorJournalEntryValue) => void) => () => void;
}

export const createErrorJournal = (capacity: number = ERROR_JOURNAL_CAPACITY): IErrorJournal => {
  let entries: readonly ErrorJournalEntryValue[] = [];
  const listeners = new Set<(entry: ErrorJournalEntryValue) => void>();

  return {
    clear: () => {
      entries = [];
    },
    list: () => entries,
    record: (entry) => {
      entries = [...entries, entry].slice(-capacity);

      for (const listener of Array.from(listeners)) {
        try {
          listener(entry);
        }
        catch (error) {
          console.log('> ErrorJournal -> record:', { code: entry.code, error });
        }
      }
    },
    subscribe: (listener) => {
      const subscription = (entry: ErrorJournalEntryValue): void => {
        listener(entry);
      };

      listeners.add(subscription);

      return () => {
        listeners.delete(subscription);
      };
    },
  };
};
