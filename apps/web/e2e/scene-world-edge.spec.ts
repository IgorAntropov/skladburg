import type {
  DragDirectionValue,
  SceneEdgeRobotValue,
} from './robots/scene-edge-robot.ts';
import type { SceneRobotValue } from './robots/scene-robot.ts';

import {
  expect,
  test,
} from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createSceneEdgeRobot } from './robots/scene-edge-robot.ts';
import { createSceneRobot } from './robots/scene-robot.ts';

interface CanvasValue {
  name: string;
  viewport: { height: number; width: number };
}

const CANVASES: readonly CanvasValue[] = [
  { name: 'desktop 1440x900', viewport: { height: 900, width: 1440 } },
  { name: 'laptop 1280x800', viewport: { height: 800, width: 1280 } },
  { name: 'tablet 1024x768', viewport: { height: 768, width: 1024 } },
];

const CORNER_TOUR: readonly DragDirectionValue[] = ['up', 'left', 'down', 'right'];
const TOUR_TIMEOUT_MS = 90_000;

const openReadyWorldWithVisibleVoid = async (
  scene: SceneRobotValue,
  edge: SceneEdgeRobotValue,
): Promise<void> => {
  await edge.paintVoidBeforeLoad();
  await scene.openNetwork();
  await scene.expectSceneState('ready');
  await scene.waitForCameraControls();
  await scene.waitForIdle();
};

test.describe('world edge', () => {
  test.use({
    initialGraphicsPreference: null,
    reducedMotion: 'no-preference',
    viewport: DESKTOP_VIEWPORT,
  });

  test('the colour of the void reaches the scene and the snapshot scan sees it', async ({ page }) => {
    const scene = createSceneRobot(page);
    const edge = createSceneEdgeRobot(page, scene);

    await openReadyWorldWithVisibleVoid(scene, edge);

    await edge.expectVoidColorReachesScene();
    await edge.expectVoidDetectedInSnapshot();
  });
});

for (const { name, viewport } of CANVASES) {
  test.describe(`world edge on ${name}`, () => {
    test.use({
      initialGraphicsPreference: null,
      reducedMotion: 'no-preference',
      viewport,
    });

    test('never shows the edge of the world in the corners, before and after a turn', async ({ page }) => {
      test.setTimeout(TOUR_TIMEOUT_MS);

      const scene = createSceneRobot(page);
      const edge = createSceneEdgeRobot(page, scene);

      await openReadyWorldWithVisibleVoid(scene, edge);
      await edge.expectNoVoid('home');
      await edge.zoomOutToLimit();
      await edge.expectNoVoid('home-zoomed-out');

      const cornerViews: string[] = [];

      for (const direction of CORNER_TOUR) {
        await edge.dragToLimit(direction);
        cornerViews.push(await edge.readViewSignature());
        await edge.expectNoVoid(`corner-${direction}`);

        await edge.turnCamera('right');
        await edge.expectNoVoid(`corner-${direction}-turned`);

        await edge.turnCamera('left');
      }

      expect(new Set(cornerViews).size, 'the drags reached four different corners').toBe(CORNER_TOUR.length);
    });
  });
}
