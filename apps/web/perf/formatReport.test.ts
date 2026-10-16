import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  PerfReportValue,
  ProfileReportValue,
  RunValue,
} from './perfTypes.ts';

import { summarizeSeries } from './computeStatistics.ts';
import {
  formatMarkdownReport,
  formatMedianTable,
} from './formatReport.ts';

const createRun = (overrides: Partial<RunValue> = {}): RunValue => ({
  bytesBeforeReady: 102_400,
  duplicates: [],
  engineReady: 1800,
  fcp: 600,
  firstScreenReady: 2400,
  isServiceWorkerThrottled: true,
  isWorkerThrottled: true,
  lcp: 900,
  longTaskCount: 3,
  longTaskExcessMs: 140,
  requests: [
    {
      bytes: 80_000,
      endAt: 500,
      fromCache: false,
      startAt: 100,
      target: 'page',
      url: 'https://host/skladburg/assets/index-Ka_enA0r.js',
    },
  ],
  requestsBeforeReady: 14,
  sceneFirstFrame: null,
  serviceWorkerBytesBeforeReady: 51_200,
  serviceWorkerRepeats: [],
  serviceWorkerRequestsBeforeReady: 4,
  skeletonShown: 700,
  ttfb: 200,
  workerCreated: 1200,
  workerMessages: [
    { at: 1900, direction: 'to-worker', requestId: 'a', type: 'request', url: 'http://demo.local/svc/GetSession' },
    { at: 2100, direction: 'from-worker', requestId: 'a', type: 'response' },
  ],
  ...overrides,
});

const createProfile = (name: string, cold: RunValue[], warm: RunValue[] = []): ProfileReportValue => ({
  cold,
  cpuRate: 4,
  name,
  network: { downloadBytesPerSecond: 1_012_500, latencyMs: 165, uploadBytesPerSecond: 168_750 },
  summary: { cold: summarizeSeries(cold), warm: summarizeSeries(warm) },
  viewport: { deviceScaleFactor: 1.75, hasTouch: true, height: 823, isMobile: true, width: 412 },
  warm,
});

const createReport = (profiles: ProfileReportValue[]): PerfReportValue => ({
  profiles,
  target: { baseUrl: 'http://localhost:4175/skladburg/' },
});

describe('formatMarkdownReport', () => {
  it('shows medians, minimums and maximums of the first screen in the profile table', () => {
    const report = createReport([
      createProfile('mobile-fast-4g', [
        createRun({ firstScreenReady: 2000 }),
        createRun({ firstScreenReady: 3000 }),
        createRun({ firstScreenReady: 2500 }),
      ]),
    ]);

    expect(formatMarkdownReport(report, '2026-10-16')).toContain('| Первый экран готов, мс | 2500 | 2000 | 3000 | — | — | — |');
  });

  it('says the worker is throttled only when every cold run was', () => {
    const throttled = createReport([createProfile('mobile-fast-4g', [createRun(), createRun()])]);
    const mixed = createReport([createProfile('mobile-fast-4g', [createRun(), createRun({ isWorkerThrottled: false })])]);

    expect(formatMarkdownReport(throttled, 'now')).toContain('Worker под троттлингом: да');
    expect(formatMarkdownReport(mixed, 'now')).toContain('Worker под троттлингом: нет');
  });

  it('adds the waterfall and the worker log of the main profile', () => {
    const report = createReport([createProfile('mobile-fast-4g', [createRun()])]);
    const markdown = formatMarkdownReport(report, 'now');

    expect(markdown).toContain('| index | index-Ka_enA0r.js | page | 100 | 500 | 78.1 | нет |');
    expect(markdown).toContain('| GetSession | 1900 | 2100 | 200 |');
  });

  it('lists duplicated files with the number of runs they appeared in', () => {
    const duplicate = 'https://host/skladburg/assets/demo-zt3dE9Y4.js';
    const report = createReport([
      createProfile('mobile-fast-4g', [createRun({ duplicates: [duplicate] }), createRun(), createRun({ duplicates: [duplicate] })]),
    ]);

    expect(formatMarkdownReport(report, 'now')).toContain(`- холодный старт: demo-zt3dE9Y4.js — в 2 из 3 прогонов (${duplicate})`);
  });

  it('says whether the service worker was throttled, failed to be, or never appeared', () => {
    const applied = createReport([createProfile('mobile-fast-4g', [createRun(), createRun({ isServiceWorkerThrottled: null })])]);
    const refused = createReport([createProfile('mobile-fast-4g', [createRun(), createRun({ isServiceWorkerThrottled: false })])]);
    const absent = createReport([createProfile('mobile-fast-4g', [createRun({ isServiceWorkerThrottled: null })])]);

    expect(formatMarkdownReport(applied, 'now')).toContain('Service worker под троттлингом: да');
    expect(formatMarkdownReport(refused, 'now')).toContain('Service worker под троттлингом: нет');
    expect(formatMarkdownReport(absent, 'now')).toContain('Service worker под троттлингом: неприменимо');
  });

  it('sums up the service worker traffic of the main profile in one line, not file by file', () => {
    const report = createReport([
      createProfile('mobile-fast-4g', [
        createRun({
          requests: [
            { bytes: 1000, endAt: 900, fromCache: false, startAt: 800, target: 'service-worker', url: 'https://host/a.js' },
            { bytes: 1000, endAt: 1800, fromCache: false, startAt: 1500, target: 'service-worker', url: 'https://host/b.js' },
            { bytes: 1000, endAt: 3000, fromCache: false, startAt: 2600, target: 'service-worker', url: 'https://host/c.js' },
          ],
          serviceWorkerRequestsBeforeReady: 2,
        }),
      ]),
    ]);

    expect(formatMarkdownReport(report, 'now')).toContain(
      'Service worker: первый запрос 800 мс, последний запрос до готовности 1500 мс; '
      + 'до готовности запросов 2, 50.0 КБ; всего в прогоне 3.',
    );
  });

  it('says so when the service worker sent nothing before the first screen', () => {
    const report = createReport([
      createProfile('mobile-fast-4g', [
        createRun({
          requests: [{ bytes: 1000, endAt: 2600, fromCache: false, startAt: 2500, target: 'service-worker', url: 'https://host/a.js' }],
          serviceWorkerBytesBeforeReady: 0,
          serviceWorkerRequestsBeforeReady: 0,
        }),
      ]),
    ]);

    expect(formatMarkdownReport(report, 'now')).toContain(
      'Service worker: первый запрос 2500 мс, до готовности запросов не было; всего в прогоне 1.',
    );
  });

  it('lists the files the service worker downloaded again with the number of runs', () => {
    const repeated = 'https://host/skladburg/assets/network-abc.js';
    const report = createReport([
      createProfile('mobile-fast-4g', [createRun({ serviceWorkerRepeats: [repeated] }), createRun()]),
    ]);

    expect(formatMarkdownReport(report, 'now')).toContain(`- холодный старт: network-abc.js — в 1 из 2 прогонов (${repeated})`);
  });

  it('writes the build time next to the commit', () => {
    const report: PerfReportValue = {
      profiles: [],
      target: { baseUrl: 'http://localhost:4175/skladburg/', buildTime: '2026-10-16T09:00:00.000Z', commit: 'f5c3505-dirty' },
    };

    expect(formatMarkdownReport(report, 'now')).toContain(
      'Адрес: http://localhost:4175/skladburg/, сборка f5c3505-dirty, собрана 2026-10-16T09:00:00.000Z. Снято: now.',
    );
  });

  it('keeps going when no run reached the first screen', () => {
    const report = createReport([createProfile('mobile-fast-4g', [createRun({ firstScreenReady: null })])]);

    expect(formatMarkdownReport(report, 'now')).toContain('Ни один холодный прогон не дошёл');
  });
});

describe('formatMedianTable', () => {
  it('prints one row per profile with the medians', () => {
    const report = createReport([
      createProfile('mobile-fast-4g', [createRun({ firstScreenReady: 2400 })], [createRun({ firstScreenReady: 900 })]),
    ]);

    expect(formatMedianTable(report)).toContain('| mobile-fast-4g | 600 | 2400 | 900 | 3 | 100.0 | 14 | 50.0 | да | да |');
  });
});
