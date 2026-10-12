import { test } from '@playwright/test';

import {
  DEFAULT_PERSONA,
  PERSONAS,
} from './fixtures/demoData.ts';
import {
  FIRST_SECTION,
  toSectionHash,
} from './fixtures/routes.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';
import { createWarehouseRobot } from './robots/warehouse-robot.ts';

test.describe('demo path', () => {
  test('hides the catalog and the warehouse from the carrier', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openRoot();

    await navigation.expectSection(FIRST_SECTION);
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await navigation.expectAvailableSections(DEFAULT_PERSONA.sections);

    await persona.selectPersona(PERSONAS.freshCarrier);

    await persona.expectCurrentPersona(PERSONAS.freshCarrier);
    await navigation.expectAvailableSections(PERSONAS.freshCarrier.sections);
    await navigation.expectSection(FIRST_SECTION);
  });

  test('shows the data of the engine after a reload', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const warehouse = createWarehouseRobot(page);

    await navigation.openSection('warehouse');
    await warehouse.expectEngineData();

    await navigation.reload();

    await navigation.expectSection('warehouse');
    await warehouse.expectEngineData();
  });

  test('resets the demo to the default persona after the confirmation', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const topBar = createTopBarRobot(page);
    const warehouse = createWarehouseRobot(page);

    await navigation.openSection(FIRST_SECTION);
    await persona.selectPersona(PERSONAS.freshCarrier);

    await topBar.requestReset();
    await topBar.expectResetConfirmOpen();
    await topBar.resetFromConfirm();

    await topBar.expectResetConfirmClosed();
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await navigation.expectAvailableSections(DEFAULT_PERSONA.sections);
    await navigation.expectAddress(toSectionHash(FIRST_SECTION));

    await navigation.openSection('warehouse');
    await warehouse.expectEngineData();
  });
});
