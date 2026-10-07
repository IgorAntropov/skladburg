import {
  describe,
  expect,
  it,
} from 'vitest';

import { AccessService } from '../gen/access/v1/access_pb';
import { OrganizationService } from '../gen/organization/v1/organization_pb';
import { listPermissionNames } from './permissionNames';

describe('listPermissionNames', () => {
  it('lists permissions of the organization service', () => {
    expect(listPermissionNames([OrganizationService])).toEqual(['warehouse_create', 'warehouse_view']);
  });

  it('returns unique sorted names across services', () => {
    const names = listPermissionNames([OrganizationService, AccessService, OrganizationService]);

    expect(names).toEqual([...new Set(names)].sort((current, next) => current.localeCompare(next, 'en')));
    expect(names).toEqual(['member_view', 'warehouse_create', 'warehouse_view']);
  });

  it('returns an empty list without services', () => {
    expect(listPermissionNames([])).toEqual([]);
  });
});
