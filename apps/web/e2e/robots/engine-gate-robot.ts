import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import {
  createSetEngineGateModeScript,
  INSTALL_ENGINE_GATE,
  READ_HELD_ENGINE_MESSAGE_COUNT,
  RELEASE_ENGINE_GATE,
} from '../fixtures/pageScripts.ts';

export type EngineGateCommandValue = 'list_personas' | 'reset';

export type EngineGateModeValue = 'fail' | 'hold' | 'pass';

export interface EngineGateRobotValue {
  expectHeldCount: (count: number) => Promise<void>;
  install: () => Promise<void>;
  release: () => Promise<void>;
  setMode: (command: EngineGateCommandValue, mode: EngineGateModeValue) => Promise<void>;
  setModeBeforeLoad: (command: EngineGateCommandValue, mode: EngineGateModeValue) => Promise<void>;
}

export const createEngineGateRobot = (page: Page): EngineGateRobotValue => ({
  async expectHeldCount(count: number): Promise<void> {
    await expect.poll(() => page.evaluate<number>(READ_HELD_ENGINE_MESSAGE_COUNT)).toBe(count);
  },
  async install(): Promise<void> {
    await page.addInitScript({ content: INSTALL_ENGINE_GATE });
  },
  async release(): Promise<void> {
    await page.evaluate(RELEASE_ENGINE_GATE);
  },
  async setMode(command: EngineGateCommandValue, mode: EngineGateModeValue): Promise<void> {
    await page.evaluate(createSetEngineGateModeScript(command, mode));
  },
  async setModeBeforeLoad(command: EngineGateCommandValue, mode: EngineGateModeValue): Promise<void> {
    await page.addInitScript({ content: createSetEngineGateModeScript(command, mode) });
  },
});
