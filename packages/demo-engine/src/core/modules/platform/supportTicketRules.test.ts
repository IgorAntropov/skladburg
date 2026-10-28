import { create } from '@bufbuild/protobuf';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  SupportReplyTemplate,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketSchema,
} from '@skladburg/contracts/support/v1/support_ticket';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  pickSupportReplyTemplate,
  resolveSupportResponseWindowMs,
  resolveSupportTicketPriority,
  SUPPORT_NORMAL_RESPONSE_WINDOW_MS,
  SUPPORT_URGENT_RESPONSE_WINDOW_MS,
} from './supportTicketRules';
import {
  createSupportContext,
  createSupportErrorRef,
} from './testing/supportFixtures';

const HOUR_MS = 3_600_000;

describe('resolveSupportTicketPriority', () => {
  it.each([
    [SupportTicketCategory.GENERAL, SupportTicketPriority.NORMAL],
    [SupportTicketCategory.ERROR, SupportTicketPriority.NORMAL],
    [SupportTicketCategory.MONEY, SupportTicketPriority.URGENT],
    [SupportTicketCategory.RECEIVING_BLOCKED, SupportTicketPriority.URGENT],
  ])('maps category %s to priority %s', (category, priority) => {
    expect(resolveSupportTicketPriority(category)).toBe(priority);
  });
});

describe('resolveSupportResponseWindowMs', () => {
  it('gives an hour to an urgent ticket and eight hours to a normal one', () => {
    expect(resolveSupportResponseWindowMs(SupportTicketPriority.URGENT)).toBe(HOUR_MS);
    expect(resolveSupportResponseWindowMs(SupportTicketPriority.NORMAL)).toBe(8 * HOUR_MS);
    expect(SUPPORT_URGENT_RESPONSE_WINDOW_MS).toBe(HOUR_MS);
    expect(SUPPORT_NORMAL_RESPONSE_WINDOW_MS).toBe(8 * HOUR_MS);
  });
});

describe('pickSupportReplyTemplate', () => {
  const early = createSupportErrorRef('trace-early', 1_000, ErrorCode.NOT_FOUND);
  const late = createSupportErrorRef('trace-late', 3_000, ErrorCode.VERSION_CONFLICT);
  const middle = createSupportErrorRef('trace-middle', 2_000, ErrorCode.LIMIT_EXCEEDED);

  const pick = (priority: SupportTicketPriority, errors = [early]): ReturnType<typeof pickSupportReplyTemplate> =>
    pickSupportReplyTemplate(create(SupportTicketSchema, { context: createSupportContext({ errors }), priority }));

  it('acknowledges a normal ticket without errors', () => {
    const reply = pick(SupportTicketPriority.NORMAL, []);

    expect(reply.template).toBe(SupportReplyTemplate.ACKNOWLEDGED);
    expect(reply.errorCode).toBe(ErrorCode.UNSPECIFIED);
    expect(reply.traceId).toBe('');
  });

  it('acknowledges an urgent ticket without errors as urgent', () => {
    expect(pick(SupportTicketPriority.URGENT, []).template).toBe(SupportReplyTemplate.URGENT_ACKNOWLEDGED);
  });

  it('acknowledges a ticket without a context', () => {
    const reply = pickSupportReplyTemplate(create(SupportTicketSchema, { priority: SupportTicketPriority.NORMAL }));

    expect(reply.template).toBe(SupportReplyTemplate.ACKNOWLEDGED);
  });

  it.each([
    ['in order', [early, middle, late]],
    ['in reverse order', [late, middle, early]],
    ['shuffled', [middle, late, early]],
  ])('explains the latest error when the errors come %s', (_name, errors) => {
    const reply = pick(SupportTicketPriority.NORMAL, errors);

    expect(reply.template).toBe(SupportReplyTemplate.ERROR_EXPLAINED);
    expect(reply.errorCode).toBe(ErrorCode.VERSION_CONFLICT);
    expect(reply.traceId).toBe('trace-late');
  });

  it('explains the error even when the ticket is urgent', () => {
    expect(pick(SupportTicketPriority.URGENT, [early]).template).toBe(SupportReplyTemplate.ERROR_EXPLAINED);
  });

  it('takes the earlier one in the list when two errors share the moment', () => {
    const first = createSupportErrorRef('trace-first', 5_000, ErrorCode.NOT_FOUND);
    const second = createSupportErrorRef('trace-second', 5_000, ErrorCode.VERSION_CONFLICT);

    expect(pick(SupportTicketPriority.NORMAL, [first, second]).traceId).toBe('trace-first');
    expect(pick(SupportTicketPriority.NORMAL, [second, first]).traceId).toBe('trace-second');
  });
});
