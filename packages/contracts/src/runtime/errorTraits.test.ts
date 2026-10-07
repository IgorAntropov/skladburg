import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  ErrorCategory,
  ErrorCode,
} from '../gen/common/v1/error_pb';
import { getErrorTraits } from './errorTraits';

const declaredCodes = Object.values(ErrorCode).filter((value): value is ErrorCode => typeof value === 'number');

describe('getErrorTraits', () => {
  it('reads the category of a code', () => {
    expect(getErrorTraits(ErrorCode.SESSION_REQUIRED).category).toBe(ErrorCategory.UNAUTHENTICATED);
  });

  it('reads the retryable flag of a code', () => {
    expect(getErrorTraits(ErrorCode.UNAVAILABLE).isRetryable).toBe(true);
    expect(getErrorTraits(ErrorCode.NOT_FOUND).isRetryable).toBe(false);
  });

  it('returns unspecified traits for the unspecified code', () => {
    const traits = getErrorTraits(ErrorCode.UNSPECIFIED);

    expect(traits.category).toBe(ErrorCategory.UNSPECIFIED);
    expect(traits.isRetryable).toBe(false);
  });

  it('gives every declared code except the unspecified one a category', () => {
    const codesWithoutCategory = declaredCodes
      .filter(code => code !== ErrorCode.UNSPECIFIED)
      .filter(code => getErrorTraits(code).category === ErrorCategory.UNSPECIFIED);

    expect(codesWithoutCategory).toEqual([]);
  });
});
