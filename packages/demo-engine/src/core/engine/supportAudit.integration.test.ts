import type { CallOptions } from '@connectrpc/connect';
import type { SupportAuditEntry } from '@skladburg/contracts/support/v1/support_access';

import { Code } from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  ACTING_ORGANIZATION_HEADER,
  SUPPORT_SESSION_HEADER,
} from '@skladburg/contracts/runtime';
import {
  SupportAccessMode,
  SupportAccessSection,
  SupportAuditAction,
  SupportAuditOutcome,
} from '@skladburg/contracts/support/v1/support_access';
import { SupportTicketCategory } from '@skladburg/contracts/support/v1/support_ticket';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { EngineCallerValue } from './testing/engineHarness';

import { MINUTE_MS } from '../modules/platform/supportAccessRules';
import {
  CLIENT,
  CLIENT_ID,
  createKey,
  OPERATOR_ID,
  STAFF,
  STAFF_ID,
} from '../modules/platform/testing/supportAccessFixtures';
import { createSupportContext } from '../modules/platform/testing/supportFixtures';
import { callAs } from '../modules/testing/moduleHarness';
import { DEMO_USER_HEADER } from '../protocol';
import {
  createEngineCaller,
  createTestEngine,
  createWarehouseRequest,
} from './testing/engineHarness';

interface OpenedSessionValue {
  id: string;
  options: CallOptions;
}

const openSession = async (caller: EngineCallerValue, mode: SupportAccessMode): Promise<OpenedSessionValue> => {
  const ticket = await caller.supportTicket.createSupportTicket(
    { category: SupportTicketCategory.GENERAL, context: createSupportContext(), idempotencyKey: createKey(1) },
    CLIENT.admin,
  );
  const requested = await caller.supportAccess.requestSupportAccess({
    durationMinutes: 30,
    idempotencyKey: createKey(2),
    mode,
    organizationId: CLIENT_ID,
    section: SupportAccessSection.ALL,
    ticketId: ticket.ticket?.id ?? '',
  }, STAFF.engineer);
  const sessionId = requested.session?.id ?? '';
  await caller.supportAccess.approveSupportAccess(
    { expectedVersion: requested.session?.version ?? 0, idempotencyKey: createKey(3), sessionId },
    CLIENT.admin,
  );

  const headers = new Headers({
    [ACTING_ORGANIZATION_HEADER]: CLIENT_ID,
    [DEMO_USER_HEADER]: STAFF_ID.engineer,
    [SUPPORT_SESSION_HEADER]: sessionId,
  });

  return { id: sessionId, options: { headers } };
};

const listCallEntries = async (caller: EngineCallerValue, sessionId: string): Promise<SupportAuditEntry[]> => {
  const response = await caller.supportAccess.listSupportAuditEntries({ sessionId }, CLIENT.admin);

  return response.entries.filter(entry => entry.action === SupportAuditAction.READ || entry.action === SupportAuditAction.CHANGE);
};

describe('support access journal of the engine', () => {
  it('writes one READ entry with the permission for a read of the client in the session', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const session = await openSession(caller, SupportAccessMode.VIEW);

    const response = await caller.organization.listWarehouses({}, session.options);

    expect(response.warehouses.length).toBeGreaterThan(0);
    const entries = await listCallEntries(caller, session.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: SupportAuditAction.READ,
      actorUserId: STAFF_ID.engineer,
      method: 'organization.v1.OrganizationService/ListWarehouses',
      organizationId: CLIENT_ID,
      outcome: SupportAuditOutcome.ALLOWED,
      permission: 'warehouse_view',
      staffUserId: STAFF_ID.engineer,
    });
  });

  it('refuses a write in a view session and writes one CHANGE entry with the denied permission', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const session = await openSession(caller, SupportAccessMode.VIEW);

    const error = await caller.organization.createWarehouse(createWarehouseRequest(createKey(10)), session.options).then(
      () => undefined,
      (reason: unknown) => reason,
    );

    expect(error).toMatchObject({ code: Code.PermissionDenied, rawMessage: 'permission_denied' });
    const entries = await listCallEntries(caller, session.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: SupportAuditAction.CHANGE,
      errorCode: ErrorCode.PERMISSION_DENIED,
      method: 'organization.v1.OrganizationService/CreateWarehouse',
      outcome: SupportAuditOutcome.DENIED,
      permission: 'warehouse_create',
    });
  });

  it('records a method that needs a membership as denied with the membership code', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const session = await openSession(caller, SupportAccessMode.VIEW);

    const error = await caller.organization.getOrganization({}, session.options).then(
      () => undefined,
      (reason: unknown) => reason,
    );

    expect(error).toMatchObject({ code: Code.PermissionDenied });
    const entries = await listCallEntries(caller, session.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: SupportAuditAction.READ,
      errorCode: ErrorCode.MEMBERSHIP_REQUIRED,
      method: 'organization.v1.OrganizationService/GetOrganization',
      outcome: SupportAuditOutcome.DENIED,
      permission: '',
    });
  });

  it('records an attempt after the term as denied with the membership code', async () => {
    const { engine, realTime } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const session = await openSession(caller, SupportAccessMode.VIEW);
    realTime.advance(31 * MINUTE_MS);

    const error = await caller.organization.listWarehouses({}, session.options).then(
      () => undefined,
      (reason: unknown) => reason,
    );

    expect(error).toMatchObject({ code: Code.PermissionDenied });
    const entries = await listCallEntries(caller, session.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      errorCode: ErrorCode.MEMBERSHIP_REQUIRED,
      outcome: SupportAuditOutcome.DENIED,
      permission: 'warehouse_view',
    });
  });

  it('writes nothing for the calls outside the session', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const session = await openSession(caller, SupportAccessMode.VIEW);

    await caller.organization.listWarehouses({}, CLIENT.admin);
    await caller.organization.listSpheres({}, session.options).catch(() => undefined);
    await caller.organization.listWarehouses({}, callAs(STAFF_ID.superAdmin, OPERATOR_ID)).catch(() => undefined);

    expect(await listCallEntries(caller, session.id)).toEqual([]);
  });

  it('shows the entries to the client next to the life of the session and hides them from another organization', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const session = await openSession(caller, SupportAccessMode.VIEW);
    await caller.organization.listWarehouses({}, session.options);

    const own = await caller.supportAccess.listSupportAuditEntries({ sessionId: session.id }, CLIENT.admin);
    const other = await caller.supportAccess.listSupportAuditEntries({}, CLIENT.otherAdmin);

    expect(own.entries.map(entry => entry.action).sort()).toEqual([
      SupportAuditAction.SESSION_REQUESTED,
      SupportAuditAction.SESSION_APPROVED,
      SupportAuditAction.READ,
    ].sort());
    expect(other.entries).toEqual([]);
  });

  it('only appends: earlier entries stay equal and the count grows by the number of calls', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const session = await openSession(caller, SupportAccessMode.VIEW);
    await caller.organization.listWarehouses({}, session.options);
    const before = (await caller.supportAccess.listSupportAuditEntries({}, CLIENT.admin)).entries;

    await caller.organization.listWarehouses({}, session.options);
    await caller.organization.createWarehouse(createWarehouseRequest(createKey(11)), session.options).catch(() => undefined);
    await caller.organization.getOrganization({}, session.options).catch(() => undefined);
    const after = (await caller.supportAccess.listSupportAuditEntries({}, CLIENT.admin)).entries;

    expect(after).toHaveLength(before.length + 3);

    for (const entry of before) {
      expect(after.find(candidate => candidate.id === entry.id)).toEqual(entry);
    }
  });

  it('answers with an error and keeps the journal unchanged when the entry cannot be stored', async () => {
    const { engine, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const session = await openSession(caller, SupportAccessMode.VIEW);
    storage.failNextCommit();

    const error = await caller.organization.listWarehouses({}, session.options).then(
      () => undefined,
      (reason: unknown) => reason,
    );

    expect(error).toMatchObject({ code: Code.Unavailable });
    expect(await listCallEntries(caller, session.id)).toEqual([]);
  });
});
