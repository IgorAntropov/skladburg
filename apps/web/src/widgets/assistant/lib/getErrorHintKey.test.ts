import { fromJson } from '@bufbuild/protobuf';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { getErrorHintKey } from './getErrorHintKey';

const QUIET_CODES: readonly ErrorCode[] = [
  ErrorCode.IMPORT_FILE_INVALID,
  ErrorCode.IMPORT_ROLLBACK_BLOCKED,
  ErrorCode.VALIDATION_FAILED,
  ErrorCode.UNAVAILABLE,
  ErrorCode.INTERNAL,
  ErrorCode.SESSION_REQUIRED,
];

describe('getErrorHintKey', () => {
  it.each([
    [ErrorCode.IDEMPOTENCY_KEY_REUSED, 'idempotencyKeyReused'],
    [ErrorCode.INVALID_TRANSITION, 'invalidTransition'],
    [ErrorCode.LIMIT_EXCEEDED, 'limitExceeded'],
    [ErrorCode.MEMBERSHIP_REQUIRED, 'membershipRequired'],
    [ErrorCode.NOT_FOUND, 'notFound'],
    [ErrorCode.PERMISSION_DENIED, 'permissionDenied'],
    [ErrorCode.VERSION_CONFLICT, 'versionConflict'],
  ] as const)('preserves the hint for code %s', (code, suffix) => {
    expect(getErrorHintKey(code)).toBe(`assistant.error.hint.${suffix}`);
  });

  it('stays silent for a future code', () => {
    expect(getErrorHintKey(fromJson(ErrorDetailSchema, { code: 999 }).code)).toBeNull();
  });

  it.each(QUIET_CODES)('stays silent for code %s', (code) => {
    expect(getErrorHintKey(code)).toBeNull();
  });

  it('stays silent for an unspecified code', () => {
    expect(getErrorHintKey(ErrorCode.UNSPECIFIED)).toBeNull();
  });
});
