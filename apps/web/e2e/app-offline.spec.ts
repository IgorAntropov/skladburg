import { DEFAULT_PERSONA } from './fixtures/demoData.ts';
import { FIRST_SECTION } from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createPwaRobot } from './robots/pwa-robot.ts';
import { createWarehouseRobot } from './robots/warehouse-robot.ts';

test.use({ serviceWorkers: 'allow' });

test.describe('offline start', () => {
  test('opens the demo without a network after the first visit', async ({ context, page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const pwa = createPwaRobot(page, context);
    const warehouse = createWarehouseRobot(page);

    await navigation.openRoot();
    await navigation.expectSection(FIRST_SECTION);
    await pwa.waitForPrecache();

    await pwa.goOffline();
    await pwa.reload();

    await navigation.expectSection(FIRST_SECTION);
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    pwa.expectServedFromServiceWorker(/\/$/);
    pwa.expectServedFromServiceWorker(/\/assets\/index-[^/]+\.js$/);

    await navigation.clickSection('warehouse');

    await navigation.expectSection('warehouse');
    await warehouse.expectEngineData();
  });
});
