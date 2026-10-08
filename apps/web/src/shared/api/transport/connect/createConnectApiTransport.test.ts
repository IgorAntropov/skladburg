import {
  describe,
  expect,
  it,
} from 'vitest';

import { createConnectApiTransport } from './createConnectApiTransport';

describe('createConnectApiTransport', () => {
  it('builds a transport for the configured address', () => {
    const transport = createConnectApiTransport({ apiUrl: 'https://api.test', interceptors: [] });

    expect(typeof transport.unary).toBe('function');
  });

  it('refuses to start without an address', () => {
    expect(() => createConnectApiTransport({ apiUrl: undefined, interceptors: [] })).toThrow('VITE_API_URL');
  });

  it('refuses to start with an empty address', () => {
    expect(() => createConnectApiTransport({ apiUrl: '', interceptors: [] })).toThrow('VITE_API_URL');
  });
});
