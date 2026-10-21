import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveNetworkSelectedTarget } from './resolveNetworkSelectedTarget';

describe('resolveNetworkSelectedTarget', () => {
  it('gives a site and a city as map targets', () => {
    expect(resolveNetworkSelectedTarget('site-1', 'site')).toEqual({ id: 'site-1', kind: 'site' });
    expect(resolveNetworkSelectedTarget('city-1', 'city')).toEqual({ id: 'city-1', kind: 'city' });
  });

  it('gives nothing for other objects and for an empty focus', () => {
    expect(resolveNetworkSelectedTarget('deal-1', 'deal')).toBeUndefined();
    expect(resolveNetworkSelectedTarget(undefined, undefined)).toBeUndefined();
  });
});
