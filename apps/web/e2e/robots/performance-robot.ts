import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import {
  createBlockMainThreadScript,
  INSTALL_LONG_TASK_RECORDER,
  READ_IS_LONG_TASK_RECORDER_INSTALLED,
  TAKE_LONG_TASK_DURATIONS,
} from '../fixtures/pageScripts.ts';

export interface PerformanceRobotValue {
  blockMainThread: (durationMs: number) => Promise<void>;
  expectRecorderInstalled: () => Promise<void>;
  installRecorder: () => Promise<void>;
  takeLongestTaskMs: () => Promise<number>;
}

export const createPerformanceRobot = (page: Page): PerformanceRobotValue => {
  return {
    async blockMainThread(durationMs: number): Promise<void> {
      await page.evaluate(createBlockMainThreadScript(durationMs));
    },
    async expectRecorderInstalled(): Promise<void> {
      expect(await page.evaluate<boolean>(READ_IS_LONG_TASK_RECORDER_INSTALLED)).toBe(true);
    },
    async installRecorder(): Promise<void> {
      await page.addInitScript({ content: INSTALL_LONG_TASK_RECORDER });
    },
    async takeLongestTaskMs(): Promise<number> {
      const durations = await page.evaluate<number[]>(TAKE_LONG_TASK_DURATIONS);

      return Math.round(Math.max(0, ...durations));
    },
  };
};
