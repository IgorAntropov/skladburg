import type {
  DescMessage,
  DescMethod,
  DescMethodUnary,
  MessageShape,
} from '@bufbuild/protobuf';
import type { ConnectError } from '@connectrpc/connect';
import type { ErrorDetail } from '@skladburg/contracts/common/v1/error';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { ConnectError as ConnectErrorValue } from '@connectrpc/connect';
import { UserProfileService } from '@skladburg/contracts/access/v1/profile';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import { MethodAccessSchema } from '@skladburg/contracts/common/v1/method_options';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import {
  CreateWarehouseRequestSchema,
  GetOrganizationSettingsRequestSchema,
  ListSpheresRequestSchema,
  ListWarehousesRequestSchema,
  OrganizationService,
  ProfileKind,
  WarehouseCapability,
} from '@skladburg/contracts/organization/v1/organization';
import { getContractRegistry } from '@skladburg/contracts/registry';
import {
  ACTING_ORGANIZATION_HEADER,
  getMethodAccess,
  getPermissionName,
  getPermissionTraits,
  listPermissionCodes,
  organizationChannel,
  SUPPORT_SESSION_HEADER,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import {
  SupportAccessMode,
  SupportAccessSection,
  SupportAccessStatus,
} from '@skladburg/contracts/support/v1/support_access';
import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { IEngineState } from '../state/index';

import { createDomainErrors } from '../errors/index';
import { createSubscriptionAccess } from '../events/subscriptionAccess';
import {
  callAs,
  callForOutcome,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../modules/testing/moduleHarness';
import { createSeededRandom } from '../ports/index';
import { DEMO_USER_HEADER } from '../protocol';
import {
  createSeedSnapshot,
  SEED_WORLD_START_MS,
  SeedCityId,
  SeedMapNodeId,
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../seed/index';
import { createEngineState } from '../state/index';
import {
  createLiveMeta,
  createTestSupportAccessSession,
} from '../state/testRecords';
import { createRequestValidator } from '../validation/index';
import { createCallGuard } from './callGuard';
import { ENGINE_SERVICES } from './serviceCatalog';
import { isNeverForSupport } from './supportSessionPermissions';
import { createProbeMethod } from './testingProbeMethod';

const MINUTE_MS = 60_000;

const STAFF_USER_IDS: readonly string[] = [
  SeedUserId.OPERATOR_SUPPORT_AGENT,
  SeedUserId.OPERATOR_SUPPORT_ENGINEER,
  SeedUserId.OPERATOR_PLATFORM_ADMIN,
  SeedUserId.OPERATOR_SUPER_ADMIN_1,
  SeedUserId.OPERATOR_SUPER_ADMIN_2,
];

const ORGANIZATION_BY_PROFILE: Readonly<Record<ProfileKind, string>> = {
  [ProfileKind.CARRIER]: SeedOrganizationId.CARRIER_1,
  [ProfileKind.CUSTOMER]: SeedOrganizationId.CUSTOMER_1,
  [ProfileKind.SUPPLIER]: SeedOrganizationId.SUPPLIER_1,
  [ProfileKind.UNSPECIFIED]: SeedOrganizationId.CUSTOMER_1,
};

const CLIENT_ORGANIZATION_ID: string = SeedOrganizationId.CUSTOMER_1;

interface SessionOptionsValue {
  expiresAtMs?: number | undefined;
  mode?: SupportAccessMode;
  organizationId?: string;
  section?: SupportAccessSection;
  staffUserId?: string;
  status?: SupportAccessStatus;
}

interface StaffHeadersOptionsValue {
  organizationId?: string | undefined;
  sessionId?: string | undefined;
  userId: string;
}

let sessionCounter = 0;

const createSessionId = (): string => {
  sessionCounter += 1;

  return `d0000000-0000-4000-8000-${String(sessionCounter).padStart(12, '0')}`;
};

const putSession = (state: IEngineState, options: SessionOptionsValue = {}): string => {
  const id = createSessionId();
  const expiresAtMs = 'expiresAtMs' in options ? options.expiresAtMs : SEED_WORLD_START_MS + 60 * MINUTE_MS;

  state.transact(SEED_WORLD_START_MS, (transaction) => {
    transaction.put('supportAccessSessions', createTestSupportAccessSession(
      id,
      options.organizationId ?? CLIENT_ORGANIZATION_ID,
      options.staffUserId ?? SeedUserId.OPERATOR_SUPER_ADMIN_1,
      options.status ?? SupportAccessStatus.ACTIVE,
      {
        expiresAt: expiresAtMs === undefined ? undefined : timestampFromMs(expiresAtMs),
        mode: options.mode ?? SupportAccessMode.EDIT,
        section: options.section ?? SupportAccessSection.ALL,
      },
    ));
  }, createLiveMeta).apply();

  return id;
};

const staffHeadersOf = (options: StaffHeadersOptionsValue): Headers => {
  const headers = new Headers();
  headers.set(DEMO_USER_HEADER, options.userId);

  if (options.organizationId !== undefined) {
    headers.set(ACTING_ORGANIZATION_HEADER, options.organizationId);
  }

  if (options.sessionId !== undefined) {
    headers.set(SUPPORT_SESSION_HEADER, options.sessionId);
  }

  return headers;
};

const catchError = (action: () => unknown): ConnectError => {
  try {
    action();
  }
  catch (error) {
    return ConnectErrorValue.from(error);
  }

  throw new Error('The call was expected to fail');
};

const detailOf = (error: ConnectError): ErrorDetail => {
  const [detail] = error.findDetails(ErrorDetailSchema);

  return detail ?? create(ErrorDetailSchema);
};

const permissionNameOf = (detail: ErrorDetail): string | undefined =>
  detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined;

const probeOf = (name: string, extra: { limitField?: string; scopeField?: string } = {}): DescMethodUnary =>
  createProbeMethod(create(MethodAccessSchema, { requirement: { case: 'permission', value: { name, ...extra } } }));

const probeRequestOf = (method: DescMethodUnary, address = ''): MessageShape<DescMessage> => create(method.input, {
  address,
  amount: create(MoneySchema, { amountMinor: 1_000_000_000_000n, currencyCode: 'RUB' }),
  capabilities: [WarehouseCapability.RAMP],
  cityId: SeedCityId.KAZAN,
  idempotencyKey: '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153',
  mapNodeId: SeedMapNodeId.KAZAN,
  name: 'Склад 9',
  timeZone: 'Europe/Moscow',
});

const errors = createDomainErrors(createSeededRandom(5));
const validator = createRequestValidator(errors, getContractRegistry());
const subscriptionAccess = createSubscriptionAccess(errors);

let nowMs = SEED_WORLD_START_MS;
const guard = createCallGuard({ errors, getWorldTimeMs: () => nowMs, validator });
const state = createEngineState(createSeedSnapshot());
const { read } = state;

const sphereRequest = create(ListSpheresRequestSchema);
const settingsRequest = create(GetOrganizationSettingsRequestSchema);
const warehousesRequest = create(ListWarehousesRequestSchema);

interface EngineMethodRowValue {
  label: string;
  method: DescMethodUnary;
  requirementCase: string;
}

const isUnary = (method: DescMethod): method is DescMethodUnary => method.methodKind === 'unary';

const listEngineMethods = (isMatching: (requirementCase: string) => boolean): EngineMethodRowValue[] =>
  ENGINE_SERVICES.flatMap(service => service.methods.filter(isUnary).flatMap((method) => {
    const requirementCase = getMethodAccess(method)?.requirement.case;

    return requirementCase !== undefined && isMatching(requirementCase)
      ? [{ label: `${service.typeName}.${method.name}`, method, requirementCase }]
      : [];
  }));

const expectMembershipRequired = (action: () => unknown): void => {
  expect(detailOf(catchError(action)).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
};

beforeEach(() => {
  nowMs = SEED_WORLD_START_MS;
});

describe('support session: nothing private without a session', () => {
  const harness = createModuleHarness();
  const organizationRows = listEngineMethods(requirementCase => requirementCase !== 'self');

  it('covers the permission methods of the engine services and all five operator staff members', () => {
    expect(organizationRows.filter(row => row.requirementCase === 'permission').length).toBeGreaterThan(0);
    expect(STAFF_USER_IDS).toHaveLength(5);
  });

  it.each(organizationRows)('$label: answers membership_required to every operator role without a session', async ({ method }) => {
    for (const userId of STAFF_USER_IDS) {
      const outcome = await callForOutcome(harness.transport, method, callAs(userId, CLIENT_ORGANIZATION_ID));

      expect(outcome.code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
    }
  });

  it('refuses the subscriptions to the organization channel and to the warehouse channel of a client', () => {
    for (const userId of STAFF_USER_IDS) {
      const headers = staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, userId });
      const organizationDetail = subscriptionAccess.check(read, organizationChannel(CLIENT_ORGANIZATION_ID), headers);
      const warehouseDetail = subscriptionAccess.check(read, warehouseChannel(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1), headers);

      expect(organizationDetail?.code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
      expect(warehouseDetail?.code).toBe(ErrorCode.NOT_FOUND);
    }
  });
});

describe('support session: admission', () => {
  const method = OrganizationService.method.listWarehouses;

  it('opens a permission method of the intersection and reports the session as the admission', () => {
    const sessionId = putSession(state, { section: SupportAccessSection.WAREHOUSES });
    const headers = staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, sessionId, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 });
    const caller = guard.guardPermissionCall(read, method, warehousesRequest, headers);

    expect(caller.user.id).toBe(SeedUserId.OPERATOR_SUPER_ADMIN_1);
    expect(caller.organizationId).toBe(CLIENT_ORGANIZATION_ID);
    expect(caller.admission.kind === 'support_session' && caller.admission.session.id).toBe(sessionId);
    expect(caller.scope).toEqual({ isOrganizationWide: true, warehouseIds: [] });
    expect(caller.permissions.map(effective => effective.permission)).toContain('warehouse_view');
    expect(caller.permissions.every(effective => effective.isOrganizationWide && effective.warehouseIds.length === 0)).toBe(true);
  });

  it('serves the real handler of the engine from the session', async () => {
    const harness = createModuleHarness();
    const sessionId = putSession(harness.state, { section: SupportAccessSection.WAREHOUSES });
    const headers = staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, sessionId, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 });
    const response = await harness.organization.listWarehouses(warehousesRequest, { headers });

    expect(response.warehouses.length).toBeGreaterThan(0);
    expect(response.warehouses.every(warehouse => warehouse.tenantId === CLIENT_ORGANIZATION_ID)).toBe(true);
  });

  it('does not open a session for a user who is not an operator staff member', () => {
    const sessionId = putSession(state, { organizationId: SeedOrganizationId.SUPPLIER_1, staffUserId: SeedUserId.ADMIN_1 });
    const headers = staffHeadersOf({ organizationId: SeedOrganizationId.SUPPLIER_1, sessionId, userId: SeedUserId.ADMIN_1 });

    expectMembershipRequired(() => guard.guardCall(read, method, warehousesRequest, headers));
  });

  it('prefers the membership when the caller is a member of the organization', () => {
    const sessionId = putSession(state, { staffUserId: SeedUserId.ADMIN_1 });
    const headers = staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, sessionId, userId: SeedUserId.ADMIN_1 });
    const caller = guard.guardPermissionCall(read, method, warehousesRequest, headers);

    expect(caller.admission.kind).toBe('membership');
  });

  it('answers membership_required without the session header', () => {
    const headers = staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 });

    expectMembershipRequired(() => guard.guardCall(read, method, warehousesRequest, headers));
  });

  it('answers membership_required with a session header and without an organization', () => {
    const sessionId = putSession(state);
    const headers = staffHeadersOf({ sessionId, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 });

    expectMembershipRequired(() => guard.guardCall(read, method, warehousesRequest, headers));
  });

  it('answers session_required for an unknown user before looking at the session', () => {
    const sessionId = putSession(state);
    const headers = staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, sessionId, userId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' });
    const error = catchError(() => guard.guardCall(read, method, warehousesRequest, headers));

    expect(detailOf(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('closes the session at expires_at by the world time without a scheduler task', () => {
    const sessionId = putSession(state, { expiresAtMs: SEED_WORLD_START_MS + 10 * MINUTE_MS });
    const headers = staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, sessionId, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 });

    nowMs = SEED_WORLD_START_MS + 10 * MINUTE_MS - 1;
    expect(() => guard.guardCall(read, method, warehousesRequest, headers)).not.toThrow();

    nowMs = SEED_WORLD_START_MS + 10 * MINUTE_MS;
    expectMembershipRequired(() => guard.guardCall(read, method, warehousesRequest, headers));

    nowMs = SEED_WORLD_START_MS + 11 * MINUTE_MS;
    expectMembershipRequired(() => guard.guardCall(read, method, warehousesRequest, headers));
  });

  it('answers membership_required for a session without expires_at', () => {
    const sessionId = putSession(state, { expiresAtMs: undefined });
    const headers = staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, sessionId, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 });

    expectMembershipRequired(() => guard.guardCall(read, method, warehousesRequest, headers));
  });

  it.each([
    SupportAccessStatus.REQUESTED,
    SupportAccessStatus.DECLINED,
    SupportAccessStatus.CANCELLED,
    SupportAccessStatus.CLOSED,
    SupportAccessStatus.UNSPECIFIED,
  ])('answers membership_required for a session in the status %s', (status) => {
    const sessionId = putSession(state, { status });
    const headers = staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, sessionId, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 });

    expectMembershipRequired(() => guard.guardCall(read, method, warehousesRequest, headers));
  });

  it('answers membership_required for a session of another staff member', () => {
    const sessionId = putSession(state, { staffUserId: SeedUserId.OPERATOR_SUPER_ADMIN_2 });
    const headers = staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, sessionId, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 });

    expectMembershipRequired(() => guard.guardCall(read, method, warehousesRequest, headers));
  });

  it('answers membership_required when the header names another organization than the session', () => {
    const sessionId = putSession(state, { organizationId: CLIENT_ORGANIZATION_ID });
    const headers = staffHeadersOf({
      organizationId: SeedOrganizationId.CUSTOMER_2,
      sessionId,
      userId: SeedUserId.OPERATOR_SUPER_ADMIN_1,
    });

    expectMembershipRequired(() => guard.guardCall(read, method, warehousesRequest, headers));
  });

  it('answers membership_required for a session id that does not exist', () => {
    const headers = staffHeadersOf({
      organizationId: CLIENT_ORGANIZATION_ID,
      sessionId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      userId: SeedUserId.OPERATOR_SUPER_ADMIN_1,
    });

    expectMembershipRequired(() => guard.guardCall(read, method, warehousesRequest, headers));
  });

  it('answers membership_required for a session of an organization that does not exist', () => {
    const missingOrganizationId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const sessionId = putSession(state, { organizationId: missingOrganizationId });
    const headers = staffHeadersOf({ organizationId: missingOrganizationId, sessionId, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 });

    expectMembershipRequired(() => guard.guardCall(read, method, warehousesRequest, headers));
  });

  it('answers the same code for every invalid session so that nothing is disclosed', () => {
    const headers = (sessionId: string, organizationId = CLIENT_ORGANIZATION_ID): Headers =>
      staffHeadersOf({ organizationId, sessionId, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 });
    const otherStaff = putSession(state, { staffUserId: SeedUserId.OPERATOR_SUPER_ADMIN_2 });
    const closed = putSession(state, { status: SupportAccessStatus.CLOSED });
    const requested = putSession(state, { status: SupportAccessStatus.REQUESTED });
    const attempts = [
      headers(otherStaff),
      headers(closed),
      headers(requested),
      headers('ffffffff-ffff-4fff-8fff-ffffffffffff'),
    ];
    const details = attempts.map(attempt => detailOf(catchError(() => guard.guardCall(read, method, warehousesRequest, attempt))));

    expect(details.map(detail => detail.code)).toEqual(attempts.map(() => ErrorCode.MEMBERSHIP_REQUIRED));
    expect(details.map(detail => detail.params.case)).toEqual(attempts.map(() => undefined));
  });
});

describe('support session: member, session and self requirements', () => {
  const sessionHeaders = (): Headers => staffHeadersOf({
    organizationId: CLIENT_ORGANIZATION_ID,
    sessionId: putSession(state),
    userId: SeedUserId.OPERATOR_SUPER_ADMIN_1,
  });

  it('refuses a member method through a session', () => {
    const headers = sessionHeaders();

    expectMembershipRequired(() => guard.guardCall(read, OrganizationService.method.getOrganizationSettings, settingsRequest, headers));
    expectMembershipRequired(
      () => guard.guardMemberCall(read, OrganizationService.method.getOrganizationSettings, settingsRequest, headers),
    );
  });

  it('refuses a session method with an organization through a session', () => {
    const headers = sessionHeaders();

    expectMembershipRequired(() => guard.guardCall(read, OrganizationService.method.listSpheres, sphereRequest, headers));
    expectMembershipRequired(() => guard.guardMemberCall(read, OrganizationService.method.listSpheres, sphereRequest, headers));
  });

  it('gives a self method no organization context from a session', () => {
    const method = UserProfileService.method.removeMyAvatar;
    const request = create(method.input, { idempotencyKey: '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153' });
    const headers = sessionHeaders();
    const caller = guard.guardCall(read, method, request, headers);

    expect(caller.user.id).toBe(SeedUserId.OPERATOR_SUPER_ADMIN_1);
    expect(caller.admission).toBeUndefined();
    expect(caller.organizationId).toBeUndefined();
    expect(caller.permissions).toEqual([]);
    expect(caller.scope).toBeUndefined();
    expectMembershipRequired(() => guard.guardMemberCall(read, method, request, headers));
  });

  it('does not change the outcome of any self method of the engine', async () => {
    const harness = createModuleHarness();
    const sessionId = putSession(harness.state);
    const selfMethods = listEngineMethods(requirementCase => requirementCase === 'self').map(row => row.method);

    expect(selfMethods.length).toBeGreaterThan(0);

    for (const method of selfMethods) {
      const withoutSession = await callForOutcome(
        harness.transport,
        method,
        { headers: staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 }) },
      );
      const withSession = await callForOutcome(
        harness.transport,
        method,
        { headers: staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, sessionId, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 }) },
      );

      expect(withSession).toEqual(withoutSession);
    }
  });

  it('refuses the notification member methods of the engine through a session', async () => {
    const harness = createModuleHarness();
    const sessionId = putSession(harness.state);
    const memberMethods = listEngineMethods(requirementCase => requirementCase === 'member').map(row => row.method);

    expect(memberMethods.length).toBeGreaterThan(0);

    for (const method of memberMethods) {
      const headers = staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, sessionId, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 });
      const outcome = await callForOutcome(harness.transport, method, { headers });

      expect(outcome.code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
    }
  });
});

describe('support session: subscriptions stay closed', () => {
  it('refuses the organization channel and the warehouse channel of a client during an active session', () => {
    const sessionId = putSession(state);
    const headers = staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, sessionId, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 });

    expect(subscriptionAccess.check(read, organizationChannel(CLIENT_ORGANIZATION_ID), headers)?.code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
    const warehouseDetail = subscriptionAccess.check(read, warehouseChannel(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1), headers);

    expect(warehouseDetail?.code).toBe(ErrorCode.NOT_FOUND);
  });
});

describe('support session: the intersection reaches the guard', () => {
  const probe = (name: string): DescMethodUnary => probeOf(name);
  const callProbe = (method: DescMethodUnary, headers: Headers): unknown => guard.guardCall(read, method, probeRequestOf(method), headers);
  const headersFor = (options: SessionOptionsValue, organizationId = CLIENT_ORGANIZATION_ID): Headers => staffHeadersOf({
    organizationId,
    sessionId: putSession(state, { organizationId, ...options }),
    userId: options.staffUserId ?? SeedUserId.OPERATOR_SUPER_ADMIN_1,
  });

  it('opens an editing permission to a session in the edit mode and refuses it in the view mode', () => {
    const method = probe('organization_edit');

    expect(() => callProbe(method, headersFor({ mode: SupportAccessMode.EDIT }))).not.toThrow();

    const detail = detailOf(catchError(() => callProbe(method, headersFor({ mode: SupportAccessMode.VIEW }))));

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(permissionNameOf(detail)).toBe('organization_edit');
  });

  it('refuses a permission outside the section of the session', () => {
    const detail = detailOf(catchError(() => callProbe(probe('warehouse_view'), headersFor({ section: SupportAccessSection.CATALOG }))));

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(permissionNameOf(detail)).toBe('warehouse_view');
  });

  it('refuses a permission that does not apply to the profiles of the organization', () => {
    const method = probe('fleet_view');
    const detail = detailOf(catchError(() => callProbe(method, headersFor({}, SeedOrganizationId.SUPPLIER_1))));

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(permissionNameOf(detail)).toBe('fleet_view');
    expect(() => callProbe(method, headersFor({}, SeedOrganizationId.CARRIER_1))).not.toThrow();
  });

  it('refuses everything to a role without support_session_create', () => {
    for (const userId of [SeedUserId.OPERATOR_SUPPORT_AGENT, SeedUserId.OPERATOR_PLATFORM_ADMIN]) {
      const detail = detailOf(catchError(() => callProbe(probe('warehouse_view'), headersFor({ staffUserId: userId }))));

      expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
      expect(permissionNameOf(detail)).toBe('warehouse_view');
    }
  });

  it('gives an engineer the view and the edit permissions of the settings only', () => {
    const headers = headersFor({ staffUserId: SeedUserId.OPERATOR_SUPPORT_ENGINEER });

    expect(() => callProbe(probe('organization_edit'), headers)).not.toThrow();
    expect(() => callProbe(probe('warehouse_view'), headers)).not.toThrow();
  });

  it('validates the request after the permission', () => {
    const method = probe('organization_edit');
    const invalid = create(method.input, { name: '' });
    const headers = headersFor({});

    expect(detailOf(catchError(() => guard.guardCall(read, method, invalid, headers))).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(detailOf(catchError(() => guard.guardCall(
      read,
      method,
      invalid,
      headersFor({ mode: SupportAccessMode.VIEW }),
    ))).code).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('covers the whole organization for the scope field and keeps another organization out', () => {
    const method = probeOf('organization_edit', { scopeField: 'address' });
    const headers = headersFor({});
    const guardFor = (warehouseId: string): unknown => guard.guardCall(read, method, probeRequestOf(method, warehouseId), headers);

    expect(() => guardFor('')).not.toThrow();
    expect(() => guardFor(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1)).not.toThrow();
    expect(() => guardFor(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2)).not.toThrow();
    expect(detailOf(catchError(() => guardFor(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1))).code).toBe(ErrorCode.NOT_FOUND);
  });

  it('applies no amount limit to a session', () => {
    const method = probeOf('organization_edit', { limitField: 'amount' });

    expect(() => guard.guardCall(read, method, probeRequestOf(method), headersFor({}))).not.toThrow();
  });
});

describe('support session: the never list', () => {
  const neverCodes = listPermissionCodes().filter(code => isNeverForSupport(code));
  const headersForOrganization = (organizationId: string): Headers => staffHeadersOf({
    organizationId,
    sessionId: putSession(state, {
      mode: SupportAccessMode.EDIT,
      organizationId,
      section: SupportAccessSection.ALL,
      staffUserId: SeedUserId.OPERATOR_SUPER_ADMIN_1,
    }),
    userId: SeedUserId.OPERATOR_SUPER_ADMIN_1,
  });

  const refusalOf = (name: string, organizationId: string): ErrorDetail => {
    const method = probeOf(name);

    return detailOf(catchError(() => guard.guardCall(read, method, probeRequestOf(method), headersForOrganization(organizationId))));
  };

  const organizationOf = (name: string): string => {
    const code = listPermissionCodes().find(candidate => getPermissionName(candidate) === name);
    const [profile] = code === undefined ? [] : getPermissionTraits(code).profiles;

    return ORGANIZATION_BY_PROFILE[profile ?? ProfileKind.UNSPECIFIED];
  };

  it('lists the codes of the catalog that the rule covers', () => {
    expect(neverCodes.length).toBeGreaterThan(20);
  });

  it.each(neverCodes.map(code => getPermissionName(code)))('refuses %s to a super administrator in an edit session over all', (name) => {
    const detail = refusalOf(name, organizationOf(name));

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(permissionNameOf(detail)).toBe(name);
  });

  it.each([
    'contract_sign',
    'document_sign',
    'payment_fund',
    'payment_release',
    'deal_create',
    'deal_edit',
    'deal_approve',
    'member_manage',
    'review_create',
  ])('refuses %s in every organization of the three sides', (name) => {
    for (const organizationId of [SeedOrganizationId.CUSTOMER_1, SeedOrganizationId.SUPPLIER_1, SeedOrganizationId.CARRIER_1]) {
      const detail = refusalOf(name, organizationId);

      expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
      expect(permissionNameOf(detail)).toBe(name);
    }
  });

  it('lets the same session through on an allowed permission so that the refusals are meaningful', () => {
    const method = probeOf('organization_edit');

    expect(() => guard.guardCall(read, method, probeRequestOf(method), headersForOrganization(CLIENT_ORGANIZATION_ID))).not.toThrow();
  });
});

describe('support session: data edits are not settings', () => {
  const editHeaders = (): Headers => staffHeadersOf({
    organizationId: CLIENT_ORGANIZATION_ID,
    sessionId: putSession(state, {
      mode: SupportAccessMode.EDIT,
      section: SupportAccessSection.ALL,
      staffUserId: SeedUserId.OPERATOR_SUPER_ADMIN_1,
    }),
    userId: SeedUserId.OPERATOR_SUPER_ADMIN_1,
  });

  it('refuses the warehouse_edit probe to a super administrator in an edit session over all', () => {
    const method = probeOf('warehouse_edit');
    const detail = detailOf(catchError(() => guard.guardCall(read, method, probeRequestOf(method), editHeaders())));

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(permissionNameOf(detail)).toBe('warehouse_edit');
  });

  it('refuses the real CreateWarehouse to a super administrator in an edit session over all', async () => {
    const harness = createModuleHarness();
    const sessionId = putSession(harness.state, {
      mode: SupportAccessMode.EDIT,
      section: SupportAccessSection.ALL,
      staffUserId: SeedUserId.OPERATOR_SUPER_ADMIN_1,
    });
    const headers = staffHeadersOf({ organizationId: CLIENT_ORGANIZATION_ID, sessionId, userId: SeedUserId.OPERATOR_SUPER_ADMIN_1 });
    const request = create(CreateWarehouseRequestSchema, {
      address: 'ул. Вымышленная, 1',
      capabilities: [WarehouseCapability.RAMP],
      cityId: SeedCityId.KAZAN,
      idempotencyKey: '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153',
      mapNodeId: SeedMapNodeId.KAZAN,
      name: 'Склад 9',
      timeZone: 'Europe/Moscow',
    });
    const detail = readErrorDetail(await captureError(harness.organization.createWarehouse(request, { headers })));
    const listed = await harness.organization.listWarehouses(warehousesRequest, { headers });

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(permissionNameOf(detail)).toBe('warehouse_create');
    expect(listed.warehouses.every(warehouse => warehouse.name !== 'Склад 9')).toBe(true);
  });
});
