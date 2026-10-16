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

  it('says the worker check is not applicable when no cold run loaded the core over the worker network', () => {
    const absent = createReport([
      createProfile('mobile-fast-4g', [
        createRun({ isWorkerThrottled: null, workerThrottlingNote: 'no-network-load' }),
        createRun({ isWorkerThrottled: null, workerThrottlingNote: 'no-network-load' }),
      ]),
    ]);
    const partial = createReport([
      createProfile('mobile-fast-4g', [createRun(), createRun({ isWorkerThrottled: null, workerThrottlingNote: 'no-network-load' })]),
    ]);
    const violated = createReport([
      createProfile('mobile-fast-4g', [
        createRun({ isWorkerThrottled: null, workerThrottlingNote: 'no-network-load' }),
        createRun({ isWorkerThrottled: false }),
      ]),
    ]);

    expect(formatMarkdownReport(absent, 'now')).toContain(
      'Worker под троттлингом: неприменимо: Worker берёт ядро из кеша (подсказка в документе).',
    );
    expect(formatMarkdownReport(partial, 'now')).toContain('Worker под троттлингом: частично');
    expect(formatMarkdownReport(violated, 'now')).toContain('Worker под троттлингом: нет');
    expect(formatMedianTable(absent)).toContain('| неприменимо | да |');
  });

  it('keeps an old report readable: a run without the note and a boolean verdict reads as before', () => {
    const oldRun = createRun({ isWorkerThrottled: false });

    expect(oldRun).not.toHaveProperty('workerThrottlingNote');
    expect(formatMarkdownReport(createReport([createProfile('mobile-fast-4g', [oldRun])]), 'now')).toContain('Worker под троттлингом: нет');
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

  it('says whether the service worker was throttled, was not, was not confirmed in time, or never appeared', () => {
    const applied = createReport([createProfile('mobile-fast-4g', [createRun(), createRun()])]);
    const refused = createReport([createProfile('mobile-fast-4g', [createRun({ isServiceWorkerThrottled: false })])]);
    const unfinished = createReport([
      createProfile('mobile-fast-4g', [createRun({ isServiceWorkerThrottled: null, serviceWorkerThrottlingNote: 'not-finished' })]),
    ]);
    const absent = createReport([createProfile('mobile-fast-4g', [createRun({ isServiceWorkerThrottled: null })])]);

    expect(formatMarkdownReport(applied, 'now')).toContain('Service worker под троттлингом: да');
    expect(formatMarkdownReport(refused, 'now')).toContain('Service worker под троттлингом: нет');
    expect(formatMarkdownReport(unfinished, 'now')).toContain('Service worker под троттлингом: не определено');
    expect(formatMarkdownReport(absent, 'now')).toContain('Service worker под троттлингом: неприменимо');
  });

  it('names the runs where the service worker was not confirmed as throttled and why', () => {
    const report = createReport([
      createProfile('mobile-fast-4g', [
        createRun(),
        createRun({ isServiceWorkerThrottled: null, serviceWorkerThrottlingNote: 'not-finished' }),
        createRun({ isServiceWorkerThrottled: false, serviceWorkerThrottlingNote: 'loaded-before-emulation' }),
        createRun({ isServiceWorkerThrottled: false, serviceWorkerThrottlingNote: 'refused' }),
        createRun({ isServiceWorkerThrottled: null, serviceWorkerThrottlingNote: 'absent' }),
      ]),
    ]);
    const markdown = formatMarkdownReport(report, 'now');

    expect(markdown).toContain('Service worker под троттлингом: частично');
    expect(markdown).toContain('- холодный прогон №2: подготовка эмуляции не завершилась к снимку');
    expect(markdown).toContain('- холодный прогон №3: первые загрузки service worker прошли до эмуляции');
    expect(markdown).toContain('- холодный прогон №4: браузер отказал в эмуляции сети на цели service worker');
    expect(markdown).toContain('- холодный прогон №5: service worker не появился');
    expect(markdown).not.toContain('холодный прогон №1');
  });

  it('keeps a report without notes readable: an old false means a refusal', () => {
    const report = createReport([createProfile('mobile-fast-4g', [createRun(), createRun({ isServiceWorkerThrottled: false })])]);

    expect(formatMarkdownReport(report, 'now')).toContain('- холодный прогон №2: браузер отказал в эмуляции сети на цели service worker');
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

  it('states the document protocol in the header when it is known', () => {
    const profiles = [createProfile('mobile-fast-4g', [createRun()])];

    const withProtocol = { ...createReport(profiles), target: { baseUrl: 'https://localhost:4175/skladburg/', protocol: 'h2' } };

    expect(formatMarkdownReport(withProtocol, 'now')).toContain('Адрес: https://localhost:4175/skladburg/, протокол документа h2.');
    expect(formatMarkdownReport(createReport(profiles), 'now')).not.toContain('протокол документа');
  });

  it('shows the channel sharing estimate and forecasts the Pages skeleton only for the main profile with a baseline', () => {
    const run = createRun({ entrySharingBytes: 180_000, entrySharingMs: 175 });
    const profiles = [createProfile('mobile-fast-4g', [run]), createProfile('mobile-slow-4g', [run])];
    const withBaseline = formatMarkdownReport(
      { ...createReport(profiles), target: { baseUrl: 'https://host/', pagesSkeletonBaselineMs: 972 } },
      'now',
    );
    const withoutBaseline = formatMarkdownReport(createReport(profiles), 'now');

    expect(withBaseline).toContain('Дележ канала с входным скриптом: 175.8 КБ параллельно, оценка задержки ≈ 175 мс');
    expect(withBaseline.match(/Прогноз скелетона Pages/g)).toHaveLength(1);
    expect(withBaseline).toContain('Прогноз скелетона Pages ≈ база + 175 мс = 1147 мс');
    expect(withoutBaseline).toContain('Дележ канала с входным скриптом: 175.8 КБ');
    expect(withoutBaseline).not.toContain('Прогноз скелетона Pages');
  });

  it('says there is no sharing data when no run found the entry script', () => {
    const report = createReport([createProfile('mobile-fast-4g', [createRun({ entrySharingBytes: null, entrySharingMs: null })])]);

    expect(formatMarkdownReport(report, 'now')).toContain('Дележ канала с входным скриптом: нет данных');
  });

  it('lists revalidations before the first screen per profile and for the median run, and keeps them out of duplicates', () => {
    const url = 'https://host/skladburg/assets/worker-XkuRDHIr.js';
    const report = createReport([
      createProfile('mobile-fast-4g', [
        createRun({ revalidatedBeforeReady: [url] }),
        createRun({ revalidatedBeforeReady: [url] }),
        createRun({ revalidatedBeforeReady: [] }),
      ]),
    ]);
    const markdown = formatMarkdownReport(report, 'now');

    expect(markdown).toContain(`- холодный старт: worker-XkuRDHIr.js — в 2 из 3 прогонов (${url})`);
    expect(markdown).toContain('Перепроверки (304) до готовности: 1 (worker-XkuRDHIr.js).');
    expect(markdown).toContain('- холодный старт: дублей нет');
  });

  it('puts the metrics from the entry script into the table and the console summary', () => {
    const run = createRun({ entryStart: 560, firstScreenFromEntry: 1040, skeletonFromEntry: 590 });
    const report = createReport([createProfile('mobile-fast-4g', [run])]);

    expect(formatMarkdownReport(report, 'now')).toContain('| Скелетон от старта входного скрипта, мс | 590 | 590 | 590 | — | — | — |');
    expect(formatMedianTable(report)).toMatch(/\| 590 \| 1040 \| — \| 0 \|$/m);
  });
});
