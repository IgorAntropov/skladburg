import { test } from '@playwright/test';

import {
  DEAL_ROUTE,
  FIRST_SECTION,
  OBJECT_ROUTES,
  SECTIONS,
  toObjectHash,
  toSectionHash,
} from './fixtures/routes.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createWarehouseRobot } from './robots/warehouse-robot.ts';

test.describe('direct links to sections', () => {
  for (const section of SECTIONS) {
    test(`opens the section ${section}`, async ({ page }) => {
      const navigation = createNavigationRobot(page);

      await navigation.openSection(section);

      await navigation.expectSection(section);
      await navigation.expectAddress(toSectionHash(section));
      await navigation.expectNoObjectNote();
    });
  }
});

test.describe('direct links to objects', () => {
  for (const route of OBJECT_ROUTES) {
    test(`opens the object ${route.type} inside the section ${route.section}`, async ({ page }) => {
      const navigation = createNavigationRobot(page);

      await navigation.openObject(route);

      await navigation.expectSection(route.section);
      await navigation.expectObjectNote(route);
      await navigation.expectAddress(toObjectHash(route));
    });
  }
});

test.describe('unknown address', () => {
  test('shows the not found screen and leads to the first section', async ({ page }) => {
    const navigation = createNavigationRobot(page);

    await navigation.openHash('#/nope');
    await navigation.expectNotFound();
    await navigation.expectAddress('#/nope');

    await navigation.clickNotFoundAction();

    await navigation.expectSection(FIRST_SECTION);
    await navigation.expectAddress(toSectionHash(FIRST_SECTION));
  });

  test('rejects an object address with a malformed identifier', async ({ page }) => {
    const navigation = createNavigationRobot(page);

    await navigation.openHash('#/deals/not%20valid');

    await navigation.expectNotFound();
  });
});

test.describe('root address', () => {
  test('redirects to the first section without leaving an empty hash in the history', async ({ page }) => {
    const navigation = createNavigationRobot(page);

    await navigation.openRoot();

    await navigation.expectSection(FIRST_SECTION);
    await navigation.expectAddress(toSectionHash(FIRST_SECTION));

    await navigation.goBack();

    await navigation.expectBlankPage();
  });

  test('keeps the history free of loops after moving between sections', async ({ page }) => {
    const navigation = createNavigationRobot(page);

    await navigation.openRoot();
    await navigation.expectSection(FIRST_SECTION);
    await navigation.clickSectionLink('catalog');
    await navigation.expectAddress(toSectionHash('catalog'));

    await navigation.goBack();

    await navigation.expectSection(FIRST_SECTION);
    await navigation.expectAddress(toSectionHash(FIRST_SECTION));

    await navigation.goBack();

    await navigation.expectBlankPage();
  });
});

test.describe('navigation bar and history', () => {
  test('moves between sections by links, back and forward', async ({ page }) => {
    const navigation = createNavigationRobot(page);

    await navigation.openSection('network');
    await navigation.expectSection('network');

    await navigation.clickSectionLink('catalog');
    await navigation.expectSection('catalog');
    await navigation.expectAddress(toSectionHash('catalog'));

    await navigation.clickSectionLink('deals');
    await navigation.expectSection('deals');
    await navigation.expectAddress(toSectionHash('deals'));

    await navigation.clickSectionLink('warehouse');
    await navigation.expectSection('warehouse');
    await navigation.expectAddress(toSectionHash('warehouse'));

    await navigation.goBack();
    await navigation.expectSection('deals');
    await navigation.expectAddress(toSectionHash('deals'));

    await navigation.goBack();
    await navigation.expectSection('catalog');
    await navigation.expectAddress(toSectionHash('catalog'));

    await navigation.goForward();
    await navigation.expectSection('deals');
    await navigation.expectAddress(toSectionHash('deals'));

    await navigation.goForward();
    await navigation.expectSection('warehouse');
    await navigation.expectAddress(toSectionHash('warehouse'));
  });

  test('leaves an object address through a section link', async ({ page }) => {
    const navigation = createNavigationRobot(page);

    await navigation.openObject(DEAL_ROUTE);
    await navigation.expectObjectNote(DEAL_ROUTE);

    await navigation.clickSectionLink('deals');

    await navigation.expectAddress(toSectionHash('deals'));
    await navigation.expectNoObjectNote();
  });
});

test.describe('reload', () => {
  for (const section of SECTIONS) {
    test(`keeps the address and the section ${section}`, async ({ page }) => {
      const navigation = createNavigationRobot(page);

      await navigation.openSection(section);
      await navigation.expectSection(section);

      await navigation.reload();

      await navigation.expectSection(section);
      await navigation.expectAddress(toSectionHash(section));
    });
  }

  test('keeps the address of an object', async ({ page }) => {
    const navigation = createNavigationRobot(page);

    await navigation.openObject(DEAL_ROUTE);
    await navigation.expectObjectNote(DEAL_ROUTE);

    await navigation.reload();

    await navigation.expectSection('deals');
    await navigation.expectObjectNote(DEAL_ROUTE);
    await navigation.expectAddress(toObjectHash(DEAL_ROUTE));
  });
});

test.describe('warehouse section', () => {
  test('shows the organization and warehouses from the demo engine on a direct link', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const warehouse = createWarehouseRobot(page);

    await navigation.openSection('warehouse');

    await navigation.expectSection('warehouse');
    await warehouse.expectEngineData();
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
});
