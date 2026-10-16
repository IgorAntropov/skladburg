import type {
  BrowserContext,
  Page,
} from '@playwright/test';

import type { ProbeSnapshotValue } from './buildRunValue.ts';
import type {
  PerfProfileValue,
  RunValue,
} from './perfTypes.ts';

import { buildRunValue } from './buildRunValue.ts';
import { isTimeoutError } from './isTimeoutError.ts';
import {
  createProbeScript,
  IS_PROBE_READY_SCRIPT,
  IS_SCENE_DRAWN_SCRIPT,
  READ_PROBE_SNAPSHOT_SCRIPT,
} from './probeScript.ts';
import { startEmulation } from './startEmulation.ts';

const READY_TIMEOUT_MS = 90_000;
const SCENE_TIMEOUT_MS = 30_000;
const SETTLE_MS = 1500;
const POLLING_INTERVAL_MS = 100;

export interface MeasuredRunValue {
  page: Page;
  run: RunValue;
}

export interface MeasureRunInputValue {
  baseUrl: string;
  context: BrowserContext;
  profile: PerfProfileValue;
  runLabel: string;
}

const waitForSceneFrame = async (page: Page): Promise<void> => {
  await page
    .waitForFunction(IS_SCENE_DRAWN_SCRIPT, undefined, { polling: POLLING_INTERVAL_MS, timeout: SCENE_TIMEOUT_MS })
    .catch((error: unknown) => {
      console.log('> measureRun -> waitForSceneFrame:', { error: String(error).split('\n')[0] });
    });
};

const waitForFirstScreen = async (page: Page, profile: PerfProfileValue, runLabel: string): Promise<boolean> => {
  try {
    await page.waitForFunction(IS_PROBE_READY_SCRIPT, undefined, { polling: POLLING_INTERVAL_MS, timeout: READY_TIMEOUT_MS });

    return true;
  }
  catch (error: unknown) {
    if (!isTimeoutError(error)) {
      throw error;
    }

    console.log('> measureRun -> waitForFirstScreen:', {
      error: String(error).split('\n')[0],
      name: profile.name,
      run: runLabel,
    });

    return false;
  }
};

export const measureRun = async ({ baseUrl, context, profile, runLabel }: MeasureRunInputValue): Promise<MeasuredRunValue> => {
  const page = await context.newPage();

  await page.addInitScript({ content: createProbeScript({ isSceneTracked: profile.isSceneTracked }) });

  const emulation = await startEmulation(context, page, profile);

  await page.goto(baseUrl, { waitUntil: 'commit' });

  const isReady = await waitForFirstScreen(page, profile, runLabel);

  if (isReady) {
    if (profile.isSceneTracked) {
      await waitForSceneFrame(page);
    }

    await page.waitForTimeout(SETTLE_MS);
  }

  const snapshot = await page.evaluate<ProbeSnapshotValue>(READ_PROBE_SNAPSHOT_SCRIPT);
  const requests = emulation.collectRequests(snapshot.timeOrigin);
  const run = buildRunValue({
    isServiceWorkerThrottled: emulation.readServiceWorkerThrottling(),
    network: profile.network,
    openRequests: emulation.collectOpenRequests(snapshot.timeOrigin),
    requests,
    snapshot,
  });

  await emulation.detach();

  return { page, run };
};
