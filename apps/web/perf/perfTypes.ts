export type MetricNameValue = keyof RunMetricsValue;

export interface MetricSummaryValue {
  max: null | number;
  median: null | number;
  min: null | number;
  sampleCount: number;
}

export interface NetworkConditionsValue {
  downloadBytesPerSecond: number;
  latencyMs: number;
  uploadBytesPerSecond: number;
}

export interface PerfProfileValue {
  cpuRate: number;
  isSceneTracked: boolean;
  name: string;
  network: NetworkConditionsValue;
  viewport: PerfViewportValue;
}

export interface PerfReportValue {
  profiles: ProfileReportValue[];
  target: TargetValue;
}

export interface PerfViewportValue {
  deviceScaleFactor: number;
  hasTouch: boolean;
  height: number;
  isMobile: boolean;
  width: number;
}

export interface ProfileReportValue {
  cold: RunValue[];
  cpuRate: number;
  name: string;
  network: NetworkConditionsValue;
  summary: ProfileSummaryValue;
  viewport: PerfViewportValue;
  warm: RunValue[];
}

export interface ProfileSummaryValue {
  cold: SeriesSummaryValue;
  warm: SeriesSummaryValue;
}

export type RequestTargetValue = 'page' | 'service-worker' | 'worker';

export interface RequestValue {
  bytes: number;
  endAt: number;
  fromCache: boolean;
  startAt: number;
  target: RequestTargetValue;
  url: string;
}

export interface RunMetricsValue {
  bytesBeforeReady: number;
  engineReady: null | number;
  fcp: null | number;
  firstScreenReady: null | number;
  lcp: null | number;
  longTaskCount: number;
  longTaskExcessMs: number;
  requestsBeforeReady: number;
  sceneFirstFrame: null | number;
  serviceWorkerBytesBeforeReady: number;
  serviceWorkerRequestsBeforeReady: number;
  skeletonShown: null | number;
  ttfb: null | number;
  workerCreated: null | number;
}

export interface RunValue extends RunMetricsValue {
  duplicates: string[];
  isServiceWorkerThrottled: boolean | null;
  isWorkerThrottled: boolean | null;
  requests: RequestValue[];
  serviceWorkerRepeats: string[];
  serviceWorkerThrottlingNote?: ServiceWorkerThrottlingNoteValue;
  workerMessages: WorkerMessageValue[];
  workerThrottlingNote?: WorkerThrottlingNoteValue;
}

export type SeriesSummaryValue = Record<MetricNameValue, MetricSummaryValue>;

export type ServiceWorkerThrottlingNoteValue = 'absent' | 'loaded-before-emulation' | 'not-finished' | 'refused';

export interface ServiceWorkerThrottlingValue {
  isThrottled: boolean | null;
  note?: ServiceWorkerThrottlingNoteValue;
}

export interface TargetValue {
  baseUrl: string;
  buildTime?: string;
  commit?: string;
}

export type WorkerMessageDirectionValue = 'from-worker' | 'to-worker';

export interface WorkerMessageValue {
  at: number;
  command?: string;
  direction: WorkerMessageDirectionValue;
  requestId?: string;
  type: string;
  url?: string;
}

export type WorkerThrottlingNoteValue = 'no-network-load';

export interface WorkerThrottlingValue {
  isThrottled: boolean | null;
  note?: WorkerThrottlingNoteValue;
}
