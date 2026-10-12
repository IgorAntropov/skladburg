import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import type { GraphicsPreferenceValue } from '../fixtures/graphicsPreference.ts';

import { createStoreGraphicsPreferenceScript } from '../fixtures/graphicsPreference.ts';
import { createProfileMenuLocators } from './profile-menu-locators.ts';
import {
  createSleepScript,
  createWaitForIdleScript,
  DRAW_COUNTER_INIT_SCRIPT,
  READ_DRAW_CALLS_SCRIPT,
} from './scene-draw-counter.ts';

export interface SceneRobotValue {
  chooseGraphicsPreference: (preference: GraphicsPreferenceValue) => Promise<void>;
  countRequestedSceneChunks: () => number;
  expectNoCanvas: () => Promise<void>;
  expectNoDrawCallsFor: (durationMs: number) => Promise<void>;
  expectOneCanvas: () => Promise<void>;
  expectSceneState: (state: SceneStateValue) => Promise<void>;
  openNetwork: () => Promise<void>;
  openNetworkWithGraphicsPreference: (preference: GraphicsPreferenceValue) => Promise<void>;
  readDrawCalls: () => Promise<number>;
  resizeWindow: (size: { height: number; width: number }) => Promise<void>;
  waitForDrawCallsToExceed: (count: number) => Promise<void>;
  waitForIdle: () => Promise<void>;
  watchSceneChunkRequests: () => void;
}

export type SceneStateValue = 'error' | 'loading' | 'off' | 'ready';

const IDLE_WINDOW_MS = 500;
const SCENE_CHUNK_PATTERN = /\/assets\/(?:NetworkBoardScene|SceneRoot)-[^/]+\.js$/;

export const createSceneRobot = (page: Page): SceneRobotValue => {
  const { button: profileButton, getGraphicsOption, menu } = createProfileMenuLocators(page);
  const sceneViewport = page.getByTestId('scene-viewport');
  const canvas = sceneViewport.locator('canvas');
  const requestedSceneChunks: string[] = [];
  let isInitScriptAdded = false;

  const ensureDrawCounter = async (): Promise<void> => {
    if (!isInitScriptAdded) {
      isInitScriptAdded = true;
      await page.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
    }
  };

  const readDrawCalls = async (): Promise<number> => page.evaluate<number>(READ_DRAW_CALLS_SCRIPT);

  const openNetwork = async (): Promise<void> => {
    await ensureDrawCounter();
    await page.goto('/#/network');
  };

  return {
    async chooseGraphicsPreference(preference: GraphicsPreferenceValue): Promise<void> {
      await profileButton.click();
      await expect(menu).toBeVisible();
      await getGraphicsOption(preference).click();
      await expect(menu).toHaveCount(0);
    },
    countRequestedSceneChunks(): number {
      return requestedSceneChunks.length;
    },
    async expectNoCanvas(): Promise<void> {
      await expect(canvas).toHaveCount(0);
    },
    async expectNoDrawCallsFor(durationMs: number): Promise<void> {
      const drawCallsBefore = await readDrawCalls();

      await page.evaluate(createSleepScript(durationMs));

      expect(await readDrawCalls()).toBe(drawCallsBefore);
    },
    async expectOneCanvas(): Promise<void> {
      await expect(canvas).toHaveCount(1);
    },
    async expectSceneState(state: SceneStateValue): Promise<void> {
      await expect(sceneViewport).toHaveAttribute('data-scene-state', state);
    },
    openNetwork,
    async openNetworkWithGraphicsPreference(preference: GraphicsPreferenceValue): Promise<void> {
      await page.addInitScript({ content: createStoreGraphicsPreferenceScript(preference) });
      await openNetwork();
    },
    readDrawCalls,
    async resizeWindow(size: { height: number; width: number }): Promise<void> {
      await page.setViewportSize(size);
    },
    async waitForDrawCallsToExceed(count: number): Promise<void> {
      await expect.poll(readDrawCalls).toBeGreaterThan(count);
    },
    async waitForIdle(): Promise<void> {
      await page.evaluate(createWaitForIdleScript(IDLE_WINDOW_MS));
    },
    watchSceneChunkRequests(): void {
      page.on('request', (request) => {
        if (SCENE_CHUNK_PATTERN.test(new URL(request.url()).pathname)) {
          requestedSceneChunks.push(request.url());
        }
      });
    },
  };
};
