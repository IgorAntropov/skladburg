import {
  getOption,
  hasOption,
} from '@bufbuild/protobuf';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  ErrorCategory,
  ErrorCode,
  ErrorCodeSchema,
  error_traits as errorTraits,
} from '../gen/common/v1/error_pb';

interface ErrorTraitsSnapshotValue {
  category: ErrorCategory;
  isRetryable: boolean;
}

const expectedTraits: Record<ErrorCode, ErrorTraitsSnapshotValue> = {
  [ErrorCode.IDEMPOTENCY_KEY_REUSED]: { category: ErrorCategory.INVALID_ARGUMENT, isRetryable: false },
  [ErrorCode.INTERNAL]: { category: ErrorCategory.INTERNAL, isRetryable: true },
  [ErrorCode.INVALID_TRANSITION]: { category: ErrorCategory.FAILED_PRECONDITION, isRetryable: false },
  [ErrorCode.LIMIT_EXCEEDED]: { category: ErrorCategory.PERMISSION_DENIED, isRetryable: false },
  [ErrorCode.MEMBERSHIP_REQUIRED]: { category: ErrorCategory.PERMISSION_DENIED, isRetryable: false },
  [ErrorCode.NOT_FOUND]: { category: ErrorCategory.NOT_FOUND, isRetryable: false },
  [ErrorCode.PERMISSION_DENIED]: { category: ErrorCategory.PERMISSION_DENIED, isRetryable: false },
  [ErrorCode.SESSION_REQUIRED]: { category: ErrorCategory.UNAUTHENTICATED, isRetryable: false },
  [ErrorCode.UNAVAILABLE]: { category: ErrorCategory.UNAVAILABLE, isRetryable: true },
  [ErrorCode.UNSPECIFIED]: { category: ErrorCategory.UNSPECIFIED, isRetryable: false },
  [ErrorCode.VALIDATION_FAILED]: { category: ErrorCategory.INVALID_ARGUMENT, isRetryable: false },
  [ErrorCode.VERSION_CONFLICT]: { category: ErrorCategory.ABORTED, isRetryable: false },
};

const readActualTraits = (code: number): ErrorTraitsSnapshotValue => {
  const value = ErrorCodeSchema.values.find(candidate => candidate.number === code);

  if (!value) {
    throw new Error(`ErrorCode ${String(code)} is not declared`);
  }

  if (!hasOption(value, errorTraits)) {
    return { category: ErrorCategory.UNSPECIFIED, isRetryable: false };
  }

  const { category, isRetryable } = getOption(value, errorTraits);

  return { category, isRetryable };
};

describe('error code catalog', () => {
  it.each(Object.entries(expectedTraits))('declares the expected traits for code %s', (code, expected) => {
    expect(readActualTraits(Number(code))).toEqual(expected);
  });

  it('keeps the expected map in step with the enum values', () => {
    const expectedCodes = Object.keys(expectedTraits).map(Number).sort((current, next) => current - next);
    const enumCodes = ErrorCodeSchema.values.map(value => value.number);

    expect(expectedCodes).toEqual(enumCodes);
  });
});
