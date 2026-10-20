import {
  DEFAULT_PERSONA,
  PERSONAS,
} from './fixtures/demoData.ts';
import { test } from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createCreateWarehouseRobot } from './robots/create-warehouse-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

const PHONE_VIEWPORT = { height: 740, width: 360 } as const;
const TOUCH_VIEWPORT = { height: 915, width: 412 } as const;

test.describe('creating a warehouse', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test('adds a warehouse that stays after a reload', async ({ page }) => {
    const createWarehouse = createCreateWarehouseRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('warehouse');
    await navigation.expectSection('warehouse');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await createWarehouse.expectInitialWarehouses();
    await createWarehouse.expectWarehouseCount(3);

    await createWarehouse.openForm();
    await createWarehouse.expectPanelOpen();
    await createWarehouse.expectButtonExpanded();
    await createWarehouse.expectNameFocused();

    await createWarehouse.fillName();
    await createWarehouse.selectCity();
    await createWarehouse.fillAddress();
    await createWarehouse.submit();

    await createWarehouse.expectPanelClosed();
    await createWarehouse.expectNewWarehouseCount(1);
    await createWarehouse.expectWarehouseCount(4);
    await createWarehouse.expectButtonFocused();
    await createWarehouse.expectAnnouncement();

    await navigation.reload();
    await navigation.expectSection('warehouse');
    await createWarehouse.expectNewWarehouseCount(1);
    await createWarehouse.expectWarehouseCount(4);
  });

  test('explains the missing permission and keeps the form closed', async ({ page }) => {
    const createWarehouse = createCreateWarehouseRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await persona.openAsPersona('#/warehouse', PERSONAS.freshStorekeeper.id);
    await navigation.expectSection('warehouse');
    await persona.expectCurrentPersona(PERSONAS.freshStorekeeper);

    await createWarehouse.expectDeniedButton();

    await createWarehouse.hoverButton();
    await createWarehouse.expectDenialTooltip();

    await createWarehouse.pressOpenButton();
    await createWarehouse.expectPanelClosed();
  });

  test('keeps the form open and points to the city when Enter is pressed without a city', async ({ page }) => {
    const createWarehouse = createCreateWarehouseRobot(page);
    const navigation = createNavigationRobot(page);

    await navigation.openSection('warehouse');
    await navigation.expectSection('warehouse');
    await createWarehouse.expectInitialWarehouses();

    await createWarehouse.openForm();
    await createWarehouse.fillName();
    await createWarehouse.pressEnterInName();

    await createWarehouse.expectPanelOpen();
    await createWarehouse.expectCityErrorFocused();
    await createWarehouse.expectNewWarehouseCount(0);
    await createWarehouse.expectWarehouseCount(3);

    await createWarehouse.selectCity();
    await createWarehouse.pressEnterInName();

    await createWarehouse.expectPanelClosed();
    await createWarehouse.expectNewWarehouseCount(1);
    await createWarehouse.expectWarehouseCount(4);
  });
});

test.describe('creating a warehouse on a phone', () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test('shows the form instead of the lists and brings the lists back after cancel and after creation', async ({ page }) => {
    const createWarehouse = createCreateWarehouseRobot(page);
    const navigation = createNavigationRobot(page);

    await navigation.openSection('warehouse');
    await navigation.expectSection('warehouse');
    await createWarehouse.expectListsShown();

    await createWarehouse.openForm();
    await createWarehouse.expectPanelOpen();
    await createWarehouse.expectListsHidden();

    await createWarehouse.cancel();
    await createWarehouse.expectPanelClosed();
    await createWarehouse.expectListsShown();
    await createWarehouse.expectNewWarehouseCount(0);

    await createWarehouse.openForm();
    await createWarehouse.fillName();
    await createWarehouse.selectCity();
    await createWarehouse.submit();

    await createWarehouse.expectPanelClosed();
    await createWarehouse.expectListsShown();
    await createWarehouse.expectNewWarehouseCount(1);
    await createWarehouse.expectWarehouseCount(4);
  });
});

test.describe('creating a warehouse on a touch screen', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: TOUCH_VIEWPORT,
  });

  test('shows the reason for the missing permission as text', async ({ page }) => {
    const createWarehouse = createCreateWarehouseRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await persona.openAsPersona('#/warehouse', PERSONAS.freshStorekeeper.id);
    await navigation.expectSection('warehouse');

    await createWarehouse.expectDeniedButton();
    await createWarehouse.expectDenialReasonOnTouch();
  });
});
