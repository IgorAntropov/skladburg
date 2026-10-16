import type { WorkerMessageValue } from './perfTypes.ts';

import { readLastSegment } from './readUrlPath.ts';

export interface WorkerCallValue {
  answeredAt: number | undefined;
  label: string;
  sentAt: number | undefined;
}

const describeMessage = (message: WorkerMessageValue): string => {
  if (message.url !== undefined) {
    return readLastSegment(message.url);
  }

  return message.command ?? message.type;
};

export const pairWorkerMessages = (messages: readonly WorkerMessageValue[]): WorkerCallValue[] => {
  const callsByRequestId = new Map<string, WorkerCallValue>();
  const calls: WorkerCallValue[] = [];

  for (const message of messages) {
    const isSent = message.direction === 'to-worker';
    const pendingCall = message.requestId === undefined ? undefined : callsByRequestId.get(message.requestId);

    if (isSent) {
      const call: WorkerCallValue = { answeredAt: undefined, label: describeMessage(message), sentAt: message.at };

      calls.push(call);

      if (message.requestId !== undefined) {
        callsByRequestId.set(message.requestId, call);
      }
    }
    else if (pendingCall === undefined) {
      calls.push({ answeredAt: message.at, label: describeMessage(message), sentAt: undefined });
    }
    else {
      pendingCall.answeredAt ??= message.at;
    }
  }

  return calls;
};
