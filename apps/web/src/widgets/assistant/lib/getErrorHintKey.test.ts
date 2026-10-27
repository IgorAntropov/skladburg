import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { getErrorHintKey } from './getErrorHintKey';

const QUIET_CODES: readonly ErrorCode[] = [
  ErrorCode.VALIDATION_FAILED,
  ErrorCode.UNAVAILABLE,
  ErrorCode.INTERNAL,
  ErrorCode.SESSION_REQUIRED,
];

describe('getErrorHintKey', () => {
  it.each(QUIET_CODES)('stays silent for code %s', (code) => {
    expect(getErrorHintKey(code)).toBeNull();
  });

  it('stays silent for an unspecified code', () => {
    expect(getErrorHintKey(ErrorCode.UNSPECIFIED)).toBeNull();
  });
});
