import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';

import { create } from '@bufbuild/protobuf';
import {
  EffectivePermissionSchema,
  GetSessionResponseSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveAvailableSections } from './resolveAvailableSections';

const WAREHOUSE_ID = 'a0000003-0000-4000-8000-000000000000';

interface PermissionOptionsValue {
  isOrganizationWide: boolean;
  permission: string;
  warehouseIds?: string[];
}

const createSession = (permissions: readonly PermissionOptionsValue[]): GetSessionResponse => create(GetSessionResponseSchema, {
  permissions: permissions.map(permission => create(EffectivePermissionSchema, permission)),
});

const organizationWide = (...names: string[]): PermissionOptionsValue[] =>
  names.map(permission => ({ isOrganizationWide: true, permission }));

describe('resolveAvailableSections', () => {
  it('returns nothing for an empty session', () => {
    expect(resolveAvailableSections(create(GetSessionResponseSchema))).toEqual([]);
  });

  it('returns nothing without any permission', () => {
    expect(resolveAvailableSections(createSession([]))).toEqual([]);
  });

  it('returns nothing for permissions that are not view permissions of a section', () => {
    expect(resolveAvailableSections(createSession(organizationWide('deal_edit', 'warehouse_create')))).toEqual([]);
  });

  it('gives all four sections in the order of sections for all view permissions', () => {
    const session = createSession(organizationWide('warehouse_view', 'deal_view', 'marketplace_view', 'network_view'));

    expect(resolveAvailableSections(session)).toEqual(['network', 'catalog', 'deals', 'warehouse']);
  });

  it('hides the deals without the deal view permission', () => {
    const session = createSession(organizationWide('network_view', 'marketplace_view', 'warehouse_view'));

    expect(resolveAvailableSections(session)).toEqual(['network', 'catalog', 'warehouse']);
  });

  it('shows the warehouse for the permission on a single warehouse', () => {
    const session = createSession([{ isOrganizationWide: false, permission: 'warehouse_view', warehouseIds: [WAREHOUSE_ID] }]);

    expect(resolveAvailableSections(session)).toEqual(['warehouse']);
  });

  it('shows the catalog for the catalog view permission alone', () => {
    expect(resolveAvailableSections(createSession(organizationWide('catalog_view')))).toEqual(['catalog']);
  });

  it('shows the catalog for the marketplace view permission alone', () => {
    expect(resolveAvailableSections(createSession(organizationWide('marketplace_view')))).toEqual(['catalog']);
  });

  it('ignores a permission name unknown to the catalog', () => {
    expect(resolveAvailableSections(createSession(organizationWide('teleport_view', 'deal_view')))).toEqual(['deals']);
  });
});
