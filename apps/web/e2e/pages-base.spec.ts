import { PERSONAS } from './fixtures/demoData.ts';
import {
  FIRST_SECTION,
  toSectionHash,
} from './fixtures/routes.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { createBasePathRobot } from './robots/base-path-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

test.describe('demo on the publication path', () => {
  test('loads the app and the engine only from the base path without failed requests', async ({ baseURL, page }) => {
    expect(baseURL).toBeDefined();

    const basePath = createBasePathRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await persona.openAsPersona(toSectionHash(FIRST_SECTION), PERSONAS.constructionSupplier.id);

    await navigation.expectSection(FIRST_SECTION);
    await persona.expectCurrentPersona(PERSONAS.constructionSupplier);
    await page.waitForLoadState('networkidle');

    basePath.expectOwnRequestsUnderBasePath(baseURL ?? '');
    basePath.expectNoBrokenRequests();
  });

  test('serves the third party licenses together with the build', async ({ page }) => {
    const basePath = createBasePathRobot(page);

    await basePath.expectLicensesServed();
  });
});
