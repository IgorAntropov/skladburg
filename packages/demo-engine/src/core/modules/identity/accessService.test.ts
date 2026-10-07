import { Code } from '@connectrpc/connect';
import { PermissionAction } from '@skladburg/contracts/access/v1/access';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedMembershipId,
  SeedOrganizationId,
  SeedRoleId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/index';
import { listSeedAdminPermissions } from '../../seed/index';
import { INVALID_PAGE_TOKEN_RULE_ID } from '../pagination';
import {
  addTestMember,
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';

const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

describe('AccessService.getSession', () => {
  it('returns the user, memberships, own organizations and effective permissions of the acting organization', async () => {
    const { access } = createModuleHarness();

    const response = await access.getSession({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1));

    expect(response.user?.id).toBe(SeedUserId.ADMIN_1);
    expect(response.memberships.map(membership => membership.id)).toEqual([SeedMembershipId.ADMIN_1]);
    expect(response.organizations.map(organization => organization.id)).toEqual([SeedOrganizationId.BUYER_1]);
    expect(response.organizations[0]?.inn).not.toBe('');
    expect(response.actingOrganizationId).toBe(SeedOrganizationId.BUYER_1);
    expect(response.permissions.map(permission => permission.permission)).toEqual(listSeedAdminPermissions());
    expect(response.permissions.every(permission => permission.isOrganizationWide && permission.warehouseIds.length === 0)).toBe(true);
  });

  it('returns the area of a role limited to one warehouse', async () => {
    const { access } = createModuleHarness();

    const response = await access.getSession({}, callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.BUYER_1));

    expect(response.permissions).toHaveLength(1);
    expect(response.permissions[0]?.permission).toBe('warehouse_view');
    expect(response.permissions[0]?.isOrganizationWide).toBe(false);
    expect(response.permissions[0]?.warehouseIds).toEqual([SeedWarehouseId.BUYER_1_WAREHOUSE_1]);
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
      organizationId: SeedOrganizationId.SELLER_5,
      permissions: ['member_view'],
      warehouseIds: [],
    });
    const response = await harness.access.getSession({}, callAs(userId, SeedOrganizationId.SELLER_5));

    expect(response.organizations.map(organization => organization.id)).toEqual([SeedOrganizationId.SELLER_5]);
    expect(response.organizations[0]?.legalName).not.toBe('');
    expect(response.permissions.map(permission => permission.permission)).toEqual(['member_view']);
  });

  it('rejects a call without a user with session_required', async () => {
    const { access } = createModuleHarness();

    const error = await captureError(access.getSession({}, callAs(undefined, SeedOrganizationId.BUYER_1)));

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

    const error = await captureError(access.getSession({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_2)));

    expect(error.code).toBe(Code.PermissionDenied);
    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });
});

describe('AccessService.listPermissions', () => {
  it('returns the catalog of permissions declared by the contract with feature and action', async () => {
    const { access } = createModuleHarness();

    const response = await access.listPermissions({}, callAs(SeedUserId.ADMIN_1));
    const warehouseView = response.permissions.find(permission => permission.name === 'warehouse_view');

    expect(response.permissions.map(permission => permission.name)).toEqual(listSeedAdminPermissions());
    expect(warehouseView?.feature).toBe('warehouse');
    expect(warehouseView?.action).toBe(PermissionAction.VIEW);
    expect(warehouseView?.isScopeApplicable).toBe(false);
    expect(warehouseView?.isLimitApplicable).toBe(false);
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

    const response = await access.listRoles({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1));

    expect(response.roles.map(role => role.id).sort()).toEqual([SeedRoleId.ADMIN_BUYER_1, SeedRoleId.STOREKEEPER_BUYER_1].sort());
    expect(response.roles.every(role => role.tenantId === SeedOrganizationId.BUYER_1)).toBe(true);
  });

  it('never returns the roles of another organization', async () => {
    const { access } = createModuleHarness();

    const response = await access.listRoles({}, callAs(SeedUserId.ADMIN_5, SeedOrganizationId.BUYER_2));

    expect(response.roles.map(role => role.id)).toContain(SeedRoleId.ADMIN_BUYER_2);
    expect(response.roles.map(role => role.id)).not.toContain(SeedRoleId.ADMIN_BUYER_1);
    expect(response.roles.every(role => role.tenantId === SeedOrganizationId.BUYER_2)).toBe(true);
  });

  it('pages through the roles', async () => {
    const { access } = createModuleHarness();
    const options = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1);
    const first = await access.listRoles({ page: { pageSize: 1 } }, options);
    const second = await access.listRoles({ page: { pageSize: 1, pageToken: first.page?.nextPageToken } }, options);

    expect(first.roles).toHaveLength(1);
    expect(first.page?.nextPageToken).not.toBe('');
    expect(second.roles).toHaveLength(1);
    expect(second.page?.nextPageToken).toBe('');
    expect(second.roles[0]?.id).not.toBe(first.roles[0]?.id);
  });

  it('rejects a user without the member_view permission with permission_denied naming it', async () => {
    const { access } = createModuleHarness();

    const error = await captureError(access.listRoles({}, callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.BUYER_1)));
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

    const error = await captureError(access.listRoles({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_2)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('rejects a call without a user with session_required', async () => {
    const { access } = createModuleHarness();

    const error = await captureError(access.listRoles({}, callAs(undefined, SeedOrganizationId.BUYER_1)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });
});
