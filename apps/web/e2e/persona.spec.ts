import { test } from '@playwright/test';

import {
  DEFAULT_PERSONA,
  PERSONA_GROUPS,
  PERSONAS,
  STOREKEEPER_WAREHOUSE_NAMES,
} from './fixtures/demoData.ts';
import { toSectionHash } from './fixtures/routes.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';
import { createWarehouseRobot } from './robots/warehouse-robot.ts';

test.describe('start persona', () => {
  test('opens as the customer of the build profile with all sections and eight personas to choose from', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openRoot();

    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await persona.expectAllPersonasListed();
    await persona.expectSections(DEFAULT_PERSONA.sections);
    await navigation.expectAddress(toSectionHash('network'));
    await persona.expectSectionHeading('network');
  });
});

test.describe('profile menu header of every persona', () => {
  for (const { personas } of PERSONA_GROUPS) {
    for (const persona of personas) {
      test(`shows the name, the role, the organization and the side of ${persona.userDisplayName}`, async ({ page }) => {
        const topBar = createTopBarRobot(page, 'desktop');
        const personaRobot = createPersonaRobot(page);

        await personaRobot.openAsPersona(toSectionHash('network'), persona.id);

        await personaRobot.expectCurrentPersona(persona);
        await topBar.openMenu();
        await topBar.expectMenuContent(persona);
      });
    }
  }
});

test.describe('switching the persona', () => {
  test('moves the storekeeper of the same organization to the warehouse with one warehouse', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const warehouse = createWarehouseRobot(page);

    await navigation.openSection('deals');
    await persona.expectCurrentPersona(PERSONAS.freshCustomer);

    await persona.selectPersona(PERSONAS.freshStorekeeper);

    await navigation.expectAddress(toSectionHash('warehouse'));
    await persona.expectSections(PERSONAS.freshStorekeeper.sections);
    await persona.expectSectionHeading('warehouse');
    await warehouse.expectWarehouses(PERSONAS.freshStorekeeper.organizationName, STOREKEEPER_WAREHOUSE_NAMES);
  });

  test('hides the catalog and the warehouse from the carrier and shows its organization', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('network');
    await persona.expectCurrentPersona(PERSONAS.freshCustomer);

    await persona.selectPersona(PERSONAS.freshCarrier);

    await persona.expectCurrentPersona(PERSONAS.freshCarrier);
    await persona.expectSections(PERSONAS.freshCarrier.sections);
    await navigation.expectAddress(toSectionHash('network'));
    await persona.expectSectionHeading('network');
  });

  test('leads the carrier away from a section that is not available to the role', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('warehouse');
    await persona.expectCurrentPersona(PERSONAS.freshCustomer);

    await persona.selectPersona(PERSONAS.freshCarrier);

    await navigation.expectAddress(toSectionHash('network'));
    await persona.expectSections(PERSONAS.freshCarrier.sections);
    await persona.expectSectionHeading('network');
  });

  test('moves from the first vertical to the supplier of the second one', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('catalog');
    await persona.expectCurrentPersona(PERSONAS.freshCustomer);

    await persona.selectPersona(PERSONAS.constructionSupplier);

    await persona.expectCurrentPersona(PERSONAS.constructionSupplier);
    await persona.expectSections(PERSONAS.constructionSupplier.sections);
    await navigation.expectAddress(toSectionHash('catalog'));
    await persona.expectSectionHeading('catalog');
  });
});

test.describe('persona lifetime', () => {
  test('keeps the chosen persona after a reload', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('network');
    await persona.selectPersona(PERSONAS.freshCarrier);

    await navigation.reload();

    await persona.expectCurrentPersona(PERSONAS.freshCarrier);
    await persona.expectSections(PERSONAS.freshCarrier.sections);
  });

  test('keeps the storekeeper and the warehouse address after a reload', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const warehouse = createWarehouseRobot(page);

    await navigation.openSection('network');
    await persona.selectPersona(PERSONAS.freshStorekeeper);
    await navigation.expectAddress(toSectionHash('warehouse'));

    await navigation.reload();

    await persona.expectCurrentPersona(PERSONAS.freshStorekeeper);
    await navigation.expectAddress(toSectionHash('warehouse'));
    await warehouse.expectWarehouses(PERSONAS.freshStorekeeper.organizationName, STOREKEEPER_WAREHOUSE_NAMES);
  });

  test('gives a new tab of the same browser context the default persona', async ({ context, page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('network');
    await persona.selectPersona(PERSONAS.freshCarrier);

    const secondPage = await context.newPage();
    const secondNavigation = createNavigationRobot(secondPage);
    const secondPersona = createPersonaRobot(secondPage);

    await secondNavigation.openRoot();

    await secondPersona.expectCurrentPersona(DEFAULT_PERSONA);
    await secondPersona.expectSections(DEFAULT_PERSONA.sections);
    await persona.expectCurrentPersona(PERSONAS.freshCarrier);
    await persona.expectSections(PERSONAS.freshCarrier.sections);
  });
});

test.describe('persona link', () => {
  test('opens the app as the persona from the address and removes the parameter from it', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await persona.openAsPersona(toSectionHash('deals'), PERSONAS.constructionSupplier.id);

    await persona.expectCurrentPersona(PERSONAS.constructionSupplier);
    await persona.expectSectionHeading('deals');
    await persona.expectSections(PERSONAS.constructionSupplier.sections);
    await navigation.expectAddress(toSectionHash('deals'));
  });

  test('keeps the persona from the link after a reload', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await persona.openAsPersona(toSectionHash('deals'), PERSONAS.constructionSupplier.id);
    await persona.expectCurrentPersona(PERSONAS.constructionSupplier);
    await navigation.expectAddress(toSectionHash('deals'));

    await navigation.reload();

    await persona.expectCurrentPersona(PERSONAS.constructionSupplier);
    await navigation.expectAddress(toSectionHash('deals'));
  });
});

test.describe('persona menu with the keyboard', () => {
  test('opens on Enter of the focused profile button with the focus inside and keeps the persona', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('deals');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);

    await persona.openMenuWithEnter();

    await persona.expectCheckedPersona(DEFAULT_PERSONA);

    await persona.closeMenuWithEscape();

    await persona.expectTriggerFocused();
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await navigation.expectAddress(toSectionHash('deals'));
  });

  test('opens again on the arrow down key after the first opening', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('deals');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await persona.openMenuWithEnter();
    await persona.closeMenuWithEscape();
    await persona.expectTriggerFocused();

    await persona.openMenuWithArrowDown();

    await persona.expectCheckedPersona(DEFAULT_PERSONA);
    await persona.closeMenuWithEscape();
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
  });

  test('keeps the persona on the arrow keys and Escape of the open menu and returns the focus to the profile button', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('deals');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await persona.openMenuWithEnter();

    await persona.pressArrowDownInMenu(3);
    await persona.pressArrowUpInMenu(1);
    await persona.expectMenuOpen();
    await persona.expectCheckedPersona(DEFAULT_PERSONA);

    await persona.closeMenuWithEscape();

    await persona.expectTriggerFocused();
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await persona.expectSections(DEFAULT_PERSONA.sections);
    await navigation.expectAddress(toSectionHash('deals'));
  });

  test('changes the persona to exactly the highlighted one on Enter and moves the focus to the new profile button', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await persona.focusTriggerWithTab();
    await persona.openMenuWithEnter();

    await persona.highlightPersonaWithArrows(PERSONAS.freshCarrier);
    await persona.expectCheckedPersona(DEFAULT_PERSONA);
    await persona.pressEnterOnHighlightedPersona();

    await persona.expectMenuClosed();
    await persona.expectCurrentPersona(PERSONAS.freshCarrier);
    await persona.expectSections(PERSONAS.freshCarrier.sections);
    await persona.expectTriggerFocused();
    await persona.expectSwitchAnnounced(PERSONAS.freshCarrier);
  });

  test('walks across the group border of the second vertical and changes to the highlighted persona', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('catalog');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await persona.openMenuWithEnter();

    await persona.highlightPersonaWithArrows(PERSONAS.constructionSupplier);
    await persona.pressEnterOnHighlightedPersona();

    await persona.expectMenuClosed();
    await persona.expectCurrentPersona(PERSONAS.constructionSupplier);
    await persona.expectTriggerFocused();
    await persona.expectSwitchAnnounced(PERSONAS.constructionSupplier);
    await persona.expectSectionHeading('catalog');
  });
});

test.describe('persona menu with the mouse', () => {
  test('opens on a click of the trigger and changes nothing until an item is chosen', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('catalog');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);

    await persona.openMenuWithClick();

    await persona.expectCheckedPersona(DEFAULT_PERSONA);
    await persona.closeMenuWithEscape();
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await navigation.expectAddress(toSectionHash('catalog'));
  });

  test('changes the persona on a click of an item', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('catalog');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);

    await persona.selectPersona(PERSONAS.constructionSupplier);

    await persona.expectCurrentPersona(PERSONAS.constructionSupplier);
    await persona.expectTriggerFocused();
    await persona.expectSwitchAnnounced(PERSONAS.constructionSupplier);
    await persona.openMenuWithClick();
    await persona.expectCheckedPersona(PERSONAS.constructionSupplier);
  });
});
