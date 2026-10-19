import type {
  DescMessage,
  DescMethodUnary,
  MessageShape,
} from '@bufbuild/protobuf';

import { create } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import {
  AccessService,
  MembershipSchema,
  RoleSchema,
  UserSchema,
} from '@skladburg/contracts/access/v1/access';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ErrorCode,
  type ErrorDetail,
  ErrorDetailSchema,
  type LimitExceededParams,
} from '@skladburg/contracts/common/v1/error';
import { MethodAccessSchema } from '@skladburg/contracts/common/v1/method_options';
import {
  type Money,
  MoneySchema,
} from '@skladburg/contracts/common/v1/money';
import {
  CreateWarehouseRequestSchema,
  GetOrganizationSettingsRequestSchema,
  ListSpheresRequestSchema,
  ListWarehousesRequestSchema,
  OrganizationService,
  WarehouseCapability,
} from '@skladburg/contracts/organization/v1/organization';
import { getContractRegistry } from '@skladburg/contracts/registry';
import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createDomainErrors } from '../errors/index';
import { createSeededRandom } from '../ports/index';
import { DEMO_USER_HEADER } from '../protocol';
import {
  createSeedSnapshot,
  SeedBoardNodeId,
  SeedCityId,
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../seed/index';
import { createEngineState } from '../state/index';
import {
  createLiveMeta,
  TEST_WORLD_TIME_MS,
} from '../state/testRecords';
import { createRequestValidator } from '../validation/index';
import { createCallGuard } from './callGuard';
import { createProbeMethod } from './testingProbeMethod';

const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const STOREKEEPER_PERMISSION_NAMES: readonly string[] = [
  'inventory_edit',
  'inventory_view',
  'sensor_view',
  'task_edit',
  'task_view',
  'warehouse_view',
  'yard_view',
];

const errors = createDomainErrors(createSeededRandom(5));
const guard = createCallGuard({ errors, validator: createRequestValidator(errors, getContractRegistry()) });
const { read } = createEngineState(createSeedSnapshot());

const headersOf = (userId: string | undefined, organizationId?: string): Headers => {
  const headers = new Headers();

  if (userId !== undefined) {
    headers.set(DEMO_USER_HEADER, userId);
  }

  if (organizationId !== undefined) {
    headers.set(ACTING_ORGANIZATION_HEADER, organizationId);
  }

  return headers;
};

const catchError = (action: () => unknown): ConnectError => {
  try {
    action();
  }
  catch (error) {
    return ConnectError.from(error);
  }

  throw new Error('The call was expected to fail');
};

const detailOf = (error: ConnectError): ErrorDetail => {
  const [detail] = error.findDetails(ErrorDetailSchema);

  return detail ?? create(ErrorDetailSchema);
};

const permissionNameOf = (detail: ErrorDetail): string | undefined =>
  detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined;

const warehouseIdOf = (detail: ErrorDetail): string | undefined =>
  detail.params.case === 'permissionDenied' ? detail.params.value.warehouseId : undefined;

const sphereRequest = create(ListSpheresRequestSchema);
const settingsRequest = create(GetOrganizationSettingsRequestSchema);
const warehousesRequest = create(ListWarehousesRequestSchema);

describe('createCallGuard: session', () => {
  const method = OrganizationService.method.listSpheres;

  it('lets a known user through without an organization', () => {
    const caller = guard.guardCall(read, method, sphereRequest, headersOf(SeedUserId.ADMIN_1));

    expect(caller.user.id).toBe(SeedUserId.ADMIN_1);
    expect(caller.organizationId).toBeUndefined();
    expect(caller.membership).toBeUndefined();
    expect(caller.permissions).toEqual([]);
    expect(caller.scope).toBeUndefined();
  });

  it('adds the membership and the effective permissions when an organization is passed', () => {
    const caller = guard.guardCall(read, method, sphereRequest, headersOf(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1));

    expect(caller.organizationId).toBe(SeedOrganizationId.CUSTOMER_1);
    expect(caller.membership?.userId).toBe(SeedUserId.STOREKEEPER_1);
    expect(caller.permissions).toEqual(STOREKEEPER_PERMISSION_NAMES.map(permission => ({
      isOrganizationWide: false,
      permission,
      warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1],
    })));
  });

  it('answers session_required without a user', () => {
    const error = catchError(() => guard.guardCall(read, method, sphereRequest, headersOf(undefined, SeedOrganizationId.CUSTOMER_1)));

    expect(detailOf(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('answers session_required for an unknown user', () => {
    const error = catchError(() => guard.guardCall(read, method, sphereRequest, headersOf(UNKNOWN_ID)));

    expect(detailOf(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('answers membership_required when the passed organization is not the one of the user', () => {
    const error = catchError(
      () => guard.guardCall(read, method, sphereRequest, headersOf(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_2)),
    );

    expect(detailOf(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('answers membership_required for an organization that does not exist', () => {
    const error = catchError(() => guard.guardCall(read, method, sphereRequest, headersOf(SeedUserId.ADMIN_1, UNKNOWN_ID)));

    expect(detailOf(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });
});

describe('createCallGuard: member', () => {
  const method = OrganizationService.method.getOrganizationSettings;

  it('lets a member through', () => {
    const caller = guard.guardMemberCall(read, method, settingsRequest, headersOf(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));

    expect(caller.organizationId).toBe(SeedOrganizationId.CUSTOMER_1);
    expect(caller.membership.organizationId).toBe(SeedOrganizationId.CUSTOMER_1);
  });

  it('answers membership_required without an organization', () => {
    const error = catchError(() => guard.guardCall(read, method, settingsRequest, headersOf(SeedUserId.ADMIN_1)));

    expect(detailOf(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('answers membership_required for a user who is not a member', () => {
    const headers = headersOf(SeedUserId.ADMIN_1, SeedOrganizationId.SUPPLIER_1);
    const error = catchError(() => guard.guardCall(read, method, settingsRequest, headers));

    expect(detailOf(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('answers session_required before membership_required', () => {
    const error = catchError(() => guard.guardCall(read, method, settingsRequest, headersOf(undefined)));

    expect(detailOf(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('turns a session method into a member call when the handler requires an organization', () => {
    const headers = headersOf(SeedUserId.ADMIN_1);
    const error = catchError(() => guard.guardMemberCall(read, OrganizationService.method.listSpheres, sphereRequest, headers));

    expect(detailOf(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });
});

describe('createCallGuard: permission', () => {
  const method = OrganizationService.method.listWarehouses;

  it('returns the area of the required permission to a scope-filtered call', () => {
    const wide = guard.guardScopeFilteredCall(
      read,
      method,
      warehousesRequest,
      headersOf(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    );
    const limited = guard.guardScopeFilteredCall(
      read,
      method,
      warehousesRequest,
      headersOf(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1),
    );

    expect(wide.scope).toEqual({ isOrganizationWide: true, warehouseIds: [] });
    expect(limited.scope).toEqual({ isOrganizationWide: false, warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1] });
  });

  it('requires a permission for the whole organization when the requirement has no scope field', () => {
    const storekeeperHeaders = headersOf(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);
    const adminHeaders = headersOf(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

    const detail = detailOf(catchError(() => guard.guardPermissionCall(read, method, warehousesRequest, storekeeperHeaders)));
    const guardCallDetail = detailOf(catchError(() => guard.guardCall(read, method, warehousesRequest, storekeeperHeaders)));

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(permissionNameOf(detail)).toBe('warehouse_view');
    expect(warehouseIdOf(detail)).toBe('');
    expect(guardCallDetail.code).toBe(ErrorCode.PERMISSION_DENIED);
    const wide = guard.guardPermissionCall(read, method, warehousesRequest, adminHeaders);
    expect(wide.scope).toEqual({ isOrganizationWide: true, warehouseIds: [] });
  });

  it('refuses a limited role on a command before the body is validated', () => {
    const detail = detailOf(catchError(() => guard.guardPermissionCall(
      read,
      OrganizationService.method.createWarehouse,
      create(CreateWarehouseRequestSchema, { name: '' }),
      headersOf(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1),
    )));

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('answers internal when a command is guarded as a scope-filtered call', () => {
    const error = catchError(() => guard.guardScopeFilteredCall(
      read,
      OrganizationService.method.createWarehouse,
      create(CreateWarehouseRequestSchema),
      headersOf(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(detailOf(error).code).toBe(ErrorCode.INTERNAL);
  });

  it('answers internal when a session method is guarded as a scope-filtered call', () => {
    const error = catchError(() => guard.guardScopeFilteredCall(
      read,
      OrganizationService.method.listSpheres,
      sphereRequest,
      headersOf(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(detailOf(error).code).toBe(ErrorCode.INTERNAL);
  });

  it('answers permission_denied naming the permission', () => {
    const error = catchError(() => guard.guardCall(
      read,
      AccessService.method.listRoles,
      create(AccessService.method.listRoles.input),
      headersOf(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1),
    ));
    const detail = detailOf(error);

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(permissionNameOf(detail)).toBe('member_view');
    expect(warehouseIdOf(detail)).toBe('');
  });

  it('answers membership_required before permission_denied', () => {
    const error = catchError(() => guard.guardCall(read, method, warehousesRequest, headersOf(SeedUserId.STOREKEEPER_1)));

    expect(detailOf(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('checks the permission before the request body', () => {
    const invalidRequest = create(CreateWarehouseRequestSchema, { name: '' });

    const denied = catchError(() => guard.guardCall(
      read,
      OrganizationService.method.createWarehouse,
      invalidRequest,
      headersOf(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1),
    ));
    const invalid = catchError(() => guard.guardCall(
      read,
      OrganizationService.method.createWarehouse,
      invalidRequest,
      headersOf(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(detailOf(denied).code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(detailOf(invalid).code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('answers internal when a session method is guarded as a permission method', () => {
    const error = catchError(() => guard.guardPermissionCall(
      read,
      OrganizationService.method.listSpheres,
      sphereRequest,
      headersOf(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(detailOf(error).code).toBe(ErrorCode.INTERNAL);
  });

  it('answers internal for a method without an access option', () => {
    const probe = createProbeMethod(undefined);
    const headers = headersOf(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
    const error = catchError(() => guard.guardCall(read, probe, create(probe.input), headers));

    expect(detailOf(error).code).toBe(ErrorCode.INTERNAL);
  });

  it('answers internal for a method whose access option has no requirement', () => {
    const probe = createProbeMethod(create(MethodAccessSchema));
    const headers = headersOf(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
    const error = catchError(() => guard.guardCall(read, probe, create(probe.input), headers));

    expect(detailOf(error).code).toBe(ErrorCode.INTERNAL);
  });
});

describe('createCallGuard: scope field', () => {
  const probe = createProbeMethod(create(MethodAccessSchema, {
    requirement: { case: 'permission', value: { name: 'warehouse_view', scopeField: 'address' } },
  }));

  const probeRequest = (warehouseId: string, method: DescMethodUnary = probe): MessageShape<DescMessage> => create(method.input, {
    address: warehouseId,
    boardNodeId: SeedBoardNodeId.KAZAN,
    capabilities: [WarehouseCapability.RAMP],
    cityId: SeedCityId.KAZAN,
    idempotencyKey: '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153',
    name: 'Склад 9',
    timeZone: 'Europe/Moscow',
  });

  const storekeeper = headersOf(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);
  const admin = headersOf(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

  it('lets a limited role through for a warehouse of its area', () => {
    const caller = guard.guardCall(read, probe, probeRequest(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1), storekeeper);

    expect(caller.scope?.warehouseIds).toEqual([SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1]);
  });

  it('answers permission_denied with the warehouse id for another warehouse of the organization', () => {
    const detail = detailOf(
      catchError(() => guard.guardCall(read, probe, probeRequest(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2), storekeeper)),
    );

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(permissionNameOf(detail)).toBe('warehouse_view');
    expect(warehouseIdOf(detail)).toBe(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2);
  });

  it('answers permission_denied with the warehouse id for a warehouse of another organization', () => {
    const detail = detailOf(catchError(() => guard.guardCall(read, probe, probeRequest(SeedWarehouseId.CUSTOMER_2_SITE_1), storekeeper)));

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(warehouseIdOf(detail)).toBe(SeedWarehouseId.CUSTOMER_2_SITE_1);
  });

  it('does not let a limited role act without naming a warehouse', () => {
    const detail = detailOf(catchError(() => guard.guardCall(read, probe, probeRequest(''), storekeeper)));

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(permissionNameOf(detail)).toBe('warehouse_view');
    expect(warehouseIdOf(detail)).toBe('');
  });

  it('lets an organization-wide role through for its own warehouse and for a request without one', () => {
    expect(guard.guardCall(read, probe, probeRequest(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3), admin).scope?.isOrganizationWide).toBe(true);
    expect(guard.guardCall(read, probe, probeRequest(''), admin).scope?.isOrganizationWide).toBe(true);
  });

  it('answers not_found for a warehouse of another organization even to an organization-wide role', () => {
    const detail = detailOf(catchError(() => guard.guardCall(read, probe, probeRequest(SeedWarehouseId.CUSTOMER_2_SITE_1), admin)));

    expect(detail.code).toBe(ErrorCode.NOT_FOUND);
    expect(detail.params.case === 'notFound' ? detail.params.value.entity : undefined).toBe(EntityKind.WAREHOUSE);
  });

  it('answers not_found for a warehouse that does not exist', () => {
    const detail = detailOf(catchError(() => guard.guardCall(read, probe, probeRequest(UNKNOWN_ID), admin)));

    expect(detail.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('answers internal when the scope field does not exist in the request', () => {
    const missingField = createProbeMethod(create(MethodAccessSchema, {
      requirement: { case: 'permission', value: { name: 'warehouse_view', scopeField: 'warehouse_id' } },
    }));

    const detail = detailOf(catchError(() => guard.guardCall(read, missingField, probeRequest('', missingField), admin)));

    expect(detail.code).toBe(ErrorCode.INTERNAL);
  });

  it('answers internal when the scope field is not a string', () => {
    const notString = createProbeMethod(create(MethodAccessSchema, {
      requirement: { case: 'permission', value: { name: 'warehouse_view', scopeField: 'capabilities' } },
    }));

    const detail = detailOf(catchError(() => guard.guardCall(read, notString, probeRequest('', notString), admin)));

    expect(detail.code).toBe(ErrorCode.INTERNAL);
  });

  it('keeps the effective permissions of the caller', () => {
    const caller = guard.guardCall(read, probe, probeRequest(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1), storekeeper);

    expect(caller.permissions.map(permission => permission.permission)).toEqual(STOREKEEPER_PERMISSION_NAMES);
  });
});

describe('createCallGuard: limit', () => {
  const state = createEngineState(createSeedSnapshot());
  const limitedProbe = createProbeMethod(create(MethodAccessSchema, {
    requirement: { case: 'permission', value: { limitField: 'amount', name: 'deal_approve' } },
  }));
  const scopedLimitedProbe = createProbeMethod(create(MethodAccessSchema, {
    requirement: { case: 'permission', value: { limitField: 'amount', name: 'deal_approve', scopeField: 'address' } },
  }));

  interface AssignmentValue {
    amountLimit?: Money;
    warehouseIds: string[];
  }

  const money = (amountMinor: bigint, currencyCode = 'RUB'): Money => create(MoneySchema, { amountMinor, currencyCode });

  let memberCounter = 0;

  const addMember = (assignments: AssignmentValue[]): Headers => {
    memberCounter += 1;
    const suffix = String(memberCounter).padStart(4, '0');
    const userId = `a0000000-0000-4000-8000-00000000${suffix}`;
    const roleId = `b0000000-0000-4000-8000-00000000${suffix}`;

    state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.put('users', create(UserSchema, { displayName: 'Тестовый пользователь', id: userId }));
      transaction.put('roles', create(RoleSchema, {
        id: roleId,
        name: 'Тестовая роль',
        permissions: ['deal_approve'],
        tenantId: SeedOrganizationId.CUSTOMER_1,
      }));
      transaction.put('memberships', create(MembershipSchema, {
        id: `c0000000-0000-4000-8000-00000000${suffix}`,
        organizationId: SeedOrganizationId.CUSTOMER_1,
        roleAssignments: assignments.map(assignment => ({ ...assignment, roleId })),
        userId,
      }));
    }, createLiveMeta).apply();

    return headersOf(userId, SeedOrganizationId.CUSTOMER_1);
  };

  const requestOf = (method: DescMethodUnary, amount: Money | undefined, warehouseId = ''): MessageShape<DescMessage> =>
    create(method.input, {
      address: warehouseId,
      amount,
      boardNodeId: SeedBoardNodeId.KAZAN,
      capabilities: [WarehouseCapability.RAMP],
      cityId: SeedCityId.KAZAN,
      idempotencyKey: '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153',
      name: 'Склад 9',
      timeZone: 'Europe/Moscow',
    });

  const limitParams = (error: ConnectError): LimitExceededParams | undefined => {
    const detail = detailOf(error);

    return detail.params.case === 'limitExceeded' ? detail.params.value : undefined;
  };

  const guardLimited = (headers: Headers, amount: Money | undefined, method = limitedProbe, warehouseId = ''): ConnectError =>
    catchError(() => guard.guardCall(state.read, method, requestOf(method, amount, warehouseId), headers));

  const passes = (headers: Headers, amount: Money, method = limitedProbe, warehouseId = ''): void => {
    expect(() => guard.guardCall(state.read, method, requestOf(method, amount, warehouseId), headers)).not.toThrow();
  };

  it('lets an amount below the limit through', () => {
    passes(addMember([{ amountLimit: money(100000n), warehouseIds: [] }]), money(99999n));
  });

  it('lets an amount equal to the limit through', () => {
    passes(addMember([{ amountLimit: money(100000n), warehouseIds: [] }]), money(100000n));
  });

  it('answers limit_exceeded naming the permission, the limit and the requested amount', () => {
    const headers = addMember([{ amountLimit: money(100000n), warehouseIds: [] }]);

    const error = guardLimited(headers, money(100001n));
    const params = limitParams(error);

    expect(detailOf(error).code).toBe(ErrorCode.LIMIT_EXCEEDED);
    expect(params?.permission).toBe('deal_approve');
    expect(params?.limit).toMatchObject({ amountMinor: 100000n, currencyCode: 'RUB' });
    expect(params?.requested).toMatchObject({ amountMinor: 100001n, currencyCode: 'RUB' });
  });

  it('lets any amount through an assignment without a limit', () => {
    passes(addMember([{ warehouseIds: [] }]), money(9000000000n));
  });

  it('lets an amount through when one of two assignments has no limit', () => {
    passes(addMember([{ amountLimit: money(100n), warehouseIds: [] }, { warehouseIds: [] }]), money(5000000n));
  });

  it('takes the largest limit of two limited assignments', () => {
    const headers = addMember([
      { amountLimit: money(100n), warehouseIds: [] },
      { amountLimit: money(5000n), warehouseIds: [] },
    ]);

    passes(headers, money(5000n));

    const params = limitParams(guardLimited(headers, money(5001n)));

    expect(params?.limit?.amountMinor).toBe(5000n);
  });

  it('refuses an amount in a currency other than the one of the limit', () => {
    const headers = addMember([{ amountLimit: money(100000n, 'RUB'), warehouseIds: [] }]);

    const params = limitParams(guardLimited(headers, money(1n, 'USD')));

    expect(params?.permission).toBe('deal_approve');
    expect(params?.limit).toMatchObject({ amountMinor: 100000n, currencyCode: 'RUB' });
    expect(params?.requested).toMatchObject({ amountMinor: 1n, currencyCode: 'USD' });
  });

  it('reports the largest limit of the currency of the request', () => {
    const headers = addMember([
      { amountLimit: money(900000n, 'RUB'), warehouseIds: [] },
      { amountLimit: money(300n, 'USD'), warehouseIds: [] },
      { amountLimit: money(200n, 'USD'), warehouseIds: [] },
    ]);

    const params = limitParams(guardLimited(headers, money(301n, 'USD')));

    expect(params?.limit).toMatchObject({ amountMinor: 300n, currencyCode: 'USD' });
  });

  it('lets an unlimited assignment pass a request in any currency', () => {
    passes(addMember([{ amountLimit: money(100n, 'RUB'), warehouseIds: [] }, { warehouseIds: [] }]), money(1000n, 'USD'));
  });

  it('answers internal when the amount field is not set', () => {
    const headers = addMember([{ amountLimit: money(100000n), warehouseIds: [] }]);

    expect(detailOf(guardLimited(headers, undefined)).code).toBe(ErrorCode.INTERNAL);
  });

  it('answers internal when the limit field does not exist in the request', () => {
    const missing = createProbeMethod(create(MethodAccessSchema, {
      requirement: { case: 'permission', value: { limitField: 'total', name: 'deal_approve' } },
    }));
    const headers = addMember([{ warehouseIds: [] }]);

    expect(detailOf(guardLimited(headers, money(1n), missing)).code).toBe(ErrorCode.INTERNAL);
  });

  it('answers internal when the limit field is not a Money message', () => {
    const notMoney = createProbeMethod(create(MethodAccessSchema, {
      requirement: { case: 'permission', value: { limitField: 'name', name: 'deal_approve' } },
    }));
    const headers = addMember([{ warehouseIds: [] }]);

    expect(detailOf(guardLimited(headers, money(1n), notMoney)).code).toBe(ErrorCode.INTERNAL);
  });

  it('checks the permission before the limit', () => {
    const headers = headersOf(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);
    const error = catchError(() => guard.guardCall(read, limitedProbe, requestOf(limitedProbe, money(1n)), headers));

    expect(detailOf(error).code).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('validates the body before the limit', () => {
    const headers = addMember([{ amountLimit: money(1n), warehouseIds: [] }]);
    const invalid = create(limitedProbe.input, { amount: money(100n), name: '' });

    const error = catchError(() => guard.guardCall(state.read, limitedProbe, invalid, headers));

    expect(detailOf(error).code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('checks the area before the limit', () => {
    const headers = addMember([{ amountLimit: money(1n), warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1] }]);

    const error = guardLimited(headers, money(100n), scopedLimitedProbe, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2);

    expect(detailOf(error).code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(warehouseIdOf(detailOf(error))).toBe(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2);
  });

  it('applies the limit of the assignment that covers the warehouse of the request', () => {
    const headers = addMember([
      { amountLimit: money(1000n), warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1] },
      { amountLimit: money(9000n), warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2] },
    ]);

    passes(headers, money(1000n), scopedLimitedProbe, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1);

    const params = limitParams(guardLimited(headers, money(1001n), scopedLimitedProbe, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1));

    expect(params?.limit?.amountMinor).toBe(1000n);
    passes(headers, money(9000n), scopedLimitedProbe, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2);
  });

  it('lets an unlimited assignment on one warehouse not lift the limit of another warehouse', () => {
    const headers = addMember([
      { amountLimit: money(1000n), warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1] },
      { warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2] },
    ]);

    passes(headers, money(50000n), scopedLimitedProbe, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2);

    const error = guardLimited(headers, money(50000n), scopedLimitedProbe, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1);

    expect(detailOf(error).code).toBe(ErrorCode.LIMIT_EXCEEDED);
  });

  it('applies an organization-wide limit to a request without a warehouse and to any warehouse', () => {
    const headers = addMember([{ amountLimit: money(1000n), warehouseIds: [] }]);

    passes(headers, money(1000n), scopedLimitedProbe, SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3);
    passes(headers, money(1000n), scopedLimitedProbe, '');
    expect(detailOf(guardLimited(headers, money(1001n), scopedLimitedProbe, '')).code).toBe(ErrorCode.LIMIT_EXCEEDED);
  });

  it('does not apply a limit tied to a warehouse to a request without a warehouse of an organization-wide role', () => {
    const headers = addMember([
      { amountLimit: money(10n), warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1] },
      { amountLimit: money(7000n), warehouseIds: [] },
    ]);

    passes(headers, money(7000n), scopedLimitedProbe, '');
  });
});
