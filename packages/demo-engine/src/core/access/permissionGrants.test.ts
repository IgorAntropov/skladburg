import { create } from '@bufbuild/protobuf';
import {
  MembershipSchema,
  RoleSchema,
} from '@skladburg/contracts/access/v1/access';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createEmptySnapshot,
  createEngineState,
} from '../state/index';
import {
  createLiveMeta,
  TEST_WORLD_TIME_MS,
} from '../state/testRecords';
import { resolveEffectivePermissions } from './effectivePermissions';
import { resolvePermissionGrants } from './permissionGrants';

const ORGANIZATION_ID = '10000001-0000-4000-8000-000000000000';
const OTHER_ORGANIZATION_ID = '10000002-0000-4000-8000-000000000000';
const WAREHOUSE_1 = '80000001-0000-4000-8000-000000000000';
const LIMIT = create(MoneySchema, { amountMinor: 500000n, currencyCode: 'RUB' });

const createState = (): ReturnType<typeof createEngineState> => {
  const state = createEngineState(createEmptySnapshot());
  state.transact(TEST_WORLD_TIME_MS, (transaction) => {
    transaction.put('roles', create(RoleSchema, {
      id: 'role-1',
      name: 'role-1',
      permissions: ['deal_approve', 'deal_view'],
      tenantId: ORGANIZATION_ID,
    }));
    transaction.put('roles', create(RoleSchema, {
      id: 'role-foreign',
      name: 'role-foreign',
      permissions: ['deal_view'],
      tenantId: OTHER_ORGANIZATION_ID,
    }));
  }, createLiveMeta).apply();

  return state;
};

const createMembership = (
  assignments: { amountLimit?: typeof LIMIT; roleId: string; warehouseIds: string[] }[],
): ReturnType<typeof create<typeof MembershipSchema>> =>
  create(MembershipSchema, { id: 'membership-1', organizationId: ORGANIZATION_ID, roleAssignments: assignments, userId: 'user-1' });

describe('resolvePermissionGrants', () => {
  it('returns one grant per assignment and role permission with the limit of the assignment', () => {
    const { read } = createState();

    const grants = resolvePermissionGrants(read, createMembership([
      { amountLimit: LIMIT, roleId: 'role-1', warehouseIds: [] },
      { roleId: 'role-1', warehouseIds: [WAREHOUSE_1] },
    ]));

    expect(grants).toHaveLength(4);
    expect(grants.filter(grant => grant.permission === 'deal_approve')).toEqual([
      { amountLimit: LIMIT, isOrganizationWide: true, permission: 'deal_approve', warehouseIds: [] },
      { amountLimit: undefined, isOrganizationWide: false, permission: 'deal_approve', warehouseIds: [WAREHOUSE_1] },
    ]);
  });

  it('skips roles of another organization and roles that do not exist', () => {
    const { read } = createState();

    const grants = resolvePermissionGrants(read, createMembership([
      { roleId: 'role-foreign', warehouseIds: [] },
      { roleId: 'role-missing', warehouseIds: [] },
    ]));

    expect(grants).toEqual([]);
  });

  it('does not put the limit into the effective permissions', () => {
    const { read } = createState();

    const effective = resolveEffectivePermissions(read, createMembership([{ amountLimit: LIMIT, roleId: 'role-1', warehouseIds: [] }]));

    expect(effective.map(permission => permission.permission)).toEqual(['deal_approve', 'deal_view']);
    expect(effective.every(permission => !('amountLimit' in permission))).toBe(true);
  });
});
