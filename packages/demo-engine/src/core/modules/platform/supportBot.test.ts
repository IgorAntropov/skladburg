import type { Event } from '@skladburg/contracts/event/v1/event';
import type { Notification } from '@skladburg/contracts/notification/v1/notification';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  NotificationImportance,
  NotificationKind,
} from '@skladburg/contracts/notification/v1/notification';
import { userChannel } from '@skladburg/contracts/runtime';
import {
  SupportMessageAuthorKind,
  SupportReplyTemplate,
  SupportTicketCategory,
  SupportTicketStatus,
} from '@skladburg/contracts/support/v1/support_ticket';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ModuleHarnessValue } from '../testing/moduleHarness';

import { createEngine } from '../../engine/createEngine';
import {
  createEngineCaller,
  createFakeRealTime,
  createSpyStorage,
  createTestEngine,
  TEST_ENGINE_EPOCH,
  WORLD_REAL_TIME_START_MS,
} from '../../engine/testing/engineHarness';
import {
  DEFAULT_ENGINE_SEED,
  SEED_WORLD_START_MS,
  SeedOrganizationId,
  SeedUserId,
} from '../../seed/index';
import {
  addTestMember,
  callAs,
  createModuleHarness,
} from '../testing/moduleHarness';
import { createSupportBotTask } from './supportBot';
import {
  createSupportContext,
  createSupportErrorRef,
  createTraceId,
  FIRST_KEY,
} from './testing/supportFixtures';

const AUTHOR = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
const REPLY_DELAY_MS = 4_000;
const RESPONDER_NAME = 'Ксения Р.';
const EXTRA_KEY = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';

const listSupportReplies = async (harness: ModuleHarnessValue, options = AUTHOR): Promise<Notification[]> =>
  (await harness.notification.listNotifications({}, options)).notifications
    .filter(notification => notification.kind === NotificationKind.SUPPORT_REPLY);

const createBotHarness = (): { harness: ModuleHarnessValue; runBot: () => Promise<void> } => {
  const harness = createModuleHarness();
  const task = createSupportBotTask(harness.runtime);

  return {
    harness,
    runBot: () => harness.runtime.command((transaction) => {
      task.run(transaction, transaction.worldTimeMs);
    }),
  };
};

const createTicketIn = async (
  harness: ModuleHarnessValue,
  category: SupportTicketCategory,
  context = createSupportContext(),
  key: string = FIRST_KEY,
): Promise<string> => {
  const response = await harness.supportTicket.createSupportTicket({ category, context, idempotencyKey: key }, AUTHOR);

  return response.ticket?.id ?? '';
};

const makeDue = (harness: ModuleHarnessValue, ticketId: string): Promise<void> =>
  harness.runtime.command((transaction) => {
    transaction.put('supportBotQueue', { dueAtMs: SEED_WORLD_START_MS, id: ticketId });
  });

describe('support bot task', () => {
  it('runs every second under a stable id', () => {
    const task = createSupportBotTask(createModuleHarness().runtime);

    expect(task.id).toBe('support-bot');
    expect(task.intervalMs).toBe(1_000);
  });

  it('keeps a ticket that is not due yet in the queue and writes nothing', async () => {
    const { harness, runBot } = createBotHarness();
    const ticketId = await createTicketIn(harness, SupportTicketCategory.GENERAL);
    harness.commits.length = 0;
    harness.events.length = 0;

    await runBot();

    expect(harness.state.read.get('supportBotQueue', ticketId)).toBeDefined();
    expect(harness.commits).toEqual([]);
    expect(harness.events).toEqual([]);
  });

  it('answers a due ticket once: a message from the responder, the status ANSWERED and an empty queue', async () => {
    const { harness, runBot } = createBotHarness();
    const ticketId = await createTicketIn(harness, SupportTicketCategory.GENERAL);
    await makeDue(harness, ticketId);

    await runBot();
    await runBot();
    await runBot();

    const detail = await harness.supportTicket.getSupportTicket({ ticketId }, AUTHOR);
    const [message] = detail.messages;

    expect(detail.ticket?.status).toBe(SupportTicketStatus.ANSWERED);
    expect(detail.messages).toHaveLength(1);
    expect(message?.authorKind).toBe(SupportMessageAuthorKind.SUPPORT);
    expect(message?.authorDisplayName).toBe(RESPONDER_NAME);
    expect(message?.ticketId).toBe(ticketId);
    expect(message?.createdAt === undefined ? undefined : timestampMs(message.createdAt)).toBe(SEED_WORLD_START_MS);
    expect(message?.body.case === 'reply' && message.body.value.template).toBe(SupportReplyTemplate.ACKNOWLEDGED);
    expect(harness.state.read.list('supportBotQueue')).toEqual([]);
    expect(await listSupportReplies(harness)).toHaveLength(1);
  });

  it.each([
    ['a general ticket', SupportTicketCategory.GENERAL, [], SupportReplyTemplate.ACKNOWLEDGED, NotificationImportance.NORMAL],
    ['a money ticket', SupportTicketCategory.MONEY, [], SupportReplyTemplate.URGENT_ACKNOWLEDGED, NotificationImportance.IMPORTANT],
    [
      'a blocked receiving ticket',
      SupportTicketCategory.RECEIVING_BLOCKED,
      [],
      SupportReplyTemplate.URGENT_ACKNOWLEDGED,
      NotificationImportance.IMPORTANT,
    ],
    ['an error ticket without errors', SupportTicketCategory.ERROR, [], SupportReplyTemplate.ACKNOWLEDGED, NotificationImportance.NORMAL],
    [
      'an urgent ticket with errors',
      SupportTicketCategory.MONEY,
      [
        createSupportErrorRef(createTraceId(1), 1_000, ErrorCode.NOT_FOUND),
        createSupportErrorRef(createTraceId(2), 9_000, ErrorCode.LIMIT_EXCEEDED),
      ],
      SupportReplyTemplate.ERROR_EXPLAINED,
      NotificationImportance.IMPORTANT,
    ],
  ])('picks the template and the importance for %s', async (_name, category, errors, template, importance) => {
    const { harness, runBot } = createBotHarness();
    const ticketId = await createTicketIn(harness, category, createSupportContext({ errors }));
    await makeDue(harness, ticketId);

    await runBot();

    const detail = await harness.supportTicket.getSupportTicket({ ticketId }, AUTHOR);
    const [reply] = await listSupportReplies(harness);
    const body = detail.messages[0]?.body;

    expect(body?.case === 'reply' && body.value.template).toBe(template);
    expect(reply?.importance).toBe(importance);
  });

  it('copies the code and the trace id of the latest error into the reply', async () => {
    const { harness, runBot } = createBotHarness();
    const errors = [
      createSupportErrorRef(createTraceId(2), 9_000, ErrorCode.LIMIT_EXCEEDED),
      createSupportErrorRef(createTraceId(1), 1_000, ErrorCode.NOT_FOUND),
    ];
    const ticketId = await createTicketIn(harness, SupportTicketCategory.ERROR, createSupportContext({ errors }));
    await makeDue(harness, ticketId);

    await runBot();

    const body = (await harness.supportTicket.getSupportTicket({ ticketId }, AUTHOR)).messages[0]?.body;

    expect(body?.case === 'reply' && body.value.errorCode).toBe(ErrorCode.LIMIT_EXCEEDED);
    expect(body?.case === 'reply' && body.value.traceId).toBe(createTraceId(2));
  });

  it('notifies the author only, with the ticket in the params and no links', async () => {
    const { harness, runBot } = createBotHarness();
    const colleagueId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: [],
      warehouseIds: [],
    });
    const ticketId = await createTicketIn(harness, SupportTicketCategory.GENERAL);
    await makeDue(harness, ticketId);
    harness.events.length = 0;

    await runBot();

    const [reply] = await listSupportReplies(harness);
    const channels = harness.events.map((event: Event) => event.channel);
    const payloadCases = harness.events.map(event => event.payload.case);

    expect(reply?.organizationId).toBe(SeedOrganizationId.CUSTOMER_1);
    expect(reply?.links).toEqual([]);
    expect(reply?.params.case === 'supportReply' && reply.params.value.ticketId).toBe(ticketId);
    expect(reply?.params.case === 'supportReply' && reply.params.value.ticketNumber).toBe(1001);
    expect(new Set(channels)).toEqual(new Set([userChannel(SeedUserId.ADMIN_1)]));
    expect([...payloadCases].sort()).toEqual(['notificationsChanged', 'supportTicketChanged']);
    expect(await listSupportReplies(harness, callAs(colleagueId, SeedOrganizationId.CUSTOMER_1))).toEqual([]);
  });

  it('removes a due record of a ticket that is already closed or missing without a reply', async () => {
    const { harness, runBot } = createBotHarness();
    const ticketId = await createTicketIn(harness, SupportTicketCategory.GENERAL);
    const ticket = harness.state.read.get('supportTickets', ticketId);

    if (ticket === undefined) {
      throw new Error('The ticket was not stored');
    }

    await harness.runtime.command((transaction) => {
      transaction.put('supportTickets', { ...ticket, status: SupportTicketStatus.CLOSED });
      transaction.put('supportBotQueue', { dueAtMs: SEED_WORLD_START_MS - 1, id: ticketId });
      transaction.put('supportBotQueue', { dueAtMs: SEED_WORLD_START_MS - 1, id: 'f0000000-0000-4000-8000-000000000001' });
    });
    harness.events.length = 0;

    await runBot();

    expect(harness.state.read.list('supportBotQueue')).toEqual([]);
    expect(harness.state.read.list('supportTicketMessages')).toEqual([]);
    expect(harness.state.read.get('supportTickets', ticketId)?.status).toBe(SupportTicketStatus.CLOSED);
    expect(harness.events).toEqual([]);
  });

  it('answers several due tickets in one run', async () => {
    const { harness, runBot } = createBotHarness();
    const first = await createTicketIn(harness, SupportTicketCategory.GENERAL);
    const second = await createTicketIn(harness, SupportTicketCategory.MONEY, createSupportContext(), EXTRA_KEY);
    await makeDue(harness, first);
    await makeDue(harness, second);

    await runBot();

    expect(harness.state.read.list('supportTicketMessages').map(message => message.ticketId).sort()).toEqual([first, second].sort());
    expect(await listSupportReplies(harness)).toHaveLength(2);
  });
});

describe('support bot over the engine clock', () => {
  const createCreateRequest = (category: SupportTicketCategory = SupportTicketCategory.GENERAL): {
    category: SupportTicketCategory;
    context: ReturnType<typeof createSupportContext>;
    idempotencyKey: string;
  } => ({ category, context: createSupportContext(), idempotencyKey: FIRST_KEY });

  it('stays silent until four seconds of world time have passed and answers exactly once afterwards', async () => {
    const { engine, realTime } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const response = await caller.supportTicket.createSupportTicket(createCreateRequest(), AUTHOR);
    const ticketId = response.ticket?.id ?? '';

    realTime.advance(REPLY_DELAY_MS - 1);
    await engine.tick();

    const early = await caller.supportTicket.getSupportTicket({ ticketId }, AUTHOR);

    expect(early.messages).toEqual([]);
    expect(early.ticket?.status).toBe(SupportTicketStatus.OPEN);

    realTime.advance(1);
    await engine.tick();
    realTime.advance(10_000);
    await engine.tick();
    await engine.tick();

    const answered = await caller.supportTicket.getSupportTicket({ ticketId }, AUTHOR);
    const notifications = await caller.notification.listNotifications({}, AUTHOR);

    expect(answered.ticket?.status).toBe(SupportTicketStatus.ANSWERED);
    expect(answered.messages).toHaveLength(1);
    expect(answered.messages[0]?.authorDisplayName).toBe(RESPONDER_NAME);
    expect(answered.messages[0]?.createdAt === undefined ? undefined : timestampMs(answered.messages[0].createdAt))
      .toBe(DEFAULT_ENGINE_SEED.worldStartMs + REPLY_DELAY_MS);
    expect(notifications.notifications.filter(notification => notification.kind === NotificationKind.SUPPORT_REPLY)).toHaveLength(1);
  });

  it('answers a ticket created after a pause only after its own four seconds', async () => {
    const { engine, realTime } = await createTestEngine();
    const caller = createEngineCaller(engine);
    realTime.advance(60_000);
    const response = await caller.supportTicket.createSupportTicket(createCreateRequest(), AUTHOR);
    const ticketId = response.ticket?.id ?? '';

    realTime.advance(REPLY_DELAY_MS - 1);
    await engine.tick();

    expect((await caller.supportTicket.getSupportTicket({ ticketId }, AUTHOR)).messages).toEqual([]);

    realTime.advance(1);
    await engine.tick();

    expect((await caller.supportTicket.getSupportTicket({ ticketId }, AUTHOR)).messages).toHaveLength(1);
  });

  it('keeps the queue over a restart on the same storage and answers exactly once', async () => {
    const storage = createSpyStorage();
    const before = await createTestEngine({ storage });
    const beforeCaller = createEngineCaller(before.engine);
    const response = await beforeCaller.supportTicket.createSupportTicket(createCreateRequest(SupportTicketCategory.MONEY), AUTHOR);
    const ticketId = response.ticket?.id ?? '';

    before.realTime.advance(1_000);
    await before.engine.tick();
    await before.engine.checkpoint();

    const realTime = createFakeRealTime(WORLD_REAL_TIME_START_MS * 3);
    const after = await createEngine({ epoch: `${TEST_ENGINE_EPOCH}-2`, realTime, storage });
    const afterCaller = createEngineCaller(after);

    realTime.advance(REPLY_DELAY_MS - 1_000 - 1);
    await after.tick();

    expect((await afterCaller.supportTicket.getSupportTicket({ ticketId }, AUTHOR)).messages).toEqual([]);

    realTime.advance(1);
    await after.tick();

    expect((await afterCaller.supportTicket.getSupportTicket({ ticketId }, AUTHOR)).messages).toHaveLength(1);

    await after.tick();
    realTime.advance(5_000);
    await after.tick();

    const detail = await afterCaller.supportTicket.getSupportTicket({ ticketId }, AUTHOR);
    const notifications = await afterCaller.notification.listNotifications({}, AUTHOR);

    expect(detail.ticket?.status).toBe(SupportTicketStatus.ANSWERED);
    expect(detail.messages).toHaveLength(1);
    expect(notifications.notifications.filter(notification => notification.kind === NotificationKind.SUPPORT_REPLY)).toHaveLength(1);
  });
});
