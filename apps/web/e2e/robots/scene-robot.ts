import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import type { GraphicsPreferenceValue } from '../fixtures/graphicsPreference.ts';
import type { ColorSchemeValue } from '../fixtures/themePreference.ts';

import { createStoreGraphicsPreferenceScript } from '../fixtures/graphicsPreference.ts';
import { createStoreSystemThemeScript } from '../fixtures/themePreference.ts';
import { createProfileMenuLocators } from './profile-menu-locators.ts';
import {
  createSleepScript,
  createWaitForIdleScript,
  DRAW_COUNTER_INIT_SCRIPT,
  MARK_MOTION_START_SCRIPT,
  MARK_THEME_SWITCH_SCRIPT,
  READ_ANIMATION_MS_SCRIPT,
  READ_DRAW_CALLS_SCRIPT,
  READ_DRAW_FRAMES_SCRIPT,
  READ_LONG_TASK_DURATIONS_SCRIPT,
  READ_SETTLE_OFFSET_SCRIPT,
  READ_THEME_CHANGE_DELAY_SCRIPT,
  READ_TRANSITION_LONG_TASK_DURATIONS_SCRIPT,
  READ_WORLD_SETTLE_MS_SCRIPT,
} from './scene-draw-counter.ts';

export type CameraButtonValue = 'home' | 'rotate-left' | 'rotate-right' | 'zoom-in' | 'zoom-out';

export interface SceneRobotValue {
  chooseGraphicsPreference: (preference: GraphicsPreferenceValue) => Promise<void>;
  countRequestedSceneChunks: () => number;
  expectNoCanvas: () => Promise<void>;
  expectNoDrawCallsFor: (durationMs: number) => Promise<void>;
  expectNoDrawFramesFor: (durationMs: number) => Promise<void>;
  expectOneCanvas: () => Promise<void>;
  expectSceneState: (state: SceneStateValue) => Promise<void>;
  expectThemeAttribute: (theme: ColorSchemeValue) => Promise<void>;
  markMotionStart: () => Promise<void>;
  openNetwork: () => Promise<void>;
  openNetworkInColorScheme: (colorScheme: ColorSchemeValue) => Promise<void>;
  openNetworkWithGraphicsPreference: (preference: GraphicsPreferenceValue) => Promise<void>;
  pressCameraButton: (button: CameraButtonValue) => Promise<void>;
  pressKey: (code: string) => Promise<void>;
  readAnimationMs: () => Promise<number>;
  readDrawCalls: () => Promise<number>;
  readDrawFrames: () => Promise<number>;
  readLongTaskDurations: () => Promise<number[]>;
  readSettleOffsetMs: () => Promise<number>;
  readThemeChangeDelayMs: () => Promise<number>;
  readTransitionLongTaskDurations: () => Promise<number[]>;
  readWorldSettleMs: () => Promise<number>;
  resizeWindow: (size: { height: number; width: number }) => Promise<void>;
  switchColorScheme: (colorScheme: ColorSchemeValue) => Promise<void>;
  waitForCameraControls: () => Promise<void>;
  waitForDrawCallsToExceed: (count: number) => Promise<void>;
  waitForDrawFramesToExceed: (count: number, message: string) => Promise<void>;
  waitForIdle: () => Promise<void>;
  watchSceneChunkRequests: () => void;
}

export type SceneStateValue = 'error' | 'loading' | 'off' | 'ready';

interface IdleReportValue {
  frames: number;
  isIdle: boolean;
  msSinceLastDraw: number;
  pendingFrames: number;
}

const IDLE_WINDOW_MS = 500;
const IDLE_TIMEOUT_MS = 15_000;
const SCENE_STATE_TIMEOUT_MS = 40_000;
const SCENE_CHUNK_PATTERN = /\/assets\/(?:NetworkWorldScene|SceneRoot)-[^/]+\.js$/;

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

  const readDrawFrames = async (): Promise<number> => page.evaluate<number>(READ_DRAW_FRAMES_SCRIPT);

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
    async expectNoDrawFramesFor(durationMs: number): Promise<void> {
      const drawFramesBefore = await readDrawFrames();

      await page.evaluate(createSleepScript(durationMs));

      expect(await readDrawFrames()).toBe(drawFramesBefore);
    },
    async expectOneCanvas(): Promise<void> {
      await expect(canvas).toHaveCount(1);
    },
    async expectSceneState(state: SceneStateValue): Promise<void> {
      await expect(sceneViewport).toHaveAttribute('data-scene-state', state, { timeout: SCENE_STATE_TIMEOUT_MS });
    },
    async expectThemeAttribute(theme: ColorSchemeValue): Promise<void> {
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    },
    async markMotionStart(): Promise<void> {
      await page.evaluate(MARK_MOTION_START_SCRIPT);
    },
    openNetwork,
    async openNetworkInColorScheme(colorScheme: ColorSchemeValue): Promise<void> {
      await page.emulateMedia({ colorScheme });
      await page.addInitScript({ content: createStoreSystemThemeScript() });
      await openNetwork();
    },
    async openNetworkWithGraphicsPreference(preference: GraphicsPreferenceValue): Promise<void> {
      await page.addInitScript({ content: createStoreGraphicsPreferenceScript(preference) });
      await openNetwork();
    },
    async pressCameraButton(button: CameraButtonValue): Promise<void> {
      await page.getByTestId(`scene-camera-${button}`).click();
    },
    async pressKey(code: string): Promise<void> {
      await page.keyboard.press(code);
    },
    async readAnimationMs(): Promise<number> {
      return page.evaluate<number>(READ_ANIMATION_MS_SCRIPT);
    },
    readDrawCalls,
    readDrawFrames,
    async readLongTaskDurations(): Promise<number[]> {
      return page.evaluate<number[]>(READ_LONG_TASK_DURATIONS_SCRIPT);
    },
    async readSettleOffsetMs(): Promise<number> {
      return page.evaluate<number>(READ_SETTLE_OFFSET_SCRIPT);
    },
    async readThemeChangeDelayMs(): Promise<number> {
      return page.evaluate<number>(READ_THEME_CHANGE_DELAY_SCRIPT);
    },
    async readTransitionLongTaskDurations(): Promise<number[]> {
      return page.evaluate<number[]>(READ_TRANSITION_LONG_TASK_DURATIONS_SCRIPT);
    },
    async readWorldSettleMs(): Promise<number> {
      return page.evaluate<number>(READ_WORLD_SETTLE_MS_SCRIPT);
    },
    async resizeWindow(size: { height: number; width: number }): Promise<void> {
      await page.setViewportSize(size);
    },
    async switchColorScheme(colorScheme: ColorSchemeValue): Promise<void> {
      await page.evaluate(MARK_THEME_SWITCH_SCRIPT);
      await page.emulateMedia({ colorScheme });
    },
    async waitForCameraControls(): Promise<void> {
      await expect(page.getByTestId('scene-camera-rotate-right')).toBeVisible();
    },
    async waitForDrawCallsToExceed(count: number): Promise<void> {
      await expect.poll(readDrawCalls).toBeGreaterThan(count);
    },
    async waitForDrawFramesToExceed(count: number, message: string): Promise<void> {
      await expect.poll(readDrawFrames, { message }).toBeGreaterThan(count);
    },
    async waitForIdle(): Promise<void> {
      const result = await page.evaluate<IdleReportValue>(createWaitForIdleScript(IDLE_WINDOW_MS, IDLE_TIMEOUT_MS));

      if (!result.isIdle) {
        throw new Error(
          `scene did not go idle within ${String(IDLE_TIMEOUT_MS)} ms: `
          + `pendingFrames=${String(result.pendingFrames)} `
          + `msSinceLastDraw=${String(result.msSinceLastDraw)} `
          + `frames=${String(result.frames)}`,
        );
      }
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
