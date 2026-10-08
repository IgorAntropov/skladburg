import {
  describe,
  expect,
  it,
} from 'vitest';

import { organizationKeys } from './organizationKeys';

describe('organizationKeys', () => {
  it('builds keys that share the organization root', () => {
    expect(organizationKeys.all).toEqual(['organization']);
    expect(organizationKeys.detail('a')).toEqual(['organization', 'detail', 'a']);
    expect(organizationKeys.settings('a')).toEqual(['organization', 'settings', 'a']);
  });

  it('separates organizations and kinds of data', () => {
    expect(organizationKeys.detail('a')).not.toEqual(organizationKeys.detail('b'));
    expect(organizationKeys.detail('a')).not.toEqual(organizationKeys.settings('a'));
  });
});
