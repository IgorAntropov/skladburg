import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { getPlacesRecovery } from './getPlacesRecovery';

describe('getPlacesRecovery', () => {
  it('asks for a reload when the service is not implemented', () => {
    expect(getPlacesRecovery(new ConnectError('no service', Code.Unimplemented))).toBe('reload');
  });

  it('asks for a retry on any other connect error', () => {
    expect(getPlacesRecovery(new ConnectError('down', Code.Unavailable))).toBe('retry');
  });

  it('asks for a retry on an error that is not a connect error', () => {
    expect(getPlacesRecovery(new Error('boom'))).toBe('retry');
  });
});
