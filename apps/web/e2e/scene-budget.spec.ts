import {
  expect,
  test,
} from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createSceneRobot } from './robots/scene-robot.ts';

const REST_PERIOD_MS = 2000;
const RESIZED_VIEWPORT = { height: 700, width: 1100 } as const;

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
