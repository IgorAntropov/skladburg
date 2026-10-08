import type {
  ErrorCode,
  ErrorDetail,
} from '@skladburg/contracts/common/v1/error';

export interface ApiErrorValue {
  code: ErrorCode;
  isRetryable: boolean;
  params: ErrorDetail['params'];
  traceId: string | undefined;
}
