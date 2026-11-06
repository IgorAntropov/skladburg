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

import type { PermissionGrantValue } from './permissionGrants';

import {
  createEmptySnapshot,
  createEngineState,
  type IEngineState,
} from '../state/index';
import {
  createLiveMeta,
  TEST_WORLD_TIME_MS,
} from '../state/testRecords';
import {
  projectSessionPermissions,
  resolveEffectivePermissions,
} from './effectivePermissions';

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

const grant = (
  amountMinor: bigint | undefined,
  currencyCode = 'RUB',
  warehouseIds: readonly string[] = [],
): PermissionGrantValue => ({
  amountLimit: amountMinor === undefined ? undefined : create(MoneySchema, { amountMinor, currencyCode }),
  isOrganizationWide: warehouseIds.length === 0,
  permission: 'deal_approve',
  warehouseIds,
});

describe('projectSessionPermissions', () => {
  it('returns the largest limit for the same permission, scope and currency without losing bigint precision', () => {
    const permissions = projectSessionPermissions([grant(9_007_199_254_740_992n), grant(9_007_199_254_740_993n)]);

    expect(permissions).toHaveLength(1);
    expect(permissions[0]).toMatchObject({
      amountLimit: { amountMinor: 9_007_199_254_740_993n, currencyCode: 'RUB' },
      isOrganizationWide: true,
      permission: 'deal_approve',
      warehouseIds: [],
    });
  });

  it('keeps the largest limit of every currency', () => {
    const permissions = projectSessionPermissions([grant(900000n), grant(300n, 'USD'), grant(200n, 'USD')]);

    expect(permissions.map(permission => permission.amountLimit)).toMatchObject([
      { amountMinor: 900000n, currencyCode: 'RUB' },
      { amountMinor: 300n, currencyCode: 'USD' },
    ]);
  });

  it('lets an unlimited organization grant absorb every currency and scope', () => {
    const permissions = projectSessionPermissions([
      grant(900000n), grant(300n, 'USD'), grant(undefined, 'RUB', [WAREHOUSE_1]), grant(undefined),
    ]);

    expect(permissions).toHaveLength(1);
    expect(permissions[0]?.amountLimit).toBeUndefined();
    expect(permissions[0]?.isOrganizationWide).toBe(true);
  });

  it('keeps a scoped unlimited grant separate from the organization limit and other warehouses', () => {
    const permissions = projectSessionPermissions([
      grant(100n),
      grant(undefined, 'RUB', [WAREHOUSE_1]),
      grant(200n, 'USD', [WAREHOUSE_2]),
      grant(50n, 'USD', [WAREHOUSE_1]),
    ]);

    expect(permissions).toHaveLength(3);
    expect(permissions[0]).toMatchObject({ amountLimit: { amountMinor: 100n }, isOrganizationWide: true });
    expect(permissions.find(permission => permission.warehouseIds.includes(WAREHOUSE_1))?.amountLimit).toBeUndefined();
    expect(permissions.find(permission => permission.warehouseIds.includes(WAREHOUSE_2))?.amountLimit)
      .toMatchObject({ amountMinor: 200n, currencyCode: 'USD' });
  });

  it('does not combine a high limit from one warehouse with access to another warehouse', () => {
    const permissions = projectSessionPermissions([
      grant(100n, 'RUB', [WAREHOUSE_1, WAREHOUSE_2]),
      grant(200n, 'RUB', [WAREHOUSE_2, WAREHOUSE_3]),
    ]);

    expect(permissions).toHaveLength(2);
    const warehousePermissions = permissions.filter(permission => permission.warehouseIds.includes(WAREHOUSE_1));

    expect(warehousePermissions.map(permission => permission.amountLimit?.amountMinor)).toEqual([100n]);
  });

  it('normalizes duplicate warehouses and removes only grants covered by the same currency and scope', () => {
    const permissions = projectSessionPermissions([
      grant(100n, 'RUB', [WAREHOUSE_2, WAREHOUSE_1, WAREHOUSE_1]),
      grant(100n, 'RUB', [WAREHOUSE_1, WAREHOUSE_2]),
      grant(99n, 'RUB', [WAREHOUSE_1]),
      grant(99n, 'USD', [WAREHOUSE_1]),
    ]);

    expect(permissions).toHaveLength(2);
    expect(permissions.some(permission =>
      permission.warehouseIds.length === 2 && permission.amountLimit?.currencyCode === 'RUB')).toBe(true);
    expect(permissions.some(permission =>
      permission.warehouseIds.length === 1 && permission.amountLimit?.currencyCode === 'USD')).toBe(true);
  });

  it('preserves the combined scope of permissions without an applicable amount limit', () => {
    const permissions = projectSessionPermissions([
      { ...grant(100n, 'RUB', [WAREHOUSE_1]), permission: 'warehouse_view' },
      { ...grant(200n, 'USD', [WAREHOUSE_2]), permission: 'warehouse_view' },
    ]);

    expect(permissions).toHaveLength(1);
    expect(permissions[0]).toMatchObject({
      isOrganizationWide: false,
      permission: 'warehouse_view',
      warehouseIds: [WAREHOUSE_1, WAREHOUSE_2],
    });
    expect(permissions[0]?.amountLimit).toBeUndefined();
  });

  it('produces the same projection regardless of role assignment order', () => {
    const grants = [grant(100n), grant(300n, 'USD'), grant(200n, 'RUB', [WAREHOUSE_2]), grant(undefined, 'RUB', [WAREHOUSE_1])];

    expect(projectSessionPermissions(grants)).toEqual(projectSessionPermissions([...grants].reverse()));
  });
});
