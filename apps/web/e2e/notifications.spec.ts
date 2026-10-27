import type { NetworkSiteValue } from './fixtures/demoData.ts';

import {
  DEFAULT_PERSONA,
  NEW_WAREHOUSE,
  NOTIFICATION_IDS,
  OWN_NETWORK_SITES,
  PERSONAS,
  RU_CATALOG_DIGEST_GREETING,
  RU_INFORMAL_CATALOG_DIGEST_GREETING,
} from './fixtures/demoData.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createAssistantRobot } from './robots/assistant-robot.ts';
import { createCreateWarehouseRobot } from './robots/create-warehouse-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createNetworkRobot } from './robots/network-robot.ts';
import { createNotificationRobot } from './robots/notification-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

const [, , KAZAN_SITE] = OWN_NETWORK_SITES;

const NEW_SITE_HASH_PATTERN = /^#\/sites\/[0-9a-f-]{36}$/;

const NEW_WAREHOUSE_SITE: NetworkSiteValue = {
  cityName: NEW_WAREHOUSE.cityName,
  cityNodeId: KAZAN_SITE.cityNodeId,
  id: KAZAN_SITE.id,
  label: NEW_WAREHOUSE.name,
};

test.describe('notification center', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test('shows the starting notifications of the director and returns the focus to the button on Escape', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const notifications = createNotificationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('warehouse');
    await navigation.expectSection('warehouse');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await notifications.expectUnreadCount(1);

    await notifications.open();
    await notifications.expectOpen();
    await notifications.expectRowCount(2);
    await notifications.expectUnread(notifications.getRowById(NOTIFICATION_IDS.freshCustomerSupplier2));
    await notifications.expectRead(notifications.getRowById(NOTIFICATION_IDS.freshCustomerSupplier1));

    await notifications.close();
    await notifications.expectClosed();
    await notifications.expectButtonFocused();
    await notifications.expectUnreadCount(1);
  });

  test('a new warehouse arrives, "show on map" opens its card and reads the row, "read all" clears the badge', async ({ page }) => {
    const createWarehouse = createCreateWarehouseRobot(page);
    const navigation = createNavigationRobot(page);
    const network = createNetworkRobot(page);
    const notifications = createNotificationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('warehouse');
    await navigation.expectSection('warehouse');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await notifications.expectUnreadCount(1);

    await createWarehouse.openForm();
    await createWarehouse.fillName();
    await createWarehouse.selectCity();
    await createWarehouse.fillAddress();
    await createWarehouse.submit();
    await createWarehouse.expectPanelClosed();
    await createWarehouse.expectNewWarehouseCount(1);

    await notifications.expectUnreadCount(2);

    await notifications.open();
    await notifications.expectRowCount(3);

    const newWarehouseRow = notifications.getRowWithData(NEW_WAREHOUSE.name, NEW_WAREHOUSE.cityName);

    await notifications.expectUnread(newWarehouseRow);

    await notifications.openLink(newWarehouseRow, 'map');
    await expect.poll(() => new URL(page.url()).hash).toMatch(NEW_SITE_HASH_PATTERN);
    await network.expectSiteInspector(NEW_WAREHOUSE_SITE);
    await notifications.expectUnreadCount(1);

    await notifications.open();
    await notifications.expectRead(newWarehouseRow);
    await notifications.expectUnread(notifications.getRowById(NOTIFICATION_IDS.freshCustomerSupplier2));

    await notifications.markAllRead();
    await notifications.close();
    await notifications.expectUnreadCount(0);
  });
});

test.describe('assistant replicas', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test('narrates a new warehouse with "show on map" that opens its card and reads the notification', async ({ page }) => {
    const assistant = createAssistantRobot(page);
    const createWarehouse = createCreateWarehouseRobot(page);
    const navigation = createNavigationRobot(page);
    const network = createNetworkRobot(page);
    const notifications = createNotificationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('warehouse');
    await navigation.expectSection('warehouse');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await assistant.dismissReplica('digest');

    await createWarehouse.openForm();
    await createWarehouse.fillName();
    await createWarehouse.selectCity();
    await createWarehouse.fillAddress();
    await createWarehouse.submit();
    await createWarehouse.expectPanelClosed();
    await createWarehouse.expectNewWarehouseCount(1);

    await assistant.expectReplica('notification', 'normal');
    await assistant.openReplicaLink('map');
    await expect.poll(() => new URL(page.url()).hash).toMatch(NEW_SITE_HASH_PATTERN);
    await network.expectSiteInspector(NEW_WAREHOUSE_SITE);
    await notifications.expectUnreadCount(1);

    await notifications.open();
    await notifications.expectRead(notifications.getRowWithData(NEW_WAREHOUSE.name, NEW_WAREHOUSE.cityName));
    await notifications.expectUnread(notifications.getRowById(NOTIFICATION_IDS.freshCustomerSupplier2));
  });

  test('stays silent about a new warehouse in the quiet mode while the center keeps the notification', async ({ page }) => {
    const assistant = createAssistantRobot(page);
    const createWarehouse = createCreateWarehouseRobot(page);
    const navigation = createNavigationRobot(page);
    const notifications = createNotificationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('warehouse');
    await navigation.expectSection('warehouse');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await notifications.expectUnreadCount(1);

    await notifications.open();
    await assistant.expectQuietMode(false);
    await assistant.toggleQuietMode();
    await assistant.expectQuietMode(true);
    await notifications.close();

    await createWarehouse.openForm();
    await createWarehouse.fillName();
    await createWarehouse.selectCity();
    await createWarehouse.fillAddress();
    await createWarehouse.submit();
    await createWarehouse.expectPanelClosed();
    await createWarehouse.expectNewWarehouseCount(1);
    await notifications.expectUnreadCount(2);

    await assistant.expectNoReplicaFor('notification');
    await assistant.expectNoReplicaFor('digest');

    await notifications.open();
    await notifications.expectRowCount(3);
    await notifications.expectUnread(notifications.getRowWithData(NEW_WAREHOUSE.name, NEW_WAREHOUSE.cityName));
  });

  test('tells the digest once per persona in a tab, formally to the default persona', async ({ page }) => {
    const assistant = createAssistantRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('network');
    await navigation.expectSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await assistant.expectReplica('digest', 'normal');
    await assistant.expectReplicaText('digest', RU_CATALOG_DIGEST_GREETING);
    await assistant.closeReplica();

    await persona.selectPersona(PERSONAS.constructionCustomer);
    await assistant.expectReplica('digest', 'normal');
    await assistant.closeReplica();

    await persona.selectPersona(DEFAULT_PERSONA);
    await assistant.expectNoReplicaFor('digest');
  });

  test('tells the digest to the informal organization in the second person singular', async ({ page }) => {
    const assistant = createAssistantRobot(page);
    const persona = createPersonaRobot(page);

    await persona.openAsPersona('#/network', PERSONAS.constructionCarrier.id);
    await persona.expectCurrentPersona(PERSONAS.constructionCarrier);
    await assistant.expectReplica('digest');
    await assistant.expectReplicaText('digest', RU_INFORMAL_CATALOG_DIGEST_GREETING);
    await assistant.expectReplicaWithoutText('digest', RU_CATALOG_DIGEST_GREETING);
  });
});
