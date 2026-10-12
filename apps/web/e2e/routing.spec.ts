import { PERSONAS } from './fixtures/demoData.ts';
import {
  DEAL_ROUTE,
  FIRST_SECTION,
  toObjectHash,
  toSectionHash,
} from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

test.describe('addresses', () => {
  test('shows the not found screen for an unknown address and leads to the first section', async ({ page }) => {
    const navigation = createNavigationRobot(page);

    await navigation.openHash('#/nope');
    await navigation.expectNotFound();
    await navigation.expectAddress('#/nope');

    await navigation.clickNotFoundAction();

    await navigation.expectSection(FIRST_SECTION);
    await navigation.expectAddress(toSectionHash(FIRST_SECTION));
  });

  test('keeps the address of an object after a reload', async ({ page }) => {
    const navigation = createNavigationRobot(page);

    await navigation.openObject(DEAL_ROUTE);
    await navigation.expectObjectNote(DEAL_ROUTE);

    await navigation.reload();

    await navigation.expectSection(DEAL_ROUTE.section);
    await navigation.expectObjectNote(DEAL_ROUTE);
    await navigation.expectAddress(toObjectHash(DEAL_ROUTE));
  });

  test('opens the app as the persona from the address and removes the parameter from it', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await persona.openAsPersona(toSectionHash('deals'), PERSONAS.constructionSupplier.id);

    await persona.expectCurrentPersona(PERSONAS.constructionSupplier);
    await navigation.expectSection('deals');
    await navigation.expectAddress(toSectionHash('deals'));
  });
});
