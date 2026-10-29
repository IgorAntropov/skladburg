import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ErrorJournalEntryValue } from '@/shared/api';

import { buildErrorReplica } from './buildErrorReplica';

const createEntry = (code: ErrorCode): ErrorJournalEntryValue => ({
  code,
  method: 'warehouse.v1.WarehouseService/CreateWarehouse',
  occurredAt: 1000,
  params: { case: undefined, value: undefined },
  traceId: 'trace-1',
});

describe('buildErrorReplica', () => {
  it('explains a domain refusal with the reason and the hint', () => {
    const replica = buildErrorReplica(createEntry(ErrorCode.PERMISSION_DENIED), () => 'Нет права', true);

    expect(replica?.importance).toBe('important');
    expect(replica?.body).toEqual({
      hintKey: 'assistant.error.hint.permissionDenied',
      kind: 'error',
      reason: 'Нет права',
    });
    expect(replica?.links).toEqual([]);
  });

  it('offers to call a human only when the support can be called', () => {
    const callable = buildErrorReplica(createEntry(ErrorCode.NOT_FOUND), () => '', true);
    const notCallable = buildErrorReplica(createEntry(ErrorCode.NOT_FOUND), () => '', false);

    expect(callable?.centerAction).toBe('callSupport');
    expect(notCallable?.centerAction).toBeUndefined();
  });

  it.each([
    ErrorCode.VALIDATION_FAILED,
    ErrorCode.UNAVAILABLE,
    ErrorCode.INTERNAL,
    ErrorCode.SESSION_REQUIRED,
  ])('stays silent for code %s and does not ask for the reason', (code) => {
    let isReasonRequested = false;
    const replica = buildErrorReplica(createEntry(code), () => {
      isReasonRequested = true;

      return '';
    }, true);

    expect(replica).toBeUndefined();
    expect(isReasonRequested).toBe(false);
  });

  it('gives two refusals at different times different ids', () => {
    const first = buildErrorReplica(createEntry(ErrorCode.NOT_FOUND), () => '', true);
    const second = buildErrorReplica({ ...createEntry(ErrorCode.NOT_FOUND), occurredAt: 2000 }, () => '', true);

    expect(first?.id).not.toBe(second?.id);
  });
});
