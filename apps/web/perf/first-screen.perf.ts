import type {
  Browser,
  BrowserContext,
} from '@playwright/test';

import { test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';

import type { PerfPreviewProtocolValue } from './perfPreview.ts';
import type {
  PerfProfileValue,
  PerfReportValue,
  ProfileReportValue,
  RunValue,
  TargetValue,
} from './perfTypes.ts';

import { summarizeSeries } from './computeStatistics.ts';
import { formatMedianTable } from './formatReport.ts';
import { measureRun } from './measureRun.ts';
import {
  assertDocumentProtocol,
  createPreviewUrl,
  PERF_PREVIEW_CACHE_CONTROL,
} from './perfPreview.ts';
import { selectPerfProfiles } from './perfProfiles.ts';
import { readPerfEnv } from './readPerfEnv.ts';
import { requestPreviewHeaders } from './requestPreviewHeaders.ts';
import { writeReportFiles } from './writeReportFiles.ts';

const SERVICE_WORKER_READY_TIMEOUT_MS = 60_000;
const BUILT_INDEX_PATH = resolve(import.meta.dirname, '..', 'dist', 'index.html');
const LOCALE = 'ru-RU';
const TIME_ZONE = 'Europe/Moscow';

const WAIT_FOR_SERVICE_WORKER_SCRIPT = `
Promise.race([
  navigator.serviceWorker.ready.then(() => true),
  new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error('The service worker did not become ready')), ${String(SERVICE_WORKER_READY_TIMEOUT_MS)});
  }),
])
`;

interface ProfileMeasurementValue {
  protocol: string | undefined;
  report: ProfileReportValue;
}

interface SeriesInputValue {
  baseUrl: string;
  browser: Browser;
  coldRunCount: number;
  profile: PerfProfileValue;
  warmRunCount: number;
}

const readCommit = (): string | undefined => {
  try {
    return execFileSync('git', ['describe', '--always', '--dirty'], { encoding: 'utf8' }).trim();
  }
  catch {
    return undefined;
  }
};

const readBuildTime = (): string | undefined => {
  try {
    return statSync(BUILT_INDEX_PATH).mtime.toISOString();
  }
  catch {
    return undefined;
  }
};

interface CreateTargetInputValue {
  baseUrl: string;
  isLocalPreview: boolean;
  pagesSkeletonBaselineMs: number | undefined;
  protocol: string | undefined;
}

const createTarget = ({ baseUrl, isLocalPreview, pagesSkeletonBaselineMs, protocol }: CreateTargetInputValue): TargetValue => {
  const commit = isLocalPreview ? readCommit() : undefined;
  const buildTime = isLocalPreview ? readBuildTime() : undefined;

  return {
    baseUrl,
    ...(buildTime === undefined ? {} : { buildTime }),
    ...(commit === undefined ? {} : { commit }),
    ...(pagesSkeletonBaselineMs === undefined ? {} : { pagesSkeletonBaselineMs }),
    ...(protocol === undefined ? {} : { protocol }),
  };
};

const createProfileContext = (browser: Browser, profile: PerfProfileValue): Promise<BrowserContext> => browser.newContext({
  deviceScaleFactor: profile.viewport.deviceScaleFactor,
  hasTouch: profile.viewport.hasTouch,
  isMobile: profile.viewport.isMobile,
  locale: LOCALE,
  serviceWorkers: 'allow',
  timezoneId: TIME_ZONE,
  viewport: { height: profile.viewport.height, width: profile.viewport.width },
});

const logRun = (series: string, index: number, profile: PerfProfileValue, run: RunValue): void => {
  console.log(`> first-screen.perf -> ${series}Run:`, { index, name: profile.name, ready: run.firstScreenReady });
};

const measureWarmRuns = async (
  context: BrowserContext,
  { baseUrl, profile, warmRunCount }: SeriesInputValue,
): Promise<RunValue[]> => {
  const warm: RunValue[] = [];

  for (let index = 0; index < warmRunCount; index += 1) {
    const { page, run } = await measureRun({ baseUrl, context, profile, runLabel: `warm ${String(index + 1)}` });

    warm.push(run);
    logRun('warm', index, profile, run);
    await page.close();
  }

  return warm;
};

const discardWarmUpRun = async (
  { baseUrl, browser, profile }: SeriesInputValue,
): Promise<string | undefined> => {
  const context = await createProfileContext(browser, profile);
  const { documentProtocol, page } = await measureRun({ baseUrl, context, profile, runLabel: 'warm-up' });

  await page.close();
  await context.close();

  return documentProtocol;
};

const measureProfile = async (
  input: SeriesInputValue,
  previewProtocol: PerfPreviewProtocolValue | undefined,
): Promise<ProfileMeasurementValue> => {
  const { baseUrl, browser, coldRunCount, profile } = input;
  const cold: RunValue[] = [];
  let warm: RunValue[] = [];

  const protocol = await discardWarmUpRun(input);

  if (previewProtocol !== undefined) {
    assertDocumentProtocol(previewProtocol, protocol);
  }

  for (let index = 0; index < coldRunCount; index += 1) {
    const context = await createProfileContext(browser, profile);
    const { page, run } = await measureRun({ baseUrl, context, profile, runLabel: `cold ${String(index + 1)}` });
    const isLastColdRun = index === coldRunCount - 1;

    cold.push(run);
    logRun('cold', index, profile, run);

    if (isLastColdRun) {
      await page.evaluate<boolean>(WAIT_FOR_SERVICE_WORKER_SCRIPT);
    }

    await page.close();

    if (isLastColdRun) {
      warm = await measureWarmRuns(context, input);
    }

    await context.close();
  }

  return {
    protocol,
    report: {
      cold,
      cpuRate: profile.cpuRate,
      name: profile.name,
      network: profile.network,
      summary: { cold: summarizeSeries(cold), warm: summarizeSeries(warm) },
      viewport: profile.viewport,
      warm,
    },
  };
};

const warmUpServer = async (baseUrl: string, isLocalPreview: boolean, isInsecureTlsAllowed: boolean): Promise<void> => {
  const { cacheControl, status } = await requestPreviewHeaders(baseUrl, isInsecureTlsAllowed);

  if (status < 200 || status >= 300) {
    throw new Error(`The address ${baseUrl} answered ${String(status)}`);
  }

  if (isLocalPreview && cacheControl !== PERF_PREVIEW_CACHE_CONTROL) {
    throw new Error(`The preview must answer Cache-Control "${PERF_PREVIEW_CACHE_CONTROL}", got "${String(cacheControl)}"`);
  }
};

test('measures the first screen on every profile', async ({ browser }) => {
  const env = readPerfEnv(process.env);
  const baseUrl = env.baseUrl ?? createPreviewUrl(env.previewProtocol);
  const isLocalPreview = env.baseUrl === undefined;
  const isInsecureTlsAllowed = isLocalPreview && env.previewProtocol === 'h2';
  const profiles = selectPerfProfiles(env.profileNames);
  const profileReports: ProfileReportValue[] = [];
  let protocol: string | undefined;

  await warmUpServer(baseUrl, isLocalPreview, isInsecureTlsAllowed);

  for (const profile of profiles) {
    const measurement = await measureProfile(
      {
        baseUrl,
        browser,
        coldRunCount: env.coldRunCount,
        profile,
        warmRunCount: env.warmRunCount,
      },
      isLocalPreview ? env.previewProtocol : undefined,
    );

    profileReports.push(measurement.report);
    protocol ??= measurement.protocol;
  }

  const report: PerfReportValue = {
    profiles: profileReports,
    target: createTarget({ baseUrl, isLocalPreview, pagesSkeletonBaselineMs: env.pagesSkeletonBaselineMs, protocol }),
  };

  console.log(`\n${formatMedianTable(report)}\n`);

  if (env.reportFile !== undefined) {
    const written = writeReportFiles(report, env.reportFile, new Date().toISOString());

    console.log('> first-screen.perf -> writeReportFiles:', { written });
  }
});
