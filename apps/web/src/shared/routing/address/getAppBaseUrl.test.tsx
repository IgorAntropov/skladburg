import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { getAppBaseUrl } from './getAppBaseUrl';

describe('getAppBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('joins the page origin with the base path', () => {
    vi.stubEnv('BASE_URL', '/skladburg/');

    expect(getAppBaseUrl().href).toBe(`${window.location.origin}/skladburg/`);
  });

  it('uses the root for the default base', () => {
    vi.stubEnv('BASE_URL', '/');

    expect(getAppBaseUrl().href).toBe(`${window.location.origin}/`);
  });
});
