import {
  FOREIGN_NETWORK_SITE,
  NETWORK_CITY_COUNT,
  NETWORK_SITE_COUNT,
  OWN_NETWORK_SITES,
  PERSONAS,
  UNKNOWN_NETWORK_SITE_ID,
} from './fixtures/demoData.ts';
import {
  toCityRoute,
  toObjectHash,
  toSectionHash,
  toSiteRoute,
} from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import {
  DESKTOP_VIEWPORT,
  PHONE_VIEWPORT,
} from './fixtures/viewports.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createNetworkRobot } from './robots/network-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

const [, SECOND_OWN_SITE, KAZAN_SITE] = OWN_NETWORK_SITES;

test.describe('network sites on a desktop', () => {
  test.use({
    colorScheme: 'light',
    reducedMotion: 'reduce',
    viewport: DESKTOP_VIEWPORT,
  });

  test('lists the sites of the network and selects one by the address', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const network = createNetworkRobot(page);

    await navigation.openSection('network');
    await navigation.expectSection('network');

    await network.expectSitesTabOpen();
    await network.expectRowCount(NETWORK_SITE_COUNT);
    await network.expectOwnSitesFirst(OWN_NETWORK_SITES);

    await network.tapRow(SECOND_OWN_SITE.id);

    await network.expectSiteInspector(SECOND_OWN_SITE);
    await network.expectRowSelected(SECOND_OWN_SITE.id);
  });

  test('opens the warehouse section from the inspector of an own site', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const network = createNetworkRobot(page);

    await navigation.openObject(toSiteRoute(SECOND_OWN_SITE.id));
    await network.expectSiteInspector(SECOND_OWN_SITE);

    await network.openWarehouse();

    await navigation.expectSection('warehouse');
    await network.expectWarehouseOpened(SECOND_OWN_SITE.id);
  });

  test('shows the organization and the side of a foreign site on a direct entry', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const network = createNetworkRobot(page);

    await navigation.openObject(toSiteRoute(FOREIGN_NETWORK_SITE.id));

    await network.expectSiteInspector(FOREIGN_NETWORK_SITE, FOREIGN_NETWORK_SITE.sideName);
    await network.expectRowSelected(FOREIGN_NETWORK_SITE.id);
    await network.expectRowCount(NETWORK_SITE_COUNT);
  });

  test('shows the sites of a city on a direct entry and leads from them to the site', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const network = createNetworkRobot(page);

    await navigation.openObject(toCityRoute(KAZAN_SITE.cityNodeId));

    await network.expectCityInspector(KAZAN_SITE.cityName);
    await network.expectCitySiteLinks([KAZAN_SITE]);

    await network.openCitySiteLink(KAZAN_SITE.id);

    await network.expectSiteInspector(KAZAN_SITE);
    await network.expectRowSelected(KAZAN_SITE.id);
  });

  test('says that the object is not found for an unknown site', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const network = createNetworkRobot(page);

    await navigation.openObject(toSiteRoute(UNKNOWN_NETWORK_SITE_ID));

    await network.expectNotFoundInspector();
    await navigation.expectAddress(toObjectHash(toSiteRoute(UNKNOWN_NETWORK_SITE_ID)));
  });

  test('shows only foreign sites without the own group to a carrier', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const network = createNetworkRobot(page);

    await persona.openAsPersona(toSectionHash('network'), PERSONAS.freshCarrier.id);
    await navigation.expectSection('network');
    await persona.expectCurrentPersona(PERSONAS.freshCarrier);

    await network.expectRowCount(NETWORK_SITE_COUNT);
    await network.expectNoOwnGroup();
  });

  test('has no violations of WCAG 2.1 A and AA in the list with an open site', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const network = createNetworkRobot(page);

    await navigation.openObject(toSiteRoute(FOREIGN_NETWORK_SITE.id));
    await network.expectSiteInspector(FOREIGN_NETWORK_SITE);
    await network.expectRowSelected(FOREIGN_NETWORK_SITE.id);

    await network.expectNoViolationsOfAccessibility();
  });
});

test.describe('network sites on a phone', () => {
  test.use({
    colorScheme: 'light',
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
    viewport: PHONE_VIEWPORT,
  });

  test('taps every city on the mini map and opens its inspector', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const network = createNetworkRobot(page);

    await navigation.openSection('network');
    await navigation.expectSection('network');

    await network.expectMiniMapShown();
    await network.tapCityMarkers(NETWORK_CITY_COUNT);
  });

  test('has no violations of WCAG 2.1 A and AA in the list with the mini map and in the city sheet', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const network = createNetworkRobot(page);

    await navigation.openSection('network');
    await navigation.expectSection('network');
    await network.expectMiniMapShown();
    await network.expectRowCount(NETWORK_SITE_COUNT);

    await network.expectNoViolationsOfAccessibility();

    await navigation.openObject(toCityRoute(KAZAN_SITE.cityNodeId));
    await network.expectCityInspector(KAZAN_SITE.cityName);

    await network.expectNoViolationsOfAccessibility();
  });
});
