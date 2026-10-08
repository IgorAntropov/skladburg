import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import { getErrorTraits } from '@skladburg/contracts/runtime';

import type { ApiErrorValue } from './apiErrorTypes';

import { apiErrorFromDetail } from './apiErrorFromDetail';

const UNAVAILABLE_TRANSPORT_CODES: readonly Code[] = [Code.Unavailable, Code.DeadlineExceeded];

const createErrorWithoutDetail = (code: ErrorCode): ApiErrorValue => ({
  code,
  isRetryable: getErrorTraits(code).isRetryable,
  params: { case: undefined },
  traceId: undefined,
});

const createUnexpectedError = (): ApiErrorValue => ({
  ...createErrorWithoutDetail(ErrorCode.INTERNAL),
  isRetryable: false,
});

export const parseApiError = (error: unknown): ApiErrorValue => {
  if (!(error instanceof ConnectError)) {
    return createUnexpectedError();
  }

  const [detail] = error.findDetails(ErrorDetailSchema);

  if (detail !== undefined) {
    return apiErrorFromDetail(detail);
  }

  return createErrorWithoutDetail(
    UNAVAILABLE_TRANSPORT_CODES.includes(error.code) ? ErrorCode.UNAVAILABLE : ErrorCode.INTERNAL,
  );
};
