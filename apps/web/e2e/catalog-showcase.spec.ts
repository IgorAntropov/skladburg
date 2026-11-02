import {
  DEFAULT_PERSONA,
  GOLDEN_APPLES,
  GOLDEN_APPLES_QUOTES,
  SHOWCASE_SEARCH_RESULT_COUNT,
  SHOWCASE_SEARCH_TEXT,
  SHOWCASE_SPHERE,
} from './fixtures/demoData.ts';
import { test } from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import {
  createCatalogRobot,
  toListingRoute,
} from './robots/catalog-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

const {
  kazan,
  moscow,
  saintPetersburg,
} = GOLDEN_APPLES_QUOTES;

test.describe('showcase of the catalog for a customer', () => {
  test.use({
    colorScheme: 'light',
    reducedMotion: 'reduce',
    viewport: DESKTOP_VIEWPORT,
  });

  test('prices the golden apples to each warehouse of the customer, narrows the list by search and opens the listing', async ({ page }) => {
    const catalog = createCatalogRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);

    await navigation.clickSection('catalog');
    await navigation.expectSection('catalog');
    await catalog.openShowcaseTab();
    await catalog.expectShowcaseOpen();

    await catalog.selectSphere(SHOWCASE_SPHERE.id);
    await catalog.expectSphere(SHOWCASE_SPHERE.id);
    await catalog.expectRowVisible(GOLDEN_APPLES.id);

    await catalog.expectDestination(moscow.site);
    await catalog.expectRowQuote(GOLDEN_APPLES.id, moscow);

    await catalog.changeDestination(saintPetersburg.site);
    await catalog.expectDestination(saintPetersburg.site);
    await catalog.expectRowQuote(GOLDEN_APPLES.id, saintPetersburg);

    await catalog.changeDestination(kazan.site);
    await catalog.expectDestination(kazan.site);
    await catalog.expectRowQuote(GOLDEN_APPLES.id, kazan);

    await catalog.changeDestination(moscow.site);
    await catalog.expectRowQuote(GOLDEN_APPLES.id, moscow);

    const rowCountBeforeSearch = await catalog.readRowCount();

    await catalog.search(SHOWCASE_SEARCH_TEXT);
    await catalog.expectRowCountBelow(rowCountBeforeSearch);
    await catalog.expectRowCount(SHOWCASE_SEARCH_RESULT_COUNT);
    await catalog.expectRowVisible(GOLDEN_APPLES.id);

    await catalog.openListing(GOLDEN_APPLES.id);
    await navigation.expectAddress(`#/${toListingRoute(GOLDEN_APPLES.id).segment}/${GOLDEN_APPLES.id}`);
    await catalog.expectInspectorOpen(GOLDEN_APPLES.name);
    await catalog.expectInspectorQuote(moscow);
  });

  test('opens the listing from a direct address with the price to the first warehouse and the stock by city', async ({ page }) => {
    const catalog = createCatalogRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await navigation.openObject(toListingRoute(GOLDEN_APPLES.id));
    await persona.expectCurrentPersona(DEFAULT_PERSONA);

    await catalog.expectInspectorOpen(GOLDEN_APPLES.name);
    await catalog.expectInspectorQuote(moscow);
    await catalog.expectInspectorCityAvailability(GOLDEN_APPLES.supplierCityName);
  });
});
