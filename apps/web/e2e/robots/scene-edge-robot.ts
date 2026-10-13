import type { Page } from '@playwright/test';

import {
  expect,
  test,
} from '@playwright/test';

import type { SceneRobotValue } from './scene-robot.ts';

import {
  ADD_VOID_PROBE_SCRIPT,
  createScanVoidPixelsScript,
  createVoidColorInitScript,
  HIDE_HUD_SCRIPT,
  READ_CLEAR_COLOR_SCRIPT,
  READ_VIEW_SIGNATURE_SCRIPT,
  READ_VOID_COLOR_SCRIPT,
  REMOVE_VOID_PROBE_SCRIPT,
  SHOW_HUD_SCRIPT,
  VOID_COLOR,
} from './scene-edge-scripts.ts';

export type DragDirectionValue = 'down' | 'left' | 'right' | 'up';

export interface SceneEdgeRobotValue {
  dragToLimit: (direction: DragDirectionValue) => Promise<void>;
  expectNoVoid: (label: string) => Promise<void>;
  expectVoidColorReachesScene: () => Promise<void>;
  expectVoidDetectedInSnapshot: () => Promise<void>;
  paintVoidBeforeLoad: () => Promise<void>;
  readViewSignature: () => Promise<string>;
  turnCamera: (direction: TurnDirectionValue) => Promise<void>;
  zoomOutToLimit: () => Promise<void>;
}

export type TurnDirectionValue = 'left' | 'right';

interface VoidScanValue {
  height: number;
  samples: { blue: number; green: number; red: number; x: number; y: number }[];
  voidCount: number;
  width: number;
}

const MAX_MOVES_TO_LIMIT = 12;
const DRAG_STEPS = 4;
const DRAG_SPAN_RATIO = 0.8;
const CLEAR_COLOR_TOLERANCE = 0.02;
const PROBE_MIN_COORDINATE_PX = 100;
const PROBE_MAX_COORDINATE_PX = 140;

export const createSceneEdgeRobot = (page: Page, scene: SceneRobotValue): SceneEdgeRobotValue => {
  const freeArea = page.getByTestId('hud-free-area');

  const captureSnapshot = async (): Promise<Buffer> => {
    await page.evaluate(HIDE_HUD_SCRIPT);

    try {
      return await page.screenshot({ animations: 'allow', scale: 'css' });
    }
    finally {
      await page.evaluate(SHOW_HUD_SCRIPT);
    }
  };

  const readViewSignature = async (): Promise<string> => page.evaluate<string>(READ_VIEW_SIGNATURE_SCRIPT);

  const settleAfter = async (action: () => Promise<void>, description: string): Promise<void> => {
    const framesBefore = await scene.readDrawFrames();

    await action();
    await scene.waitForDrawFramesToExceed(framesBefore, `${description} drew no frame`);
    await scene.waitForIdle();
  };

  const moveUntilViewStops = async (move: () => Promise<void>, description: string): Promise<void> => {
    await scene.waitForIdle();

    let previous = await readViewSignature();

    for (let attempt = 0; attempt < MAX_MOVES_TO_LIMIT; attempt += 1) {
      await settleAfter(move, description);

      const current = await readViewSignature();

      if (current === previous) {
        return;
      }

      previous = current;
    }

    throw new Error(`The view kept moving after ${String(MAX_MOVES_TO_LIMIT)} ${description}`);
  };

  const scanSnapshot = async (snapshot: Buffer): Promise<VoidScanValue> => {
    return page.evaluate<VoidScanValue>(createScanVoidPixelsScript(snapshot.toString('base64')));
  };

  const dragAcrossFreeArea = async (direction: DragDirectionValue): Promise<void> => {
    const box = await freeArea.boundingBox();

    if (box === null) {
      throw new Error('The free area of the HUD is not laid out');
    }

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

  return {
    async dragToLimit(direction: DragDirectionValue): Promise<void> {
      await moveUntilViewStops(async () => dragAcrossFreeArea(direction), `drags ${direction}`);
    },
    async expectNoVoid(label: string): Promise<void> {
      const snapshot = await captureSnapshot();
      const { height, samples, voidCount, width } = await scanSnapshot(snapshot);

      if (voidCount > 0) {
        await test.info().attach(`world-edge-${label}`, { body: snapshot, contentType: 'image/png' });
      }

      expect(
        { canvas: `${String(width)}x${String(height)}`, label, samples, voidCount },
        `the colour of the void is visible in the snapshot: ${label}`,
      ).toMatchObject({ samples: [], voidCount: 0 });
    },
    async expectVoidColorReachesScene(): Promise<void> {
      expect(await page.evaluate<string>(READ_VOID_COLOR_SCRIPT)).toBe(VOID_COLOR);

      await expect.poll(
        async () => page.evaluate<null | number[]>(READ_CLEAR_COLOR_SCRIPT),
        { message: 'the renderer never cleared the frame with the void colour' },
      ).toEqual([
        expect.closeTo(1, CLEAR_COLOR_TOLERANCE),
        expect.closeTo(0, CLEAR_COLOR_TOLERANCE),
        expect.closeTo(1, CLEAR_COLOR_TOLERANCE),
        expect.closeTo(1, CLEAR_COLOR_TOLERANCE),
      ]);
    },
    async expectVoidDetectedInSnapshot(): Promise<void> {
      await page.evaluate(ADD_VOID_PROBE_SCRIPT);

      try {
        const { samples, voidCount } = await scanSnapshot(await captureSnapshot());

        expect(voidCount).toBeGreaterThan(0);

        for (const sample of samples) {
          expect(sample.x).toBeGreaterThanOrEqual(PROBE_MIN_COORDINATE_PX);
          expect(sample.x).toBeLessThan(PROBE_MAX_COORDINATE_PX);
          expect(sample.y).toBeGreaterThanOrEqual(PROBE_MIN_COORDINATE_PX);
          expect(sample.y).toBeLessThan(PROBE_MAX_COORDINATE_PX);
        }
      }
      finally {
        await page.evaluate(REMOVE_VOID_PROBE_SCRIPT);
      }
    },
    async paintVoidBeforeLoad(): Promise<void> {
      await page.addInitScript({ content: createVoidColorInitScript() });
    },
    readViewSignature,
    async turnCamera(direction: TurnDirectionValue): Promise<void> {
      await settleAfter(async () => scene.pressCameraButton(`rotate-${direction}`), `turn ${direction}`);
    },
    async zoomOutToLimit(): Promise<void> {
      await moveUntilViewStops(async () => scene.pressCameraButton('zoom-out'), 'zoom-out presses');
    },
  };
};
