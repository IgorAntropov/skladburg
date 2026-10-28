import type { Event } from '@skladburg/contracts/event/v1/event';
import type { SupportAccessSession } from '@skladburg/contracts/support/v1/support_access';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  organizationChannel,
  SUPPORT_SESSION_HEADER,
} from '@skladburg/contracts/runtime';
import {
  SupportAccessCloseReason,
  SupportAccessMode,
  SupportAccessSection,
  SupportAccessStatus,
  SupportAuditAction,
  SupportAuditOutcome,
  SupportEmergencyReason,
} from '@skladburg/contracts/support/v1/support_access';
import { SupportAccessChange } from '@skladburg/contracts/support/v1/support_events';
import { SupportTicketCategory } from '@skladburg/contracts/support/v1/support_ticket';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ModuleHarnessValue } from '../testing/moduleHarness';

import {
  createEngineCaller,
  createHeaders,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import {
  SEED_WORLD_START_MS,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/index';
import {
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';
import { createSupportAccessExpiryTask } from './supportAccessExpiry';
import { MINUTE_MS } from './supportAccessRules';
import {
  CLIENT,
  CLIENT_ID,
  createKey,
  createSessionId,
  OTHER_CLIENT_ID,
  putSession,
  STAFF,
  STAFF_ID,
} from './testing/supportAccessFixtures';
import { createSupportContext } from './testing/supportFixtures';

const runExpiry = (harness: ModuleHarnessValue): Promise<void> => {
  const task = createSupportAccessExpiryTask(harness.runtime);

  return harness.runtime.command((transaction) => {
    task.run(transaction, transaction.worldTimeMs);
  });
};

const toMs = (timestamp: SupportAccessSession['endedAt']): number | undefined =>
  timestamp === undefined ? undefined : timestampMs(timestamp);

describe('support access expiry task', () => {
  it('runs every 15 seconds of the world time under a stable id', () => {
    const task = createSupportAccessExpiryTask(createModuleHarness().runtime);

    expect(task.id).toBe('support-access-expiry');
    expect(task.intervalMs).toBe(15_000);
  });

  it('closes an active session at its end time with the reason EXPIRED, one entry without an actor and an ENDED event', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, {
      expiresAtMs: SEED_WORLD_START_MS,
      id: createSessionId(1),
      status: SupportAccessStatus.ACTIVE,
    });
    harness.events.length = 0;

    await runExpiry(harness);

    expect(harness.state.read.get('supportAccessSessions', session.id)).toMatchObject({
      closeReason: SupportAccessCloseReason.EXPIRED,
      status: SupportAccessStatus.CLOSED,
      version: 2,
    });
    expect(toMs(harness.state.read.get('supportAccessSessions', session.id)?.endedAt)).toBe(SEED_WORLD_START_MS);
    expect(harness.state.read.list('supportAuditEntries')).toMatchObject([{
      action: SupportAuditAction.SESSION_CLOSED,
      actorUserId: '',
      closeReason: SupportAccessCloseReason.EXPIRED,
      method: '',
      organizationId: CLIENT_ID,
      permission: '',
      sessionId: session.id,
      staffUserId: STAFF_ID.engineer,
    }]);
    expect(harness.events.map(event => [event.channel, event.payload.case === 'supportAccessChanged' && event.payload.value.change]))
      .toEqual([[organizationChannel(CLIENT_ID), SupportAccessChange.ENDED]]);
  });

  it('keeps an active session until the very end time', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, {
      expiresAtMs: SEED_WORLD_START_MS + 1,
      id: createSessionId(1),
      status: SupportAccessStatus.ACTIVE,
    });
    harness.commits.length = 0;

    await runExpiry(harness);

    expect(harness.state.read.get('supportAccessSessions', session.id)).toEqual(session);
    expect(harness.commits).toEqual([]);
  });

  it('cancels a request that has waited for an answer 60 minutes with the reason EXPIRED and the entry SESSION_CANCELLED', async () => {
    const harness = createModuleHarness();
    const waiting = await putSession(harness, { id: createSessionId(1), requestedAtMs: SEED_WORLD_START_MS - 60 * MINUTE_MS });
    const fresh = await putSession(harness, { id: createSessionId(2), requestedAtMs: SEED_WORLD_START_MS - 60 * MINUTE_MS + 1 });
    harness.events.length = 0;

    await runExpiry(harness);

    expect(harness.state.read.get('supportAccessSessions', waiting.id)).toMatchObject({
      closeReason: SupportAccessCloseReason.EXPIRED,
      status: SupportAccessStatus.CANCELLED,
      version: 2,
    });
    expect(toMs(harness.state.read.get('supportAccessSessions', waiting.id)?.endedAt)).toBe(SEED_WORLD_START_MS);
    expect(harness.state.read.get('supportAccessSessions', fresh.id)).toEqual(fresh);
    expect(harness.state.read.list('supportAuditEntries')).toMatchObject([{
      action: SupportAuditAction.SESSION_CANCELLED,
      actorUserId: '',
      closeReason: SupportAccessCloseReason.EXPIRED,
      sessionId: waiting.id,
    }]);
    expect(harness.events.filter(event => event.payload.case === 'supportAccessChanged')).toHaveLength(1);
  });

  it('leaves the finished sessions alone and does nothing the second time', async () => {
    const harness = createModuleHarness();
    const old = SEED_WORLD_START_MS - 600 * MINUTE_MS;

    for (const [index, status] of [
      SupportAccessStatus.DECLINED,
      SupportAccessStatus.CANCELLED,
      SupportAccessStatus.CLOSED,
    ].entries()) {
      await putSession(harness, { expiresAtMs: old, id: createSessionId(index + 1), requestedAtMs: old, status });
    }

    harness.commits.length = 0;
    await runExpiry(harness);

    expect(harness.commits).toEqual([]);
    expect(harness.state.read.list('supportAuditEntries')).toEqual([]);
  });

  it('closes the sessions of different organizations, each event in the channel of its own organization', async () => {
    const harness = createModuleHarness();
    await putSession(harness, {
      expiresAtMs: SEED_WORLD_START_MS - 1,
      id: createSessionId(1),
      status: SupportAccessStatus.ACTIVE,
    });
    await putSession(harness, {
      expiresAtMs: SEED_WORLD_START_MS - 1,
      id: createSessionId(2),
      organizationId: OTHER_CLIENT_ID,
      status: SupportAccessStatus.ACTIVE,
    });
    harness.events.length = 0;

    await runExpiry(harness);

    expect(harness.events.filter(event => event.payload.case === 'supportAccessChanged').map(event => event.channel).sort())
      .toEqual([organizationChannel(CLIENT_ID), organizationChannel(OTHER_CLIENT_ID)].sort());
    expect(harness.state.read.list('supportAuditEntries').map(entry => entry.organizationId).sort())
      .toEqual([CLIENT_ID, OTHER_CLIENT_ID].sort());
  });
});

describe('support access expiry across the whole engine', () => {
  const MINUTES = 15;

  const createStaffHeaders = (sessionId: string): { headers: Headers } => {
    const headers = createHeaders(SeedUserId.OPERATOR_SUPER_ADMIN_1, CLIENT_ID);
    headers.set(SUPPORT_SESSION_HEADER, sessionId);

    return { headers };
  };

  it('reads the warehouses, is refused at the end time before the task runs and is closed by the task', async () => {
    const { engine, realTime } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const batches: Event[][] = [];
    const subscribed = engine.subscribe(
      organizationChannel(CLIENT_ID),
      createHeaders(SeedUserId.ADMIN_1, CLIENT_ID),
      (batch) => {
        batches.push([...batch]);
      },
    );

    expect(subscribed.kind).toBe('subscribed');

    const started = await caller.supportAccess.startEmergencySupportAccess({
      durationMinutes: MINUTES,
      emergencyReason: SupportEmergencyReason.DATA_RECOVERY,
      idempotencyKey: createKey(90),
      mode: SupportAccessMode.VIEW,
      organizationId: CLIENT_ID,
      section: SupportAccessSection.WAREHOUSES,
    }, STAFF.superAdmin);
    const sessionId = started.session?.id ?? '';
    const warehouses = await caller.organization.listWarehouses({}, createStaffHeaders(sessionId));

    expect(started.session?.status).toBe(SupportAccessStatus.ACTIVE);
    expect(warehouses.warehouses.map(warehouse => warehouse.id)).toContain(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1);

    realTime.advance(MINUTES * MINUTE_MS);
    const refused = readErrorDetail(await captureError(caller.organization.listWarehouses({}, createStaffHeaders(sessionId))));

    expect(refused.code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
    expect((await caller.supportAccess.listSupportAccessSessions({}, CLIENT.admin)).sessions[0]?.status).toBe(SupportAccessStatus.ACTIVE);

    await engine.tick();

    const [session] = (await caller.supportAccess.listSupportAccessSessions({}, CLIENT.admin)).sessions;
    const entries = (await caller.supportAccess.listSupportAuditEntries({ sessionId }, CLIENT.admin)).entries;

    expect(session).toMatchObject({
      closeReason: SupportAccessCloseReason.EXPIRED,
      status: SupportAccessStatus.CLOSED,
      version: 2,
    });
    expect(entries.map(entry => [entry.action, entry.actorUserId, entry.closeReason, entry.outcome])).toEqual([
      [SupportAuditAction.SESSION_CLOSED, '', SupportAccessCloseReason.EXPIRED, SupportAuditOutcome.ALLOWED],
      [SupportAuditAction.READ, SeedUserId.OPERATOR_SUPER_ADMIN_1, SupportAccessCloseReason.UNSPECIFIED, SupportAuditOutcome.DENIED],
      [SupportAuditAction.READ, SeedUserId.OPERATOR_SUPER_ADMIN_1, SupportAccessCloseReason.UNSPECIFIED, SupportAuditOutcome.ALLOWED],
      [
        SupportAuditAction.SESSION_STARTED_EMERGENCY,
        SeedUserId.OPERATOR_SUPER_ADMIN_1,
        SupportAccessCloseReason.UNSPECIFIED,
        SupportAuditOutcome.ALLOWED,
      ],
    ]);
    expect(batches.flat().flatMap(event => event.payload.case === 'supportAccessChanged'
      ? [[event.channel, event.payload.value.change]]
      : [])).toEqual([
      [organizationChannel(CLIENT_ID), SupportAccessChange.STARTED],
      [organizationChannel(CLIENT_ID), SupportAccessChange.ENDED],
    ]);
  });

  it('cancels a request that nobody has answered for 60 minutes and refuses the late approval', async () => {
    const { engine, realTime } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const ticket = await caller.supportTicket.createSupportTicket(
      { category: SupportTicketCategory.GENERAL, context: createSupportContext(), idempotencyKey: createKey(91) },
      CLIENT.admin,
    );
    const requested = await caller.supportAccess.requestSupportAccess({
      durationMinutes: 30,
      idempotencyKey: createKey(92),
      mode: SupportAccessMode.VIEW,
      organizationId: CLIENT_ID,
      section: SupportAccessSection.WAREHOUSES,
      ticketId: ticket.ticket?.id ?? '',
    }, STAFF.engineer);
    const sessionId = requested.session?.id ?? '';

    realTime.advance(59 * MINUTE_MS);
    await engine.tick();

    expect((await caller.supportAccess.listSupportAccessSessions({}, CLIENT.admin)).sessions[0]?.status)
      .toBe(SupportAccessStatus.REQUESTED);

    realTime.advance(MINUTE_MS);
    await engine.tick();

    const [session] = (await caller.supportAccess.listSupportAccessSessions({}, CLIENT.admin)).sessions;
    const late = await captureError(caller.supportAccess.approveSupportAccess(
      { expectedVersion: 2, idempotencyKey: createKey(93), sessionId },
      CLIENT.admin,
    ));

    expect(session).toMatchObject({ closeReason: SupportAccessCloseReason.EXPIRED, status: SupportAccessStatus.CANCELLED });
    expect(readErrorDetail(late).code).toBe(ErrorCode.INVALID_TRANSITION);
  });
});
