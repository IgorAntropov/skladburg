import {
  describe,
  expect,
  it,
} from 'vitest';

import { sessionKeys } from './sessionKeys';

describe('sessionKeys', () => {
  it('builds the current key from the organization and the user', () => {
    expect(sessionKeys.all).toEqual(['session']);
    expect(sessionKeys.current('org-a', 'user-a')).toEqual(['session', 'current', 'org-a', 'user-a']);
  });

  it('separates users of the same organization and organizations of the same user', () => {
    expect(sessionKeys.current('org-a', 'user-a')).not.toEqual(sessionKeys.current('org-a', 'user-b'));
    expect(sessionKeys.current('org-a', 'user-a')).not.toEqual(sessionKeys.current('org-b', 'user-a'));
  });
});
