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

import { isNotFoundError } from './isNotFoundError';

const createApiError = (code: ErrorCode): ConnectError => new ConnectError(
  'failed',
  Code.FailedPrecondition,
  undefined,
  [{ desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code }) }],
);

describe('isNotFoundError', () => {
  it('is true for the not found code of the service', () => {
    expect(isNotFoundError(createApiError(ErrorCode.NOT_FOUND))).toBe(true);
  });

  it('is false for another code of the service', () => {
    expect(isNotFoundError(createApiError(ErrorCode.PERMISSION_DENIED))).toBe(false);
  });

  it('is false without an error', () => {
    expect(isNotFoundError(null)).toBe(false);
  });
});
