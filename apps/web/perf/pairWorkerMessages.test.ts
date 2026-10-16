import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WorkerMessageValue } from './perfTypes.ts';

import { pairWorkerMessages } from './pairWorkerMessages.ts';

describe('pairWorkerMessages', () => {
  it('joins a request with its response by request id and names it after the last url segment', () => {
    const messages: WorkerMessageValue[] = [
      {
        at: 1200,
        direction: 'to-worker',
        requestId: 'a',
        type: 'request',
        url: 'http://demo.local/org.v1.OrganizationService/GetOrganizationSettings',
      },
      { at: 1900, direction: 'from-worker', requestId: 'a', type: 'response' },
    ];

    expect(pairWorkerMessages(messages)).toEqual([{ answeredAt: 1900, label: 'GetOrganizationSettings', sentAt: 1200 }]);
  });

  it('names a control message after its command', () => {
    const messages: WorkerMessageValue[] = [
      { at: 1100, command: 'list_personas', direction: 'to-worker', requestId: 'p', type: 'control' },
      { at: 1500, direction: 'from-worker', requestId: 'p', type: 'control_result' },
    ];

    expect(pairWorkerMessages(messages)).toEqual([{ answeredAt: 1500, label: 'list_personas', sentAt: 1100 }]);
  });

  it('keeps calls in the order they were sent and answers them out of order', () => {
    const messages: WorkerMessageValue[] = [
      { at: 10, direction: 'to-worker', requestId: 'a', type: 'request', url: 'http://x/svc/GetSession' },
      { at: 11, direction: 'to-worker', requestId: 'b', type: 'request', url: 'http://x/svc/GetWorldClock' },
      { at: 30, direction: 'from-worker', requestId: 'b', type: 'response' },
      { at: 40, direction: 'from-worker', requestId: 'a', type: 'response' },
    ];

    expect(pairWorkerMessages(messages)).toEqual([
      { answeredAt: 40, label: 'GetSession', sentAt: 10 },
      { answeredAt: 30, label: 'GetWorldClock', sentAt: 11 },
    ]);
  });

  it('lists a worker message without a matching request as its own row', () => {
    const messages: WorkerMessageValue[] = [{ at: 800, direction: 'from-worker', type: 'status' }];

    expect(pairWorkerMessages(messages)).toEqual([{ answeredAt: 800, label: 'status', sentAt: undefined }]);
  });

  it('leaves a request without a response unanswered', () => {
    const messages: WorkerMessageValue[] = [
      { at: 5, direction: 'to-worker', requestId: 'a', type: 'request', url: 'http://x/svc/GetSession' },
    ];

    expect(pairWorkerMessages(messages)).toEqual([{ answeredAt: undefined, label: 'GetSession', sentAt: 5 }]);
  });
});
