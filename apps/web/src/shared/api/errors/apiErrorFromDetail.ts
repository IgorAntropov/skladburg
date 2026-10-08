import {
  ErrorCode,
  type ErrorDetail,
} from '@skladburg/contracts/common/v1/error';
import { getErrorTraits } from '@skladburg/contracts/runtime';

import type { ApiErrorValue } from './apiErrorTypes';

import { isKnownErrorCode } from './isKnownErrorCode';

export const apiErrorFromDetail = (detail: ErrorDetail): ApiErrorValue => {
  const code = isKnownErrorCode(detail.code) ? detail.code : ErrorCode.INTERNAL;

  return {
    code,
    isRetryable: getErrorTraits(code).isRetryable,
    params: detail.params,
    traceId: detail.traceId === '' ? undefined : detail.traceId,
  };
};
