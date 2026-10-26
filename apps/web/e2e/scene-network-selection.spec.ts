import type { ObjectRouteValue } from './fixtures/routes.ts';
import type { ColorSchemeValue } from './fixtures/themePreference.ts';
import type { NetworkRobotValue } from './robots/network-robot.ts';
import type { OrganizationDirectoryRobotValue } from './robots/organization-directory-robot.ts';
import type { SceneEdgeRobotValue } from './robots/scene-edge-robot.ts';
import type {
  CityLabelPlacementValue,
  SceneRobotValue,
} from './robots/scene-robot.ts';

import {
  FAR_NETWORK_SITE,
  FOREIGN_NETWORK_SITE,
  MULTI_CITY_ORGANIZATION,
  OWN_NETWORK_SITES,
} from './fixtures/demoData.ts';
import {
  toCityRoute,
  toObjectHash,
  toOrganizationRoute,
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
import { createOrganizationDirectoryRobot } from './robots/organization-directory-robot.ts';
import { createSceneEdgeRobot } from './robots/scene-edge-robot.ts';
import { createSceneRobot } from './robots/scene-robot.ts';

const SCENE_TEST_TIMEOUT_MS = 90_000;
const REST_PERIOD_MS = 1000;
const MIN_FLIGHT_FRAMES = 10;
const MIN_PAN_SHIFT_PX = 5;
const DRAG_DISTANCE_PX = 60;
const MIN_PANNED_DISTANCE_PX = 150;
const CITY_LABEL_TOLERANCE_PX = 2;
const BUILDING_OFFSET_BOUND_PX = 150;
const MIN_NEAR_PLATE_PIXELS = 1000;
const MAX_NIGHT_PLATE_DEVIATION = 0.1;
const MAX_FAR_PLATE_SHARE = 0.05;
const MIN_THEME_TRANSITION_FRAMES = 10;

interface PlateFrameValue {
  plateCount: number;
  viewMatrices: ReadonlySet<string>;
}

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
const { cityNodeIds: COMPANY_CITY_IDS, organization: MULTI_CITY_COMPANY } = MULTI_CITY_ORGANIZATION;
const [, , KAZAN_SITE] = OWN_NETWORK_SITES;
const COMPANY_PANNED_CITY_ID = KAZAN_SITE.cityNodeId;
const COMPANY_ROUTE = toOrganizationRoute(MULTI_CITY_COMPANY.id);

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

const switchColorSchemeAndSettle = async (
  scene: SceneRobotValue,
  colorScheme: ColorSchemeValue,
): Promise<void> => {
  const framesBefore = await scene.readDrawFrames();

  await scene.switchColorScheme(colorScheme);
  await scene.expectThemeAttribute(colorScheme);
  await scene.waitForDrawFramesToExceed(
    framesBefore + MIN_THEME_TRANSITION_FRAMES - 1,
    `the switch to ${colorScheme} drew fewer than ${String(MIN_THEME_TRANSITION_FRAMES)} frames`,
  );
  await scene.waitForIdle();
};

const countPlatePixels = async (
  scene: SceneRobotValue,
  edge: SceneEdgeRobotValue,
): Promise<PlateFrameValue> => {
  await scene.moveMouseToWorldCorner();
  await scene.waitForIdle();

  const frame = await edge.captureLightFrame();

  return {
    plateCount: await scene.countBannerPlatePixels(frame.snapshot),
    viewMatrices: new Set(frame.viewSignature.split('|')),
  };
};

const flyToCompanyByRow = async (
  scene: SceneRobotValue,
  directory: OrganizationDirectoryRobotValue,
): Promise<void> => {
  const framesBefore = await scene.readDrawFrames();

  await directory.openRow(MULTI_CITY_COMPANY);
  await directory.expectOwnCard(MULTI_CITY_COMPANY);
  await directory.expectRowSelected(MULTI_CITY_COMPANY);
  await expectFlightThenRest(scene, framesBefore);
  await scene.expectCityLabelsInsideFreeArea(COMPANY_CITY_IDS);
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

  test('a flight to a site shows the plate of the mark by day and by night and the overview shows only flags', async ({ page }) => {
    const scene = createSceneRobot(page);
    const edge = createSceneEdgeRobot(page, scene);
    const network = createNetworkRobot(page);

    await edge.paintVoidBeforeLoad();
    await scene.openNetworkInColorScheme('light');
    await scene.expectSceneState('ready');
    await scene.waitForCameraControls();
    await scene.waitForIdle();
    await flyToFarSiteByRow(scene, network);

    const day = await countPlatePixels(scene, edge);

    await switchColorSchemeAndSettle(scene, 'dark');

    const night = await countPlatePixels(scene, edge);

    await switchColorSchemeAndSettle(scene, 'light');

    const framesBeforeHome = await scene.readDrawFrames();

    await scene.pressCameraButton('home');
    await expectFlightThenRest(scene, framesBeforeHome);

    const overview = await countPlatePixels(scene, edge);
    const nightDeviation = Math.abs(night.plateCount - day.plateCount) / day.plateCount;

    test.info().annotations.push({
      description: [
        `nearDay=${String(day.plateCount)}`,
        `nearNight=${String(night.plateCount)}`,
        `nightDeviation=${(nightDeviation * 100).toFixed(1)}%`,
        `overview=${String(overview.plateCount)}`,
        `overviewShare=${(overview.plateCount / day.plateCount * 100).toFixed(1)}%`,
      ].join(' '),
      type: 'banner-plate-pixels',
    });

    expect(night.viewMatrices).toEqual(day.viewMatrices);
    expect(day.plateCount).toBeGreaterThanOrEqual(MIN_NEAR_PLATE_PIXELS);
    expect(night.plateCount).toBeGreaterThanOrEqual(MIN_NEAR_PLATE_PIXELS);
    expect(nightDeviation).toBeLessThanOrEqual(MAX_NIGHT_PLATE_DEVIATION);
    expect(overview.plateCount).toBeLessThanOrEqual(day.plateCount * MAX_FAR_PLATE_SHARE);
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

  test('a tap on the row of a company in several cities flies the camera over all its sites after a manual pan', async ({ page }) => {
    const scene = createSceneRobot(page);
    const directory = createOrganizationDirectoryRobot(page);

    await openReadyNetwork(scene);
    await directory.openCompaniesTab();

    await scene.dragWorld('left');
    await scene.waitForIdle();
    await scene.expectSomeCityLabelOutsideFreeArea(COMPANY_CITY_IDS);

    await flyToCompanyByRow(scene, directory);
  });

  test('"show on map" of a company card brings the camera back over all its sites after a manual pan', async ({ page }) => {
    const scene = createSceneRobot(page);
    const directory = createOrganizationDirectoryRobot(page);
    const network = createNetworkRobot(page);

    await openReadyNetwork(scene);
    await directory.openCompaniesTab();
    await flyToCompanyByRow(scene, directory);

    const offsetBefore = await scene.readCityLabelOffset(COMPANY_PANNED_CITY_ID);

    await scene.dragWorld('left');
    await scene.waitForIdle();

    const offsetAfter = await scene.readCityLabelOffset(COMPANY_PANNED_CITY_ID);

    expect(offsetBefore).toBeDefined();
    expect(Math.abs((offsetAfter?.dx ?? 0) - (offsetBefore?.dx ?? 0))).toBeGreaterThan(MIN_PANNED_DISTANCE_PX);
    await scene.expectSomeCityLabelOutsideFreeArea(COMPANY_CITY_IDS);

    const framesBefore = await scene.readDrawFrames();

    await network.expectShowOnMapShown();
    await network.showOnMap();

    await expectFlightThenRest(scene, framesBefore);
    await scene.expectCityLabelsInsideFreeArea(COMPANY_CITY_IDS);
  });

  test('the mouse over the row of a company redraws the scene once, settles and leaving the row clears the highlight', async ({ page }) => {
    const scene = createSceneRobot(page);
    const directory = createOrganizationDirectoryRobot(page);

    await openReadyNetwork(scene);
    await directory.openCompaniesTab();

    const framesBefore = await scene.readDrawFrames();

    await directory.hoverRow(MULTI_CITY_COMPANY);
    await directory.expectRowHovered(MULTI_CITY_COMPANY);

    await scene.waitForDrawFramesToExceed(framesBefore, 'the hover over the company did not redraw the scene');
    await scene.waitForIdle();
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);

    const framesBeforeLeave = await scene.readDrawFrames();

    await scene.moveMouseToWorldCorner();
    await directory.expectRowNotHovered(MULTI_CITY_COMPANY);

    await scene.waitForDrawFramesToExceed(framesBeforeLeave, 'leaving the company row did not redraw the scene');
    await scene.waitForIdle();
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
  });

  test('a direct entry by the address of the own company keeps all its sites in the free area when ready', async ({ page }) => {
    const scene = createSceneRobot(page);
    const directory = createOrganizationDirectoryRobot(page);

    await scene.openObject(COMPANY_ROUTE);
    await scene.expectSceneState('ready');
    await scene.waitForCameraControls();

    await directory.expectOwnCard(MULTI_CITY_COMPANY);
    await scene.expectCityLabelsInsideFreeArea(COMPANY_CITY_IDS);
    await scene.waitForIdle();
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
    await scene.expectCityLabelsInsideFreeArea(COMPANY_CITY_IDS);

    expect(new URL(page.url()).hash).toBe(toObjectHash(COMPANY_ROUTE));
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
