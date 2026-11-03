import { create } from '@bufbuild/protobuf';
import { OrganizationSchema } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ModuleHarnessValue } from '../../testing/moduleHarness';

import {
  SeedOrganizationId,
  SeedSphereId,
} from '../../../seed/index';
import { createModuleHarness } from '../../testing/moduleHarness';
import {
  GTIN_ONE,
  listFullShowcase,
  SUPPLIER_2_CALL,
} from '../testing/catalogFixtures';
import {
  createShowcaseListing,
  CUSTOMER_CALL,
  UNKNOWN_ID,
} from './testing/showcaseFixtures';

const FRUIT_LISTING = { sphereIds: [SeedSphereId.FRUIT_AND_VEGETABLES] };

describe('filters of the showcase list', () => {
  it('selects by a sphere together with its subtree', async () => {
    const harness = createModuleHarness();
    const dairy = await createShowcaseListing(harness);
    const fruit = await createShowcaseListing(harness, { listing: FRUIT_LISTING });

    const food = await listFullShowcase(harness.catalogShowcase, { sphereId: SeedSphereId.FOOD }, CUSTOMER_CALL);
    const fruitOnly = await listFullShowcase(harness.catalogShowcase, { sphereId: SeedSphereId.FRUIT_AND_VEGETABLES }, CUSTOMER_CALL);
    const construction = await listFullShowcase(harness.catalogShowcase, { sphereId: SeedSphereId.CONSTRUCTION }, CUSTOMER_CALL);

    expect(food.listings.map(item => item.id)).toEqual(expect.arrayContaining([dairy.listing.id, fruit.listing.id]));
    expect(fruitOnly.listings.map(item => item.id)).toContain(fruit.listing.id);
    expect(fruitOnly.listings.map(item => item.id)).not.toContain(dairy.listing.id);
    expect(construction.listings.map(item => item.id)).not.toContain(dairy.listing.id);
  });

  it('answers an empty list for an unknown sphere', async () => {
    const harness = createModuleHarness();

    await createShowcaseListing(harness);

    const response = await listFullShowcase(harness.catalogShowcase, { sphereId: UNKNOWN_ID }, CUSTOMER_CALL);

    expect(response.listings).toEqual([]);
  });

  it('selects the listings of one supplier', async () => {
    const harness = createModuleHarness();
    const first = await createShowcaseListing(harness);
    const second = await createShowcaseListing(harness, { call: SUPPLIER_2_CALL });

    const response = await listFullShowcase(
      harness.catalogShowcase,
      { supplierOrganizationId: SeedOrganizationId.SUPPLIER_2 },
      CUSTOMER_CALL,
    );

    expect(response.listings.map(item => item.id)).toContain(second.listing.id);
    expect(response.listings.map(item => item.id)).not.toContain(first.listing.id);
    expect(response.listings.every(item => item.supplier?.organizationId === SeedOrganizationId.SUPPLIER_2)).toBe(true);
  });

  it('searches the product name and the supplier name regardless of case', async () => {
    const harness = createModuleHarness();
    const yogurt = await createShowcaseListing(harness, { product: { name: 'Тестовый йогурт' } });
    const kefir = await createShowcaseListing(harness, { call: SUPPLIER_2_CALL, product: { name: 'Тестовый кефир' } });
    const supplierName = harness.state.read.get('organizations', SeedOrganizationId.SUPPLIER_2)?.name ?? '';

    const byProduct = await listFullShowcase(harness.catalogShowcase, { query: 'ЙОГУРТ' }, CUSTOMER_CALL);
    const bySupplier = await listFullShowcase(harness.catalogShowcase, { query: supplierName.toUpperCase() }, CUSTOMER_CALL);
    const byNothing = await listFullShowcase(harness.catalogShowcase, { query: 'такого товара нет' }, CUSTOMER_CALL);

    expect(byProduct.listings.map(item => item.id)).toContain(yogurt.listing.id);
    expect(byProduct.listings.map(item => item.id)).not.toContain(kefir.listing.id);
    expect(bySupplier.listings.map(item => item.id)).toContain(kefir.listing.id);
    expect(bySupplier.listings.map(item => item.id)).not.toContain(yogurt.listing.id);
    expect(byNothing.listings).toEqual([]);
  });

  it('takes the words in any order, yo as ye and extra spaces', async () => {
    const harness = createModuleHarness();
    const apples = await createShowcaseListing(harness, { product: { name: 'Яблоки Голден-тест, 1 сорт' } });
    const supplier = create(OrganizationSchema, harness.state.read.get('organizations', SeedOrganizationId.SUPPLIER_2));

    supplier.name = 'Тёплый склад тест';

    await harness.runtime.command((transaction) => {
      transaction.put('organizations', supplier);
    });

    const bread = await createShowcaseListing(harness, { call: SUPPLIER_2_CALL, product: { name: 'Хлеб ржаной' } });

    const reordered = await listFullShowcase(harness.catalogShowcase, { query: '  голден-тест   ЯБЛОКИ ' }, CUSTOMER_CALL);
    const bySupplierWithYe = await listFullShowcase(harness.catalogShowcase, { query: 'теплый' }, CUSTOMER_CALL);
    const bySupplierAndProduct = await listFullShowcase(harness.catalogShowcase, { query: 'ржаной ТЁПЛЫЙ' }, CUSTOMER_CALL);

    expect(reordered.listings.map(item => item.id)).toEqual([apples.listing.id]);
    expect(bySupplierWithYe.listings.map(item => item.id)).toContain(bread.listing.id);
    expect(bySupplierWithYe.listings.map(item => item.id)).not.toContain(apples.listing.id);
    expect(bySupplierAndProduct.listings.map(item => item.id)).toEqual([bread.listing.id]);
  });

  it('searches by the gtin of the product but not by seven digits', async () => {
    const harness = createModuleHarness();
    const { listing, product } = await createShowcaseListing(harness, { product: { gtin: GTIN_ONE } });

    const byGtin = await listFullShowcase(harness.catalogShowcase, { query: GTIN_ONE }, CUSTOMER_CALL);
    const byPaddedGtin = await listFullShowcase(harness.catalogShowcase, { query: `0${GTIN_ONE}` }, CUSTOMER_CALL);
    const byShortDigits = await listFullShowcase(harness.catalogShowcase, { query: GTIN_ONE.slice(0, 7) }, CUSTOMER_CALL);

    expect(product.gtin).toBe(GTIN_ONE);
    expect(byGtin.listings.map(item => item.id)).toEqual([listing.id]);
    expect(byPaddedGtin.listings.map(item => item.id)).toEqual([listing.id]);
    expect(byShortDigits.listings).toEqual([]);
  });

  it('keeps the seeded apples under the word apples', async () => {
    const harness = createModuleHarness();

    const response = await listFullShowcase(harness.catalogShowcase, { query: 'яблоки' }, CUSTOMER_CALL);

    expect(response.listings.map(item => item.productName)).toEqual([
      'Яблоки Антоновка, 2 сорт',
      'Яблоки Гала, 1 сорт',
      'Яблоки Голден, 1 сорт',
      'Яблоки Гренни Смит, 1 сорт',
      'Яблоки Ренет Симиренко, 2 сорт',
      'Яблоки Фуджи, 1 сорт',
    ]);
  });

  it('does not search by the article', async () => {
    const harness = createModuleHarness();
    const { listing, product } = await createShowcaseListing(harness);

    const response = await listFullShowcase(harness.catalogShowcase, { query: product.sku }, CUSTOMER_CALL);

    expect(response.listings.map(item => item.id)).not.toContain(listing.id);
  });
});

describe('order and pages of the showcase list', () => {
  const createSortedTriple = async (harness: ModuleHarnessValue): Promise<string[]> => {
    const third = await createShowcaseListing(harness, { product: { name: 'Порядок-тест В' } });
    const first = await createShowcaseListing(harness, { call: SUPPLIER_2_CALL, product: { name: 'Порядок-тест А' } });
    const second = await createShowcaseListing(harness, { product: { name: 'Порядок-тест Б' } });

    return [first.listing.id, second.listing.id, third.listing.id];
  };

  it('sorts by product name without lifting the own or paid ones', async () => {
    const harness = createModuleHarness();
    const expectedIds = await createSortedTriple(harness);

    const response = await listFullShowcase(harness.catalogShowcase, { query: 'порядок-тест' }, CUSTOMER_CALL);

    expect(response.listings.map(item => item.id)).toEqual(expectedIds);
  });

  it('walks the pages in the same order', async () => {
    const harness = createModuleHarness();
    const expectedIds = await createSortedTriple(harness);

    const firstPage = await harness.catalogShowcase.listShowcaseListings(
      { page: { pageSize: 2 }, query: 'порядок-тест' },
      CUSTOMER_CALL,
    );
    const secondPage = await harness.catalogShowcase.listShowcaseListings(
      { page: { pageSize: 2, pageToken: firstPage.page?.nextPageToken ?? '' }, query: 'порядок-тест' },
      CUSTOMER_CALL,
    );

    expect(firstPage.listings.map(item => item.id)).toEqual(expectedIds.slice(0, 2));
    expect(firstPage.page?.nextPageToken).toBe(expectedIds[1]);
    expect(secondPage.listings.map(item => item.id)).toEqual(expectedIds.slice(2));
    expect(secondPage.page?.nextPageToken).toBe('');
  });
});
