import {
  DAIRY_SPHERE_ID,
  DEFAULT_PERSONA,
  DIRECTORY_ORGANIZATIONS,
  DIRECTORY_VISIBLE_ORGANIZATIONS,
} from './fixtures/demoData.ts';
import { toOrganizationRoute } from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import {
  DESKTOP_VIEWPORT,
  PHONE_VIEWPORT,
} from './fixtures/viewports.ts';
import { createAssistantRobot } from './robots/assistant-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createOrganizationDirectoryRobot } from './robots/organization-directory-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';

const {
  carrier1,
  carrier2,
  customer1,
  supplier1,
  supplier2,
  supplier3,
  supplier4,
} = DIRECTORY_ORGANIZATIONS;

test.describe('organization directory on a desktop', () => {
  test.use({
    colorScheme: 'light',
    reducedMotion: 'reduce',
    viewport: DESKTOP_VIEWPORT,
  });

  test('lists the companies visible to the viewer by name and marks the own one', async ({ page }) => {
    const directory = createOrganizationDirectoryRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('network');
    await navigation.expectSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);

    await directory.openCompaniesTab();
    await directory.expectCompaniesTabOpen();

    await directory.expectRows(DIRECTORY_VISIBLE_ORGANIZATIONS);
    await directory.expectOwnMarkOnlyOn(customer1);
  });

  test('narrows the list by sphere, verification level and side', async ({ page }) => {
    const directory = createOrganizationDirectoryRobot(page);
    const navigation = createNavigationRobot(page);

    await navigation.openSection('network');
    await navigation.expectSection('network');
    await directory.openCompaniesTab();
    await directory.expectRows(DIRECTORY_VISIBLE_ORGANIZATIONS);

    await directory.tabFilters.open();
    await directory.tabFilters.selectSphere(DAIRY_SPHERE_ID);
    await directory.expectRows([supplier1]);

    await directory.tabFilters.reset();
    await directory.expectRows(DIRECTORY_VISIBLE_ORGANIZATIONS);

    await directory.tabFilters.selectMinLevel(3);
    await directory.expectRows([carrier2, supplier2, supplier3]);

    await directory.tabFilters.close();
    await directory.expectSummary('проверка от 3');
    await directory.expectRows([carrier2, supplier2, supplier3]);

    await directory.tabFilters.open();
    await directory.tabFilters.reset();
    await directory.expectRows(DIRECTORY_VISIBLE_ORGANIZATIONS);

    await directory.tabFilters.selectSide('Перевозчик');
    await directory.tabFilters.selectMinLevel(1);
    await directory.expectRows([carrier1, carrier2]);

    await directory.tabFilters.selectMinLevel(4);
    await directory.expectLevelFourHint();
  });

  test('opens the card of a foreign company without requisites and the own one with them', async ({ page }) => {
    const directory = createOrganizationDirectoryRobot(page);
    const navigation = createNavigationRobot(page);

    await navigation.openSection('network');
    await navigation.expectSection('network');
    await directory.openCompaniesTab();
    await directory.expectRows(DIRECTORY_VISIBLE_ORGANIZATIONS);

    await directory.openRow(supplier1);
    await directory.expectForeignCard(supplier1);
    await directory.expectRowSelected(supplier1);

    await directory.openRow(customer1);
    await directory.expectOwnCard(customer1);
    await directory.expectRowSelected(customer1);
  });

  test('shows the loaded logo of a foreign company in the card and swaps it with the theme', async ({ page }) => {
    const directory = createOrganizationDirectoryRobot(page);
    const navigation = createNavigationRobot(page);
    const topBar = createTopBarRobot(page);

    await directory.followSystemTheme();
    await navigation.openObject(toOrganizationRoute(supplier1.id));
    await directory.expectForeignCard(supplier1);
    await topBar.expectDocumentTheme('light');
    await directory.expectCardLogo(supplier1, 'light');

    await directory.switchColorScheme('dark');
    await topBar.expectDocumentTheme('dark');
    await directory.expectCardLogo(supplier1, 'dark');

    await directory.switchColorScheme('light');
    await topBar.expectDocumentTheme('light');
    await directory.expectCardLogo(supplier1, 'light');
  });

  test('opens the card on a direct entry and after a reload', async ({ page }) => {
    const directory = createOrganizationDirectoryRobot(page);
    const navigation = createNavigationRobot(page);

    await navigation.openObject(toOrganizationRoute(supplier4.id));
    await directory.expectForeignCard(supplier4);

    await navigation.reload();
    await navigation.expectAddress(`#/organizations/${supplier4.id}`);
    await directory.expectForeignCard(supplier4);

    await navigation.openObject(toOrganizationRoute(customer1.id));
    await directory.expectOwnCard(customer1);
  });

  test('shows the same filter in the table and in the tab and opens a card from the table', async ({ page }) => {
    const directory = createOrganizationDirectoryRobot(page);
    const navigation = createNavigationRobot(page);

    await navigation.openSection('network');
    await navigation.expectSection('network');
    await directory.openCompaniesTab();
    await directory.expectRows(DIRECTORY_VISIBLE_ORGANIZATIONS);

    await directory.openTable();
    await directory.expectTableOpen();
    await directory.expectTableRows(DIRECTORY_VISIBLE_ORGANIZATIONS);

    await directory.tableFilters.expectOpen();
    await directory.tableFilters.selectMinLevel(3);
    await directory.expectTableRows([carrier2, supplier2, supplier3]);
    await directory.expectRows([carrier2, supplier2, supplier3]);
    await directory.expectActiveFilterCount(1);

    await directory.tabFilters.open();
    await directory.tabFilters.expectMinLevel(3);

    await directory.tapTableRowCell(supplier2);
    await directory.expectForeignCard(supplier2);
    await directory.expectTableOpen();
    await directory.expectTableRowSelected(supplier2);

    await directory.closeTable();
    await directory.expectTableClosed();
    await directory.expectTableButtonFocused();
  });

  test('has no violations of WCAG 2.1 A and AA in the tab with open filters and in the card', async ({ page }) => {
    const directory = createOrganizationDirectoryRobot(page);
    const navigation = createNavigationRobot(page);

    await navigation.openSection('network');
    await navigation.expectSection('network');
    await directory.openCompaniesTab();
    await directory.tabFilters.open();
    await directory.tabFilters.selectSphere(DAIRY_SPHERE_ID);
    await directory.expectRows([supplier1]);

    await directory.expectNoViolationsOfAccessibility();

    await directory.openRow(supplier1);
    await directory.expectForeignCard(supplier1);

    await directory.expectNoViolationsOfAccessibility();
  });

  test('has no violations of WCAG 2.1 A and AA in the table panel', async ({ page }) => {
    const directory = createOrganizationDirectoryRobot(page);
    const navigation = createNavigationRobot(page);

    await navigation.openSection('network');
    await navigation.expectSection('network');
    await directory.openCompaniesTab();
    await directory.openTable();
    await directory.expectTableOpen();
    await directory.expectTableRows(DIRECTORY_VISIBLE_ORGANIZATIONS);

    await directory.expectNoViolationsOfAccessibility();
  });
});

test.describe('organization directory on a phone', () => {
  test.use({
    colorScheme: 'light',
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
    viewport: PHONE_VIEWPORT,
  });

  test('filters the companies without the table button', async ({ page }) => {
    const assistant = createAssistantRobot(page);
    const directory = createOrganizationDirectoryRobot(page);
    const navigation = createNavigationRobot(page);

    await navigation.openSection('network');
    await navigation.expectSection('network');
    await assistant.dismissReplica('digest');
    await directory.openCompaniesTab();
    await directory.expectRows(DIRECTORY_VISIBLE_ORGANIZATIONS);
    await directory.expectNoTableButton();

    await directory.tabFilters.open();
    await directory.tabFilters.selectSphere(DAIRY_SPHERE_ID);
    await directory.expectRows([supplier1]);
  });
});
