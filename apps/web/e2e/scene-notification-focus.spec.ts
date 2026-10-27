import type { NetworkSiteValue } from './fixtures/demoData.ts';

import {
  FAR_NETWORK_SITE,
  NEW_WAREHOUSE,
  NOTIFICATION_IDS,
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import { test } from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createAssistantRobot } from './robots/assistant-robot.ts';
import { createCreateWarehouseRobot } from './robots/create-warehouse-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createNetworkRobot } from './robots/network-robot.ts';
import { createNotificationRobot } from './robots/notification-robot.ts';
import { createSceneRobot } from './robots/scene-robot.ts';

const SCENE_TEST_TIMEOUT_MS = 90_000;
const REST_PERIOD_MS = 1000;
const MIN_FLIGHT_FRAMES = 10;
const BUILDING_OFFSET_BOUND_PX = 150;
const STARTING_UNREAD_COUNT = 2;
const MIN_PANNED_DISTANCE_PX = 150;

const [, , KAZAN_SITE] = OWN_NETWORK_SITES;

const NEW_WAREHOUSE_SITE: NetworkSiteValue = {
  cityName: NEW_WAREHOUSE.cityName,
  cityNodeId: KAZAN_SITE.cityNodeId,
  id: KAZAN_SITE.id,
  label: NEW_WAREHOUSE.name,
};

test.describe.configure({ timeout: SCENE_TEST_TIMEOUT_MS });

test.describe('notification center on the network map', () => {
  test.use({
    colorScheme: 'light',
    initialGraphicsPreference: 'low',
    reducedMotion: 'no-preference',
    viewport: DESKTOP_VIEWPORT,
  });

  test('"show on map" from the center flies the camera to the site and the scene rests', async ({ page }) => {
    const network = createNetworkRobot(page);
    const notifications = createNotificationRobot(page);
    const scene = createSceneRobot(page);

    await scene.openNetworkAsPersona(PERSONAS.constructionCustomer.id);
    await scene.expectSceneState('ready');
    await scene.waitForCameraControls();
    await notifications.expectUnreadCount(STARTING_UNREAD_COUNT);
    await scene.waitForIdle();
    await scene.expectCityLabelAwayFromFreeAreaCenter(FAR_NETWORK_SITE.cityNodeId, BUILDING_OFFSET_BOUND_PX);

    const framesBefore = await scene.readDrawFrames();

    await notifications.open();
    await notifications.openLink(notifications.getRowById(NOTIFICATION_IDS.constructionCustomerSupplier3), 'map');

    await network.expectSiteInspector(FAR_NETWORK_SITE, FAR_NETWORK_SITE.sideName);
    await scene.waitForDrawFramesToExceed(
      framesBefore + MIN_FLIGHT_FRAMES - 1,
      `the flight drew fewer than ${String(MIN_FLIGHT_FRAMES)} frames`,
    );
    await scene.waitForIdle();
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
    await scene.expectCityLabelAtFreeAreaCenter(FAR_NETWORK_SITE.cityNodeId, {
      horizontalTolerancePx: BUILDING_OFFSET_BOUND_PX,
      isVerticalInUpperHalf: true,
    });
    await notifications.expectUnreadCount(STARTING_UNREAD_COUNT - 1);
  });

  test('"show on map" from the assistant replica flies the camera to the new warehouse and the scene rests', async ({ page }) => {
    const assistant = createAssistantRobot(page);
    const createWarehouse = createCreateWarehouseRobot(page);
    const navigation = createNavigationRobot(page);
    const network = createNetworkRobot(page);
    const notifications = createNotificationRobot(page);
    const scene = createSceneRobot(page);

    await scene.openNetworkAsPersona(PERSONAS.constructionCustomer.id);
    await scene.expectSceneState('ready');
    await scene.waitForCameraControls();
    await notifications.expectUnreadCount(STARTING_UNREAD_COUNT);
    await assistant.dismissReplica('digest');

    await navigation.openSection('warehouse');
    await navigation.expectSection('warehouse');
    await createWarehouse.openForm();
    await createWarehouse.fillName();
    await createWarehouse.selectCity();
    await createWarehouse.fillAddress();
    await createWarehouse.submit();
    await createWarehouse.expectPanelClosed();
    await createWarehouse.expectNewWarehouseCount(1);
    await assistant.expectReplica('notification');
    await assistant.holdReplica('notification');
    await navigation.clickSection('network');
    await navigation.expectSection('network');
    await scene.dragWorld('left');
    await scene.waitForIdle();
    await scene.expectCityLabelAwayFromFreeAreaCenter(NEW_WAREHOUSE_SITE.cityNodeId, MIN_PANNED_DISTANCE_PX);

    const framesBefore = await scene.readDrawFrames();

    await assistant.openReplicaLink('map');

    await network.expectSiteInspector(NEW_WAREHOUSE_SITE);
    await scene.waitForDrawFramesToExceed(
      framesBefore + MIN_FLIGHT_FRAMES - 1,
      `the flight drew fewer than ${String(MIN_FLIGHT_FRAMES)} frames`,
    );
    await scene.waitForIdle();
    await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
    await scene.expectCityLabelAtFreeAreaCenter(NEW_WAREHOUSE_SITE.cityNodeId, {
      horizontalTolerancePx: BUILDING_OFFSET_BOUND_PX,
      isVerticalInUpperHalf: true,
    });
    await notifications.expectUnreadCount(STARTING_UNREAD_COUNT);
  });
});
