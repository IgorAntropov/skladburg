import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { isReadAccessDenied } from './isReadAccessDenied';

describe('isReadAccessDenied', () => {
  it.each([Code.NotFound, Code.PermissionDenied, Code.Unauthenticated])('rejects transport denial %i without details', (code) => {
    expect(isReadAccessDenied(new ConnectError('', code))).toBe(true);
  });

  it.each([Code.Canceled, Code.DeadlineExceeded, Code.Internal, Code.Unavailable])('allows stale data after failure %i', (code) => {
    expect(isReadAccessDenied(new ConnectError('', code))).toBe(false);
  });
});
