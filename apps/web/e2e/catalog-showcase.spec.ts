import type {
  BrowserContext,
  Page,
} from '@playwright/test';

import {
  DEFAULT_PERSONA,
  GOLDEN_APPLES,
  GOLDEN_APPLES_INITIAL_UNIT_PRICE_TEXT,
  GOLDEN_APPLES_QUOTES,
  GOLDEN_APPLES_REPRICED,
  PERSONAS,
  SALES_TERMS_AUTO_CONFIRM_TEXTS,
  SHOWCASE_SEARCH_RESULT_COUNT,
  SHOWCASE_SEARCH_TEXT,
  SHOWCASE_SPHERE,
} from './fixtures/demoData.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from './fixtures/graphicsPreference.ts';
import { toSectionHash } from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createAssistantRobot } from './robots/assistant-robot.ts';
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

const openOwnCatalogAsSupplier = async (context: BrowserContext): Promise<Page> => {
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });

  const supplierPage = await context.newPage();
  const assistant = createAssistantRobot(supplierPage);
  const catalog = createCatalogRobot(supplierPage);
  const persona = createPersonaRobot(supplierPage);

  await persona.openAsPersona(toSectionHash('catalog'), PERSONAS.freshSupplier.id);
  await persona.expectCurrentPersona(PERSONAS.freshSupplier);
  await assistant.dismissReplica('digest');
  await catalog.openOwnTab();
  await catalog.expectOwnOpen();

  return supplierPage;
};

test.describe('own catalog of a supplier', () => {
  test.use({
    colorScheme: 'light',
    reducedMotion: 'reduce',
    viewport: DESKTOP_VIEWPORT,
  });

  test('shows the new price of the golden apples to a customer in another tab without a reload', async ({ context, page }) => {
    const customerCatalog = createCatalogRobot(page);
    const customerNavigation = createNavigationRobot(page);
    const customerPersona = createPersonaRobot(page);

    await customerNavigation.openSection('catalog');
    await customerPersona.expectCurrentPersona(DEFAULT_PERSONA);
    await customerCatalog.expectShowcaseOpen();
    await customerCatalog.selectSphere(SHOWCASE_SPHERE.id);
    await customerCatalog.expectDestination(moscow.site);
    await customerCatalog.expectRowQuote(GOLDEN_APPLES.id, moscow);
    await customerCatalog.expectRowUnitPrice(GOLDEN_APPLES.id, GOLDEN_APPLES_INITIAL_UNIT_PRICE_TEXT);

    const supplierPage = await openOwnCatalogAsSupplier(context);
    const supplierCatalog = createCatalogRobot(supplierPage);

    await supplierCatalog.expectOwnRowVisible(GOLDEN_APPLES.id);
    await supplierCatalog.openOwnListing(GOLDEN_APPLES.id);
    await supplierCatalog.openEditor();
    await supplierCatalog.expectEditorOpen();
    await supplierCatalog.fillTierPrice(0, GOLDEN_APPLES_REPRICED.tierPriceInput);
    await supplierCatalog.savePrice();
    await supplierCatalog.expectPriceSaved();

    await customerCatalog.expectRowUnitPrice(GOLDEN_APPLES.id, GOLDEN_APPLES_REPRICED.unitPriceText);
    await customerCatalog.expectRowQuote(GOLDEN_APPLES.id, GOLDEN_APPLES_REPRICED.moscow);
  });

  test('removes the unpublished golden apples from the showcase in another tab without a reload', async ({ context, page }) => {
    const customerCatalog = createCatalogRobot(page);
    const customerNavigation = createNavigationRobot(page);
    const customerPersona = createPersonaRobot(page);

    await customerNavigation.openSection('catalog');
    await customerPersona.expectCurrentPersona(DEFAULT_PERSONA);
    await customerCatalog.expectShowcaseOpen();
    await customerCatalog.selectSphere(SHOWCASE_SPHERE.id);
    await customerCatalog.expectRowVisible(GOLDEN_APPLES.id);

    const supplierPage = await openOwnCatalogAsSupplier(context);
    const supplierCatalog = createCatalogRobot(supplierPage);

    await supplierCatalog.openOwnListing(GOLDEN_APPLES.id);
    await supplierCatalog.openEditor();
    await supplierCatalog.expectEditorOpen();
    await supplierCatalog.togglePublication();
    await supplierCatalog.expectOwnListingPublication(GOLDEN_APPLES.id, false);

    await customerCatalog.expectRowAbsent(GOLDEN_APPLES.id);
  });

  test('keeps the switched auto confirmation in the sales terms of the supplier', async ({ context }) => {
    const supplierPage = await openOwnCatalogAsSupplier(context);
    const supplierCatalog = createCatalogRobot(supplierPage);

    await supplierCatalog.expectSalesTermsCardVisible();
    await supplierCatalog.expectSalesTermsAutoConfirm(SALES_TERMS_AUTO_CONFIRM_TEXTS.off);

    await supplierCatalog.openSalesTermsForm();
    await supplierCatalog.expectAutoConfirmSwitch(false);
    await supplierCatalog.toggleAutoConfirm();
    await supplierCatalog.expectAutoConfirmSwitch(true);
    await supplierCatalog.saveSalesTerms();
    await supplierCatalog.expectSalesTermsAutoConfirm(SALES_TERMS_AUTO_CONFIRM_TEXTS.on);

    await supplierCatalog.openSalesTermsForm();
    await supplierCatalog.expectAutoConfirmSwitch(true);
  });
});
