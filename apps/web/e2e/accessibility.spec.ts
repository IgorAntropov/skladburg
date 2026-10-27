import { DEFAULT_PERSONA } from './fixtures/demoData.ts';
import { test } from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createCreateWarehouseRobot } from './robots/create-warehouse-robot.ts';
import { createHudRobot } from './robots/hud-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createNotificationRobot } from './robots/notification-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';

test.describe('accessibility', () => {
  test.use({
    colorScheme: 'light',
    reducedMotion: 'reduce',
    viewport: DESKTOP_VIEWPORT,
  });

  test('has no violations of WCAG 2.1 A and AA in the panel', async ({ page }) => {
    const hud = createHudRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const topBar = createTopBarRobot(page);

    await navigation.openSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await topBar.expectDocumentTheme('light');

    await hud.expectNoViolationsOfAccessibility();
  });

  test('has no violations of WCAG 2.1 A and AA in the open form of a new warehouse', async ({ page }) => {
    const createWarehouse = createCreateWarehouseRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const topBar = createTopBarRobot(page);

    await navigation.openSection('warehouse');
    await navigation.expectSection('warehouse');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await topBar.expectDocumentTheme('light');

    await createWarehouse.openForm();
    await createWarehouse.fillName();
    await createWarehouse.pressEnterInName();
    await createWarehouse.expectCityErrorFocused();

    await createWarehouse.expectNoViolationsOfAccessibility();
  });

  test('has no violations of WCAG 2.1 A and AA in the open notification center', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const notifications = createNotificationRobot(page);
    const persona = createPersonaRobot(page);
    const topBar = createTopBarRobot(page);

    await navigation.openSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await topBar.expectDocumentTheme('light');
    await notifications.expectUnreadCount(1);

    await notifications.open();

    await notifications.expectNoViolationsOfAccessibility();
  });
});
