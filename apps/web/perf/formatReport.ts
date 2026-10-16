import type {
  MetricNameValue,
  MetricSummaryValue,
  PerfReportValue,
  ProfileReportValue,
  RequestValue,
  RunValue,
  ServiceWorkerThrottlingNoteValue,
} from './perfTypes.ts';

import { buildWaterfall } from './buildWaterfall.ts';
import {
  computeSpreadRatio,
  findMedianRun,
} from './computeStatistics.ts';
import { pairWorkerMessages } from './pairWorkerMessages.ts';
import { readLastSegment } from './readUrlPath.ts';

interface MetricRowValue {
  isBytes?: boolean;
  label: string;
  name: MetricNameValue;
}

const MAIN_PROFILE_NAME = 'mobile-fast-4g';
const EMPTY_CELL = '—';
const BYTES_PER_KILOBYTE = 1024;

const METRIC_ROWS: readonly MetricRowValue[] = [
  { label: 'TTFB, мс', name: 'ttfb' },
  { label: 'FCP, мс', name: 'fcp' },
  { label: 'Скелетон оболочки, мс', name: 'skeletonShown' },
  { label: 'LCP, мс', name: 'lcp' },
  { label: 'Worker создан, мс', name: 'workerCreated' },
  { label: 'Движок готов, мс', name: 'engineReady' },
  { label: 'Первый экран готов, мс', name: 'firstScreenReady' },
  { label: 'Первый кадр сцены, мс', name: 'sceneFirstFrame' },
  { label: 'Долгих задач до готовности', name: 'longTaskCount' },
  { label: 'Сумма сверх 50 мс, мс', name: 'longTaskExcessMs' },
  { isBytes: true, label: 'Байт до готовности, КБ', name: 'bytesBeforeReady' },
  { label: 'Запросов до готовности', name: 'requestsBeforeReady' },
  { isBytes: true, label: 'Service worker: байт до готовности, КБ', name: 'serviceWorkerBytesBeforeReady' },
  { label: 'Service worker: запросов до готовности', name: 'serviceWorkerRequestsBeforeReady' },
];

type ServiceWorkerVerdictValue = 'absent' | 'applied' | 'not-applied' | 'partial' | 'unfinished';

const SERVICE_WORKER_VERDICT_LABELS: Record<ServiceWorkerVerdictValue, string> = {
  'absent': 'неприменимо',
  'applied': 'да',
  'not-applied': 'нет',
  'partial': 'частично',
  'unfinished': 'не определено',
};

const SERVICE_WORKER_NOTE_TEXTS: Record<ServiceWorkerThrottlingNoteValue, string> = {
  'absent': 'service worker не появился',
  'loaded-before-emulation': 'первые загрузки service worker прошли до эмуляции',
  'not-finished': 'подготовка эмуляции не завершилась к снимку',
  'refused': 'браузер отказал в эмуляции сети на цели service worker',
};

const formatNumber = (value: null | number, isBytes = false): string => {
  if (value === null) {
    return EMPTY_CELL;
  }

  return isBytes ? (value / BYTES_PER_KILOBYTE).toFixed(1) : String(Math.round(value));
};

const formatSummaryCells = (summary: MetricSummaryValue, isBytes: boolean): string[] => [
  formatNumber(summary.median, isBytes),
  formatNumber(summary.min, isBytes),
  formatNumber(summary.max, isBytes),
];

const formatTable = (header: readonly string[], rows: readonly (readonly string[])[]): string[] => [
  `| ${header.join(' | ')} |`,
  `| ${header.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| ${row.join(' | ')} |`),
];

const formatSpread = (profile: ProfileReportValue): string[] => {
  const coldSpread = computeSpreadRatio(profile.summary.cold.firstScreenReady);
  const warmSpread = computeSpreadRatio(profile.summary.warm.firstScreenReady);
  const formatPercent = (ratio: null | number): string => (ratio === null ? EMPTY_CELL : `${String(Math.round(ratio * 100))} %`);

  return [`Разброс первого экрана (макс − мин) / медиана: холодный ${formatPercent(coldSpread)}, тёплый ${formatPercent(warmSpread)}.`];
};

type WorkerVerdictValue = 'absent' | 'applied' | 'not-applied' | 'partial';

const WORKER_VERDICT_LABELS: Record<WorkerVerdictValue, string> = {
  'absent': 'неприменимо',
  'applied': 'да',
  'not-applied': 'нет',
  'partial': 'частично',
};

const readWorkerVerdict = (profile: ProfileReportValue): WorkerVerdictValue => {
  const throttledCount = profile.cold.filter(run => run.isWorkerThrottled === true).length;
  const unknownCount = profile.cold.filter(run => run.isWorkerThrottled === null).length;

  if (profile.cold.length === 0 || throttledCount + unknownCount < profile.cold.length) {
    return 'not-applied';
  }

  if (throttledCount === 0) {
    return 'absent';
  }

  return unknownCount > 0 ? 'partial' : 'applied';
};

const readServiceWorkerNote = (run: RunValue): ServiceWorkerThrottlingNoteValue => {
  if (run.serviceWorkerThrottlingNote !== undefined) {
    return run.serviceWorkerThrottlingNote;
  }

  return run.isServiceWorkerThrottled === false ? 'refused' : 'absent';
};

const readServiceWorkerVerdict = (profile: ProfileReportValue): ServiceWorkerVerdictValue => {
  const throttledCount = profile.cold.filter(run => run.isServiceWorkerThrottled === true).length;
  const unthrottledCount = profile.cold.filter(run => run.isServiceWorkerThrottled === false).length;

  if (unthrottledCount > 0) {
    return throttledCount > 0 ? 'partial' : 'not-applied';
  }

  if (throttledCount > 0) {
    return 'applied';
  }

  return profile.cold.some(run => run.serviceWorkerThrottlingNote === 'not-finished') ? 'unfinished' : 'absent';
};

const formatServiceWorkerExceptions = (profile: ProfileReportValue, verdict: ServiceWorkerVerdictValue): string[] => {
  const exceptions = profile.cold
    .map((run, index) => ({ index, run }))
    .filter(({ run }) => run.isServiceWorkerThrottled !== true);

  if (verdict === 'absent' || exceptions.length === 0) {
    return [];
  }

  return [
    '',
    ...exceptions.map(({ index, run }) => (
      `- холодный прогон №${String(index + 1)}: ${SERVICE_WORKER_NOTE_TEXTS[readServiceWorkerNote(run)]}`
    )),
  ];
};

const formatWorkerThrottling = (profile: ProfileReportValue): string[] => {
  const verdict = readWorkerVerdict(profile);
  const details: Record<WorkerVerdictValue, string> = {
    'absent': ': Worker берёт ядро из кеша (подсказка в документе).',
    'applied': ' (сеть, по времени загрузки ядра движка в холодных прогонах).',
    'not-applied': ' (сеть, по времени загрузки ядра движка в холодных прогонах).',
    'partial': ' (сеть, по времени загрузки ядра; в части прогонов Worker брал ядро из кеша).',
  };
  const lines = [`Worker под троттлингом: ${WORKER_VERDICT_LABELS[verdict]}${details[verdict]}`];

  if (profile.cpuRate > 1) {
    lines.push(
      '',
      'CPU замедлен только на основном потоке: на Worker браузер замедление не применяет, '
      + 'движок в Worker быстрее реального телефона.',
    );
  }

  return lines;
};

const formatServiceWorkerThrottling = (profile: ProfileReportValue): string[] => {
  const verdict = readServiceWorkerVerdict(profile);
  const details: Record<ServiceWorkerVerdictValue, string> = {
    'absent': 'service worker не появился до конца холодных прогонов',
    'applied': 'сеть, эмуляция задана на цели service worker',
    'not-applied': 'сеть замедлена не была: отказ браузера или первые загрузки прошли до эмуляции, причины ниже',
    'partial': 'сеть, но не во всех холодных прогонах; исключения ниже',
    'unfinished': 'подготовка эмуляции не завершилась к снимку ни в одном прогоне со service worker',
  };

  return [
    `Service worker под троттлингом: ${SERVICE_WORKER_VERDICT_LABELS[verdict]} (${details[verdict]}).`,
    ...formatServiceWorkerExceptions(profile, verdict),
    '',
    'Эмуляция CDP задаётся на цель, а не на общий канал: загрузки service worker идут под своей эмуляцией и не отнимают '
    + 'полосу у страницы и Worker (проверено отдельным опытом: две параллельные загрузки не замедляют друг друга). '
    + 'Конкуренция precache с критическим путём моделируется не полностью; оценка конкуренции — по строкам '
    + '«Service worker: … до готовности».',
    '',
    'Окно замера кончается через 1,5 с после готовности, а precache идёт долго и последовательно: '
    + 'повторные загрузки service worker в окно попадают лишь частично, их список — нижняя оценка.',
  ];
};

const formatProfileTable = (profile: ProfileReportValue): string[] => formatTable(
  ['Метрика', 'Холодный: медиана', 'мин', 'макс', 'Тёплый: медиана', 'мин', 'макс'],
  METRIC_ROWS.map(({ isBytes = false, label, name }) => [
    label,
    ...formatSummaryCells(profile.summary.cold[name], isBytes),
    ...formatSummaryCells(profile.summary.warm[name], isBytes),
  ]),
);

const formatRequestRow = (label: string, request: RequestValue | undefined): string[] => {
  if (request === undefined) {
    return [label, EMPTY_CELL, EMPTY_CELL, EMPTY_CELL, EMPTY_CELL, EMPTY_CELL, EMPTY_CELL];
  }

  return [
    label,
    readLastSegment(request.url),
    request.target,
    formatNumber(request.startAt),
    formatNumber(request.endAt),
    formatNumber(request.bytes, true),
    request.fromCache ? 'да' : 'нет',
  ];
};

const formatWaterfall = (run: RunValue): string[] => formatTable(
  ['Файл', 'Имя', 'Откуда', 'Начало, мс', 'Конец, мс', 'КБ по сети', 'Из кеша'],
  buildWaterfall(run.requests).map(row => formatRequestRow(row.label, row.request)),
);

const formatWorkerLog = (run: RunValue): string[] => formatTable(
  ['Вызов Worker', 'Отправлен, мс', 'Ответ, мс', 'Ожидание, мс'],
  pairWorkerMessages(run.workerMessages).map((call) => {
    const waitMs = call.sentAt !== undefined && call.answeredAt !== undefined ? call.answeredAt - call.sentAt : null;

    return [call.label, formatNumber(call.sentAt ?? null), formatNumber(call.answeredAt ?? null), formatNumber(waitMs)];
  }),
);

const countFiles = (runs: readonly RunValue[], readFiles: (run: RunValue) => readonly string[]): Map<string, number> => {
  const counts = new Map<string, number>();

  for (const run of runs) {
    for (const url of readFiles(run)) {
      counts.set(url, (counts.get(url) ?? 0) + 1);
    }
  }

  return counts;
};

const formatFileCounts = (
  profile: ProfileReportValue,
  readFiles: (run: RunValue) => readonly string[],
  emptyText: string,
): string[] => {
  const lines: string[] = [];

  for (const [seriesName, runs] of [['холодный', profile.cold], ['тёплый', profile.warm]] as const) {
    const counts = countFiles(runs, readFiles);

    if (counts.size === 0) {
      lines.push(`- ${seriesName} старт: ${emptyText}`);
    }

    for (const [url, count] of counts) {
      lines.push(`- ${seriesName} старт: ${readLastSegment(url)} — в ${String(count)} из ${String(runs.length)} прогонов (${url})`);
    }
  }

  return lines;
};

const formatServiceWorkerSummary = (run: RunValue): string => {
  const requests = run.requests.filter(request => request.target === 'service-worker');
  const first = requests[0];

  if (first === undefined) {
    return 'Service worker: сетевых запросов в этом прогоне не было.';
  }

  const readyAt = run.firstScreenReady;
  const beforeReady = readyAt === null ? [] : requests.filter(request => request.startAt <= readyAt);
  const last = beforeReady.at(-1);
  const totalText = `всего в прогоне ${String(requests.length)}`;
  const tailText = last === undefined
    ? `до готовности запросов не было; ${totalText}`
    : `последний запрос до готовности ${formatNumber(last.startAt)} мс; до готовности запросов `
      + `${String(run.serviceWorkerRequestsBeforeReady)}, ${formatNumber(run.serviceWorkerBytesBeforeReady, true)} КБ; ${totalText}`;

  return `Service worker: первый запрос ${formatNumber(first.startAt)} мс, ${tailText}.`;
};

const pickMainProfile = (report: PerfReportValue): ProfileReportValue | undefined => (
  report.profiles.find(profile => profile.name === MAIN_PROFILE_NAME) ?? report.profiles[0]
);

const formatProfileSection = (profile: ProfileReportValue): string[] => [
  `## Профиль ${profile.name}`,
  '',
  `Сеть: задержка ${String(profile.network.latencyMs)} мс, приём ${String(Math.round(profile.network.downloadBytesPerSecond))} Б/с, `
  + `отдача ${String(Math.round(profile.network.uploadBytesPerSecond))} Б/с; CPU ×${String(profile.cpuRate)}; `
  + `экран ${String(profile.viewport.width)}×${String(profile.viewport.height)}, DPR ${String(profile.viewport.deviceScaleFactor)}. `
  + `Прогонов: холодных ${String(profile.cold.length)}, тёплых ${String(profile.warm.length)}.`,
  '',
  ...formatWorkerThrottling(profile),
  '',
  ...formatServiceWorkerThrottling(profile),
  '',
  ...formatProfileTable(profile),
  '',
  ...formatSpread(profile),
  '',
  '### Дубли',
  '',
  ...formatFileCounts(profile, run => run.duplicates, 'дублей нет'),
  '',
  '### Повторные загрузки service worker',
  '',
  'Файлы, которые service worker скачал из сети, хотя страница или Worker уже скачали их из сети в этом прогоне. '
  + 'Справочная цифра, в дубли и в байты до готовности не входит.',
  '',
  ...formatFileCounts(profile, run => run.serviceWorkerRepeats, 'повторов нет'),
  '',
];

const formatMainProfileSection = (profile: ProfileReportValue): string[] => {
  const medianRun = findMedianRun(profile.cold);

  if (medianRun === undefined) {
    return [`## Водопад и журнал Worker (${profile.name})`, '', 'Ни один холодный прогон не дошёл до готового первого экрана.', ''];
  }

  return [
    `## Водопад ключевых файлов (${profile.name}, холодный старт, медианный прогон)`,
    '',
    ...formatWaterfall(medianRun),
    '',
    formatServiceWorkerSummary(medianRun),
    '',
    `## Журнал сообщений Worker (${profile.name}, холодный старт, медианный прогон)`,
    '',
    ...formatWorkerLog(medianRun),
    '',
  ];
};

export const formatMarkdownReport = (report: PerfReportValue, generatedAt: string): string => {
  const mainProfile = pickMainProfile(report);
  const commit = report.target.commit === undefined ? '' : `, сборка ${report.target.commit}`;
  const buildTime = report.target.buildTime === undefined ? '' : `, собрана ${report.target.buildTime}`;

  return [
    '# Замер первого экрана',
    '',
    `Адрес: ${report.target.baseUrl}${commit}${buildTime}. Снято: ${generatedAt}.`,
    '',
    'Время — от начала навигации. «Готов» — по маркерам DOM: скелетон оболочки сменён, страница раздела на месте, '
    + 'скелетон HUD исчез, кнопка профиля без aria-busy, часы с цифрами, aria-busy вне зоны сцены нет. '
    + 'Байты — по сети (страница и Worker); запросов — начатых до готовности, байт — завершённых до готовности. '
    + 'Загрузки service worker считаются отдельно и в эти цифры не входят.',
    '',
    ...report.profiles.flatMap(formatProfileSection),
    ...(mainProfile === undefined ? [] : formatMainProfileSection(mainProfile)),
  ].join('\n');
};

export const formatJsonReport = (report: PerfReportValue): string => `${JSON.stringify(report, null, 2)}\n`;

export const formatMedianTable = (report: PerfReportValue): string => {
  const rows = report.profiles.map(profile => [
    profile.name,
    formatNumber(profile.summary.cold.fcp.median),
    formatNumber(profile.summary.cold.firstScreenReady.median),
    formatNumber(profile.summary.warm.firstScreenReady.median),
    formatNumber(profile.summary.cold.longTaskCount.median),
    formatNumber(profile.summary.cold.bytesBeforeReady.median, true),
    formatNumber(profile.summary.cold.requestsBeforeReady.median),
    formatNumber(profile.summary.cold.serviceWorkerBytesBeforeReady.median, true),
    WORKER_VERDICT_LABELS[readWorkerVerdict(profile)],
    SERVICE_WORKER_VERDICT_LABELS[readServiceWorkerVerdict(profile)],
  ]);

  return formatTable(
    [
      'Профиль',
      'FCP хол., мс',
      'Готов хол., мс',
      'Готов тёпл., мс',
      'Долг. задач',
      'КБ',
      'Запросов',
      'SW, КБ',
      'Worker троттлен',
      'SW троттлен',
    ],
    rows,
  ).join('\n');
};
