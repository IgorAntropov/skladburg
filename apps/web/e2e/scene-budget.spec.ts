import type { SceneRobotValue } from './robots/scene-robot.ts';

import {
  expect,
  test,
} from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createSceneRobot } from './robots/scene-robot.ts';

interface RotationMeasurementValue {
  animationMs: number;
  drawCallsPerFrame: number;
  frames: number;
  longTaskCount: number;
  longTaskMaxMs: number;
  settleMs: number;
}

const REST_PERIOD_MS = 2000;
const SCENE_TEST_TIMEOUT_MS = 60_000;
const RESIZED_VIEWPORT = { height: 700, width: 1100 } as const;
const MIN_ROTATION_FRAMES = 10;
const MAX_ROTATION_ANIMATION_MS = 1500;
const MAX_REDUCED_MOTION_FRAMES = 3;
const MIN_REDUCED_MOTION_FRAMES = 1;
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
  minFrames: number,
): Promise<RotationMeasurementValue> => {
  const framesBefore = await scene.readDrawFrames();
  const drawCallsBefore = await scene.readDrawCalls();

  await scene.markMotionStart();
  await rotate();
  await scene.waitForDrawFramesToExceed(
    framesBefore + minFrames - 1,
    `rotation drew fewer than ${String(minFrames)} frames`,
  );
  await scene.waitForIdle();

  const animationMs = await scene.readAnimationMs();
  const frames = (await scene.readDrawFrames()) - framesBefore;
  const drawCallsPerFrame = frames > 0 ? ((await scene.readDrawCalls()) - drawCallsBefore) / frames : 0;
  const settleMs = await scene.readSettleOffsetMs();
  const longTaskDurations = await scene.readLongTaskDurations();
  const longTaskCount = longTaskDurations.length;
  const longTaskMaxMs = Math.max(0, ...longTaskDurations);

  await scene.expectNoDrawFramesFor(REST_PERIOD_MS);

  return { animationMs, drawCallsPerFrame, frames, longTaskCount, longTaskMaxMs, settleMs };
};

const annotateRotation = (
  type: string,
  { animationMs, drawCallsPerFrame, frames, longTaskCount, longTaskMaxMs, settleMs }: RotationMeasurementValue,
): void => {
  const description = [
    `frames=${String(frames)}`,
    `drawCallsPerFrame=${String(Math.round(drawCallsPerFrame))}`,
    `animationMs=${String(Math.round(animationMs))}`,
    `settleMs=${String(Math.round(settleMs))}`,
    `longTaskCount=${String(longTaskCount)}`,
    `longTaskMaxMs=${String(Math.round(longTaskMaxMs))}`,
  ].join(' ');

  test.info().annotations.push({ description, type });
};
test.describe.configure({ timeout: SCENE_TEST_TIMEOUT_MS });

test.describe('camera motion', () => {
  test.use({
    initialGraphicsPreference: 'low',
    reducedMotion: 'no-preference',
    viewport: DESKTOP_VIEWPORT,
  });

  test('turns the board with the button over many frames and then goes quiet', async ({ page }) => {
    const scene = createSceneRobot(page);

    await openReadyBoard(scene);

    const rotation = await measureRotation(
      scene,
      async () => scene.pressCameraButton('rotate-right'),
      MIN_ROTATION_FRAMES,
    );

    annotateRotation('rotation-button', rotation);

    expect(rotation.frames).toBeGreaterThanOrEqual(MIN_ROTATION_FRAMES);
    expect(rotation.animationMs).toBeLessThanOrEqual(MAX_ROTATION_ANIMATION_MS);
    expect(rotation.longTaskCount).toBe(MAX_LONG_TASK_COUNT);
  });

  test('turns the board with the E key like the button does', async ({ page }) => {
    const scene = createSceneRobot(page);

    await openReadyBoard(scene);

    const rotation = await measureRotation(
      scene,
      async () => scene.pressKey('KeyE'),
      MIN_ROTATION_FRAMES,
    );

    annotateRotation('rotation-key', rotation);

    expect(rotation.frames).toBeGreaterThanOrEqual(MIN_ROTATION_FRAMES);
    expect(rotation.animationMs).toBeLessThanOrEqual(MAX_ROTATION_ANIMATION_MS);
  });
});

test.describe('scene frame budget', () => {
  test.use({
    initialGraphicsPreference: 'low',
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

    const rotation = await measureRotation(
      scene,
      async () => scene.pressCameraButton('rotate-right'),
      MIN_REDUCED_MOTION_FRAMES,
    );

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
