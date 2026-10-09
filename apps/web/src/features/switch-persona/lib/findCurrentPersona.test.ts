import {
  describe,
  expect,
  it,
} from 'vitest';

import { findCurrentPersona } from './findCurrentPersona';
import {
  FRESH_CUSTOMER_FIXTURE,
  FRESH_STOREKEEPER_FIXTURE,
  PERSONA_FIXTURES,
} from './testing/personaFixtures';

describe('findCurrentPersona', () => {
  it('finds the persona by the organization and the user of the acting context', () => {
    const found = findCurrentPersona(PERSONA_FIXTURES, {
      organizationId: FRESH_STOREKEEPER_FIXTURE.organizationId,
      userId: FRESH_STOREKEEPER_FIXTURE.userId,
    });

    expect(found).toBe(FRESH_STOREKEEPER_FIXTURE);
  });

  it('tells the personas of one organization apart by the user', () => {
    expect(FRESH_CUSTOMER_FIXTURE.organizationId).toBe(FRESH_STOREKEEPER_FIXTURE.organizationId);
    expect(findCurrentPersona(PERSONA_FIXTURES, {
      organizationId: FRESH_CUSTOMER_FIXTURE.organizationId,
      userId: FRESH_CUSTOMER_FIXTURE.userId,
    })).toBe(FRESH_CUSTOMER_FIXTURE);
  });

  it('finds nothing for an unknown or an empty context', () => {
    expect(findCurrentPersona(PERSONA_FIXTURES, { organizationId: 'unknown', userId: 'unknown' })).toBeUndefined();
    expect(findCurrentPersona(PERSONA_FIXTURES, { organizationId: undefined, userId: undefined })).toBeUndefined();
    expect(findCurrentPersona([], {
      organizationId: FRESH_CUSTOMER_FIXTURE.organizationId,
      userId: FRESH_CUSTOMER_FIXTURE.userId,
    })).toBeUndefined();
  });
});
