import type { DescMethod } from '@bufbuild/protobuf';
import type { QueryKey } from '@tanstack/react-query';

import type { ApiErrorValue } from '../errors/apiErrorTypes';

export interface CommandOptionsValue<TResult> {
  execute: (idempotencyKey: string) => Promise<TResult>;
  method?: DescMethod | undefined;
  mutationKey?: QueryKey | undefined;
  onSuccess?: ((result: TResult) => void) | undefined;
}

export interface CommandValue {
  apiError: ApiErrorValue | undefined;
  error: Error | null;
  failedAt: number;
  isPending: boolean;
  method: DescMethod | undefined;
  reset: () => void;
  run: () => void;
}
