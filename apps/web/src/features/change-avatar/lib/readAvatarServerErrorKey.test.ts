import { create } from '@bufbuild/protobuf';
import {
  ErrorCode,
  FieldViolationSchema,
  ValidationFailedParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ApiErrorValue } from '@/shared/api';

import { readAvatarServerErrorKey } from './readAvatarServerErrorKey';

const createValidationError = (ruleIds: readonly string[]): ApiErrorValue => ({
  code: ErrorCode.VALIDATION_FAILED,
  isRetryable: false,
  params: {
    case: 'validationFailed',
    value: create(ValidationFailedParamsSchema, {
      violations: ruleIds.map(ruleId => create(FieldViolationSchema, { fieldPath: 'image', ruleId })),
    }),
  },
  traceId: undefined,
});

describe('readAvatarServerErrorKey', () => {
  it('returns nothing without an error', () => {
    expect(readAvatarServerErrorKey(undefined)).toBeUndefined();
  });

  it('names the signature violation', () => {
    expect(readAvatarServerErrorKey(createValidationError(['avatar_image_signature']))).toBe('validation.avatar_image_signature');
  });

  it('names the signature violation among others', () => {
    expect(readAvatarServerErrorKey(createValidationError(['required', 'avatar_image_signature']))).toBe(
      'validation.avatar_image_signature',
    );
  });

  it('leaves other violations to the generic notice', () => {
    expect(readAvatarServerErrorKey(createValidationError(['bytes.max_len']))).toBeUndefined();
  });

  it('leaves an error without violations to the generic notice', () => {
    expect(readAvatarServerErrorKey({
      code: ErrorCode.UNAVAILABLE,
      isRetryable: true,
      params: { case: undefined },
      traceId: undefined,
    })).toBeUndefined();
  });
});
