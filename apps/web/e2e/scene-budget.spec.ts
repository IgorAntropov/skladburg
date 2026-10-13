import type { SceneRobotValue } from './robots/scene-robot.ts';

import {
  expect,
  test,
} from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createSceneRobot } from './robots/scene-robot.ts';

const REST_PERIOD_MS = 2000;
const RESIZED_VIEWPORT = { height: 700, width: 1100 } as const;
const MIN_ROTATION_FRAMES = 10;
const MAX_ROTATION_ANIMATION_MS = 1500;
const MAX_REDUCED_MOTION_FRAMES = 3;
const MAX_LONG_TASK_COUNT = 0;

const openReadyBoard = async (scene: SceneRobotValue): Promise<void> => {
  await scene.openNetwork();
  await scene.expectSceneState('ready');
  await scene.waitForCameraControls();
  await scene.waitForIdle();
};

const measureRotation = async (
  scene: SceneRobotValue,
  rotate: () => Promise<void>,
): Promise<{ animationMs: number; frames: number; longTaskCount: number; settleMs: number }> => {
  const framesBefore = await scene.readDrawFrames();

  await scene.markMotionStart();
  await rotate();
  await scene.waitForDrawFramesToExceed(framesBefore);
  await scene.waitForIdle();

  const animationMs = await scene.readAnimationMs();
  const frames = (await scene.readDrawFrames()) - framesBefore;
  const settleMs = await scene.readSettleOffsetMs();
  const longTaskCount = (await scene.readLongTaskDurations()).length;

  await scene.expectNoDrawFramesFor(REST_PERIOD_MS);

  return { animationMs, frames, longTaskCount, settleMs };
};

const annotateRotation = (
  type: string,
  { animationMs, frames, settleMs }: { animationMs: number; frames: number; settleMs: number },
): void => {
  const description = `frames=${String(frames)} animationMs=${String(Math.round(animationMs))} settleMs=${String(Math.round(settleMs))}`;

  test.info().annotations.push({ description, type });
};
test.describe('camera motion', () => {
  test.use({
    initialGraphicsPreference: null,
    reducedMotion: 'no-preference',
    viewport: DESKTOP_VIEWPORT,
  });

  test('turns the board with the button over many frames and then goes quiet', async ({ page }) => {
    const scene = createSceneRobot(page);

    await openReadyBoard(scene);

    const rotation = await measureRotation(scene, async () => scene.pressCameraButton('rotate-right'));

    annotateRotation('rotation-button', rotation);

    expect(rotation.frames).toBeGreaterThanOrEqual(MIN_ROTATION_FRAMES);
    expect(rotation.animationMs).toBeLessThanOrEqual(MAX_ROTATION_ANIMATION_MS);
    expect(rotation.longTaskCount).toBe(MAX_LONG_TASK_COUNT);
  });

  test('turns the board with the E key like the button does', async ({ page }) => {
    const scene = createSceneRobot(page);

    await openReadyBoard(scene);

    const rotation = await measureRotation(scene, async () => scene.pressKey('KeyE'));

    annotateRotation('rotation-key', rotation);

    expect(rotation.frames).toBeGreaterThanOrEqual(MIN_ROTATION_FRAMES);
    expect(rotation.animationMs).toBeLessThanOrEqual(MAX_ROTATION_ANIMATION_MS);
  });
});

test.describe('scene frame budget', () => {
  test.use({
    initialGraphicsPreference: null,
    reducedMotion: 'reduce',
    viewport: DESKTOP_VIEWPORT,
  });

  test('draws no frames while the board is at rest', async ({ page }) => {
    const scene = createSceneRobot(page);

    await scene.openNetwork();
    await scene.expectSceneState('ready');
    await scene.waitForIdle();

    const drawCallsAtRest = await scene.readDrawCalls();

    expect(drawCallsAtRest).toBeGreaterThan(0);

    await scene.expectNoDrawCallsFor(REST_PERIOD_MS);
  });

  test('redraws after the window is resized and goes back to rest', async ({ page }) => {
    const scene = createSceneRobot(page);

    await scene.openNetwork();
    await scene.expectSceneState('ready');
    await scene.waitForIdle();

    const drawCallsBeforeResize = await scene.readDrawCalls();

    await scene.resizeWindow(RESIZED_VIEWPORT);
    await scene.waitForDrawCallsToExceed(drawCallsBeforeResize);
    await scene.waitForIdle();

    await scene.expectNoDrawCallsFor(REST_PERIOD_MS);
  });

  test('jumps the board to the new angle in a couple of frames and goes quiet', async ({ page }) => {
    const scene = createSceneRobot(page);

    await openReadyBoard(scene);

    const rotation = await measureRotation(scene, async () => scene.pressCameraButton('rotate-right'));

    annotateRotation('rotation-reduced-motion', rotation);

    expect(rotation.frames).toBeLessThanOrEqual(MAX_REDUCED_MOTION_FRAMES);
  });

  test('does not request the scene chunk without 3D and loads it after switching back to auto', async ({ page }) => {
    const scene = createSceneRobot(page);

    scene.watchSceneChunkRequests();
    await scene.openNetworkWithGraphicsPreference('off');
    await scene.expectSceneState('off');
    await scene.expectNoCanvas();

    expect(scene.countRequestedSceneChunks()).toBe(0);

    await scene.chooseGraphicsPreference('auto');

    await scene.expectSceneState('ready');
    await scene.expectOneCanvas();

    expect(scene.countRequestedSceneChunks()).toBeGreaterThan(0);
  });
});
