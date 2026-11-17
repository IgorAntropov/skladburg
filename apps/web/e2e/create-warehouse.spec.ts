import {
  DEFAULT_PERSONA,
  NEW_WAREHOUSE,
  PERSONAS,
} from './fixtures/demoData.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createCreateWarehouseRobot } from './robots/create-warehouse-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

const PHONE_VIEWPORT = { height: 740, width: 360 } as const;
const TOUCH_VIEWPORT = { height: 915, width: 412 } as const;
const KAZAN_ADDRESSES = ['ул. Рябиновых Фонарей, 8', 'ул. Рябиновых Фонарей, 14'];

test.describe('creating a warehouse', () => {
  test.use({ colorScheme: 'light', viewport: DESKTOP_VIEWPORT });

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

    const autocomplete = await page.getByTestId('create-warehouse-panel').evaluate((panel) => {
      const address = panel.querySelector('form')?.elements.namedItem('address');

      return address instanceof HTMLInputElement ? address.getAttribute('autocomplete') ?? address.form?.autocomplete : undefined;
    });

    expect(autocomplete).toBe('off');

    await createWarehouse.fillName();
    await createWarehouse.selectCity();
    await createWarehouse.fillAddress();
    await createWarehouse.expectAddressOptions([]);
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
    await createWarehouse.expectNewWarehouseAddress(NEW_WAREHOUSE.address);
  });

  test('filters the demo addresses by city and saves the keyboard selection', async ({ page }) => {
    const createWarehouse = createCreateWarehouseRobot(page);
    const navigation = createNavigationRobot(page);

    await navigation.openSection('warehouse');
    await createWarehouse.openForm();
    await createWarehouse.fillName();
    await createWarehouse.fillAddress('РЯБИ');
    await createWarehouse.expectAddressOptions([]);

    await createWarehouse.selectCity();
    await createWarehouse.expectAddressOptions(KAZAN_ADDRESSES);
    await createWarehouse.expectNoViolationsOfAccessibility();
    await createWarehouse.selectCity('Москва');
    await createWarehouse.expectAddressOptions(['ул. Рябиновых Маяков, 6']);
    await createWarehouse.expectAddressValue('РЯБИ');

    await createWarehouse.dismissAddressOptions();
    await createWarehouse.expectPanelOpen();
    await createWarehouse.expectAddressOptions([]);
    await createWarehouse.selectCity();
    await createWarehouse.fillAddress('фонар');
    await createWarehouse.expectAddressOptions(KAZAN_ADDRESSES);
    await createWarehouse.chooseAddressWithKeyboard(1);
    await createWarehouse.expectAddressValue('ул. Рябиновых Фонарей, 14');
    await createWarehouse.expectAddressOptions([]);
    await createWarehouse.submit();

    await createWarehouse.expectPanelClosed();
    await navigation.reload();
    await createWarehouse.expectNewWarehouseAddress('ул. Рябиновых Фонарей, 14');
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
    colorScheme: 'dark',
    hasTouch: true,
    isMobile: true,
    viewport: TOUCH_VIEWPORT,
  });

  test('uses a suggestion by touch in the warehouse form', async ({ page }) => {
    const createWarehouse = createCreateWarehouseRobot(page);
    const navigation = createNavigationRobot(page);

    await navigation.openSection('warehouse');
    await createWarehouse.openForm();
    await createWarehouse.fillName();
    await createWarehouse.selectCity();
    await createWarehouse.fillAddress('кленов');
    await createWarehouse.expectAddressOptions(['проезд Клёновых Контейнеров, 3']);
    await createWarehouse.chooseAddressWithTap(0);
    await createWarehouse.expectAddressValue('проезд Клёновых Контейнеров, 3');
    await createWarehouse.submit();

    await createWarehouse.expectPanelClosed();
    await createWarehouse.expectNewWarehouseAddress('проезд Клёновых Контейнеров, 3');
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
