import type { EffectivePermission } from '@skladburg/contracts/access/v1/access';

import { create } from '@bufbuild/protobuf';
import { EffectivePermissionSchema } from '@skladburg/contracts/access/v1/access';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { PermissionScopeValue } from '../model/permissionScope';
import type { CommandRequirementValue } from './readCommandRequirement';

import { readCommandRequirement } from './readCommandRequirement';
import { resolveCommandAccess } from './resolveCommandAccess';

const WAREHOUSE_ID = 'b0000001-0000-4000-8000-000000000000';
const OTHER_WAREHOUSE_ID = 'b0000002-0000-4000-8000-000000000000';

const ANY: PermissionScopeValue = { kind: 'any' };
const ORGANIZATION: PermissionScopeValue = { kind: 'organization' };
const WAREHOUSE: PermissionScopeValue = { kind: 'warehouse', warehouseId: WAREHOUSE_ID };

const OPEN: CommandRequirementValue = { kind: 'open' };
const REQUIRES_WAREHOUSE_EDIT: CommandRequirementValue = { kind: 'permission', permission: 'warehouse_edit' };

const createPermission = (permission: string, isOrganizationWide: boolean, warehouseIds: string[] = []): EffectivePermission =>
  create(EffectivePermissionSchema, { isOrganizationWide, permission, warehouseIds });

const findMethod = (name: string): (typeof OrganizationService.methods)[number] => {
  const method = OrganizationService.methods.find(candidate => candidate.name === name);

  if (!method) {
    throw new Error(`Method ${name} is not declared`);
  }

  return method;
};

describe('resolveCommandAccess', () => {
  it('allows an open command even without a session', () => {
    expect(resolveCommandAccess(OPEN, undefined, ANY)).toEqual({ status: 'allowed' });
  });

  it('keeps checking while the session is not loaded', () => {
    expect(resolveCommandAccess(REQUIRES_WAREHOUSE_EDIT, undefined, ANY)).toEqual({ status: 'checking' });
  });

  it('allows a granted permission', () => {
    const permissions = [createPermission('warehouse_edit', true)];

    expect(resolveCommandAccess(REQUIRES_WAREHOUSE_EDIT, permissions, ANY)).toEqual({ status: 'allowed' });
  });

  it('denies a missing permission and names it', () => {
    const permissions = [createPermission('warehouse_view', true)];

    expect(resolveCommandAccess(REQUIRES_WAREHOUSE_EDIT, permissions, ANY)).toEqual({
      permission: 'warehouse_edit',
      status: 'denied',
    });
  });

  it('denies a name that is not in the catalog and keeps the name', () => {
    const requirement: CommandRequirementValue = { kind: 'permission', permission: 'no_such_permission' };

    expect(resolveCommandAccess(requirement, [createPermission('no_such_permission', true)], ANY)).toEqual({
      permission: 'no_such_permission',
      status: 'denied',
    });
  });

  it('denies a permission granted on another warehouse only', () => {
    const permissions = [createPermission('warehouse_edit', false, [OTHER_WAREHOUSE_ID])];

    expect(resolveCommandAccess(REQUIRES_WAREHOUSE_EDIT, permissions, WAREHOUSE)).toEqual({
      permission: 'warehouse_edit',
      status: 'denied',
    });
  });

  it('allows an organization-wide permission in the warehouse and organization scopes', () => {
    const permissions = [createPermission('warehouse_edit', true)];

    expect(resolveCommandAccess(REQUIRES_WAREHOUSE_EDIT, permissions, WAREHOUSE)).toEqual({ status: 'allowed' });
    expect(resolveCommandAccess(REQUIRES_WAREHOUSE_EDIT, permissions, ORGANIZATION)).toEqual({ status: 'allowed' });
  });

  it('denies a warehouse-only permission in the organization scope', () => {
    const permissions = [createPermission('warehouse_edit', false, [WAREHOUSE_ID])];

    expect(resolveCommandAccess(REQUIRES_WAREHOUSE_EDIT, permissions, ORGANIZATION)).toEqual({
      permission: 'warehouse_edit',
      status: 'denied',
    });
  });
});

describe('readCommandRequirement', () => {
  it('reads the permission from the method option', () => {
    expect(readCommandRequirement(findMethod('CreateWarehouse'))).toEqual({
      kind: 'permission',
      permission: 'warehouse_create',
    });
  });

  it('treats a member requirement as open', () => {
    expect(readCommandRequirement(findMethod('GetOrganization'))).toEqual(OPEN);
  });

  it('treats a missing method as open', () => {
    expect(readCommandRequirement(undefined)).toEqual(OPEN);
  });

  it('gives the same object for the same method', () => {
    const method = findMethod('CreateWarehouse');

    expect(readCommandRequirement(method)).toBe(readCommandRequirement(method));
  });
});
