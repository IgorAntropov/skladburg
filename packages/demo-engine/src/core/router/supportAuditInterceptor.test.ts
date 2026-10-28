import type { DescMethodUnary } from '@bufbuild/protobuf';
import type {
  StreamResponse,
  UnaryRequest,
  UnaryResponse,
} from '@connectrpc/connect';
import type { SupportAuditEntry } from '@skladburg/contracts/support/v1/support_access';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  createContextValues,
} from '@connectrpc/connect';
import { UserProfileService } from '@skladburg/contracts/access/v1/profile';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { MethodAccessSchema } from '@skladburg/contracts/common/v1/method_options';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import {
  ACTING_ORGANIZATION_HEADER,
  SUPPORT_SESSION_HEADER,
} from '@skladburg/contracts/runtime';
import {
  SupportAccessStatus,
  SupportAuditAction,
  SupportAuditOutcome,
} from '@skladburg/contracts/support/v1/support_access';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ModuleHarnessValue } from '../modules/testing/moduleHarness';
import type { SupportAuditDependenciesValue } from './supportAuditInterceptor';

import { createProbeMethod } from '../access/testingProbeMethod';
import { createDomainErrors } from '../errors/index';
import { MINUTE_MS } from '../modules/platform/supportAccessRules';
import {
  CLIENT_ID,
  createSessionId,
  OTHER_CLIENT_ID,
  putSession,
  STAFF_ID,
} from '../modules/platform/testing/supportAccessFixtures';
import {
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../modules/testing/moduleHarness';
import { createSeededRandom } from '../ports/index';
import { DEMO_USER_HEADER } from '../protocol';
import {
  SEED_WORLD_START_MS,
  SeedUserId,
} from '../seed/index';
import { createSupportAuditInterceptor } from './supportAuditInterceptor';

const SESSION_ID = createSessionId(1);
const COLLEAGUE_ID: string = SeedUserId.OPERATOR_SUPPORT_AGENT;
const EDIT_PERMISSION = 'organization_edit';

const listWarehouses = OrganizationService.method.listWarehouses;
const getOrganization = OrganizationService.method.getOrganization;
const listSpheres = OrganizationService.method.listSpheres;
const setMyAvatar = UserProfileService.method.setMyAvatar;

const createEditProbe = (): DescMethodUnary => createProbeMethod(create(MethodAccessSchema, {
  requirement: { case: 'permission', value: { name: EDIT_PERMISSION } },
}));

interface HeadersOptionsValue {
  organizationId?: string | undefined;
  sessionId?: string | undefined;
  userId?: string | undefined;
}

const createStaffHeaders = (options: HeadersOptionsValue = {}): Headers => {
  const headers = new Headers();
  const entries: [string, string | undefined][] = [
    [DEMO_USER_HEADER, 'userId' in options ? options.userId : STAFF_ID.engineer],
    [ACTING_ORGANIZATION_HEADER, 'organizationId' in options ? options.organizationId : CLIENT_ID],
    [SUPPORT_SESSION_HEADER, 'sessionId' in options ? options.sessionId : SESSION_ID],
  ];

  for (const [name, value] of entries) {
    if (value !== undefined) {
      headers.set(name, value);
    }
  }

  return headers;
};

const createRequest = (method: DescMethodUnary, header: Headers): UnaryRequest => ({
  contextValues: createContextValues(),
  header,
  message: create(method.input),
  method,
  requestMethod: 'POST',
  service: method.parent,
  signal: new AbortController().signal,
  stream: false,
  url: `http://engine.local/${method.parent.typeName}/${method.name}`,
});

const createResponse = (method: DescMethodUnary): UnaryResponse => ({
  header: new Headers(),
  message: create(method.output),
  method,
  service: method.parent,
  stream: false,
  trailer: new Headers(),
});

interface SetupValue {
  call: (method: DescMethodUnary, header: Headers, handle?: () => Promise<UnaryResponse>) => Promise<StreamResponse | UnaryResponse>;
  harness: ModuleHarnessValue;
  readEntries: () => SupportAuditEntry[];
}

const setup = async (overrides: Partial<SupportAuditDependenciesValue> = {}): Promise<SetupValue> => {
  const harness = createModuleHarness();
  await putSession(harness, {
    expiresAtMs: SEED_WORLD_START_MS + 30 * MINUTE_MS,
    id: SESSION_ID,
    status: SupportAccessStatus.ACTIVE,
  });
  const interceptor = createSupportAuditInterceptor({ ...harness.runtime, ...overrides });

  return {
    call: (method, header, handle = () => Promise.resolve(createResponse(method))) =>
      interceptor(handle)(createRequest(method, header)),
    harness,
    readEntries: () => harness.state.read.list('supportAuditEntries'),
  };
};

describe('support audit interceptor', () => {
  it('writes one READ entry with the permission of the method after an allowed read', async () => {
    const { call, harness, readEntries } = await setup();

    const response = await call(listWarehouses, createStaffHeaders());

    expect(response.message).toEqual(create(listWarehouses.output));
    expect(readEntries()).toHaveLength(1);
    expect(readEntries()[0]).toMatchObject({
      action: SupportAuditAction.READ,
      actorUserId: STAFF_ID.engineer,
      errorCode: ErrorCode.UNSPECIFIED,
      method: 'organization.v1.OrganizationService/ListWarehouses',
      organizationId: CLIENT_ID,
      outcome: SupportAuditOutcome.ALLOWED,
      permission: 'warehouse_view',
      sessionId: SESSION_ID,
      staffUserId: STAFF_ID.engineer,
    });
    expect(harness.commits).toHaveLength(2);
  });

  it('writes a CHANGE entry for a method that is not free of side effects', async () => {
    const { call, readEntries } = await setup();

    await call(createEditProbe(), createStaffHeaders());

    expect(readEntries()).toHaveLength(1);
    expect(readEntries()[0]).toMatchObject({
      action: SupportAuditAction.CHANGE,
      outcome: SupportAuditOutcome.ALLOWED,
      permission: EDIT_PERMISSION,
    });
  });

  it('writes a DENIED entry with the domain code and rethrows the very same error', async () => {
    const { call, harness, readEntries } = await setup();
    const denial = harness.runtime.errors.permissionDenied('warehouse_create');

    const thrown = await captureError(call(listWarehouses, createStaffHeaders(), () => Promise.reject(denial)));

    expect(thrown).toBe(denial);
    expect(readEntries()).toHaveLength(1);
    expect(readEntries()[0]).toMatchObject({
      action: SupportAuditAction.READ,
      errorCode: ErrorCode.PERMISSION_DENIED,
      outcome: SupportAuditOutcome.DENIED,
      permission: 'warehouse_view',
    });
  });

  it('records an unexpected exception as an internal denial and answers with the internal error', async () => {
    const { call, readEntries } = await setup();

    const thrown = await captureError(call(createEditProbe(), createStaffHeaders(), () => {
      throw new Error('secret failure details');
    }));

    expect(thrown.code).toBe(Code.Internal);
    expect(thrown.rawMessage).toBe('internal');
    expect(readErrorDetail(thrown).code).toBe(ErrorCode.INTERNAL);
    expect(readEntries()).toHaveLength(1);
    expect(readEntries()[0]).toMatchObject({ errorCode: ErrorCode.INTERNAL, outcome: SupportAuditOutcome.DENIED });
  });

  it('keeps the code and the trace id of the original error', async () => {
    const { call, harness } = await setup();
    const original = harness.runtime.errors.membershipRequired();
    const originalDetail = readErrorDetail(original);

    const thrown = await captureError(call(getOrganization, createStaffHeaders(), () => Promise.reject(original)));

    expect(readErrorDetail(thrown).code).toBe(originalDetail.code);
    expect(readErrorDetail(thrown).traceId).toBe(originalDetail.traceId);
  });

  it('writes an entry without a permission for a method that needs a membership', async () => {
    const { call, harness, readEntries } = await setup();

    await call(getOrganization, createStaffHeaders());
    await captureError(call(getOrganization, createStaffHeaders(), () => Promise.reject(harness.runtime.errors.membershipRequired())));

    expect(readEntries().map(entry => ({
      action: entry.action,
      errorCode: entry.errorCode,
      method: entry.method,
      outcome: entry.outcome,
      permission: entry.permission,
    })).sort((current, prev) => current.outcome - prev.outcome)).toEqual([
      {
        action: SupportAuditAction.READ,
        errorCode: ErrorCode.UNSPECIFIED,
        method: 'organization.v1.OrganizationService/GetOrganization',
        outcome: SupportAuditOutcome.ALLOWED,
        permission: '',
      },
      {
        action: SupportAuditAction.READ,
        errorCode: ErrorCode.MEMBERSHIP_REQUIRED,
        method: 'organization.v1.OrganizationService/GetOrganization',
        outcome: SupportAuditOutcome.DENIED,
        permission: '',
      },
    ]);
  });

  it.each([
    ['a session-only method', listSpheres],
    ['a self-only method', setMyAvatar],
  ])('writes nothing for %s', async (_name, method) => {
    const { call, readEntries } = await setup();

    await call(method, createStaffHeaders());

    expect(readEntries()).toEqual([]);
  });

  it.each([
    ['there is no session header', { sessionId: undefined }],
    ['the session belongs to a colleague', { userId: COLLEAGUE_ID }],
    ['the session does not exist', { sessionId: createSessionId(99) }],
    ['the header names another organization', { organizationId: OTHER_CLIENT_ID }],
    ['the header names no organization', { organizationId: undefined }],
    ['the header names no user', { userId: undefined }],
  ])('writes nothing when %s', async (_name, options) => {
    const { call, harness, readEntries } = await setup();
    const handler = vi.fn(() => Promise.resolve(createResponse(listWarehouses)));

    const response = await call(listWarehouses, createStaffHeaders(options), handler);

    expect(response.message).toEqual(create(listWarehouses.output));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(readEntries()).toEqual([]);
    expect(harness.commits).toHaveLength(1);
  });

  it('writes nothing for a refusal of a colleague session but passes the error on', async () => {
    const { call, harness, readEntries } = await setup();
    const denial = harness.runtime.errors.membershipRequired();

    const thrown = await captureError(call(listWarehouses, createStaffHeaders({ userId: COLLEAGUE_ID }), () => Promise.reject(denial)));

    expect(thrown).toBe(denial);
    expect(readEntries()).toEqual([]);
  });

  it('writes a DENIED entry for an attempt after the end of the term', async () => {
    const { call, harness, readEntries } = await setup();
    await putSession(harness, {
      expiresAtMs: SEED_WORLD_START_MS - MINUTE_MS,
      id: createSessionId(2),
      status: SupportAccessStatus.ACTIVE,
    });

    const thrown = await captureError(call(
      listWarehouses,
      createStaffHeaders({ sessionId: createSessionId(2) }),
      () => Promise.reject(harness.runtime.errors.membershipRequired()),
    ));

    expect(readErrorDetail(thrown).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
    expect(readEntries()).toHaveLength(1);
    expect(readEntries()[0]).toMatchObject({
      errorCode: ErrorCode.MEMBERSHIP_REQUIRED,
      outcome: SupportAuditOutcome.DENIED,
      sessionId: createSessionId(2),
    });
  });

  it.each([
    SupportAccessStatus.CLOSED,
    SupportAccessStatus.REQUESTED,
    SupportAccessStatus.DECLINED,
  ])('writes a DENIED entry for an attempt in a session with the status %s', async (status) => {
    const { call, harness, readEntries } = await setup();
    await putSession(harness, { id: createSessionId(3), status });

    await captureError(call(
      listWarehouses,
      createStaffHeaders({ sessionId: createSessionId(3) }),
      () => Promise.reject(harness.runtime.errors.membershipRequired()),
    ));

    expect(readEntries()).toHaveLength(1);
    expect(readEntries()[0]).toMatchObject({
      errorCode: ErrorCode.MEMBERSHIP_REQUIRED,
      outcome: SupportAuditOutcome.DENIED,
      sessionId: createSessionId(3),
    });
  });

  it('writes one entry per call and never touches the earlier entries', async () => {
    const { call, harness, readEntries } = await setup();
    await call(listWarehouses, createStaffHeaders());
    const before = readEntries().map(entry => structuredClone(entry));

    await call(listWarehouses, createStaffHeaders());
    await call(createEditProbe(), createStaffHeaders());
    await captureError(call(listWarehouses, createStaffHeaders(), () => Promise.reject(harness.runtime.errors.membershipRequired())));
    const after = readEntries();

    expect(after).toHaveLength(before.length + 3);

    for (const entry of before) {
      expect(after.find(candidate => candidate.id === entry.id)).toEqual(entry);
    }
  });

  it('answers with an error when the entry cannot be written and does not hand out the response', async () => {
    const unavailable = createDomainErrors(createSeededRandom(1)).unavailable();
    const { call, readEntries } = await setup({ command: () => Promise.reject(unavailable) });

    const thrown = await captureError(call(listWarehouses, createStaffHeaders()));

    expect(thrown).toBe(unavailable);
    expect(readEntries()).toEqual([]);
  });

  it('normalizes an unexpected failure of the write into the internal error', async () => {
    const { call } = await setup({ command: () => Promise.reject(new Error('disk is full')) });

    const thrown = await captureError(call(listWarehouses, createStaffHeaders()));

    expect(readErrorDetail(thrown).code).toBe(ErrorCode.INTERNAL);
  });

  it('answers with the error of the write when the handler failed and the write failed too', async () => {
    const unavailable = createDomainErrors(createSeededRandom(1)).unavailable();
    const { call, harness } = await setup({ command: () => Promise.reject(unavailable) });

    const thrown = await captureError(call(
      listWarehouses,
      createStaffHeaders(),
      () => Promise.reject(harness.runtime.errors.permissionDenied('warehouse_view')),
    ));

    expect(thrown).toBe(unavailable);
  });
});
