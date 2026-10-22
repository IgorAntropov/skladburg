import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import type { GraphicsPreferenceValue } from '../fixtures/graphicsPreference.ts';
import type { ObjectRouteValue } from '../fixtures/routes.ts';
import type { ColorSchemeValue } from '../fixtures/themePreference.ts';

import { createStoreGraphicsPreferenceScript } from '../fixtures/graphicsPreference.ts';
import { toObjectHash } from '../fixtures/routes.ts';
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

export type AutoGraphicsLevelValue = 'high' | 'low' | 'medium';

export type CameraButtonValue = 'home' | 'rotate-left' | 'rotate-right' | 'zoom-in' | 'zoom-out';

export interface CityLabelOffsetValue {
  dx: number;
  dy: number;
  freeAreaHeight: number;
  labelHeight: number;
}

export interface CityLabelPlacementValue {
  horizontalTolerancePx: number;
  isVerticalInUpperHalf: boolean;
}

export type DragDirectionValue = 'down' | 'left' | 'right' | 'up';

export interface SceneRobotValue {
  chooseGraphicsPreference: (preference: GraphicsPreferenceValue) => Promise<void>;
  countRequestedSceneChunks: () => number;
  dragFromFreeAreaCenter: (distancePx: number) => Promise<void>;
  dragWorld: (direction: DragDirectionValue) => Promise<void>;
  expectAutoGraphicsLevel: (level: AutoGraphicsLevelValue) => Promise<void>;
  expectCityLabelAtFreeAreaCenter: (cityId: string, placement: CityLabelPlacementValue) => Promise<void>;
  expectCityLabelAwayFromFreeAreaCenter: (cityId: string, minDistancePx: number) => Promise<void>;
  expectCityLabelSelected: (cityId: string) => Promise<void>;
  expectCityLabelsInsideFreeArea: (cityIds: readonly string[]) => Promise<void>;
  expectNoCanvas: () => Promise<void>;
  expectNoDrawCallsFor: (durationMs: number) => Promise<void>;
  expectNoDrawFramesFor: (durationMs: number) => Promise<void>;
  expectOneCanvas: () => Promise<void>;
  expectSceneState: (state: SceneStateValue) => Promise<void>;
  expectSomeCityLabelOutsideFreeArea: (cityIds: readonly string[]) => Promise<void>;
  expectThemeAttribute: (theme: ColorSchemeValue) => Promise<void>;
  markMotionStart: () => Promise<void>;
  moveMouseToFreeAreaCenter: () => Promise<void>;
  moveMouseToWorldCorner: () => Promise<void>;
  openNetwork: () => Promise<void>;
  openNetworkAsPersona: (personaId: string) => Promise<void>;
  openNetworkInColorScheme: (colorScheme: ColorSchemeValue) => Promise<void>;
  openNetworkWithGraphicsPreference: (preference: GraphicsPreferenceValue) => Promise<void>;
  openObject: (route: ObjectRouteValue) => Promise<void>;
  pressCameraButton: (button: CameraButtonValue) => Promise<void>;
  pressKey: (code: string) => Promise<void>;
  readAnimationMs: () => Promise<number>;
  readCityLabelOffset: (cityId: string) => Promise<CityLabelOffsetValue | undefined>;
  readDrawCalls: () => Promise<number>;
  readDrawFrames: () => Promise<number>;
  readLongTaskDurations: () => Promise<number[]>;
  readSettleOffsetMs: () => Promise<number>;
  readThemeChangeDelayMs: () => Promise<number>;
  readTransitionLongTaskDurations: () => Promise<number[]>;
  readWorldSettleMs: () => Promise<number>;
  resizeWindow: (size: { height: number; width: number }) => Promise<void>;
  switchColorScheme: (colorScheme: ColorSchemeValue) => Promise<void>;
  tapFreeAreaCenter: () => Promise<void>;
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
const DRAG_STEPS = 6;
const DRAG_SPAN_RATIO = 0.4;
const LABEL_POLL_TIMEOUT_MS = 20_000;
const SCENE_CHUNK_PATTERN = /\/assets\/(?:NetworkWorldScene|SceneRoot)-[^/]+\.js$/;

export const createSceneRobot = (page: Page): SceneRobotValue => {
  const {
    autoGraphicsLevel,
    button: profileButton,
    getGraphicsOption,
    menu,
  } = createProfileMenuLocators(page);
  const sceneViewport = page.getByTestId('scene-viewport');
  const canvas = sceneViewport.locator('canvas');
  const freeArea = page.getByTestId('hud-free-area');
  const cityLabels = page.getByTestId('network-city-label');
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
    await page.goto('./#/network');
  };

  const readFreeAreaBox = async (): Promise<{ height: number; width: number; x: number; y: number }> => {
    const box = await freeArea.boundingBox();

    if (box === null) {
      throw new Error('The free area of the HUD is not laid out');
    }

    return box;
  };

  const dragWorld = async (direction: DragDirectionValue): Promise<void> => {
    const box = await readFreeAreaBox();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const halfWidth = box.width * DRAG_SPAN_RATIO / 2;
    const halfHeight = box.height * DRAG_SPAN_RATIO / 2;
    const routes = {
      down: { from: { x: centerX, y: centerY - halfHeight }, to: { x: centerX, y: centerY + halfHeight } },
      left: { from: { x: centerX + halfWidth, y: centerY }, to: { x: centerX - halfWidth, y: centerY } },
      right: { from: { x: centerX - halfWidth, y: centerY }, to: { x: centerX + halfWidth, y: centerY } },
      up: { from: { x: centerX, y: centerY + halfHeight }, to: { x: centerX, y: centerY - halfHeight } },
    } as const;
    const { from, to } = routes[direction];

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: DRAG_STEPS });
    await page.mouse.up();
  };

  const getCityLabel = (cityId: string): Locator => cityLabels.and(page.locator(`[data-city-id="${cityId}"]`));

  const readCityLabelOffset = async (cityId: string): Promise<CityLabelOffsetValue | undefined> => {
    const labelBox = await getCityLabel(cityId).boundingBox();
    const freeAreaBox = await freeArea.boundingBox();

    if (labelBox === null || freeAreaBox === null) {
      return undefined;
    }

    return {
      dx: labelBox.x + labelBox.width / 2 - (freeAreaBox.x + freeAreaBox.width / 2),
      dy: labelBox.y + labelBox.height / 2 - (freeAreaBox.y + freeAreaBox.height / 2),
      freeAreaHeight: freeAreaBox.height,
      labelHeight: labelBox.height,
    };
  };

  const findCityLabelsOutsideFreeArea = async (cityIds: readonly string[]): Promise<string[]> => {
    const freeAreaBox = await freeArea.boundingBox();
    const misplaced: string[] = [];

    for (const cityId of cityIds) {
      const labelBox = await getCityLabel(cityId).boundingBox();

      if (labelBox === null || freeAreaBox === null) {
        misplaced.push(`${cityId}: not shown`);
      }
      else if (
        labelBox.x < freeAreaBox.x
        || labelBox.y < freeAreaBox.y
        || labelBox.x + labelBox.width > freeAreaBox.x + freeAreaBox.width
        || labelBox.y + labelBox.height > freeAreaBox.y + freeAreaBox.height
      ) {
        misplaced.push(`${cityId}: outside the free area`);
      }
    }

    return misplaced;
  };

  const dragFromFreeAreaCenter = async (distancePx: number): Promise<void> => {
    const box = await readFreeAreaBox();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + distancePx, centerY, { steps: DRAG_STEPS });
    await page.mouse.up();
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
    dragFromFreeAreaCenter,
    dragWorld,
    async expectAutoGraphicsLevel(level: AutoGraphicsLevelValue): Promise<void> {
      await profileButton.click();
      await expect(menu).toBeVisible();
      await expect(autoGraphicsLevel).toHaveAttribute('data-auto-level', level);
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
    },
    async expectCityLabelAtFreeAreaCenter(cityId: string, placement: CityLabelPlacementValue): Promise<void> {
      await expect.poll(async () => {
        const offset = await readCityLabelOffset(cityId);

        if (offset === undefined) {
          return 'label is not shown';
        }

        const isHorizontalCentered = Math.abs(offset.dx) <= placement.horizontalTolerancePx;
        const isVerticalInside = Math.abs(offset.dy) <= offset.freeAreaHeight / 2;
        const isVerticalInUpperHalf = offset.dy <= 0;

        if (isHorizontalCentered && isVerticalInside && (!placement.isVerticalInUpperHalf || isVerticalInUpperHalf)) {
          return 'centered';
        }

        return `dx=${offset.dx.toFixed(1)} dy=${offset.dy.toFixed(1)} freeAreaHeight=${offset.freeAreaHeight.toFixed(1)}`;
      }, {
        message: `the label of the city ${cityId} is not at the center of the free area`,
        timeout: LABEL_POLL_TIMEOUT_MS,
      }).toBe('centered');
    },
    async expectCityLabelAwayFromFreeAreaCenter(cityId: string, minDistancePx: number): Promise<void> {
      await expect.poll(async () => {
        const offset = await readCityLabelOffset(cityId);

        return offset === undefined ? Number.POSITIVE_INFINITY : Math.hypot(offset.dx, offset.dy);
      }, {
        message: `the label of the city ${cityId} is still near the center of the free area`,
        timeout: LABEL_POLL_TIMEOUT_MS,
      }).toBeGreaterThan(minDistancePx);
    },
    async expectCityLabelSelected(cityId: string): Promise<void> {
      await expect(getCityLabel(cityId)).toHaveAttribute('data-selected', 'true');
    },
    async expectCityLabelsInsideFreeArea(cityIds: readonly string[]): Promise<void> {
      await expect.poll(() => findCityLabelsOutsideFreeArea(cityIds), {
        message: 'the labels of the cities are not inside the free area',
        timeout: LABEL_POLL_TIMEOUT_MS,
      }).toEqual([]);
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
    async expectSomeCityLabelOutsideFreeArea(cityIds: readonly string[]): Promise<void> {
      await expect.poll(async () => (await findCityLabelsOutsideFreeArea(cityIds)).length, {
        message: 'every label of the cities is still inside the free area',
        timeout: LABEL_POLL_TIMEOUT_MS,
      }).toBeGreaterThan(0);
    },
    async expectThemeAttribute(theme: ColorSchemeValue): Promise<void> {
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    },
    async markMotionStart(): Promise<void> {
      await page.evaluate(MARK_MOTION_START_SCRIPT);
    },
    async moveMouseToFreeAreaCenter(): Promise<void> {
      const box = await readFreeAreaBox();

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
    },
    async moveMouseToWorldCorner(): Promise<void> {
      const box = await readFreeAreaBox();

      await page.mouse.move(box.x + 4, box.y + 4, { steps: 3 });
    },
    openNetwork,
    async openNetworkAsPersona(personaId: string): Promise<void> {
      await ensureDrawCounter();
      await page.goto(`./#/network?as=${personaId}`);
    },
    async openNetworkInColorScheme(colorScheme: ColorSchemeValue): Promise<void> {
      await page.emulateMedia({ colorScheme });
      await page.addInitScript({ content: createStoreSystemThemeScript() });
      await openNetwork();
    },
    async openNetworkWithGraphicsPreference(preference: GraphicsPreferenceValue): Promise<void> {
      await page.addInitScript({ content: createStoreGraphicsPreferenceScript(preference) });
      await openNetwork();
    },
    async openObject(route: ObjectRouteValue): Promise<void> {
      await ensureDrawCounter();
      await page.goto(`./${toObjectHash(route)}`);
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
    readCityLabelOffset,
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
    async tapFreeAreaCenter(): Promise<void> {
      const box = await readFreeAreaBox();

      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
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
