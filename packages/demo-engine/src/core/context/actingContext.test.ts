import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { DEMO_USER_HEADER } from '../protocol';
import { readActingContext } from './actingContext';

describe('readActingContext', () => {
  it('reads the user and the organization from the headers', () => {
    const headers = new Headers({
      [ACTING_ORGANIZATION_HEADER]: 'organization-1',
      [DEMO_USER_HEADER]: 'user-1',
    });

    expect(readActingContext(headers)).toEqual({ organizationId: 'organization-1', userId: 'user-1' });
  });

  it('leaves both undefined when the headers are absent', () => {
    expect(readActingContext(new Headers())).toEqual({ organizationId: undefined, userId: undefined });
  });

  it('treats empty and blank values as undefined', () => {
    const headers = new Headers({
      [ACTING_ORGANIZATION_HEADER]: '',
      [DEMO_USER_HEADER]: '   ',
    });

    expect(readActingContext(headers)).toEqual({ organizationId: undefined, userId: undefined });
  });

  it('reads a user without an organization', () => {
    const headers = new Headers({ [DEMO_USER_HEADER]: 'user-1' });

    expect(readActingContext(headers)).toEqual({ organizationId: undefined, userId: 'user-1' });
  });

  it('reads headers regardless of the name case', () => {
    const headers = new Headers();
    headers.set('X-Demo-User-Id', 'user-2');

    expect(readActingContext(headers).userId).toBe('user-2');
  });
});
