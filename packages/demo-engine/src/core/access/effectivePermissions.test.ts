import { create } from '@bufbuild/protobuf';
import {
  MembershipSchema,
  RoleSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createEmptySnapshot,
  createEngineState,
  type IEngineState,
} from '../state/index';
import {
  createLiveMeta,
  TEST_WORLD_TIME_MS,
} from '../state/testRecords';
import { resolveEffectivePermissions } from './effectivePermissions';

const ORGANIZATION_ID = '10000001-0000-4000-8000-000000000000';
const OTHER_ORGANIZATION_ID = '10000002-0000-4000-8000-000000000000';
const WAREHOUSE_1 = '80000001-0000-4000-8000-000000000000';
const WAREHOUSE_2 = '80000002-0000-4000-8000-000000000000';
const WAREHOUSE_3 = '80000003-0000-4000-8000-000000000000';

interface RoleDefinitionValue {
  id: string;
  permissions: string[];
  tenantId: string;
}

const createState = (roles: readonly RoleDefinitionValue[]): IEngineState => {
  const state = createEngineState(createEmptySnapshot());
  state.transact(TEST_WORLD_TIME_MS, (transaction) => {
    for (const role of roles) {
      transaction.put('roles', create(RoleSchema, { id: role.id, name: role.id, permissions: role.permissions, tenantId: role.tenantId }));
    }
  }, createLiveMeta).apply();

  return state;
};

const createMembership = (assignments: { roleId: string; warehouseIds: string[] }[]): ReturnType<typeof create<typeof MembershipSchema>> =>
  create(MembershipSchema, {
    id: 'membership-1',
    organizationId: ORGANIZATION_ID,
    roleAssignments: assignments,
    userId: 'user-1',
  });

describe('resolveEffectivePermissions', () => {
  it('returns an organization-wide permission for an assignment without warehouses', () => {
    const state = createState([{ id: 'role-1', permissions: ['warehouse_view'], tenantId: ORGANIZATION_ID }]);

    const result = resolveEffectivePermissions(state.read, createMembership([{ roleId: 'role-1', warehouseIds: [] }]));

    expect(result).toEqual([{ isOrganizationWide: true, permission: 'warehouse_view', warehouseIds: [] }]);
  });

  it('limits the permission to the listed warehouses', () => {
    const state = createState([{ id: 'role-1', permissions: ['warehouse_view'], tenantId: ORGANIZATION_ID }]);

    const membership = createMembership([{ roleId: 'role-1', warehouseIds: [WAREHOUSE_2, WAREHOUSE_1] }]);

    const result = resolveEffectivePermissions(state.read, membership);

    expect(result).toEqual([{ isOrganizationWide: false, permission: 'warehouse_view', warehouseIds: [WAREHOUSE_1, WAREHOUSE_2] }]);
  });

  it('unites the warehouses of several assignments without duplicates', () => {
    const state = createState([
      { id: 'role-1', permissions: ['warehouse_view'], tenantId: ORGANIZATION_ID },
      { id: 'role-2', permissions: ['warehouse_view', 'member_view'], tenantId: ORGANIZATION_ID },
    ]);

    const result = resolveEffectivePermissions(state.read, createMembership([
      { roleId: 'role-1', warehouseIds: [WAREHOUSE_1, WAREHOUSE_2] },
      { roleId: 'role-2', warehouseIds: [WAREHOUSE_2, WAREHOUSE_3] },
    ]));

    expect(result).toEqual([
      { isOrganizationWide: false, permission: 'member_view', warehouseIds: [WAREHOUSE_2, WAREHOUSE_3] },
      { isOrganizationWide: false, permission: 'warehouse_view', warehouseIds: [WAREHOUSE_1, WAREHOUSE_2, WAREHOUSE_3] },
    ]);
  });

  it('lets an organization-wide assignment absorb the limited ones', () => {
    const state = createState([{ id: 'role-1', permissions: ['warehouse_view'], tenantId: ORGANIZATION_ID }]);

    const result = resolveEffectivePermissions(state.read, createMembership([
      { roleId: 'role-1', warehouseIds: [WAREHOUSE_1] },
      { roleId: 'role-1', warehouseIds: [] },
    ]));

    expect(result).toEqual([{ isOrganizationWide: true, permission: 'warehouse_view', warehouseIds: [] }]);
  });

  it('ignores a role of another organization and a role that does not exist', () => {
    const state = createState([{ id: 'role-foreign', permissions: ['warehouse_view'], tenantId: OTHER_ORGANIZATION_ID }]);

    const result = resolveEffectivePermissions(state.read, createMembership([
      { roleId: 'role-foreign', warehouseIds: [] },
      { roleId: 'role-missing', warehouseIds: [] },
    ]));

    expect(result).toEqual([]);
  });

  it('returns the permissions sorted by name', () => {
    const state = createState([{ id: 'role-1', permissions: ['warehouse_view', 'deal_view', 'member_view'], tenantId: ORGANIZATION_ID }]);

    const result = resolveEffectivePermissions(state.read, createMembership([{ roleId: 'role-1', warehouseIds: [] }]));

    expect(result.map(effective => effective.permission)).toEqual(['deal_view', 'member_view', 'warehouse_view']);
  });
});
