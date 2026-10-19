import type { EffectivePermission } from '@skladburg/contracts/access/v1/access';

import { create } from '@bufbuild/protobuf';
import { EffectivePermissionSchema } from '@skladburg/contracts/access/v1/access';
import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { PermissionScopeValue } from '../model/permissionScope';

import { isPermissionGranted } from './isPermissionGranted';

const WAREHOUSE_ID = 'b0000001-0000-4000-8000-000000000000';
const OTHER_WAREHOUSE_ID = 'b0000002-0000-4000-8000-000000000000';

const ANY: PermissionScopeValue = { kind: 'any' };
const ORGANIZATION: PermissionScopeValue = { kind: 'organization' };
const WAREHOUSE: PermissionScopeValue = { kind: 'warehouse', warehouseId: WAREHOUSE_ID };
const OTHER_WAREHOUSE: PermissionScopeValue = { kind: 'warehouse', warehouseId: OTHER_WAREHOUSE_ID };

const createPermission = (permission: string, isOrganizationWide: boolean, warehouseIds: string[] = []): EffectivePermission =>
  create(EffectivePermissionSchema, { isOrganizationWide, permission, warehouseIds });

describe('isPermissionGranted', () => {
  it('denies everything on an empty list', () => {
    expect(isPermissionGranted([], PermissionCode.DEAL_VIEW, ANY)).toBe(false);
    expect(isPermissionGranted([], PermissionCode.DEAL_VIEW, ORGANIZATION)).toBe(false);
    expect(isPermissionGranted([], PermissionCode.DEAL_VIEW, WAREHOUSE)).toBe(false);
  });

  it('grants an organization-wide permission in every scope', () => {
    const permissions = [createPermission('deal_view', true)];

    expect(isPermissionGranted(permissions, PermissionCode.DEAL_VIEW, ANY)).toBe(true);
    expect(isPermissionGranted(permissions, PermissionCode.DEAL_VIEW, ORGANIZATION)).toBe(true);
    expect(isPermissionGranted(permissions, PermissionCode.DEAL_VIEW, WAREHOUSE)).toBe(true);
  });

  it('grants a permission on a part of the warehouses in the any scope and on those warehouses only', () => {
    const permissions = [createPermission('warehouse_view', false, [WAREHOUSE_ID])];

    expect(isPermissionGranted(permissions, PermissionCode.WAREHOUSE_VIEW, ANY)).toBe(true);
    expect(isPermissionGranted(permissions, PermissionCode.WAREHOUSE_VIEW, WAREHOUSE)).toBe(true);
    expect(isPermissionGranted(permissions, PermissionCode.WAREHOUSE_VIEW, OTHER_WAREHOUSE)).toBe(false);
    expect(isPermissionGranted(permissions, PermissionCode.WAREHOUSE_VIEW, ORGANIZATION)).toBe(false);
  });

  it('denies another permission of the session', () => {
    const permissions = [createPermission('deal_view', true)];

    expect(isPermissionGranted(permissions, PermissionCode.WAREHOUSE_VIEW, ANY)).toBe(false);
  });

  it('ignores a permission name unknown to the catalog', () => {
    const permissions = [createPermission('teleport_edit', true), createPermission('deal_view', true)];

    expect(isPermissionGranted(permissions, PermissionCode.DEAL_VIEW, ANY)).toBe(true);
    expect(isPermissionGranted(permissions, PermissionCode.DEAL_EDIT, ANY)).toBe(false);
  });

  it('grants when one of several entries of the same permission fits the scope', () => {
    const permissions = [
      createPermission('warehouse_view', false, [OTHER_WAREHOUSE_ID]),
      createPermission('warehouse_view', false, [WAREHOUSE_ID]),
    ];

    expect(isPermissionGranted(permissions, PermissionCode.WAREHOUSE_VIEW, WAREHOUSE)).toBe(true);
  });
});
