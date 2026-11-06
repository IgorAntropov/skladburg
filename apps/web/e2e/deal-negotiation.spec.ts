import { DealStatus } from '@skladburg/contracts/deal/v1/deal';

import type { PersonaValue } from './fixtures/demoData.ts';

import {
  FOREIGN_NETWORK_SITE,
  GOLDEN_APPLES,
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from './fixtures/graphicsPreference.ts';
import {
  toObjectHash,
  toSectionHash,
} from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import {
  createCatalogRobot,
  toListingRoute,
} from './robots/catalog-robot.ts';
import { createDealRobot } from './robots/deal-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

const BUYER = {
  id: '90000009-0000-4000-8000-000000000000',
  organizationName: PERSONAS.freshCustomer.organizationName,
  sections: PERSONAS.freshCustomer.sections,
} satisfies PersonaValue;

const MOSCOW_WAREHOUSE_ID = OWN_NETWORK_SITES[0].id;
const GOLDEN_APPLES_ADDRESS = toObjectHash(toListingRoute(GOLDEN_APPLES.id));
const AGREED_GOODS_TOTAL = '45\u00a0600\u00a0₽';

test.describe('deal negotiation', () => {
  test.use({
    colorScheme: 'light',
    reducedMotion: 'reduce',
    viewport: DESKTOP_VIEWPORT,
  });

  test('keeps the draft private and updates the negotiated deal in both tabs', async ({ context, page }) => {
    await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
    const supplierPage = await context.newPage();
    const supplierPersona = createPersonaRobot(supplierPage);
    const customerPersona = createPersonaRobot(page);
    const customer = createDealRobot(page);
    const navigation = createNavigationRobot(page);
    const supplier = createDealRobot(supplierPage);

    await customerPersona.openAsPersona(GOLDEN_APPLES_ADDRESS, PERSONAS.freshCustomer.id);
    await customerPersona.expectCurrentPersona(PERSONAS.freshCustomer);
    await createCatalogRobot(page).expectInspectorOpen(GOLDEN_APPLES.name);
    await supplierPersona.openAsPersona(toSectionHash('deals'), PERSONAS.freshSupplier.id);
    await supplierPersona.expectCurrentPersona(PERSONAS.freshSupplier);

    const address = await customer.createDraft(MOSCOW_WAREHOUSE_ID, '480');
    await customer.expectStatus(DealStatus.DRAFT);
    await supplier.expectDraftsPrivate();

    await navigation.reload();
    await navigation.expectAddress(address);
    await customer.expectStatus(DealStatus.DRAFT);
    await customer.submitDraft();
    await customer.expectStatus(DealStatus.SUBMITTED);
    await supplier.expectInMyQueue(address);
    await supplier.openReceivedNotification(address);
    await supplier.expectStatus(DealStatus.SUBMITTED);

    await supplier.sendCounterOffer(FOREIGN_NETWORK_SITE.id, '95');
    await supplier.expectStatus(DealStatus.COUNTER_OFFERED);
    await customer.expectStatus(DealStatus.COUNTER_OFFERED);
    await customer.acceptCounterOffer();

    await customer.expectStatus(DealStatus.AGREED);
    await supplier.expectStatus(DealStatus.AGREED);
    await customer.expectGoodsTotal(AGREED_GOODS_TOTAL);
    await supplier.expectGoodsTotal(AGREED_GOODS_TOTAL);

    await navigation.openSection('deals');
    await customer.openFromSearch(address, GOLDEN_APPLES.name);
    await customer.expectStatus(DealStatus.AGREED);
  });

  test('keeps a draft over the buyer approval limit in their queue and explains the blocked action', async ({ browserName, page }) => {
    const persona = createPersonaRobot(page);
    const buyer = createDealRobot(page);

    await persona.openAsPersona(GOLDEN_APPLES_ADDRESS, BUYER.id);
    await persona.expectCurrentPersona(BUYER);
    await createCatalogRobot(page).expectInspectorOpen(GOLDEN_APPLES.name);

    const address = await buyer.createDraft(MOSCOW_WAREHOUSE_ID, '1440');
    await buyer.expectStatus(DealStatus.DRAFT);
    await buyer.expectInMyQueue(address);
    await buyer.expectSubmissionOverLimit();

    if (browserName === 'chromium') {
      await buyer.expectNoViolationsOfAccessibility();
    }
  });
});
