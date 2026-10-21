import type { ObjectRouteValue } from './fixtures/routes.ts';
import type { NetworkRobotValue } from './robots/network-robot.ts';
import type {
  CityLabelPlacementValue,
  SceneRobotValue,
} from './robots/scene-robot.ts';

import {
  FAR_NETWORK_SITE,
  FOREIGN_NETWORK_SITE,
} from './fixtures/demoData.ts';
import {
  toCityRoute,
  toObjectHash,
  toSectionHash,
  toSiteRoute,
} from './fixtures/routes.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createNetworkRobot } from './robots/network-robot.ts';
import { createSceneRobot } from './robots/scene-robot.ts';

const SCENE_TEST_TIMEOUT_MS = 90_000;
const REST_PERIOD_MS = 1000;
const MIN_FLIGHT_FRAMES = 10;
const MIN_PAN_SHIFT_PX = 5;
const DRAG_DISTANCE_PX = 60;
const MIN_PANNED_DISTANCE_PX = 150;
const CITY_LABEL_TOLERANCE_PX = 2;
const BUILDING_OFFSET_BOUND_PX = 150;

const SITE_LABEL_PLACEMENT: CityLabelPlacementValue = {
  horizontalTolerancePx: BUILDING_OFFSET_BOUND_PX,
  isVerticalInUpperHalf: true,
};

const CITY_LABEL_PLACEMENT: CityLabelPlacementValue = {
  horizontalTolerancePx: CITY_LABEL_TOLERANCE_PX,
  isVerticalInUpperHalf: true,
};

const FAR_SITE_ROUTE = toSiteRoute(FAR_NETWORK_SITE.id);
const FAR_CITY_ROUTE = toCityRoute(FAR_NETWORK_SITE.cityNodeId);
const FAR_SITE_HASH = toObjectHash(FAR_SITE_ROUTE);

interface ColdEntryValue {
  name: string;
  placement: CityLabelPlacementValue;
  route: ObjectRouteValue;
}

const COLD_ENTRIES: readonly ColdEntryValue[] = [
  { name: 'a site', placement: SITE_LABEL_PLACEMENT, route: FAR_SITE_ROUTE },
  { name: 'a city', placement: CITY_LABEL_PLACEMENT, route: FAR_CITY_ROUTE },
];

const openReadyNetwork = async (scene: SceneRobotValue): Promise<void> => {
  await scene.openNetwork();
  await scene.expectSceneState('ready');
  await scene.waitForCameraControls();
  await scene.waitForIdle();
};

const expectFlightThenRest = async (
  scene: SceneRobotValue,
  framesBefore: number,
): Promise<void> => {
  await scene.waitForDrawFramesToExceed(
    framesBefore + MIN_FLIGHT_FRAMES - 1,
    `the flight drew fewer than ${String(MIN_FLIGHT_FRAMES)} frames`,
  );
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
};

const flyToFarSiteByRow = async (
  scene: SceneRobotValue,
  network: NetworkRobotValue,
): Promise<void> => {
  const framesBefore = await scene.readDrawFrames();

  await network.tapRow(FAR_NETWORK_SITE.id);
  await network.expectSiteInspector(FAR_NETWORK_SITE, FAR_NETWORK_SITE.sideName);
  await network.expectRowSelected(FAR_NETWORK_SITE.id);
  await expectFlightThenRest(scene, framesBefore);
  await scene.expectCityLabelAtFreeAreaCenter(FAR_NETWORK_SITE.cityNodeId, SITE_LABEL_PLACEMENT);
};

test.describe.configure({ timeout: SCENE_TEST_TIMEOUT_MS });

test.describe('selection on the network map', () => {
  test.use({
    colorScheme: 'light',
    initialGraphicsPreference: 'low',
    reducedMotion: 'no-preference',
    viewport: DESKTOP_VIEWPORT,
  });

  test('a tap on the row of a far site flies the camera to it and the scene rests', async ({ page }) => {
    const scene = createSceneRobot(page);
    const network = createNetworkRobot(page);

    await openReadyNetwork(scene);
    await scene.expectCityLabelAwayFromFreeAreaCenter(FAR_NETWORK_SITE.cityNodeId, BUILDING_OFFSET_BOUND_PX);

    await flyToFarSiteByRow(scene, network);
  });

  test('"show on map" brings the camera back to the site after a manual pan', async ({ page }) => {
    const scene = createSceneRobot(page);
    const network = createNetworkRobot(page);

    await openReadyNetwork(scene);
    await flyToFarSiteByRow(scene, network);

    await scene.dragWorld('left');
    await scene.waitForIdle();
    await scene.expectCityLabelAwayFromFreeAreaCenter(FAR_NETWORK_SITE.cityNodeId, MIN_PANNED_DISTANCE_PX);

    const framesBefore = await scene.readDrawFrames();

    await network.expectShowOnMapShown();
    await network.showOnMap();

    await expectFlightThenRest(scene, framesBefore);
    await scene.expectCityLabelAtFreeAreaCenter(FAR_NETWORK_SITE.cityNodeId, SITE_LABEL_PLACEMENT);
  });

  test('a tap on the site in the world selects it and opens the sites list', async ({ page }) => {
    const scene = createSceneRobot(page);
    const navigation = createNavigationRobot(page);
    const network = createNetworkRobot(page);

    await openReadyNetwork(scene);
    await flyToFarSiteByRow(scene, network);

    await network.closeInspector();
    await navigation.expectAddress(toSectionHash('network'));
    await network.openListTab('deals');
    await scene.waitForIdle();

    const framesBefore = await scene.readDrawFrames();

    await scene.tapFreeAreaCenter();

    await navigation.expectAddress(FAR_SITE_HASH);
    await network.expectSiteInspector(FAR_NETWORK_SITE, FAR_NETWORK_SITE.sideName);
    await network.expectListTabActive('warehouses');
    await network.expectRowSelected(FAR_NETWORK_SITE.id);

    await scene.waitForDrawFramesToExceed(framesBefore, 'the selection did not redraw the scene');
    await scene.waitForIdle();
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
  });

  test('the mouse over the site in the world highlights its row and settles', async ({ page }) => {
    const scene = createSceneRobot(page);
    const network = createNetworkRobot(page);

    await openReadyNetwork(scene);
    await flyToFarSiteByRow(scene, network);

    await scene.moveMouseToWorldCorner();
    await network.expectRowNotHovered(FAR_NETWORK_SITE.id);
    await scene.waitForIdle();

    const framesBefore = await scene.readDrawFrames();

    await scene.moveMouseToFreeAreaCenter();

    await network.expectRowHovered(FAR_NETWORK_SITE.id);
    await scene.waitForDrawFramesToExceed(framesBefore, 'the hover did not redraw the scene');
    await scene.waitForIdle();
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
  });

  test('a drag across the site moves the camera and does not change the address', async ({ page }) => {
    const scene = createSceneRobot(page);
    const navigation = createNavigationRobot(page);
    const network = createNetworkRobot(page);

    await openReadyNetwork(scene);
    await flyToFarSiteByRow(scene, network);

    await network.closeInspector();
    await navigation.expectAddress(toSectionHash('network'));
    await scene.waitForIdle();

    const offsetBefore = await scene.readCityLabelOffset(FAR_NETWORK_SITE.cityNodeId);

    await scene.dragFromFreeAreaCenter(DRAG_DISTANCE_PX);
    await scene.waitForIdle();

    const offsetAfter = await scene.readCityLabelOffset(FAR_NETWORK_SITE.cityNodeId);

    expect(offsetBefore).toBeDefined();
    expect(offsetAfter).toBeDefined();
    expect(Math.abs((offsetAfter?.dx ?? 0) - (offsetBefore?.dx ?? 0))).toBeGreaterThan(MIN_PAN_SHIFT_PX);

    await navigation.expectAddress(toSectionHash('network'));
    await network.expectNoInspectorBody();
  });

  test('the mouse over a row of the list redraws the scene once and settles', async ({ page }) => {
    const scene = createSceneRobot(page);
    const network = createNetworkRobot(page);

    await openReadyNetwork(scene);

    const framesBefore = await scene.readDrawFrames();

    await network.hoverRow(FAR_NETWORK_SITE.id);
    await network.expectRowHovered(FAR_NETWORK_SITE.id);

    await scene.waitForDrawFramesToExceed(framesBefore, 'the hover from the list did not redraw the scene');
    await scene.waitForIdle();
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);

    const framesBeforeLeave = await scene.readDrawFrames();

    await scene.moveMouseToWorldCorner();
    await network.expectRowNotHovered(FAR_NETWORK_SITE.id);

    await scene.waitForDrawFramesToExceed(framesBeforeLeave, 'leaving the row did not redraw the scene');
    await scene.waitForIdle();
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
  });

  for (const { name, placement, route } of COLD_ENTRIES) {
    test(`a direct entry by the address of ${name} flies to it once the scene is ready`, async ({ page }) => {
      const scene = createSceneRobot(page);
      const network = createNetworkRobot(page);

      await scene.openObject(route);
      await scene.expectSceneState('ready');
      await scene.waitForCameraControls();

      await scene.expectCityLabelAtFreeAreaCenter(FAR_NETWORK_SITE.cityNodeId, placement);
      await scene.waitForIdle();
      await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
      await scene.expectCityLabelAtFreeAreaCenter(FAR_NETWORK_SITE.cityNodeId, placement);

      if (route === FAR_CITY_ROUTE) {
        await network.expectCityInspector(FAR_NETWORK_SITE.cityName);
        await scene.expectCityLabelSelected(FAR_NETWORK_SITE.cityNodeId);
      }
      else {
        await network.expectSiteInspector(FAR_NETWORK_SITE, FAR_NETWORK_SITE.sideName);
        await network.expectRowSelected(FAR_NETWORK_SITE.id);
      }

      expect(new URL(page.url()).hash).toBe(toObjectHash(route));
    });
  }
});

test.describe('accessibility of the network map with the scene', () => {
  test.use({
    colorScheme: 'light',
    initialGraphicsPreference: null,
    reducedMotion: 'no-preference',
    viewport: DESKTOP_VIEWPORT,
  });

  test('has no violations of WCAG 2.1 A and AA with the scene, a selected site and the open inspector', async ({ page }) => {
    const scene = createSceneRobot(page);
    const network = createNetworkRobot(page);

    const site = FOREIGN_NETWORK_SITE;

    await scene.openObject(toSiteRoute(site.id));
    await scene.expectSceneState('ready');
    await scene.waitForCameraControls();
    await network.expectSiteInspector(site, site.sideName);
    await network.expectRowSelected(site.id);
    await network.expectShowOnMapShown();
    await scene.waitForIdle();

    await network.expectNoViolationsOfAccessibility();
  });
});
