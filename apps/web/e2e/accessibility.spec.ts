import {
  DEFAULT_PERSONA,
  GLOBAL_SEARCH_AXE_QUERY,
  GOLDEN_APPLES,
  PERSONAS,
} from './fixtures/demoData.ts';
import { toSectionHash } from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import {
  DESKTOP_VIEWPORT,
  PHONE_VIEWPORT,
} from './fixtures/viewports.ts';
import { createAssistantRobot } from './robots/assistant-robot.ts';
import {
  createCatalogRobot,
  toListingRoute,
} from './robots/catalog-robot.ts';
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

  test('has no violations of WCAG 2.1 A and AA in the open panel of the global search', async ({ page }) => {
    const hud = createHudRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const topBar = createTopBarRobot(page);

    await navigation.openSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await topBar.expectDocumentTheme('light');

    await topBar.openSearchBySlash();
    await topBar.typeSearchQuery(GLOBAL_SEARCH_AXE_QUERY.text);
    await topBar.expectSearchGroups(GLOBAL_SEARCH_AXE_QUERY.groupIds);
    await topBar.expectActiveSearchOption();

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

  test('has no violations of WCAG 2.1 A and AA in the showcase of the catalog', async ({ page }) => {
    const catalog = createCatalogRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const topBar = createTopBarRobot(page);

    await navigation.openSection('catalog');
    await navigation.expectSection('catalog');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await topBar.expectDocumentTheme('light');
    await catalog.expectShowcaseOpen();

    await catalog.expectNoViolationsOfAccessibility();
  });

  test('has no violations of WCAG 2.1 A and AA in the inspector of a listing', async ({ page }) => {
    const catalog = createCatalogRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const topBar = createTopBarRobot(page);

    await navigation.openObject(toListingRoute(GOLDEN_APPLES.id));
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await topBar.expectDocumentTheme('light');
    await catalog.expectInspectorOpen(GOLDEN_APPLES.name);
    await catalog.expectInspectorCityAvailability(GOLDEN_APPLES.supplierCityName);

    await catalog.expectNoViolationsOfAccessibility();
  });

  test('has no violations of WCAG 2.1 A and AA in the own catalog of a supplier', async ({ page }) => {
    const assistant = createAssistantRobot(page);
    const catalog = createCatalogRobot(page);
    const persona = createPersonaRobot(page);
    const topBar = createTopBarRobot(page);

    await persona.openAsPersona(toSectionHash('catalog'), PERSONAS.freshSupplier.id);
    await persona.expectCurrentPersona(PERSONAS.freshSupplier);
    await topBar.expectDocumentTheme('light');
    await assistant.dismissReplica('digest');
    await catalog.openOwnTab();
    await catalog.expectOwnOpen();
    await catalog.expectSalesTermsCardVisible();

    await catalog.expectNoViolationsOfAccessibility();
  });

  test('has no violations of WCAG 2.1 A and AA in the open editor of an own listing', async ({ page }) => {
    const assistant = createAssistantRobot(page);
    const catalog = createCatalogRobot(page);
    const persona = createPersonaRobot(page);
    const topBar = createTopBarRobot(page);

    await persona.openAsPersona(toSectionHash('catalog'), PERSONAS.freshSupplier.id);
    await persona.expectCurrentPersona(PERSONAS.freshSupplier);
    await topBar.expectDocumentTheme('light');
    await assistant.dismissReplica('digest');
    await catalog.openOwnTab();
    await catalog.expectOwnOpen();
    await catalog.openOwnListing(GOLDEN_APPLES.id);
    await catalog.openEditor();
    await catalog.expectEditorOpen();

    await catalog.expectNoViolationsOfAccessibility();
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
