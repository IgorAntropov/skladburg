import { useState } from 'react';

export interface HeldErrorValue {
  announceKey: number;
  error: Error | null;
}

interface ErrorRecordValue {
  count: number;
  error: Error | null;
}

interface HeldErrorOptionsValue {
  error: Error | null;
  hasData: boolean;
  isRetrying: boolean;
}

export const useHeldError = ({ error, hasData, isRetrying }: HeldErrorOptionsValue): HeldErrorValue => {
  const [record, setRecord] = useState<ErrorRecordValue>({ count: 0, error: null });

  const isNewError = error !== null && error !== record.error;
  const isRecordStale = error === null && hasData && record.error !== null;

  if (isNewError) {
    setRecord({ count: record.count + 1, error });
  }
  else if (isRecordStale) {
    setRecord({ count: record.count, error: null });
  }

  const isErrorHeld = isRetrying && !hasData && error === null;

  return { announceKey: record.count, error: error ?? (isErrorHeld ? record.error : null) };
};
