import { DEFAULT_PERSONA } from './fixtures/demoData.ts';
import { test } from './fixtures/test.ts';
import {
  DESKTOP_VIEWPORT,
  PHONE_VIEWPORT,
} from './fixtures/viewports.ts';
import { createAssistantRobot } from './robots/assistant-robot.ts';
import { createCreateWarehouseRobot } from './robots/create-warehouse-robot.ts';
import { createHudRobot } from './robots/hud-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createNotificationRobot } from './robots/notification-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createSupportRobot } from './robots/support-robot.ts';
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

  test('has no violations of WCAG 2.1 A and AA with the assistant replica open', async ({ page }) => {
    const assistant = createAssistantRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const topBar = createTopBarRobot(page);

    await navigation.openSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await topBar.expectDocumentTheme('light');

    await assistant.expectNoViolationsOfAccessibility('digest');
  });

  test('has no violations of WCAG 2.1 A and AA in the help tab with the open call form', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const support = createSupportRobot(page);
    const topBar = createTopBarRobot(page);

    await navigation.openSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await topBar.expectDocumentTheme('light');

    await support.openHelp();
    await support.openFormFromHelp();
    await support.expectFormOpen();

    await support.expectNoViolationsOfAccessibility();
  });

  test('has no violations of WCAG 2.1 A and AA in the help tab with the reply of the support', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const support = createSupportRobot(page);
    const topBar = createTopBarRobot(page);

    await navigation.openSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await topBar.expectDocumentTheme('light');

    await support.openHelp();
    await support.openFormFromHelp();
    await support.submit();
    await support.expectReply();

    await support.expectNoViolationsOfAccessibility();
  });
});

test.describe('accessibility on the phone', () => {
  test.use({
    colorScheme: 'light',
    reducedMotion: 'reduce',
    viewport: PHONE_VIEWPORT,
  });

  test('has no violations of WCAG 2.1 A and AA with the assistant replica scrolling on the phone', async ({ page }) => {
    const assistant = createAssistantRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const topBar = createTopBarRobot(page);

    await navigation.openSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await topBar.expectDocumentTheme('light');

    await assistant.expectReplica('digest');
    await assistant.expectScrollAreaFocusable('digest');
    await assistant.expectNoViolationsOfAccessibility('digest');
  });
});
