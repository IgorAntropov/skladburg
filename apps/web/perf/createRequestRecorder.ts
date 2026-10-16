import type {
  RequestTargetValue,
  RequestValue,
} from './perfTypes.ts';

export interface IRequestRecorder {
  fail: (requestId: string) => void;
  finish: (event: RequestFinishedValue) => void;
  markServedFromCache: (requestId: string) => void;
  respond: (event: RequestRespondedValue) => void;
  start: (event: RequestStartedValue) => void;
  toOpenRequests: (timeOriginMs: number) => OpenRequestValue[];
  toRequests: (timeOriginMs: number) => RequestValue[];
}

export interface OpenRequestValue {
  startAt: number;
  url: string;
}

export interface RequestFinishedValue {
  encodedDataLength: number;
  requestId: string;
  timestamp: number;
}

export interface RequestRespondedValue {
  isFromCache: boolean;
  requestId: string;
}

export interface RequestStartedValue {
  requestId: string;
  timestamp: number;
  url: string;
  wallTime: number;
}

interface PendingRequestValue {
  finished: RequestFinishedValue | undefined;
  isFromCache: boolean;
  started: RequestStartedValue;
}

const MILLISECONDS_PER_SECOND = 1000;
const RECORDED_URL_PATTERN = /^https?:/;

export const createRequestRecorder = (target: RequestTargetValue): IRequestRecorder => {
  const pendingById = new Map<string, PendingRequestValue>();

  return {
    fail(requestId: string): void {
      pendingById.delete(requestId);
    },
    finish(event: RequestFinishedValue): void {
      const pending = pendingById.get(event.requestId);

      if (pending !== undefined) {
        pending.finished = event;
      }
    },
    markServedFromCache(requestId: string): void {
      const pending = pendingById.get(requestId);

      if (pending !== undefined) {
        pending.isFromCache = true;
      }
    },
    respond(event: RequestRespondedValue): void {
      const pending = pendingById.get(event.requestId);

      if (pending !== undefined && event.isFromCache) {
        pending.isFromCache = true;
      }
    },
    start(event: RequestStartedValue): void {
      if (RECORDED_URL_PATTERN.test(event.url)) {
        pendingById.set(event.requestId, { finished: undefined, isFromCache: false, started: event });
      }
    },
    toOpenRequests(timeOriginMs: number): OpenRequestValue[] {
      return [...pendingById.values()]
        .filter(pending => pending.finished === undefined)
        .map(pending => ({
          startAt: pending.started.wallTime * MILLISECONDS_PER_SECOND - timeOriginMs,
          url: pending.started.url,
        }));
    },
    toRequests(timeOriginMs: number): RequestValue[] {
      const requests: RequestValue[] = [];

      for (const { finished, isFromCache, started } of pendingById.values()) {
        if (finished !== undefined) {
          const startAt = started.wallTime * MILLISECONDS_PER_SECOND - timeOriginMs;

          requests.push({
            bytes: isFromCache ? 0 : finished.encodedDataLength,
            endAt: startAt + (finished.timestamp - started.timestamp) * MILLISECONDS_PER_SECOND,
            fromCache: isFromCache,
            startAt,
            target,
            url: started.url,
          });
        }
      }

      return requests.sort((first, second) => first.startAt - second.startAt);
    },
  };
};
