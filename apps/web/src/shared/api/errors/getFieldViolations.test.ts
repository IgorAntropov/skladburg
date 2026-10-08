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

import type { ApiErrorValue } from './apiErrorTypes';

import { getFieldViolations } from './getFieldViolations';

const createError = (params: ApiErrorValue['params']): ApiErrorValue => ({
  code: ErrorCode.VALIDATION_FAILED,
  isRetryable: false,
  params,
  traceId: undefined,
});

describe('getFieldViolations', () => {
  it('returns the violations of a validation error', () => {
    const violations = [
      create(FieldViolationSchema, { fieldPath: 'name', ruleId: 'string.min_len' }),
      create(FieldViolationSchema, { fieldPath: 'city_id', ruleId: 'string.uuid_empty' }),
    ];

    const error = createError({
      case: 'validationFailed',
      value: create(ValidationFailedParamsSchema, { violations }),
    });

    expect(getFieldViolations(error)).toEqual(violations);
  });

  it('returns nothing for an error of another kind', () => {
    expect(getFieldViolations(createError({ case: undefined }))).toEqual([]);
  });
});
