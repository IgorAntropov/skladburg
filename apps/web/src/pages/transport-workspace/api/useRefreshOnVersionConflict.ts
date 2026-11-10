import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  useEffect,
  useRef,
} from 'react';

import type { CommandValue } from '@/shared/api';

export const useRefreshOnVersionConflict = (command: CommandValue, refresh: () => Promise<void>): void => {
  const handledError = useRef<Error | null>(null);
  const { apiError, error } = command;

  useEffect(() => {
    if (apiError?.code === ErrorCode.VERSION_CONFLICT && error !== handledError.current) {
      handledError.current = error;
      void refresh();
    }
  }, [apiError, error, refresh]);
};
