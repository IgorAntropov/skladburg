import type { Event } from '@skladburg/contracts/event/v1/event';

import { create } from '@bufbuild/protobuf';
import {
  timestampFromMs,
  timestampMs,
} from '@bufbuild/protobuf/wkt';
import { MembershipSchema } from '@skladburg/contracts/access/v1/access';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  SUPPORT_SESSION_HEADER,
  userChannel,
} from '@skladburg/contracts/runtime';
import {
  SupportAccessMode,
  SupportAccessSection,
  SupportAccessStatus,
} from '@skladburg/contracts/support/v1/support_access';
import {
  DeviceFormFactor,
  SupportMessageAuthorKind,
  type SupportTicket,
  SupportTicketCategory,
  SupportTicketChannel,
  SupportTicketMessageSchema,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@skladburg/contracts/support/v1/support_ticket';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ModuleHarnessValue } from '../testing/moduleHarness';

import {
  SEED_WORLD_START_MS,
  SeedOrganizationId,
  SeedRoleId,
  SeedUserId,
} from '../../seed/index';
import { createTestSupportAccessSession } from '../../state/testRecords';
import {
  addTestMember,
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';
import {
  createSupportContext,
  createSupportErrorRef,
  createTraceId,
  FIRST_KEY,
} from './testing/supportFixtures';

const HOUR_MS = 3_600_000;
const MISSING_TICKET_ID = 'e0000000-0000-4000-8000-000000000001';
const AUTHOR = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
const OTHER_ORGANIZATION_MEMBER = callAs(SeedUserId.ADMIN_5, SeedOrganizationId.CUSTOMER_2);

const createTicket = async (
  harness: ModuleHarnessValue,
  key: string = FIRST_KEY,
  category: SupportTicketCategory = SupportTicketCategory.GENERAL,
): Promise<SupportTicket> => {
  const response = await harness.supportTicket.createSupportTicket(
    { category, context: createSupportContext(), idempotencyKey: key },
    AUTHOR,
  );

  if (response.ticket === undefined) {
    throw new Error('The response carries no ticket');
  }

  return response.ticket;
};

const readNotFoundEntity = async (call: Promise<unknown>): Promise<EntityKind | undefined> => {
  const { params } = readErrorDetail(await captureError(call));

  return params.case === 'notFound' ? params.value.entity : undefined;
};

const readViolationPaths = async (call: Promise<unknown>): Promise<string[]> => {
  const detail = readErrorDetail(await captureError(call));

  expect(detail.code).toBe(ErrorCode.VALIDATION_FAILED);

  return detail.params.case === 'validationFailed' ? detail.params.value.violations.map(violation => violation.fieldPath) : [];
};

const addMembershipTo = (harness: ModuleHarnessValue, userId: string, organizationId: string): Promise<void> =>
  harness.runtime.command((transaction) => {
    transaction.put('memberships', create(MembershipSchema, {
      id: 'c0000000-0000-4000-8000-000000000001',
      organizationId,
      roleAssignments: [],
      userId,
    }));
  });

const nextKey = (index: number): string => `3f2b8c1e-5a47-4d9b-8e21-${String(index).padStart(12, '0')}`;

describe('CreateSupportTicket', () => {
  it('numbers the tickets from 1001 and grows by one', async () => {
    const harness = createModuleHarness();

    const first = await createTicket(harness, nextKey(1));
    const second = await createTicket(harness, nextKey(2));
    const other = await harness.supportTicket.createSupportTicket(
      { category: SupportTicketCategory.ERROR, context: createSupportContext(), idempotencyKey: nextKey(3) },
      OTHER_ORGANIZATION_MEMBER,
    );

    expect([first.number, second.number, other.ticket?.number]).toEqual([1001, 1002, 1003]);
  });

  it.each([
    [SupportTicketCategory.GENERAL, SupportTicketPriority.NORMAL, 8 * HOUR_MS],
    [SupportTicketCategory.ERROR, SupportTicketPriority.NORMAL, 8 * HOUR_MS],
    [SupportTicketCategory.MONEY, SupportTicketPriority.URGENT, HOUR_MS],
    [SupportTicketCategory.RECEIVING_BLOCKED, SupportTicketPriority.URGENT, HOUR_MS],
  ])('sets the priority and the response deadline for category %s', async (category, priority, windowMs) => {
    const harness = createModuleHarness();

    const ticket = await createTicket(harness, FIRST_KEY, category);

    expect(ticket.category).toBe(category);
    expect(ticket.priority).toBe(priority);
    expect(ticket.createdAt === undefined ? undefined : timestampMs(ticket.createdAt)).toBe(SEED_WORLD_START_MS);
    expect(ticket.responseDueAt === undefined ? undefined : timestampMs(ticket.responseDueAt)).toBe(SEED_WORLD_START_MS + windowMs);
  });

  it('fills the ticket from the caller, the membership and the context and writes no message', async () => {
    const harness = createModuleHarness();
    const context = createSupportContext({
      errors: [createSupportErrorRef(createTraceId(1), SEED_WORLD_START_MS - 5_000)],
      screenPath: '/warehouses/42',
    });

    const response = await harness.supportTicket.createSupportTicket(
      { category: SupportTicketCategory.ERROR, context, idempotencyKey: FIRST_KEY },
      AUTHOR,
    );
    const ticket = response.ticket;
    const detail = await harness.supportTicket.getSupportTicket({ ticketId: ticket?.id ?? '' }, AUTHOR);

    expect(ticket?.authorUserId).toBe(SeedUserId.ADMIN_1);
    expect(ticket?.organizationId).toBe(SeedOrganizationId.CUSTOMER_1);
    expect(ticket?.channel).toBe(SupportTicketChannel.ASSISTANT);
    expect(ticket?.status).toBe(SupportTicketStatus.OPEN);
    expect(ticket?.context?.screenPath).toBe('/warehouses/42');
    expect(ticket?.context?.errors.map(error => error.traceId)).toEqual([createTraceId(1)]);
    expect(ticket?.context?.device?.formFactor).toBe(DeviceFormFactor.DESKTOP);
    expect(detail.ticket).toEqual(ticket);
    expect(detail.messages).toEqual([]);
    expect(harness.state.read.list('supportTicketMessages')).toEqual([]);
  });

  it('copies the role ids of the membership, unique and sorted', async () => {
    const harness = createModuleHarness();
    const membership = harness.state.read.listBy('memberships', 'userId', SeedUserId.ADMIN_1)
      .find(candidate => candidate.organizationId === SeedOrganizationId.CUSTOMER_1);

    expect(membership).toBeDefined();

    await harness.runtime.command((transaction) => {
      transaction.put('memberships', create(MembershipSchema, {
        id: membership?.id ?? '',
        organizationId: SeedOrganizationId.CUSTOMER_1,
        roleAssignments: [
          { roleId: SeedRoleId.STOREKEEPER_CUSTOMER_1, warehouseIds: [] },
          { roleId: SeedRoleId.DIRECTOR_CUSTOMER_1, warehouseIds: [] },
          { roleId: SeedRoleId.STOREKEEPER_CUSTOMER_1, warehouseIds: ['w-1'] },
        ],
        userId: SeedUserId.ADMIN_1,
      }));
    });

    const ticket = await createTicket(harness);

    expect(ticket.authorRoleIds).toEqual([SeedRoleId.DIRECTOR_CUSTOMER_1, SeedRoleId.STOREKEEPER_CUSTOMER_1].sort());
  });

  it('takes the roles of the acting organization only', async () => {
    const harness = createModuleHarness();

    const ticket = await createTicket(harness);
    const roles = harness.state.read.listBy('memberships', 'userId', SeedUserId.ADMIN_1)
      .filter(membership => membership.organizationId === SeedOrganizationId.CUSTOMER_1)
      .flatMap(membership => membership.roleAssignments.map(assignment => assignment.roleId));

    expect(ticket.authorRoleIds).toEqual([...new Set(roles)].sort());
  });

  it('puts the ticket to the bot queue with the delay and tells only the author', async () => {
    const harness = createModuleHarness();

    const ticket = await createTicket(harness);
    const queued = harness.state.read.get('supportBotQueue', ticket.id);
    const channels = harness.events.map(event => event.channel);
    const payloads = harness.events.map((event: Event) => event.payload);

    expect(queued).toEqual({ dueAtMs: SEED_WORLD_START_MS + 4_000, id: ticket.id });
    expect(channels).toEqual([userChannel(SeedUserId.ADMIN_1)]);
    expect(payloads[0]?.case).toBe('supportTicketChanged');
    expect(payloads[0]?.case === 'supportTicketChanged' && payloads[0].value.ticketId).toBe(ticket.id);
  });

  it('answers a repeated idempotency key with the same ticket and stores one', async () => {
    const harness = createModuleHarness();

    const first = await createTicket(harness);
    harness.events.length = 0;
    const repeated = await createTicket(harness);

    expect(repeated).toEqual(first);
    expect(harness.state.read.list('supportTickets')).toHaveLength(1);
    expect(harness.state.read.list('supportBotQueue')).toHaveLength(1);
    expect(harness.events).toEqual([]);
  });

  it('rejects the same key with another request', async () => {
    const harness = createModuleHarness();
    await createTicket(harness);

    const error = await captureError(createTicket(harness, FIRST_KEY, SupportTicketCategory.MONEY));

    expect(readErrorDetail(error).code).toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
    expect(harness.state.read.list('supportTickets')).toHaveLength(1);
  });

  it('keeps the same key of two authors apart', async () => {
    const harness = createModuleHarness();
    await createTicket(harness);

    const other = await harness.supportTicket.createSupportTicket(
      { category: SupportTicketCategory.GENERAL, context: createSupportContext(), idempotencyKey: FIRST_KEY },
      OTHER_ORGANIZATION_MEMBER,
    );

    expect(other.ticket?.authorUserId).toBe(SeedUserId.ADMIN_5);
    expect(harness.state.read.list('supportTickets')).toHaveLength(2);
  });

  describe('context validation', () => {
    const create6Errors = (): ReturnType<typeof createSupportErrorRef>[] =>
      Array.from({ length: 6 }, (_unused, index) => createSupportErrorRef(createTraceId(index), index));

    const createMethodOfLength = (length: number): string => `a.v1.S${'s'.repeat(length - 'a.v1.S/M'.length)}/M`;

    const createErrorWith = (
      overrides: Partial<Pick<ReturnType<typeof createSupportErrorRef>, 'method' | 'traceId'>>,
    ): ReturnType<typeof createSupportErrorRef> => ({ ...createSupportErrorRef(createTraceId(1), 1), ...overrides });

    it.each([
      ['six errors', { errors: create6Errors() }, 'context.errors'],
      ['a path without a slash', { screenPath: 'network' }, 'context.screen_path'],
      ['an empty path', { screenPath: '' }, 'context.screen_path'],
      ['a path with a search string', { screenPath: '/network?inn=7701234567' }, 'context.screen_path'],
      ['a path with an anchor', { screenPath: '/network#top' }, 'context.screen_path'],
      ['a path with a search string and an anchor', { screenPath: '/network?inn=7701234567#top' }, 'context.screen_path'],
      ['an object path with a search string', { screenPath: '/deals/42?tab=documents' }, 'context.screen_path'],
      ['a path with a space', { screenPath: '/deals/4 2' }, 'context.screen_path'],
      ['a path with a line break', { screenPath: '/network\n' }, 'context.screen_path'],
      ['a path with a tab', { screenPath: '/deals/\t42' }, 'context.screen_path'],
      ['a path with a third segment', { screenPath: '/deals/42/extra' }, 'context.screen_path'],
      ['a path with a free text', { screenPath: '/call me on 84951234567' }, 'context.screen_path'],
      ['a path with a section above 32 characters', { screenPath: `/${'a'.repeat(33)}` }, 'context.screen_path'],
      ['a path with an object id above 64 characters', { screenPath: `/deals/${'1'.repeat(65)}` }, 'context.screen_path'],
      ['an empty app version', { appVersion: '' }, 'context.app_version'],
      ['an app version above 64 characters', { appVersion: 'v'.repeat(65) }, 'context.app_version'],
      ['an app version with a space', { appVersion: 'dev build' }, 'context.app_version'],
      ['an app version with a free text', { appVersion: 'Ivan 84951234567' }, 'context.app_version'],
      ['an app version with a line break', { appVersion: 'dev\n' }, 'context.app_version'],
      ['an app version with a pre-release suffix', { appVersion: '1.0.0-rc.1' }, 'context.app_version'],
      ['a trace id above 64 characters', { errors: [createErrorWith({ traceId: 't'.repeat(65) })] }, 'context.errors[0].trace_id'],
      ['a trace id that is not a UUID', { errors: [createErrorWith({ traceId: 'trace-1' })] }, 'context.errors[0].trace_id'],
      [
        'a trace id with a free text',
        { errors: [createErrorWith({ traceId: 'call me 84951234567' })] },
        'context.errors[0].trace_id',
      ],
      [
        'a trace id with a line break',
        { errors: [createErrorWith({ traceId: `${createTraceId(1)}\n` })] },
        'context.errors[0].trace_id',
      ],
      [
        'a method above 160 characters',
        { errors: [createErrorWith({ method: createMethodOfLength(161) })] },
        'context.errors[0].method',
      ],
      [
        'a method that is not a full RPC name',
        { errors: [createErrorWith({ method: 'CreateWarehouse' })] },
        'context.errors[0].method',
      ],
      [
        'a method with a space',
        { errors: [createErrorWith({ method: 'organization.v1.OrganizationService/Create Warehouse' })] },
        'context.errors[0].method',
      ],
      [
        'a method with a free text',
        { errors: [createErrorWith({ method: 'please call me back' })] },
        'context.errors[0].method',
      ],
      [
        'a method placeholder',
        { errors: [createErrorWith({ method: 'unknown' })] },
        'context.errors[0].method',
      ],
      ['no device', { device: undefined }, 'context.device'],
    ])('rejects %s with validation_failed and stores nothing', async (_name, overrides, expectedPath) => {
      const harness = createModuleHarness();
      const call = harness.supportTicket.createSupportTicket(
        { category: SupportTicketCategory.GENERAL, context: createSupportContext(overrides), idempotencyKey: FIRST_KEY },
        AUTHOR,
      );

      expect(await readViolationPaths(call)).toContain(expectedPath);
      expect(harness.state.read.list('supportTickets')).toEqual([]);
      expect(harness.events).toEqual([]);
    });

    it.each([
      ['the home path', { screenPath: '/' }],
      ['a section path', { screenPath: '/warehouse' }],
      ['an object path with a UUID', { screenPath: `/deals/${FIRST_KEY}` }],
      ['an object path with a hyphenated segment', { screenPath: '/handling-units/hu_1-a' }],
      ['the development version', { appVersion: 'dev' }],
      ['a short commit hash', { appVersion: '3f9c2ab' }],
      ['a release version with a build suffix', { appVersion: '1.0.0+3f9c2ab' }],
      ['an error without a trace id', { errors: [createErrorWith({ traceId: '' })] }],
      ['an error without a method', { errors: [createErrorWith({ method: '' })] }],
    ])('accepts %s', async (_name, overrides) => {
      const harness = createModuleHarness();

      const response = await harness.supportTicket.createSupportTicket(
        { category: SupportTicketCategory.GENERAL, context: createSupportContext(overrides), idempotencyKey: FIRST_KEY },
        AUTHOR,
      );

      expect(response.ticket?.context).toEqual(createSupportContext(overrides));
      expect(harness.state.read.list('supportTickets')).toHaveLength(1);
    });

    it('accepts exactly five errors and the longest allowed values', async () => {
      const harness = createModuleHarness();
      const errors = Array.from({ length: 5 }, (_unused, index) => createErrorWith({
        method: createMethodOfLength(160),
        traceId: createTraceId(index),
      }));

      const response = await harness.supportTicket.createSupportTicket({
        category: SupportTicketCategory.ERROR,
        context: createSupportContext({
          appVersion: `9999.9999.9999+${'f'.repeat(40)}`,
          errors,
          screenPath: `/${'a'.repeat(32)}/${'1'.repeat(64)}`,
        }),
        idempotencyKey: FIRST_KEY,
      }, AUTHOR);

      expect(response.ticket?.context?.errors).toHaveLength(5);
    });

    it('rejects an unknown category and a key that is not a UUID', async () => {
      const harness = createModuleHarness();

      const noCategory = harness.supportTicket.createSupportTicket(
        { category: SupportTicketCategory.UNSPECIFIED, context: createSupportContext(), idempotencyKey: FIRST_KEY },
        AUTHOR,
      );
      const badKey = harness.supportTicket.createSupportTicket(
        { category: SupportTicketCategory.GENERAL, context: createSupportContext(), idempotencyKey: 'not-a-uuid' },
        AUTHOR,
      );

      expect(await readViolationPaths(noCategory)).toContain('category');
      expect(await readViolationPaths(badKey)).toContain('idempotency_key');
    });
  });

  describe('membership', () => {
    const request = { category: SupportTicketCategory.GENERAL, context: createSupportContext(), idempotencyKey: FIRST_KEY };

    it('answers membership_required without the organization header', async () => {
      const harness = createModuleHarness();

      const error = await captureError(harness.supportTicket.createSupportTicket(request, callAs(SeedUserId.ADMIN_1)));

      expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
      expect(harness.state.read.list('supportTickets')).toEqual([]);
    });

    it('answers membership_required for an organization the caller does not belong to', async () => {
      const harness = createModuleHarness();

      const error = await captureError(
        harness.supportTicket.createSupportTicket(request, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_2)),
      );

      expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
      expect(harness.state.read.list('supportTickets')).toEqual([]);
      expect(harness.events).toEqual([]);
    });

    it('answers session_required without a user', async () => {
      const harness = createModuleHarness();

      const error = await captureError(
        harness.supportTicket.createSupportTicket(request, callAs(undefined, SeedOrganizationId.CUSTOMER_1)),
      );

      expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
    });

    it('does not let a support staff member with a valid session open a ticket in the client organization', async () => {
      const harness = createModuleHarness();
      const sessionId = 'd0000000-0000-4000-8000-000000000001';

      await harness.runtime.command((transaction) => {
        transaction.put('supportAccessSessions', createTestSupportAccessSession(
          sessionId,
          SeedOrganizationId.CUSTOMER_1,
          SeedUserId.OPERATOR_SUPER_ADMIN_1,
          SupportAccessStatus.ACTIVE,
          { expiresAt: timestampFromMs(SEED_WORLD_START_MS + HOUR_MS), mode: SupportAccessMode.EDIT, section: SupportAccessSection.ALL },
        ));
      });
      const options = callAs(SeedUserId.OPERATOR_SUPER_ADMIN_1, SeedOrganizationId.CUSTOMER_1);
      options.headers = new Headers(options.headers);
      options.headers.set(SUPPORT_SESSION_HEADER, sessionId);

      const created = await captureError(harness.supportTicket.createSupportTicket(request, options));
      const listed = await captureError(harness.supportTicket.listMySupportTickets({}, options));
      const read = await captureError(harness.supportTicket.getSupportTicket({ ticketId: MISSING_TICKET_ID }, options));

      expect([created, listed, read].map(error => readErrorDetail(error).code)).toEqual([
        ErrorCode.MEMBERSHIP_REQUIRED,
        ErrorCode.MEMBERSHIP_REQUIRED,
        ErrorCode.MEMBERSHIP_REQUIRED,
      ]);
      expect(harness.state.read.list('supportTickets')).toEqual([]);
    });
  });
});

describe('GetSupportTicket', () => {
  it('returns the own ticket with its messages', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicket(harness);

    const response = await harness.supportTicket.getSupportTicket({ ticketId: ticket.id }, AUTHOR);

    expect(response.ticket).toEqual(ticket);
  });

  it('orders the messages by time and then by id', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicket(harness);
    const messages = [
      { createdAtMs: 5_000, id: 'b0000000-0000-4000-8000-000000000003' },
      { createdAtMs: 9_000, id: 'b0000000-0000-4000-8000-000000000001' },
      { createdAtMs: 5_000, id: 'b0000000-0000-4000-8000-000000000002' },
    ];

    await harness.runtime.command((transaction) => {
      for (const message of messages) {
        transaction.put('supportTicketMessages', create(SupportTicketMessageSchema, {
          authorKind: SupportMessageAuthorKind.SUPPORT,
          createdAt: timestampFromMs(message.createdAtMs),
          id: message.id,
          ticketId: ticket.id,
        }));
      }
    });

    const response = await harness.supportTicket.getSupportTicket({ ticketId: ticket.id }, AUTHOR);

    expect(response.messages.map(message => message.id)).toEqual([
      'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000003',
      'b0000000-0000-4000-8000-000000000001',
    ]);
  });

  it('answers not_found for a ticket of another user of the same organization', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicket(harness);
    const colleagueId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: [],
      warehouseIds: [],
    });

    const entity = await readNotFoundEntity(
      harness.supportTicket.getSupportTicket({ ticketId: ticket.id }, callAs(colleagueId, SeedOrganizationId.CUSTOMER_1)),
    );

    expect(entity).toBe(EntityKind.SUPPORT_TICKET);
  });

  it('answers not_found for the author acting in another organization he belongs to', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicket(harness);
    await addMembershipTo(harness, SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_2);

    const entity = await readNotFoundEntity(
      harness.supportTicket.getSupportTicket({ ticketId: ticket.id }, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_2)),
    );

    expect(entity).toBe(EntityKind.SUPPORT_TICKET);
  });

  it('answers not_found for a user of another organization and for a missing ticket', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicket(harness);

    const foreign = await readNotFoundEntity(harness.supportTicket.getSupportTicket({ ticketId: ticket.id }, OTHER_ORGANIZATION_MEMBER));
    const missing = await readNotFoundEntity(harness.supportTicket.getSupportTicket({ ticketId: MISSING_TICKET_ID }, AUTHOR));

    expect([foreign, missing]).toEqual([EntityKind.SUPPORT_TICKET, EntityKind.SUPPORT_TICKET]);
  });

  it('answers membership_required before not_found outside the organization', async () => {
    const harness = createModuleHarness();
    const ticket = await createTicket(harness);

    const error = await captureError(
      harness.supportTicket.getSupportTicket({ ticketId: ticket.id }, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_2)),
    );

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('rejects a ticket id that is not a UUID', async () => {
    const harness = createModuleHarness();

    expect(await readViolationPaths(harness.supportTicket.getSupportTicket({ ticketId: 'x' }, AUTHOR))).toContain('ticket_id');
  });
});

describe('ListMySupportTickets', () => {
  it('lists only the own tickets of the acting organization, the newest first', async () => {
    const harness = createModuleHarness();
    const first = await createTicket(harness, nextKey(1));
    const second = await createTicket(harness, nextKey(2));
    await harness.supportTicket.createSupportTicket(
      { category: SupportTicketCategory.GENERAL, context: createSupportContext(), idempotencyKey: nextKey(3) },
      OTHER_ORGANIZATION_MEMBER,
    );
    await harness.runtime.command((transaction) => {
      transaction.put('supportTickets', { ...first, createdAt: timestampFromMs(SEED_WORLD_START_MS - 10_000) });
    });

    const response = await harness.supportTicket.listMySupportTickets({}, AUTHOR);

    expect(response.tickets.map(ticket => ticket.id)).toEqual([second.id, first.id]);
    expect(response.page?.nextPageToken).toBe('');
  });

  it('orders tickets created at the same moment by id', async () => {
    const harness = createModuleHarness();
    const first = await createTicket(harness, nextKey(1));
    const second = await createTicket(harness, nextKey(2));

    const response = await harness.supportTicket.listMySupportTickets({}, AUTHOR);

    expect(response.tickets.map(ticket => ticket.id)).toEqual([first.id, second.id].sort());
  });

  it('pages through the tickets with the token', async () => {
    const harness = createModuleHarness();
    const created: SupportTicket[] = [];

    for (let index = 1; index <= 3; index += 1) {
      const ticket = await createTicket(harness, nextKey(index));
      created.push(ticket);
      await harness.runtime.command((transaction) => {
        transaction.put('supportTickets', { ...ticket, createdAt: timestampFromMs(SEED_WORLD_START_MS + index * 1_000) });
      });
    }

    const firstPage = await harness.supportTicket.listMySupportTickets({ page: { pageSize: 2 } }, AUTHOR);
    const secondPage = await harness.supportTicket.listMySupportTickets(
      { page: { pageSize: 2, pageToken: firstPage.page?.nextPageToken ?? '' } },
      AUTHOR,
    );

    expect(firstPage.tickets.map(ticket => ticket.number)).toEqual([created[2]?.number, created[1]?.number]);
    expect(firstPage.page?.nextPageToken).not.toBe('');
    expect(secondPage.tickets.map(ticket => ticket.number)).toEqual([created[0]?.number]);
    expect(secondPage.page?.nextPageToken).toBe('');
  });

  it('is empty for a user without tickets', async () => {
    const harness = createModuleHarness();
    await createTicket(harness);

    const response = await harness.supportTicket.listMySupportTickets({}, OTHER_ORGANIZATION_MEMBER);

    expect(response.tickets).toEqual([]);
  });

  it('answers membership_required outside the organization', async () => {
    const harness = createModuleHarness();

    const error = await captureError(
      harness.supportTicket.listMySupportTickets({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_2)),
    );

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });
});
