import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { DEFAULT_ORGANIZATION_DIRECTORY_FILTER } from '../model/organizationDirectoryFilter';
import { countActiveDirectoryFilters } from './countActiveDirectoryFilters';

describe('countActiveDirectoryFilters', () => {
  it('counts nothing for the default filter', () => {
    expect(countActiveDirectoryFilters(DEFAULT_ORGANIZATION_DIRECTORY_FILTER)).toBe(0);
  });

  it('counts every changed field once', () => {
    expect(countActiveDirectoryFilters({ ...DEFAULT_ORGANIZATION_DIRECTORY_FILTER, profileKind: ProfileKind.CARRIER })).toBe(1);
    expect(countActiveDirectoryFilters({ ...DEFAULT_ORGANIZATION_DIRECTORY_FILTER, sphereId: 'sphere' })).toBe(1);
    expect(countActiveDirectoryFilters({ ...DEFAULT_ORGANIZATION_DIRECTORY_FILTER, minVerificationLevel: 2 })).toBe(1);
    expect(countActiveDirectoryFilters({ minVerificationLevel: 3, profileKind: ProfileKind.SUPPLIER, sphereId: 'sphere' })).toBe(3);
  });
});
