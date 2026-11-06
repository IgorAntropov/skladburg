import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  useEffect,
  useRef,
} from 'react';

import type { CommandValue } from '@/shared/api';

export const useDealConflictRefresh = (command: CommandValue, onRefresh: () => void): void => {
  const seenError = useRef<Error | null>(null);
  const { apiError, error } = command;

  useEffect(() => {
    if (apiError?.code === ErrorCode.VERSION_CONFLICT && error !== seenError.current) {
      seenError.current = error;
      onRefresh();
    }
  }, [apiError, error, onRefresh]);
};
