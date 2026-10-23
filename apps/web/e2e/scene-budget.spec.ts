import type { ColorSchemeValue } from './fixtures/themePreference.ts';
import type { SceneRobotValue } from './robots/scene-robot.ts';

import { PERSONAS } from './fixtures/demoData.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createSceneEdgeRobot } from './robots/scene-edge-robot.ts';
import { createSceneRobot } from './robots/scene-robot.ts';

interface RotationMeasurementValue {
  animationMs: number;
  drawCallsPerFrame: number;
  frames: number;
  longTaskCount: number;
  longTaskMaxMs: number;
  settleMs: number;
}

interface ThemeSwitchMeasurementValue {
  drawCallsPerFrame: number;
  frames: number;
  longTaskCount: number;
  longTaskMaxMs: number;
  themeChangeDelayMs: number;
  worldSettleMs: number;
}

const REST_PERIOD_MS = 2000;
const SCENE_TEST_TIMEOUT_MS = 60_000;
const RESIZED_VIEWPORT = { height: 700, width: 1100 } as const;
const MIN_ROTATION_FRAMES = 10;
const MAX_ROTATION_ANIMATION_MS = 1500;
const MAX_DRAW_CALLS_PER_FRAME = 40;
const MIN_HOME_FRAMES = 2;
const MAX_REDUCED_MOTION_FRAMES = 3;
const MIN_REDUCED_MOTION_FRAMES = 1;
const MAX_LONG_TASK_COUNT = 0;
const MIN_THEME_TRANSITION_FRAMES = 10;
const MIN_THEME_TRANSITION_MS = 2000;
const MAX_THEME_TRANSITION_MS = 5000;
const MAX_THEME_APPLY_MS = 1000;
const MIN_NIGHT_GLOW_PIXELS = 60;
const MIN_NIGHT_WARM_SPOT_PIXELS = 200;
const MAX_DAY_WARM_SPOT_PIXELS = 40;

const openReadyWorld = async (scene: SceneRobotValue): Promise<void> => {
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

const openReadyWorldInColorScheme = async (
  scene: SceneRobotValue,
  colorScheme: ColorSchemeValue,
): Promise<void> => {
  await scene.openNetworkInColorScheme(colorScheme);
  await scene.expectSceneState('ready');
  await scene.expectThemeAttribute(colorScheme);
  await scene.waitForCameraControls();
  await scene.waitForIdle();
};

const settleThemeSwitch = async (
  scene: SceneRobotValue,
  colorScheme: ColorSchemeValue,
  minFrames: number,
): Promise<void> => {
  const framesBefore = await scene.readDrawFrames();

  await scene.switchColorScheme(colorScheme);
  await scene.expectThemeAttribute(colorScheme);
  await scene.waitForDrawFramesToExceed(
    framesBefore + minFrames - 1,
    `the switch to ${colorScheme} drew fewer than ${String(minFrames)} frames`,
  );
  await scene.waitForIdle();
};

const measureThemeSwitch = async (
  scene: SceneRobotValue,
  colorScheme: ColorSchemeValue,
  minFrames: number,
): Promise<ThemeSwitchMeasurementValue> => {
  const framesBefore = await scene.readDrawFrames();
  const drawCallsBefore = await scene.readDrawCalls();

  await settleThemeSwitch(scene, colorScheme, minFrames);

  const frames = (await scene.readDrawFrames()) - framesBefore;
  const drawCallsPerFrame = frames > 0 ? ((await scene.readDrawCalls()) - drawCallsBefore) / frames : 0;
  const themeChangeDelayMs = await scene.readThemeChangeDelayMs();
  const worldSettleMs = await scene.readWorldSettleMs();
  const longTaskDurations = await scene.readTransitionLongTaskDurations();
  const longTaskCount = longTaskDurations.length;
  const longTaskMaxMs = Math.max(0, ...longTaskDurations);

  await scene.expectNoDrawFramesFor(REST_PERIOD_MS);

  return { drawCallsPerFrame, frames, longTaskCount, longTaskMaxMs, themeChangeDelayMs, worldSettleMs };
};

const annotateThemeSwitch = (
  type: string,
  { drawCallsPerFrame, frames, longTaskCount, longTaskMaxMs, themeChangeDelayMs, worldSettleMs }: ThemeSwitchMeasurementValue,
): void => {
  const description = [
    `frames=${String(frames)}`,
    `drawCallsPerFrame=${drawCallsPerFrame.toFixed(1)}`,
    `themeChangeDelayMs=${String(Math.round(themeChangeDelayMs))}`,
    `worldSettleMs=${String(Math.round(worldSettleMs))}`,
    `longTaskCount=${String(longTaskCount)}`,
    `longTaskMaxMs=${String(Math.round(longTaskMaxMs))}`,
  ].join(' ');

  test.info().annotations.push({ description, type });
};

const annotateRotation = (
  type: string,
  { animationMs, drawCallsPerFrame, frames, longTaskCount, longTaskMaxMs, settleMs }: RotationMeasurementValue,
): void => {
  const description = [
    `frames=${String(frames)}`,
    `drawCallsPerFrame=${drawCallsPerFrame.toFixed(1)}`,
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

  test('turns the world with the button over many frames and then goes quiet', async ({ page }) => {
    const scene = createSceneRobot(page);

    await openReadyWorld(scene);

    const rotation = await measureRotation(
      scene,
      async () => scene.pressCameraButton('rotate-right'),
      MIN_ROTATION_FRAMES,
    );

    annotateRotation('rotation-button', rotation);

    expect(rotation.frames).toBeGreaterThanOrEqual(MIN_ROTATION_FRAMES);
    expect(rotation.drawCallsPerFrame).toBeGreaterThan(0);
    expect(rotation.drawCallsPerFrame).toBeLessThanOrEqual(MAX_DRAW_CALLS_PER_FRAME);
    expect(rotation.animationMs).toBeLessThanOrEqual(MAX_ROTATION_ANIMATION_MS);
    expect(rotation.longTaskCount).toBe(MAX_LONG_TASK_COUNT);
  });

  test('brings the world back home after a turn and a drag and then goes quiet', async ({ page }) => {
    const scene = createSceneRobot(page);

    await openReadyWorld(scene);

    const turn = await measureRotation(
      scene,
      async () => scene.pressCameraButton('rotate-right'),
      MIN_ROTATION_FRAMES,
    );
    const drag = await measureRotation(
      scene,
      async () => scene.dragWorld('left'),
      MIN_HOME_FRAMES,
    );
    const home = await measureRotation(
      scene,
      async () => scene.pressCameraButton('home'),
      MIN_HOME_FRAMES,
    );

    annotateRotation('turn-before-home', turn);
    annotateRotation('drag-before-home', drag);
    annotateRotation('home', home);

    expect(home.frames).toBeGreaterThanOrEqual(MIN_HOME_FRAMES);
    expect(home.drawCallsPerFrame).toBeLessThanOrEqual(MAX_DRAW_CALLS_PER_FRAME);
    expect(home.longTaskCount).toBe(MAX_LONG_TASK_COUNT);
  });

  test('turns the world with the E key like the button does', async ({ page }) => {
    const scene = createSceneRobot(page);

    await openReadyWorld(scene);

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

test.describe('carrier without sites', () => {
  test.use({
    initialGraphicsPreference: 'low',
    reducedMotion: 'reduce',
    viewport: DESKTOP_VIEWPORT,
  });

  test('shows the whole network and draws no frames at rest', async ({ page }) => {
    const scene = createSceneRobot(page);

    await scene.openNetworkAsPersona(PERSONAS.freshCarrier.id);
    await scene.expectSceneState('ready');
    await scene.waitForCameraControls();
    await scene.waitForIdle();

    expect(await scene.readDrawCalls()).toBeGreaterThan(0);

    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
  });
});

test.describe('day and night', () => {
  test.use({
    initialGraphicsPreference: 'low',
    reducedMotion: 'no-preference',
    viewport: DESKTOP_VIEWPORT,
  });

  const switches: readonly { from: ColorSchemeValue; title: string; to: ColorSchemeValue }[] = [
    { from: 'light', title: 'the world sinks into night over many frames when the theme turns dark', to: 'dark' },
    { from: 'dark', title: 'the world wakes up over many frames when the theme turns light', to: 'light' },
  ];

  for (const { from, title, to } of switches) {
    test(title, async ({ page }) => {
      const scene = createSceneRobot(page);

      await openReadyWorldInColorScheme(scene, from);

      const transition = await measureThemeSwitch(scene, to, MIN_THEME_TRANSITION_FRAMES);

      annotateThemeSwitch(`theme-${from}-to-${to}`, transition);

      expect(transition.themeChangeDelayMs).toBeGreaterThanOrEqual(0);
      expect(transition.themeChangeDelayMs).toBeLessThan(MAX_THEME_APPLY_MS);
      expect(transition.themeChangeDelayMs).toBeLessThan(transition.worldSettleMs);
      expect(transition.frames).toBeGreaterThanOrEqual(MIN_THEME_TRANSITION_FRAMES);
      expect(transition.drawCallsPerFrame).toBeGreaterThan(0);
      expect(transition.drawCallsPerFrame).toBeLessThanOrEqual(MAX_DRAW_CALLS_PER_FRAME);
      expect(transition.worldSettleMs).toBeGreaterThanOrEqual(MIN_THEME_TRANSITION_MS);
      expect(transition.worldSettleMs).toBeLessThanOrEqual(MAX_THEME_TRANSITION_MS);
      expect(transition.longTaskCount).toBe(MAX_LONG_TASK_COUNT);
    });
  }
});

test.describe('night world', () => {
  test.use({
    initialGraphicsPreference: 'low',
    reducedMotion: 'no-preference',
    viewport: DESKTOP_VIEWPORT,
  });

  test('stays quiet at night, turns with the button within the draw call budget and goes quiet again', async ({ page }) => {
    const scene = createSceneRobot(page);

    await openReadyWorldInColorScheme(scene, 'dark');
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);

    const rotation = await measureRotation(
      scene,
      async () => scene.pressCameraButton('rotate-right'),
      MIN_ROTATION_FRAMES,
    );

    annotateRotation('rotation-night-low', rotation);

    expect(rotation.frames).toBeGreaterThanOrEqual(MIN_ROTATION_FRAMES);
    expect(rotation.drawCallsPerFrame).toBeGreaterThan(0);
    expect(rotation.drawCallsPerFrame).toBeLessThanOrEqual(MAX_DRAW_CALLS_PER_FRAME);
    expect(rotation.animationMs).toBeLessThanOrEqual(MAX_ROTATION_ANIMATION_MS);
    expect(rotation.longTaskCount).toBe(MAX_LONG_TASK_COUNT);
  });

  test('shows warm lights on the canvas at night and none by day', async ({ page }) => {
    const scene = createSceneRobot(page);
    const edge = createSceneEdgeRobot(page, scene);

    await openReadyWorldInColorScheme(scene, 'light');

    const dayFrame = await edge.captureLightFrame();

    await settleThemeSwitch(scene, 'dark', MIN_THEME_TRANSITION_FRAMES);

    const nightFrame = await edge.captureLightFrame();

    await settleThemeSwitch(scene, 'light', MIN_THEME_TRANSITION_FRAMES);

    const nextDayFrame = await edge.captureLightFrame();
    const night = await edge.compareLightFrames(nightFrame, dayFrame);
    const day = await edge.compareLightFrames(dayFrame, nightFrame);
    const nextDay = await edge.compareLightFrames(nextDayFrame, nightFrame);

    test.info().annotations.push({
      description: [
        `nightSpots=${String(night.newWarmSpotCount)}`,
        `nightGlow=${String(night.glowCount)}`,
        `nightRaw=${String(night.rawWarmSpotCount)}`,
        `daySpotsKeptAtNight=${String(day.sharedWarmSpotCount)}`,
        `dayGlow=${String(day.glowCount)}`,
        `dayRaw=${String(day.rawWarmSpotCount)}`,
        `nextDaySpotsKeptAtNight=${String(nextDay.sharedWarmSpotCount)}`,
        `nextDayGlow=${String(nextDay.glowCount)}`,
        `nextDayRaw=${String(nextDay.rawWarmSpotCount)}`,
      ].join(' '),
      type: 'light-pixels',
    });

    expect(nightFrame.viewSignature).toBe(dayFrame.viewSignature);
    expect(nextDayFrame.viewSignature).toBe(dayFrame.viewSignature);
    expect(night.glowCount).toBeGreaterThanOrEqual(MIN_NIGHT_GLOW_PIXELS);
    expect(night.newWarmSpotCount).toBeGreaterThanOrEqual(MIN_NIGHT_WARM_SPOT_PIXELS);
    expect(day.glowCount).toBe(0);
    expect(day.sharedWarmSpotCount).toBe(0);
    expect(day.rawWarmSpotCount).toBeLessThanOrEqual(MAX_DAY_WARM_SPOT_PIXELS);
    expect(nextDay.glowCount).toBe(0);
    expect(nextDay.sharedWarmSpotCount).toBe(0);
    expect(nextDay.rawWarmSpotCount).toBeLessThanOrEqual(MAX_DAY_WARM_SPOT_PIXELS);
  });

  test.describe('at the high level', () => {
    test.use({ initialGraphicsPreference: 'high' });

    test('turns with the button at night and goes quiet, the draw calls are only reported', async ({ page }) => {
      const scene = createSceneRobot(page);

      await openReadyWorldInColorScheme(scene, 'dark');
      await scene.expectNoDrawFramesFor(REST_PERIOD_MS);

      const rotation = await measureRotation(
        scene,
        async () => scene.pressCameraButton('rotate-right'),
        MIN_ROTATION_FRAMES,
      );

      annotateRotation('rotation-night-high', rotation);

      expect(rotation.frames).toBeGreaterThanOrEqual(MIN_ROTATION_FRAMES);
      expect(rotation.drawCallsPerFrame).toBeGreaterThan(0);
    });
  });
});

test.describe('scene frame budget', () => {
  test.use({
    initialGraphicsPreference: 'low',
    reducedMotion: 'reduce',
    viewport: DESKTOP_VIEWPORT,
  });

  test('draws no frames while the world is at rest', async ({ page }) => {
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

  test('jumps the world to the new angle in a couple of frames and goes quiet', async ({ page }) => {
    const scene = createSceneRobot(page);

    await openReadyWorld(scene);

    const rotation = await measureRotation(
      scene,
      async () => scene.pressCameraButton('rotate-right'),
      MIN_REDUCED_MOTION_FRAMES,
    );

    annotateRotation('rotation-reduced-motion', rotation);

    expect(rotation.frames).toBeLessThanOrEqual(MAX_REDUCED_MOTION_FRAMES);
  });

  test('changes the world to night in a couple of frames and goes quiet when the theme turns dark', async ({ page }) => {
    const scene = createSceneRobot(page);

    await openReadyWorldInColorScheme(scene, 'light');

    const framesBefore = await scene.readDrawFrames();

    await scene.switchColorScheme('dark');
    await scene.expectThemeAttribute('dark');
    await scene.waitForDrawFramesToExceed(framesBefore, 'theme switch drew no frames');
    await scene.waitForIdle();

    const frames = (await scene.readDrawFrames()) - framesBefore;

    test.info().annotations.push({ description: `frames=${String(frames)}`, type: 'theme-reduced-motion' });

    expect(frames).toBeGreaterThanOrEqual(MIN_REDUCED_MOTION_FRAMES);
    expect(frames).toBeLessThanOrEqual(MAX_REDUCED_MOTION_FRAMES);

    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
  });

  test('does not request the scene chunk without 3D and loads it at the low level after switching back to auto', async ({ page }) => {
    const scene = createSceneRobot(page);

    scene.watchSceneChunkRequests();
    await scene.openNetworkWithGraphicsPreference('off');
    await scene.expectSceneState('off');
    await scene.expectNoCanvas();

    expect(scene.countRequestedSceneChunks()).toBe(0);

    await scene.chooseGraphicsPreference('auto');

    await scene.expectSceneState('ready');
    await scene.expectOneCanvas();
    await scene.expectAutoGraphicsLevel('low');

    expect(scene.countRequestedSceneChunks()).toBeGreaterThan(0);
  });
});
