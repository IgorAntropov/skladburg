import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createRetryPredicate,
  getRetryDelayMs,
} from './queryRetryPolicy';

const createErrorWithCode = (code: ErrorCode): ConnectError => new ConnectError(
  'failed',
  Code.FailedPrecondition,
  undefined,
  [{ desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code }) }],
);

const NON_RETRYABLE_CODES: readonly ErrorCode[] = [
  ErrorCode.PERMISSION_DENIED,
  ErrorCode.VALIDATION_FAILED,
  ErrorCode.NOT_FOUND,
  ErrorCode.SESSION_REQUIRED,
];

describe('getRetryDelayMs', () => {
  it('doubles the pause from one second', () => {
    expect([0, 1, 2].map(getRetryDelayMs)).toEqual([1000, 2000, 4000]);
  });

  it('never exceeds eight seconds', () => {
    expect([3, 4, 10, 50].map(getRetryDelayMs)).toEqual([8000, 8000, 8000, 8000]);
  });
});

describe('createRetryPredicate', () => {
  const unavailable = new ConnectError('down', Code.Unavailable);

  it('allows retries of a retryable error below the limit', () => {
    const shouldRetry = createRetryPredicate(3);

    expect([0, 1, 2].map(count => shouldRetry(count, unavailable))).toEqual([true, true, true]);
  });

  it('stops at the limit', () => {
    expect(createRetryPredicate(3)(3, unavailable)).toBe(false);
    expect(createRetryPredicate(2)(2, unavailable)).toBe(false);
  });

  it('retries a connect error without a detail and with the internal transport code', () => {
    expect(createRetryPredicate(3)(0, new ConnectError('failed', Code.Internal))).toBe(true);
  });

  it('does not retry a value that is not a connect error', () => {
    expect(createRetryPredicate(3)(0, new Error('boom'))).toBe(false);
    expect(createRetryPredicate(3)(0, 'boom')).toBe(false);
  });

  it.each(NON_RETRYABLE_CODES)('does not retry error code %s', (code) => {
    expect(createRetryPredicate(3)(0, createErrorWithCode(code))).toBe(false);
  });
});
