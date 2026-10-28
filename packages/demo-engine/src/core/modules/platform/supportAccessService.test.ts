import type { CallOptions } from '@connectrpc/connect';
import type { SupportAccessSession } from '@skladburg/contracts/support/v1/support_access';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  NotificationImportance,
  NotificationKind,
} from '@skladburg/contracts/notification/v1/notification';
import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  SupportAccessCloseReason,
  SupportAccessKind,
  SupportAccessMode,
  SupportAccessSection,
  SupportAccessStatus,
  SupportAuditAction,
  SupportAuditOutcome,
  SupportEmergencyReason,
  SupportEmergencyReview,
} from '@skladburg/contracts/support/v1/support_access';
import { SupportAccessChange } from '@skladburg/contracts/support/v1/support_events';
import { SupportTicketCategory } from '@skladburg/contracts/support/v1/support_ticket';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ModuleHarnessValue } from '../testing/moduleHarness';

import { SEED_WORLD_START_MS } from '../../seed/index';
import {
  addTestMember,
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';
import { createSupportAccessExpiryTask } from './supportAccessExpiry';
import { MINUTE_MS } from './supportAccessRules';
import {
  CLIENT,
  CLIENT_ID,
  CLIENT_USER_ID,
  createKey,
  createSessionId,
  listNotifications,
  OPERATOR_ID,
  OTHER_CLIENT_ID,
  putSession,
  readDeniedPermission,
  readErrorCode,
  readNotFoundEntity,
  STAFF,
  STAFF_ID,
} from './testing/supportAccessFixtures';
import { createSupportContext } from './testing/supportFixtures';

const SESSION_ENTITY = EntityKind.SUPPORT_ACCESS_SESSION;
const MISSING_ID = 'e0000000-0000-4000-8000-000000000001';

const sessionBody = (sessionId: string, expectedVersion: number, key: number): {
  expectedVersion: number;
  idempotencyKey: string;
  sessionId: string;
} => ({ expectedVersion, idempotencyKey: createKey(key), sessionId });

const toMs = (timestamp: SupportAccessSession['expiresAt']): number | undefined =>
  timestamp === undefined ? undefined : timestampMs(timestamp);

const createTicketNumber = async (
  harness: ModuleHarnessValue,
  options: CallOptions = CLIENT.admin,
): Promise<{ id: string; number: number }> => {
  const response = await harness.supportTicket.createSupportTicket(
    { category: SupportTicketCategory.GENERAL, context: createSupportContext(), idempotencyKey: createKey(900) },
    options,
  );

  return { id: response.ticket?.id ?? '', number: response.ticket?.number ?? 0 };
};

interface RequestOverridesValue {
  durationMinutes?: number;
  key?: string;
  mode?: SupportAccessMode;
  options?: CallOptions;
  organizationId?: string;
  ticketId?: string;
}

const requestAccess = (
  harness: ModuleHarnessValue,
  ticketId: string,
  overrides: RequestOverridesValue = {},
): Promise<SupportAccessSession> =>
  harness.supportAccess.requestSupportAccess({
    durationMinutes: overrides.durationMinutes ?? 30,
    idempotencyKey: overrides.key ?? createKey(1),
    mode: overrides.mode ?? SupportAccessMode.VIEW,
    organizationId: overrides.organizationId ?? CLIENT_ID,
    section: SupportAccessSection.WAREHOUSES,
    ticketId: overrides.ticketId ?? ticketId,
  }, overrides.options ?? STAFF.engineer).then(response => response.session ?? failMissing());

const failMissing = (): never => {
  throw new Error('The response carries no session');
};

interface EmergencyOverridesValue {
  key?: string;
  mode?: SupportAccessMode;
  options?: CallOptions;
  organizationId?: string;
  ticketId?: string;
}

const startEmergency = (harness: ModuleHarnessValue, overrides: EmergencyOverridesValue = {}): Promise<SupportAccessSession> =>
  harness.supportAccess.startEmergencySupportAccess({
    durationMinutes: 30,
    emergencyReason: SupportEmergencyReason.SECURITY_INCIDENT,
    idempotencyKey: overrides.key ?? createKey(2),
    mode: overrides.mode ?? SupportAccessMode.VIEW,
    organizationId: overrides.organizationId ?? CLIENT_ID,
    section: SupportAccessSection.ALL,
    ticketId: overrides.ticketId ?? '',
  }, overrides.options ?? STAFF.superAdmin).then(response => response.session ?? failMissing());

const listNoticesOfKind = (harness: ModuleHarnessValue, kind: NotificationKind): ReturnType<typeof listNotifications> =>
  listNotifications(harness).filter(record => record.notification.kind === kind);

const runTask = (harness: ModuleHarnessValue, task: ReturnType<typeof createSupportAccessExpiryTask>): Promise<void> =>
  harness.runtime.command((transaction) => {
    task.run(transaction, SEED_WORLD_START_MS);
  });

const listChangesOf = (harness: ModuleHarnessValue): { change: SupportAccessChange | undefined; channel: string }[] =>
  harness.events.flatMap(event => event.payload.case === 'supportAccessChanged'
    ? [{ change: event.payload.value.change, channel: event.channel }]
    : []);

const readEntries = async (harness: ModuleHarnessValue, sessionId = ''): Promise<SupportAuditEntryRowValue[]> => {
  const response = await harness.supportAccess.listSupportAuditEntries({ sessionId }, CLIENT.admin);

  return response.entries.map(entry => ({
    action: entry.action,
    actorUserId: entry.actorUserId,
    closeReason: entry.closeReason,
    method: entry.method,
    outcome: entry.outcome,
    permission: entry.permission,
  }));
};

interface SupportAuditEntryRowValue {
  action: SupportAuditAction;
  actorUserId: string;
  closeReason: SupportAccessCloseReason;
  method: string;
  outcome: SupportAuditOutcome;
  permission: string;
}

describe('RequestSupportAccess', () => {
  it('creates a requested normal session with the details of the staff member and the ticket', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicketNumber(harness);

    const session = await requestAccess(harness, ticket.id);

    expect(session).toMatchObject({
      durationMinutes: 30,
      emergencyReview: SupportEmergencyReview.NOT_REQUIRED,
      kind: SupportAccessKind.NORMAL,
      mode: SupportAccessMode.VIEW,
      organizationId: CLIENT_ID,
      section: SupportAccessSection.WAREHOUSES,
      staffDisplayName: 'Илья Г.',
      status: SupportAccessStatus.REQUESTED,
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      version: 1,
    });
    expect(session.staffUserId).toBe(STAFF_ID.engineer);
    expect(toMs(session.requestedAt)).toBe(SEED_WORLD_START_MS);
    expect(session.startedAt).toBeUndefined();
    expect(session.expiresAt).toBeUndefined();
    expect(session.endedAt).toBeUndefined();
    expect(harness.state.read.get('supportAccessSessions', session.id)).toEqual(session);
  });

  it('names support_session_create when the agent, the platform administrator and a client member are refused', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicketNumber(harness);

    for (const options of [STAFF.agent, STAFF.admin, CLIENT.admin]) {
      expect(await readDeniedPermission(requestAccess(harness, ticket.id, { options }))).toBe('support_session_create');
    }

    expect(harness.state.read.list('supportAccessSessions')).toEqual([]);
  });

  it('answers not_found for the operator, an unknown organization and a ticket of another organization', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicketNumber(harness);
    const foreignTicket = await createTicketNumber(harness, CLIENT.otherAdmin);
    const operatorId = OPERATOR_ID;

    expect(await readNotFoundEntity(requestAccess(harness, ticket.id, { organizationId: operatorId }))).toBe(EntityKind.ORGANIZATION);
    expect(await readNotFoundEntity(requestAccess(harness, ticket.id, { organizationId: MISSING_ID }))).toBe(EntityKind.ORGANIZATION);
    expect(await readNotFoundEntity(requestAccess(harness, foreignTicket.id))).toBe(EntityKind.SUPPORT_TICKET);
    expect(await readNotFoundEntity(requestAccess(harness, MISSING_ID))).toBe(EntityKind.SUPPORT_TICKET);
    expect(harness.state.read.list('supportAccessSessions')).toEqual([]);
  });

  it('refuses the edit mode to a staff member without support_settings_edit and allows it to the engineer', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicketNumber(harness);
    const viewerId = await addTestMember(harness, {
      organizationId: OPERATOR_ID,
      permissions: ['support_session_create'],
      warehouseIds: [],
    });
    const viewer = callAs(viewerId, OPERATOR_ID);

    expect(await readDeniedPermission(
      requestAccess(harness, ticket.id, { key: createKey(11), mode: SupportAccessMode.EDIT, options: viewer }),
    )).toBe('support_settings_edit');
    expect((await requestAccess(harness, ticket.id, { key: createKey(12), options: viewer })).mode).toBe(SupportAccessMode.VIEW);
    const edit = await requestAccess(harness, ticket.id, { key: createKey(13), mode: SupportAccessMode.EDIT });

    expect(edit.mode).toBe(SupportAccessMode.EDIT);
  });

  it('rejects a duration outside of 15 to 240 minutes with validation_failed', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicketNumber(harness);

    expect(await readErrorCode(requestAccess(harness, ticket.id, { durationMinutes: 5 }))).toBe(ErrorCode.VALIDATION_FAILED);
    expect(await readErrorCode(requestAccess(harness, ticket.id, { durationMinutes: 241 }))).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('answers a repeated idempotency key with the same session, one record, one audit entry and one event', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicketNumber(harness);

    const first = await requestAccess(harness, ticket.id);
    const noticeCount = listNotifications(harness).length;
    harness.events.length = 0;
    const second = await requestAccess(harness, ticket.id);

    expect(second).toEqual(first);
    expect(harness.state.read.list('supportAccessSessions')).toHaveLength(1);
    expect(harness.state.read.list('supportAuditEntries')).toHaveLength(1);
    expect(listNotifications(harness)).toHaveLength(noticeCount);
    expect(harness.events).toEqual([]);
  });

  it('writes one SESSION_REQUESTED entry by the staff member without a method or a permission', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicketNumber(harness);
    const session = await requestAccess(harness, ticket.id);

    const [entry] = harness.state.read.list('supportAuditEntries');

    expect(harness.state.read.list('supportAuditEntries')).toHaveLength(1);
    expect(entry).toMatchObject({
      action: SupportAuditAction.SESSION_REQUESTED,
      actorUserId: session.staffUserId,
      method: '',
      organizationId: CLIENT_ID,
      outcome: SupportAuditOutcome.ALLOWED,
      permission: '',
      sessionId: session.id,
      staffDisplayName: 'Илья Г.',
      staffUserId: session.staffUserId,
      ticketNumber: ticket.number,
    });
    expect(toMs(entry?.occurredAt)).toBe(SEED_WORLD_START_MS);
    expect(entry?.closeReason).toBe(SupportAccessCloseReason.UNSPECIFIED);
  });

  it('publishes REQUESTED only to the organization channel of the client', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicketNumber(harness);
    harness.events.length = 0;

    await requestAccess(harness, ticket.id);

    expect(listChangesOf(harness)).toEqual([{ change: SupportAccessChange.REQUESTED, channel: organizationChannel(CLIENT_ID) }]);
    expect(harness.events.map(event => event.channel).filter(channel => !channel.startsWith('user:'))).toEqual([
      organizationChannel(CLIENT_ID),
    ]);
  });
});

describe('support access notices', () => {
  const listApprovers = (harness: ModuleHarnessValue, organizationId: string): string[] =>
    harness.state.read.listBy('memberships', 'organizationId', organizationId)
      .filter(membership => membership.roleAssignments.some(assignment => assignment.warehouseIds.length === 0
        && harness.state.read.get('roles', assignment.roleId)?.permissions.includes('support_access_approve') === true))
      .map(membership => membership.userId)
      .sort();

  const addNoiseMembers = async (harness: ModuleHarnessValue): Promise<string[]> => {
    const orgWide = await addTestMember(harness, { organizationId: CLIENT_ID, permissions: ['support_access_approve'], warehouseIds: [] });
    await addTestMember(harness, { organizationId: CLIENT_ID, permissions: ['support_access_approve'], warehouseIds: ['w-1'] });
    await addTestMember(harness, { organizationId: CLIENT_ID, permissions: ['support_access_view'], warehouseIds: [] });

    return [orgWide];
  };

  it('sends the request as IMPORTANT to every member who can approve and to nobody else', async () => {
    const harness = createModuleHarness();
    const extra = await addNoiseMembers(harness);
    const ticket = await createTicketNumber(harness);
    const session = await requestAccess(harness, ticket.id);

    const sent = listNoticesOfKind(harness, NotificationKind.SUPPORT_ACCESS_REQUESTED);
    const expected = listApprovers(harness, CLIENT_ID);

    expect(expected.length).toBeGreaterThan(0);
    expect(expected).toEqual(expect.arrayContaining(extra));
    expect(harness.state.read.listBy('memberships', 'organizationId', CLIENT_ID).length).toBeGreaterThan(expected.length);
    expect(sent.map(record => record.userId).sort()).toEqual(expected);

    for (const { notification } of sent) {
      expect(notification.importance).toBe(NotificationImportance.IMPORTANT);
      expect(notification.organizationId).toBe(CLIENT_ID);
      expect(notification.links).toEqual([]);
      expect(notification.params.case).toBe('supportAccess');
      expect(notification.params.case === 'supportAccess' && {
        expiresAt: notification.params.value.expiresAt,
        sessionId: notification.params.value.sessionId,
        staffDisplayName: notification.params.value.staffDisplayName,
        ticketNumber: notification.params.value.ticketNumber,
      }).toEqual({
        expiresAt: undefined,
        sessionId: session.id,
        staffDisplayName: 'Илья Г.',
        ticketNumber: ticket.number,
      });
    }
  });

  it('sends the emergency start as CRITICAL with the end time to the same set of members', async () => {
    const harness = createModuleHarness();
    await addNoiseMembers(harness);

    const session = await startEmergency(harness);
    const sent = listNoticesOfKind(harness, NotificationKind.SUPPORT_EMERGENCY_ACCESS_STARTED);

    expect(sent.map(record => record.userId).sort()).toEqual(listApprovers(harness, CLIENT_ID));
    expect(listApprovers(harness, OTHER_CLIENT_ID).some(userId => sent.some(record => record.userId === userId))).toBe(false);

    for (const { notification } of sent) {
      expect(notification.importance).toBe(NotificationImportance.CRITICAL);
      expect(notification.organizationId).toBe(CLIENT_ID);
      expect(notification.params.case === 'supportAccess' && toMs(notification.params.value.expiresAt)).toBe(toMs(session.expiresAt));
      expect(notification.params.case === 'supportAccess' && notification.params.value.sessionId).toBe(session.id);
    }
  });

  it('sends nothing on the ordinary start and end of a session', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, { id: createSessionId(1) });

    await harness.supportAccess.approveSupportAccess(sessionBody(session.id, 1, 3), CLIENT.admin);
    await harness.supportAccess.endSupportAccess(sessionBody(session.id, 2, 4), CLIENT.admin);

    expect(listNoticesOfKind(harness, NotificationKind.SUPPORT_ACCESS_REQUESTED)).toEqual([]);
    expect(listNoticesOfKind(harness, NotificationKind.SUPPORT_EMERGENCY_ACCESS_STARTED)).toEqual([]);
  });
});

describe('StartEmergencySupportAccess', () => {
  it('starts an active emergency session at once with a pending review and the end time', async () => {
    const harness = createModuleHarness();

    const session = await startEmergency(harness);

    expect(session).toMatchObject({
      emergencyReason: SupportEmergencyReason.SECURITY_INCIDENT,
      emergencyReview: SupportEmergencyReview.PENDING,
      kind: SupportAccessKind.EMERGENCY,
      organizationId: CLIENT_ID,
      staffDisplayName: 'Олег Б.',
      status: SupportAccessStatus.ACTIVE,
      ticketNumber: 0,
      version: 1,
    });
    expect(toMs(session.requestedAt)).toBe(SEED_WORLD_START_MS);
    expect(toMs(session.startedAt)).toBe(SEED_WORLD_START_MS);
    expect(toMs(session.expiresAt)).toBe(SEED_WORLD_START_MS + 30 * MINUTE_MS);
    expect(session.endedAt).toBeUndefined();
  });

  it('answers permission_denied naming support_emergency_manage to the engineer', async () => {
    const harness = createModuleHarness();

    expect(await readDeniedPermission(startEmergency(harness, { options: STAFF.engineer }))).toBe('support_emergency_manage');
    expect(harness.state.read.list('supportAccessSessions')).toEqual([]);
  });

  it('refuses the edit mode without support_settings_edit and allows it to the super administrator', async () => {
    const harness = createModuleHarness();
    const operatorId = OPERATOR_ID;
    const managerId = await addTestMember(harness, {
      organizationId: operatorId,
      permissions: ['support_emergency_manage'],
      warehouseIds: [],
    });

    expect(await readDeniedPermission(
      startEmergency(harness, { key: createKey(21), mode: SupportAccessMode.EDIT, options: callAs(managerId, operatorId) }),
    )).toBe('support_settings_edit');
    expect((await startEmergency(harness, { key: createKey(22), mode: SupportAccessMode.EDIT })).mode).toBe(SupportAccessMode.EDIT);
  });

  it('checks the organization and the optional ticket like the request does', async () => {
    const harness = createModuleHarness();
    const own = await createTicketNumber(harness);
    const foreign = await createTicketNumber(harness, CLIENT.otherAdmin);

    expect(await readNotFoundEntity(startEmergency(harness, { organizationId: MISSING_ID }))).toBe(EntityKind.ORGANIZATION);
    expect(await readNotFoundEntity(startEmergency(harness, { ticketId: foreign.id }))).toBe(EntityKind.SUPPORT_TICKET);
    expect((await startEmergency(harness, { ticketId: own.id })).ticketNumber).toBe(own.number);
  });

  it('writes SESSION_STARTED_EMERGENCY and publishes STARTED only to the organization channel', async () => {
    const harness = createModuleHarness();

    const session = await startEmergency(harness);

    const [entry] = harness.state.read.list('supportAuditEntries');

    expect(harness.state.read.list('supportAuditEntries')).toHaveLength(1);
    expect(entry).toMatchObject({
      action: SupportAuditAction.SESSION_STARTED_EMERGENCY,
      actorUserId: session.staffUserId,
      method: '',
      permission: '',
      sessionId: session.id,
    });
    expect(listChangesOf(harness)).toEqual([{ change: SupportAccessChange.STARTED, channel: organizationChannel(CLIENT_ID) }]);
  });

  it('answers a repeated key with the same session and no second record', async () => {
    const harness = createModuleHarness();

    const first = await startEmergency(harness);
    harness.events.length = 0;
    const second = await startEmergency(harness);

    expect(second).toEqual(first);
    expect(harness.state.read.list('supportAccessSessions')).toHaveLength(1);
    expect(harness.state.read.list('supportAuditEntries')).toHaveLength(1);
    expect(harness.events).toEqual([]);
  });
});

describe('client decisions', () => {
  it('approves a request: active, the end time from the duration, the approver, an entry and a STARTED event', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, { id: createSessionId(1) });
    harness.events.length = 0;

    const response = await harness.supportAccess.approveSupportAccess(sessionBody(session.id, 1, 5), CLIENT.admin);

    expect(response.session).toMatchObject({ approvedByUserId: CLIENT_USER_ID, status: SupportAccessStatus.ACTIVE, version: 2 });
    expect(toMs(response.session?.startedAt)).toBe(SEED_WORLD_START_MS);
    expect(toMs(response.session?.expiresAt)).toBe(SEED_WORLD_START_MS + 30 * MINUTE_MS);
    expect(response.session?.endedAt).toBeUndefined();
    expect(await readEntries(harness)).toEqual([{
      action: SupportAuditAction.SESSION_APPROVED,
      actorUserId: CLIENT_USER_ID,
      closeReason: SupportAccessCloseReason.UNSPECIFIED,
      method: '',
      outcome: SupportAuditOutcome.ALLOWED,
      permission: '',
    }]);
    expect(listChangesOf(harness)).toEqual([{ change: SupportAccessChange.STARTED, channel: organizationChannel(CLIENT_ID) }]);
  });

  it('declines a request: declined with the end time and an ENDED event', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, { id: createSessionId(1) });
    harness.events.length = 0;

    const response = await harness.supportAccess.declineSupportAccess(sessionBody(session.id, 1, 5), CLIENT.admin);

    expect(response.session).toMatchObject({ status: SupportAccessStatus.DECLINED, version: 2 });
    expect(toMs(response.session?.endedAt)).toBe(SEED_WORLD_START_MS);
    expect((await readEntries(harness)).map(entry => entry.action)).toEqual([SupportAuditAction.SESSION_DECLINED]);
    expect(listChangesOf(harness)).toEqual([{ change: SupportAccessChange.ENDED, channel: organizationChannel(CLIENT_ID) }]);
  });

  it('ends an active session: closed by the client with the end time and an ENDED event', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, {
      expiresAtMs: SEED_WORLD_START_MS + MINUTE_MS,
      id: createSessionId(1),
      status: SupportAccessStatus.ACTIVE,
    });
    harness.events.length = 0;

    const response = await harness.supportAccess.endSupportAccess(sessionBody(session.id, 1, 5), CLIENT.admin);

    expect(response.session).toMatchObject({
      closeReason: SupportAccessCloseReason.ENDED_BY_CLIENT,
      status: SupportAccessStatus.CLOSED,
      version: 2,
    });
    expect(toMs(response.session?.endedAt)).toBe(SEED_WORLD_START_MS);
    expect((await readEntries(harness))[0]).toMatchObject({
      action: SupportAuditAction.SESSION_CLOSED,
      closeReason: SupportAccessCloseReason.ENDED_BY_CLIENT,
    });
    expect(listChangesOf(harness)).toEqual([{ change: SupportAccessChange.ENDED, channel: organizationChannel(CLIENT_ID) }]);
  });

  it('answers permission_denied naming support_access_approve to a storekeeper of the client', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, { id: createSessionId(1) });
    const body = { expectedVersion: 1, idempotencyKey: createKey(5), sessionId: session.id };

    expect(await readDeniedPermission(harness.supportAccess.approveSupportAccess(body, CLIENT.storekeeper))).toBe('support_access_approve');
    expect(await readDeniedPermission(harness.supportAccess.declineSupportAccess(body, CLIENT.storekeeper))).toBe('support_access_approve');
    expect(await readDeniedPermission(harness.supportAccess.endSupportAccess(body, CLIENT.storekeeper))).toBe('support_access_approve');
    expect(harness.state.read.get('supportAccessSessions', session.id)?.status).toBe(SupportAccessStatus.REQUESTED);
  });

  it('answers not_found for a session of another organization or an unknown one without touching it', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, { id: createSessionId(1) });
    const body = { expectedVersion: 1, idempotencyKey: createKey(5), sessionId: session.id };

    expect(await readNotFoundEntity(harness.supportAccess.approveSupportAccess(body, CLIENT.otherAdmin))).toBe(SESSION_ENTITY);
    expect(await readNotFoundEntity(harness.supportAccess.declineSupportAccess(body, CLIENT.otherAdmin))).toBe(SESSION_ENTITY);
    expect(await readNotFoundEntity(harness.supportAccess.endSupportAccess(body, CLIENT.otherAdmin))).toBe(SESSION_ENTITY);
    expect(await readNotFoundEntity(
      harness.supportAccess.approveSupportAccess({ ...body, sessionId: MISSING_ID }, CLIENT.admin),
    )).toBe(EntityKind.SUPPORT_ACCESS_SESSION);
    expect(harness.state.read.get('supportAccessSessions', session.id)).toEqual(session);
  });

  it('answers version_conflict with the current version and keeps the session', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, { id: createSessionId(1) });

    const detail = readErrorDetail(await captureError(
      harness.supportAccess.approveSupportAccess(sessionBody(session.id, 2, 5), CLIENT.admin),
    ));

    expect(detail.code).toBe(ErrorCode.VERSION_CONFLICT);
    expect(detail.params.case === 'versionConflict' && detail.params.value).toMatchObject({
      currentVersion: 1,
      entity: EntityKind.SUPPORT_ACCESS_SESSION,
    });
    expect(harness.state.read.get('supportAccessSessions', session.id)).toEqual(session);
    expect(harness.state.read.list('supportAuditEntries')).toEqual([]);
  });

  it('answers invalid_transition with the status and the target and checks the version first', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, {
      expiresAtMs: SEED_WORLD_START_MS + MINUTE_MS,
      id: createSessionId(1),
      status: SupportAccessStatus.ACTIVE,
    });

    const detail = readErrorDetail(await captureError(
      harness.supportAccess.approveSupportAccess(sessionBody(session.id, 1, 5), CLIENT.admin),
    ));
    const staleDetail = readErrorDetail(await captureError(
      harness.supportAccess.approveSupportAccess(sessionBody(session.id, 7, 6), CLIENT.admin),
    ));

    expect(detail.code).toBe(ErrorCode.INVALID_TRANSITION);
    expect(detail.params.case === 'invalidTransition' && detail.params.value).toMatchObject({
      entity: EntityKind.SUPPORT_ACCESS_SESSION,
      fromStatus: 'ACTIVE',
      toStatus: 'ACTIVE',
    });
    expect(staleDetail.code).toBe(ErrorCode.VERSION_CONFLICT);
  });

  it('answers a repeated key with the first response, even after the session has moved on', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, { id: createSessionId(1) });
    const body = { expectedVersion: 1, idempotencyKey: createKey(5), sessionId: session.id };

    const first = await harness.supportAccess.approveSupportAccess(body, CLIENT.admin);
    await harness.supportAccess.endSupportAccess(sessionBody(session.id, 2, 6), CLIENT.admin);
    harness.events.length = 0;
    const second = await harness.supportAccess.approveSupportAccess(body, CLIENT.admin);

    expect(second.session).toEqual(first.session);
    expect(harness.state.read.list('supportAuditEntries')).toHaveLength(2);
    expect(harness.events).toEqual([]);
  });
});

describe('CloseSupportAccess', () => {
  it('cancels the own request: cancelled by the support with the end time and an entry', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, { id: createSessionId(1) });
    harness.events.length = 0;

    const response = await harness.supportAccess.closeSupportAccess(sessionBody(session.id, 1, 7), STAFF.engineer);

    expect(response.session).toMatchObject({
      closeReason: SupportAccessCloseReason.CLOSED_BY_SUPPORT,
      status: SupportAccessStatus.CANCELLED,
      version: 2,
    });
    expect(toMs(response.session?.endedAt)).toBe(SEED_WORLD_START_MS);
    expect(await readEntries(harness)).toEqual([{
      action: SupportAuditAction.SESSION_CANCELLED,
      actorUserId: session.staffUserId,
      closeReason: SupportAccessCloseReason.CLOSED_BY_SUPPORT,
      method: '',
      outcome: SupportAuditOutcome.ALLOWED,
      permission: '',
    }]);
    expect(listChangesOf(harness)).toEqual([{ change: SupportAccessChange.ENDED, channel: organizationChannel(CLIENT_ID) }]);
  });

  it('closes the own active session', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, {
      expiresAtMs: SEED_WORLD_START_MS + MINUTE_MS,
      id: createSessionId(1),
      status: SupportAccessStatus.ACTIVE,
    });

    const response = await harness.supportAccess.closeSupportAccess(sessionBody(session.id, 1, 7), STAFF.engineer);

    expect(response.session).toMatchObject({
      closeReason: SupportAccessCloseReason.CLOSED_BY_SUPPORT,
      status: SupportAccessStatus.CLOSED,
    });
    expect((await readEntries(harness))[0]?.action).toBe(SupportAuditAction.SESSION_CLOSED);
  });

  it('lets the super administrator close a session of a colleague with the reason CLOSED_BY_SUPER_ADMIN', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, {
      expiresAtMs: SEED_WORLD_START_MS + MINUTE_MS,
      id: createSessionId(1),
      status: SupportAccessStatus.ACTIVE,
    });

    const response = await harness.supportAccess.closeSupportAccess(sessionBody(session.id, 1, 7), STAFF.superAdmin);

    expect(response.session).toMatchObject({
      closeReason: SupportAccessCloseReason.CLOSED_BY_SUPER_ADMIN,
      status: SupportAccessStatus.CLOSED,
    });
    expect((await readEntries(harness))[0]).toMatchObject({
      actorUserId: STAFF_ID.superAdmin,
      closeReason: SupportAccessCloseReason.CLOSED_BY_SUPER_ADMIN,
    });
  });

  it('refuses a colleague session to the engineer and closes the own one of the super administrator as support', async () => {
    const harness = createModuleHarness();
    const foreign = await putSession(harness, {
      id: createSessionId(1),
      staffUserId: STAFF_ID.superAdminOther,
    });
    const own = await putSession(harness, {
      id: createSessionId(2),
      staffUserId: STAFF_ID.superAdmin,
    });

    const refused = harness.supportAccess.closeSupportAccess(sessionBody(foreign.id, 1, 7), STAFF.engineer);

    expect(await readDeniedPermission(refused)).toBe('support_emergency_manage');
    const closed = await harness.supportAccess.closeSupportAccess(sessionBody(own.id, 1, 8), STAFF.superAdmin);

    expect(closed.session?.closeReason).toBe(SupportAccessCloseReason.CLOSED_BY_SUPPORT);
    expect(harness.state.read.get('supportAccessSessions', foreign.id)?.status).toBe(SupportAccessStatus.REQUESTED);
  });

  it('answers not_found for an unknown session and permission_denied to an agent and a client member', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, { id: createSessionId(1) });
    const body = { expectedVersion: 1, idempotencyKey: createKey(7), sessionId: session.id };

    expect(await readNotFoundEntity(
      harness.supportAccess.closeSupportAccess({ ...body, sessionId: MISSING_ID }, STAFF.engineer),
    )).toBe(EntityKind.SUPPORT_ACCESS_SESSION);
    expect(await readDeniedPermission(harness.supportAccess.closeSupportAccess(body, STAFF.agent))).toBe('support_session_create');
    expect(await readDeniedPermission(harness.supportAccess.closeSupportAccess(body, CLIENT.admin))).toBe('support_session_create');
  });

  it('answers version_conflict and invalid_transition for a stale version and a finished session', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, { id: createSessionId(1) });
    const body = { expectedVersion: 1, idempotencyKey: createKey(7), sessionId: session.id };

    expect(await readErrorCode(harness.supportAccess.closeSupportAccess({ ...body, expectedVersion: 3 }, STAFF.engineer)))
      .toBe(ErrorCode.VERSION_CONFLICT);

    await harness.supportAccess.closeSupportAccess(body, STAFF.engineer);

    const repeated = harness.supportAccess.closeSupportAccess(sessionBody(session.id, 2, 8), STAFF.engineer);

    expect(await readErrorCode(repeated)).toBe(ErrorCode.INVALID_TRANSITION);
  });
});

describe('every session command against every status', () => {
  const CLOSED_BY = SupportAccessCloseReason;
  const STATUS = SupportAccessStatus;

  interface CommandRowValue {
    call: (harness: ModuleHarnessValue, sessionId: string) => Promise<{ session?: SupportAccessSession | undefined }>;
    name: string;
    outcomes: Readonly<Partial<Record<SupportAccessStatus, [SupportAccessStatus, SupportAccessCloseReason]>>>;
  }

  const body = (sessionId: string): { expectedVersion: number; idempotencyKey: string; sessionId: string } =>
    ({ expectedVersion: 1, idempotencyKey: createKey(30), sessionId });

  const ROWS: readonly CommandRowValue[] = [
    {
      call: (harness, id) => harness.supportAccess.approveSupportAccess(body(id), CLIENT.admin),
      name: 'approve',
      outcomes: { [STATUS.REQUESTED]: [STATUS.ACTIVE, CLOSED_BY.UNSPECIFIED] },
    },
    {
      call: (harness, id) => harness.supportAccess.declineSupportAccess(body(id), CLIENT.admin),
      name: 'decline',
      outcomes: { [STATUS.REQUESTED]: [STATUS.DECLINED, CLOSED_BY.UNSPECIFIED] },
    },
    {
      call: (harness, id) => harness.supportAccess.endSupportAccess(body(id), CLIENT.admin),
      name: 'end',
      outcomes: { [STATUS.ACTIVE]: [STATUS.CLOSED, CLOSED_BY.ENDED_BY_CLIENT] },
    },
    {
      call: (harness, id) => harness.supportAccess.closeSupportAccess(body(id), STAFF.engineer),
      name: 'close by the owner',
      outcomes: {
        [STATUS.ACTIVE]: [STATUS.CLOSED, CLOSED_BY.CLOSED_BY_SUPPORT],
        [STATUS.REQUESTED]: [STATUS.CANCELLED, CLOSED_BY.CLOSED_BY_SUPPORT],
      },
    },
    {
      call: (harness, id) => harness.supportAccess.closeSupportAccess(body(id), STAFF.superAdmin),
      name: 'close by the super administrator',
      outcomes: {
        [STATUS.ACTIVE]: [STATUS.CLOSED, CLOSED_BY.CLOSED_BY_SUPER_ADMIN],
        [STATUS.REQUESTED]: [STATUS.CANCELLED, CLOSED_BY.CLOSED_BY_SUPER_ADMIN],
      },
    },
  ];

  const STATUSES: readonly SupportAccessStatus[] = [STATUS.REQUESTED, STATUS.ACTIVE, STATUS.DECLINED, STATUS.CANCELLED, STATUS.CLOSED];

  const CASES = ROWS.flatMap(row => STATUSES.map(status => ({ row, status })));

  it.each(CASES)('$row.name from status $status', async ({ row, status }) => {
    const harness = createModuleHarness();
    const session = await putSession(harness, {
      expiresAtMs: SEED_WORLD_START_MS + MINUTE_MS,
      id: createSessionId(1),
      status,
    });
    const outcome = row.outcomes[status];

    if (outcome === undefined) {
      expect(await readErrorCode(row.call(harness, session.id))).toBe(ErrorCode.INVALID_TRANSITION);
      expect(harness.state.read.get('supportAccessSessions', session.id)).toEqual(session);
      expect(harness.state.read.list('supportAuditEntries')).toEqual([]);

      return;
    }

    const response = await row.call(harness, session.id);

    expect([response.session?.status, response.session?.closeReason]).toEqual(outcome);
    expect(response.session?.version).toBe(2);
    expect(harness.state.read.get('supportAccessSessions', session.id)).toEqual(response.session);
    expect(harness.state.read.list('supportAuditEntries')).toHaveLength(1);
  });

  it('closes a requested session on the first run of the expiry task and ignores it afterwards', async () => {
    const harness = createModuleHarness();
    const task = createSupportAccessExpiryTask(harness.runtime);
    const session = await putSession(harness, { id: createSessionId(1), requestedAtMs: SEED_WORLD_START_MS - 61 * MINUTE_MS });

    await runTask(harness, task);
    await runTask(harness, task);

    expect(harness.state.read.get('supportAccessSessions', session.id)).toMatchObject({
      closeReason: CLOSED_BY.EXPIRED,
      status: STATUS.CANCELLED,
      version: 2,
    });
    expect(harness.state.read.list('supportAuditEntries')).toHaveLength(1);
  });
});

describe('client lists', () => {
  it('shows only the sessions of the own organization, the newest first, with ties in reverse order of creation', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicketNumber(harness);
    const foreignTicket = await createTicketNumber(harness, CLIENT.otherAdmin);

    const first = await requestAccess(harness, ticket.id, { key: createKey(41) });
    const second = await requestAccess(harness, ticket.id, { key: createKey(42) });
    const third = await requestAccess(harness, ticket.id, { key: createKey(43) });
    await requestAccess(harness, foreignTicket.id, { key: createKey(44), organizationId: OTHER_CLIENT_ID });
    const old = await putSession(harness, { id: createSessionId(1), requestedAtMs: SEED_WORLD_START_MS - MINUTE_MS });

    const ownList = await harness.supportAccess.listSupportAccessSessions({}, CLIENT.admin);
    const foreignList = await harness.supportAccess.listSupportAccessSessions({}, CLIENT.otherAdmin);

    expect(ownList.sessions.map(session => session.id)).toEqual([third.id, second.id, first.id, old.id]);
    expect(foreignList.sessions).toHaveLength(1);
    expect(foreignList.sessions.every(session => session.organizationId === OTHER_CLIENT_ID)).toBe(true);
  });

  it('pages the sessions with the token of the last item', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicketNumber(harness);

    for (let index = 0; index < 3; index += 1) {
      await requestAccess(harness, ticket.id, { key: createKey(50 + index) });
    }

    const firstPage = await harness.supportAccess.listSupportAccessSessions({ page: { pageSize: 2 } }, CLIENT.admin);
    const secondPage = await harness.supportAccess.listSupportAccessSessions(
      { page: { pageSize: 2, pageToken: firstPage.page?.nextPageToken ?? '' } },
      CLIENT.admin,
    );

    expect(firstPage.sessions).toHaveLength(2);
    expect(firstPage.page?.nextPageToken).toBe(firstPage.sessions.at(-1)?.id);
    expect(secondPage.sessions).toHaveLength(1);
    expect(secondPage.page?.nextPageToken).toBe('');
  });

  it('answers permission_denied naming support_access_view to a member without it and to the support staff', async () => {
    const harness = createModuleHarness();
    const memberId = await addTestMember(harness, { organizationId: CLIENT_ID, permissions: [], warehouseIds: [] });
    const member = callAs(memberId, CLIENT_ID);

    expect(await readDeniedPermission(harness.supportAccess.listSupportAccessSessions({}, member))).toBe('support_access_view');
    expect(await readDeniedPermission(harness.supportAccess.listSupportAuditEntries({}, member))).toBe('support_access_view');
    expect(await readDeniedPermission(harness.supportAccess.listSupportAccessSessions({}, STAFF.engineer))).toBe('support_access_view');
  });

  it('lists the audit entries of the own organization only, the newest first, ties in reverse order of writing', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicketNumber(harness);
    const foreignTicket = await createTicketNumber(harness, CLIENT.otherAdmin);

    const session = await requestAccess(harness, ticket.id);
    await harness.supportAccess.approveSupportAccess(sessionBody(session.id, 1, 60), CLIENT.admin);
    await harness.supportAccess.endSupportAccess(sessionBody(session.id, 2, 61), CLIENT.admin);
    await requestAccess(harness, foreignTicket.id, { key: createKey(62), organizationId: OTHER_CLIENT_ID });

    const entries = await harness.supportAccess.listSupportAuditEntries({}, CLIENT.admin);

    expect(new Set(entries.entries.map(entry => toMs(entry.occurredAt)))).toEqual(new Set([SEED_WORLD_START_MS]));
    expect(entries.entries.map(entry => entry.action)).toEqual([
      SupportAuditAction.SESSION_CLOSED,
      SupportAuditAction.SESSION_APPROVED,
      SupportAuditAction.SESSION_REQUESTED,
    ]);
    expect(entries.entries.every(entry => entry.organizationId === CLIENT_ID)).toBe(true);
    expect((await harness.supportAccess.listSupportAuditEntries({}, CLIENT.otherAdmin)).entries).toHaveLength(1);
  });

  it('filters the entries by the session and shows nothing for a session of another organization', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicketNumber(harness);
    const foreignTicket = await createTicketNumber(harness, CLIENT.otherAdmin);

    const first = await requestAccess(harness, ticket.id, { key: createKey(70) });
    const second = await requestAccess(harness, ticket.id, { key: createKey(71) });
    const foreign = await requestAccess(harness, foreignTicket.id, { key: createKey(72), organizationId: OTHER_CLIENT_ID });
    await harness.supportAccess.declineSupportAccess(sessionBody(first.id, 1, 73), CLIENT.admin);

    const ofFirst = await harness.supportAccess.listSupportAuditEntries({ sessionId: first.id }, CLIENT.admin);
    const ofSecond = await harness.supportAccess.listSupportAuditEntries({ sessionId: second.id }, CLIENT.admin);
    const ofForeign = await harness.supportAccess.listSupportAuditEntries({ sessionId: foreign.id }, CLIENT.admin);
    const all = await harness.supportAccess.listSupportAuditEntries({}, CLIENT.admin);

    expect(ofFirst.entries.map(entry => entry.action)).toEqual([SupportAuditAction.SESSION_DECLINED, SupportAuditAction.SESSION_REQUESTED]);
    expect(ofSecond.entries.map(entry => entry.action)).toEqual([SupportAuditAction.SESSION_REQUESTED]);
    expect(ofForeign.entries).toEqual([]);
    expect(all.entries).toHaveLength(3);
  });

  it('writes one entry for every transition of a whole life of a session with the right actor and reason', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicketNumber(harness);
    const engineerId = STAFF_ID.engineer;
    const adminId = CLIENT_USER_ID;

    const session = await requestAccess(harness, ticket.id);
    await harness.supportAccess.approveSupportAccess(sessionBody(session.id, 1, 80), CLIENT.admin);
    await harness.supportAccess.closeSupportAccess(sessionBody(session.id, 2, 81), STAFF.engineer);

    expect(await readEntries(harness, session.id)).toEqual([
      {
        action: SupportAuditAction.SESSION_CLOSED,
        actorUserId: engineerId,
        closeReason: SupportAccessCloseReason.CLOSED_BY_SUPPORT,
        method: '',
        outcome: SupportAuditOutcome.ALLOWED,
        permission: '',
      },
      {
        action: SupportAuditAction.SESSION_APPROVED,
        actorUserId: adminId,
        closeReason: SupportAccessCloseReason.UNSPECIFIED,
        method: '',
        outcome: SupportAuditOutcome.ALLOWED,
        permission: '',
      },
      {
        action: SupportAuditAction.SESSION_REQUESTED,
        actorUserId: engineerId,
        closeReason: SupportAccessCloseReason.UNSPECIFIED,
        method: '',
        outcome: SupportAuditOutcome.ALLOWED,
        permission: '',
      },
    ]);
  });
});
