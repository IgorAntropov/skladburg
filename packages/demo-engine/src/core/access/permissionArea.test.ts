import {
  getPermissionName,
  listPermissionCodes,
} from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { PLATFORM_OPERATOR_ORGANIZATION_ID } from '../platform/index';
import {
  isPermissionInOrganizationArea,
  isPlatformPermission,
} from './permissionArea';

const CLIENT_ORGANIZATION_ID = '10000001-0000-4000-8000-000000000000';

describe('isPlatformPermission', () => {
  it('recognizes the platform permissions of the catalog', () => {
    expect(isPlatformPermission('support_ticket_view')).toBe(true);
    expect(isPlatformPermission('support_session_create')).toBe(true);
    expect(isPlatformPermission('platform_dispute_approve')).toBe(true);
  });

  it('does not take client permissions, even support_access ones, for platform', () => {
    expect(isPlatformPermission('support_access_approve')).toBe(false);
    expect(isPlatformPermission('support_access_view')).toBe(false);
    expect(isPlatformPermission('deal_approve')).toBe(false);
  });

  it('does not take an unknown name for platform', () => {
    expect(isPlatformPermission('unknown_permission')).toBe(false);
    expect(isPlatformPermission('')).toBe(false);
  });
});

describe('isPermissionInOrganizationArea', () => {
  it('lets the operator hold platform permissions only', () => {
    for (const code of listPermissionCodes()) {
      const name = getPermissionName(code);

      expect(isPermissionInOrganizationArea(name, PLATFORM_OPERATOR_ORGANIZATION_ID), name).toBe(isPlatformPermission(name));
    }
  });

  it('lets a client hold client permissions only', () => {
    for (const code of listPermissionCodes()) {
      const name = getPermissionName(code);

      expect(isPermissionInOrganizationArea(name, CLIENT_ORGANIZATION_ID), name).toBe(!isPlatformPermission(name));
    }
  });

  it('keeps an unknown name away from the operator', () => {
    expect(isPermissionInOrganizationArea('unknown_permission', PLATFORM_OPERATOR_ORGANIZATION_ID)).toBe(false);
  });
});
