import type { OpenRequestValue } from './createRequestRecorder.ts';
import type { ResourceTimingValue } from './mergeResourceTimings.ts';
import type {
  NetworkConditionsValue,
  RequestValue,
  RunValue,
  ServiceWorkerThrottlingNoteValue,
  WorkerMessageValue,
} from './perfTypes.ts';
import type { LongTaskValue } from './summarizeLongTasks.ts';

import { findDuplicates } from './findDuplicates.ts';
import { findServiceWorkerRepeats } from './findServiceWorkerRepeats.ts';
import { judgeWorkerThrottling } from './judgeWorkerThrottling.ts';
import { mergeResourceTimings } from './mergeResourceTimings.ts';
import { summarizeLongTasks } from './summarizeLongTasks.ts';

export interface BuildRunInputValue {
  isServiceWorkerThrottled: boolean | null;
  network: NetworkConditionsValue;
  openRequests: OpenRequestValue[];
  requests: RequestValue[];
  serviceWorkerThrottlingNote?: ServiceWorkerThrottlingNoteValue | undefined;
  snapshot: ProbeSnapshotValue;
}

export interface ProbeSnapshotValue {
  engineReadyAt: null | number;
  fcp: null | number;
  firstScreenReadyAt: null | number;
  lcp: null | number;
  longTasks: LongTaskValue[];
  resources: ResourceTimingValue[];
  sceneFirstFrameAt: null | number;
  skeletonShownAt: null | number;
  timeOrigin: number;
  ttfb: null | number;
  workerCreatedAt: null | number;
  workerMessages: WorkerMessageValue[];
}

interface ReadyTotalsValue {
  bytesFinished: number;
  requestsStarted: number;
}

const sumBeforeReady = (requests: readonly RequestValue[], readyAt: null | number): ReadyTotalsValue => {
  if (readyAt === null) {
    return { bytesFinished: 0, requestsStarted: 0 };
  }

  return {
    bytesFinished: requests.filter(request => request.endAt <= readyAt).reduce((total, request) => total + request.bytes, 0),
    requestsStarted: requests.filter(request => request.startAt <= readyAt).length,
  };
};

export const buildRunValue = ({
  isServiceWorkerThrottled,
  network,
  openRequests,
  requests: networkRequests,
  serviceWorkerThrottlingNote,
  snapshot,
}: BuildRunInputValue): RunValue => {
  const serviceWorkerRequests = networkRequests.filter(request => request.target === 'service-worker');
  const pageRequests = mergeResourceTimings(
    networkRequests.filter(request => request.target !== 'service-worker'),
    openRequests,
    snapshot.resources,
  );
  const requests = [...pageRequests, ...serviceWorkerRequests].sort((first, second) => first.startAt - second.startAt);
  const readyAt = snapshot.firstScreenReadyAt;
  const longTasks = summarizeLongTasks(snapshot.longTasks, readyAt);
  const pageTotals = sumBeforeReady(pageRequests, readyAt);
  const serviceWorkerTotals = sumBeforeReady(serviceWorkerRequests, readyAt);
  const workerThrottling = judgeWorkerThrottling(requests, network);

  return {
    bytesBeforeReady: pageTotals.bytesFinished,
    duplicates: findDuplicates(pageRequests),
    engineReady: snapshot.engineReadyAt,
    fcp: snapshot.fcp,
    firstScreenReady: readyAt,
    isServiceWorkerThrottled,
    isWorkerThrottled: workerThrottling.isThrottled,
    lcp: snapshot.lcp,
    longTaskCount: longTasks.count,
    longTaskExcessMs: longTasks.excessMs,
    requests,
    requestsBeforeReady: pageTotals.requestsStarted,
    sceneFirstFrame: snapshot.sceneFirstFrameAt,
    serviceWorkerBytesBeforeReady: serviceWorkerTotals.bytesFinished,
    serviceWorkerRepeats: findServiceWorkerRepeats(requests),
    serviceWorkerRequestsBeforeReady: serviceWorkerTotals.requestsStarted,
    ...(serviceWorkerThrottlingNote === undefined ? {} : { serviceWorkerThrottlingNote }),
    skeletonShown: snapshot.skeletonShownAt,
    ttfb: snapshot.ttfb,
    workerCreated: snapshot.workerCreatedAt,
    workerMessages: snapshot.workerMessages,
    ...(workerThrottling.note === undefined ? {} : { workerThrottlingNote: workerThrottling.note }),
  };
};
