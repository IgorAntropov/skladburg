import { Code } from '@connectrpc/connect';
import { PermissionAction } from '@skladburg/contracts/access/v1/access';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  getPermissionName,
  getPermissionTraits,
  listPermissionCodes,
} from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { RolePresetKey } from '../../access/index';
import {
  createSeedRoleId,
  SeedMembershipId,
  SeedOrganizationId,
  SeedRoleId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/index';
import { INVALID_PAGE_TOKEN_RULE_ID } from '../pagination';
import {
  addTestMember,
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';

const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const MONEY_ACTION_SUFFIXES: readonly string[] = ['_fund', '_release'];

const listDirectorPermissionNames = (profile: ProfileKind): string[] =>
  listPermissionCodes()
    .filter(code => getPermissionTraits(code).profiles.includes(profile))
    .map(code => getPermissionName(code))
    .filter(name => !MONEY_ACTION_SUFFIXES.some(suffix => name.endsWith(suffix)))
    .sort();

const ACCOUNTANT_MONEY_PERMISSION_NAMES: readonly string[] = ['payment_fund', 'payment_release'];

const STOREKEEPER_PERMISSION_NAMES: readonly string[] = [
  'inventory_edit',
  'inventory_view',
  'sensor_view',
  'task_edit',
  'task_view',
  'warehouse_view',
  'yard_view',
];

describe('AccessService.getSession', () => {
  it('returns the user, memberships, own organizations and effective permissions of the acting organization', async () => {
    const { access } = createModuleHarness();

    const response = await access.getSession({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));

    expect(response.user?.id).toBe(SeedUserId.ADMIN_1);
    expect(response.memberships.map(membership => membership.id)).toEqual([SeedMembershipId.ADMIN_1]);
    expect(response.organizations.map(organization => organization.id)).toEqual([SeedOrganizationId.CUSTOMER_1]);
    expect(response.organizations[0]?.inn).not.toBe('');
    expect(response.actingOrganizationId).toBe(SeedOrganizationId.CUSTOMER_1);
    expect(response.permissions.map(permission => permission.permission)).toEqual(
      [...listDirectorPermissionNames(ProfileKind.CUSTOMER), ...ACCOUNTANT_MONEY_PERMISSION_NAMES].sort(),
    );
    expect(response.permissions.every(permission => permission.isOrganizationWide && permission.warehouseIds.length === 0)).toBe(true);
  });

  it('returns the area of a role limited to one warehouse', async () => {
    const { access } = createModuleHarness();

    const response = await access.getSession({}, callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1));

    expect(response.permissions.map(permission => permission.permission)).toEqual(STOREKEEPER_PERMISSION_NAMES);
    expect(response.permissions.every(permission => !permission.isOrganizationWide)).toBe(true);
    expect(response.permissions.every(permission => permission.warehouseIds.length === 1)).toBe(true);
    expect(response.permissions.map(permission => permission.warehouseIds[0])).toEqual(
      STOREKEEPER_PERMISSION_NAMES.map(() => SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1),
    );
  });

  it('works without an acting organization and returns no permissions', async () => {
    const { access } = createModuleHarness();

    const response = await access.getSession({}, callAs(SeedUserId.ADMIN_1));

    expect(response.actingOrganizationId).toBe('');
    expect(response.permissions).toEqual([]);
    expect(response.memberships).toHaveLength(1);
  });

  it('returns every organization of the user in full and the permissions of the acting one only', async () => {
    const harness = createModuleHarness();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.SUPPLIER_5,
      permissions: ['member_view'],
      warehouseIds: [],
    });
    const response = await harness.access.getSession({}, callAs(userId, SeedOrganizationId.SUPPLIER_5));

    expect(response.organizations.map(organization => organization.id)).toEqual([SeedOrganizationId.SUPPLIER_5]);
    expect(response.organizations[0]?.legalName).not.toBe('');
    expect(response.permissions.map(permission => permission.permission)).toEqual(['member_view']);
  });

  it('rejects a call without a user with session_required', async () => {
    const { access } = createModuleHarness();

    const error = await captureError(access.getSession({}, callAs(undefined, SeedOrganizationId.CUSTOMER_1)));

    expect(error.code).toBe(Code.Unauthenticated);
    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('rejects an unknown user with session_required', async () => {
    const { access } = createModuleHarness();

    const error = await captureError(access.getSession({}, callAs(UNKNOWN_ID)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('rejects an organization the user does not belong to with membership_required', async () => {
    const { access } = createModuleHarness();

    const error = await captureError(access.getSession({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_2)));

    expect(error.code).toBe(Code.PermissionDenied);
    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });
});

describe('AccessService.listPermissions', () => {
  it('returns every permission of the contract catalog with feature, action, traits and profiles', async () => {
    const { access } = createModuleHarness();

    const response = await access.listPermissions({ page: { pageSize: 200 } }, callAs(SeedUserId.ADMIN_1));
    const codes = listPermissionCodes();
    const warehouseView = response.permissions.find(permission => permission.name === 'warehouse_view');
    const dealApprove = response.permissions.find(permission => permission.name === 'deal_approve');
    const marketplaceView = response.permissions.find(permission => permission.name === 'marketplace_view');

    const platformPermissions = response.permissions.filter(permission => permission.isPlatform);
    const supportAccessApprove = response.permissions.find(permission => permission.name === 'support_access_approve');
    const supportTicketView = response.permissions.find(permission => permission.name === 'support_ticket_view');

    expect(codes).toHaveLength(68);
    expect(response.permissions.map(permission => permission.name)).toEqual(codes.map(getPermissionName));
    expect(response.permissions.every(permission => permission.isPlatform === (permission.profiles.length === 0))).toBe(true);
    expect(response.permissions.map(permission => permission.isPlatform)).toEqual(codes.map(code => getPermissionTraits(code).isPlatform));
    expect(platformPermissions.map(permission => permission.name)).toEqual([
      'platform_dispute_approve',
      'platform_verification_approve',
      'support_emergency_manage',
      'support_session_create',
      'support_settings_edit',
      'support_ticket_edit',
      'support_ticket_view',
    ]);
    expect(platformPermissions.every(permission => !permission.isScopeApplicable && !permission.isLimitApplicable)).toBe(true);
    expect(supportAccessApprove?.isPlatform).toBe(false);
    expect(supportAccessApprove?.profiles).toEqual([ProfileKind.CUSTOMER, ProfileKind.SUPPLIER, ProfileKind.CARRIER]);
    expect(supportTicketView?.isPlatform).toBe(true);
    expect(supportTicketView?.profiles).toEqual([]);
    expect(response.permissions.map(permission => permission.profiles)).toEqual(codes.map(code => getPermissionTraits(code).profiles));
    expect(warehouseView?.feature).toBe('warehouse');
    expect(warehouseView?.action).toBe(PermissionAction.VIEW);
    expect(warehouseView?.isScopeApplicable).toBe(true);
    expect(warehouseView?.isLimitApplicable).toBe(false);
    expect(warehouseView?.profiles).toEqual([ProfileKind.CUSTOMER, ProfileKind.SUPPLIER]);
    expect(dealApprove?.isLimitApplicable).toBe(true);
    expect(marketplaceView?.profiles).toEqual([ProfileKind.CUSTOMER]);
    expect(response.page?.nextPageToken).toBe('');
  });

  it('is available with a session alone and without an organization', async () => {
    const { access } = createModuleHarness();

    const response = await access.listPermissions({}, callAs(SeedUserId.STOREKEEPER_1));

    expect(response.permissions.length).toBeGreaterThan(0);
  });

  it('pages through the catalog with an opaque cursor', async () => {
    const { access } = createModuleHarness();
    const options = callAs(SeedUserId.ADMIN_1);
    const first = await access.listPermissions({ page: { pageSize: 2 } }, options);
    const second = await access.listPermissions({ page: { pageSize: 2, pageToken: first.page?.nextPageToken } }, options);
    const all = await access.listPermissions({}, options);

    expect(first.permissions).toHaveLength(2);
    expect(first.page?.nextPageToken).not.toBe('');
    expect([...first.permissions, ...second.permissions].map(permission => permission.name))
      .toEqual(all.permissions.slice(0, first.permissions.length + second.permissions.length).map(permission => permission.name));
  });

  it('rejects a cursor that matches no record with validation_failed on page.page_token', async () => {
    const { access } = createModuleHarness();

    const error = await captureError(access.listPermissions({ page: { pageToken: 'unknown' } }, callAs(SeedUserId.ADMIN_1)));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.InvalidArgument);
    expect(detail.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(detail.params.case === 'validationFailed' ? detail.params.value.violations.map(violation => violation.fieldPath) : []).toEqual([
      'page.page_token',
    ]);
    expect(detail.params.case === 'validationFailed' ? detail.params.value.violations[0]?.ruleId : undefined)
      .toBe(INVALID_PAGE_TOKEN_RULE_ID);
  });

  it('rejects a page size above the contract maximum with the validation rule id', async () => {
    const { access } = createModuleHarness();

    const error = await captureError(access.listPermissions({ page: { pageSize: 201 } }, callAs(SeedUserId.ADMIN_1)));
    const detail = readErrorDetail(error);

    expect(detail.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(detail.params.case === 'validationFailed' ? detail.params.value.violations[0] : undefined).toMatchObject({
      fieldPath: 'page.page_size',
      ruleId: 'int32.gte_lte',
    });
  });

  it('rejects a call without a user with session_required', async () => {
    const { access } = createModuleHarness();

    const error = await captureError(access.listPermissions({}, callAs(undefined)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });
});

describe('AccessService.listRoles', () => {
  it('returns the roles of the acting organization only', async () => {
    const { access } = createModuleHarness();

    const response = await access.listRoles({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));

    expect(response.roles.map(role => role.id).sort()).toEqual([
      createSeedRoleId(SeedOrganizationId.CUSTOMER_1, RolePresetKey.ACCOUNTANT),
      createSeedRoleId(SeedOrganizationId.CUSTOMER_1, RolePresetKey.ADMIN),
      createSeedRoleId(SeedOrganizationId.CUSTOMER_1, RolePresetKey.BUYER),
      SeedRoleId.DIRECTOR_CUSTOMER_1,
      SeedRoleId.STOREKEEPER_CUSTOMER_1,
    ].sort());
    expect(response.roles.every(role => role.tenantId === SeedOrganizationId.CUSTOMER_1)).toBe(true);
  });

  it('never returns the roles of another organization', async () => {
    const { access } = createModuleHarness();

    const response = await access.listRoles({}, callAs(SeedUserId.ADMIN_5, SeedOrganizationId.CUSTOMER_2));

    expect(response.roles.map(role => role.id)).toContain(SeedRoleId.DIRECTOR_CUSTOMER_2);
    expect(response.roles.map(role => role.id)).not.toContain(SeedRoleId.DIRECTOR_CUSTOMER_1);
    expect(response.roles.every(role => role.tenantId === SeedOrganizationId.CUSTOMER_2)).toBe(true);
  });

  it('pages through the roles', async () => {
    const { access } = createModuleHarness();
    const options = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
    const first = await access.listRoles({ page: { pageSize: 2 } }, options);
    const second = await access.listRoles({ page: { pageSize: 2, pageToken: first.page?.nextPageToken } }, options);
    const third = await access.listRoles({ page: { pageSize: 2, pageToken: second.page?.nextPageToken } }, options);
    const ids = [...first.roles, ...second.roles, ...third.roles].map(role => role.id);

    expect(first.roles).toHaveLength(2);
    expect(first.page?.nextPageToken).not.toBe('');
    expect(second.roles).toHaveLength(2);
    expect(second.page?.nextPageToken).not.toBe('');
    expect(third.roles).toHaveLength(1);
    expect(third.page?.nextPageToken).toBe('');
    expect(new Set(ids).size).toBe(5);
  });

  it('rejects a role with member_view on a part of the warehouses with permission_denied naming it', async () => {
    const harness = createModuleHarness();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: ['member_view'],
      warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1],
    });

    const error = await captureError(harness.access.listRoles({}, callAs(userId, SeedOrganizationId.CUSTOMER_1)));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.PermissionDenied);
    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined).toBe('member_view');
  });

  it('lets a role with member_view on the whole organization read the roles', async () => {
    const harness = createModuleHarness();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: ['member_view'],
      warehouseIds: [],
    });

    const response = await harness.access.listRoles({}, callAs(userId, SeedOrganizationId.CUSTOMER_1));

    expect(response.roles.length).toBeGreaterThan(0);
  });

  it('rejects a user without the member_view permission with permission_denied naming it', async () => {
    const { access } = createModuleHarness();

    const error = await captureError(access.listRoles({}, callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1)));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.PermissionDenied);
    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined).toBe('member_view');
  });

  it('rejects a call without an organization with membership_required', async () => {
    const { access } = createModuleHarness();

    const error = await captureError(access.listRoles({}, callAs(SeedUserId.ADMIN_1)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('rejects an organization the user does not belong to with membership_required', async () => {
    const { access } = createModuleHarness();

    const error = await captureError(access.listRoles({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_2)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('rejects a call without a user with session_required', async () => {
    const { access } = createModuleHarness();

    const error = await captureError(access.listRoles({}, callAs(undefined, SeedOrganizationId.CUSTOMER_1)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });
});
