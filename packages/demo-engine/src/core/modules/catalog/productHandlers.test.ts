import { BaseUnit } from '@skladburg/contracts/catalog/v1/catalog';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { SeedOrganizationId } from '../../seed/index';
import { createModuleHarness } from '../testing/moduleHarness';
import {
  buildPackaging,
  buildProductRequest,
  buildRub,
  captureFailure,
  createListing,
  createPrice,
  createProduct,
  createPublishedListing,
  GTIN_ONE,
  GTIN_TWO,
  listCatalogEvents,
  nextUuid,
  SUPPLIER_1_CALL,
  SUPPLIER_2_CALL,
} from './testing/catalogFixtures';

describe('CatalogService.saveProduct', () => {
  it('creates a product at version 1 and bumps the version on every edit', async () => {
    const harness = createModuleHarness();
    const created = await createProduct(harness, { name: 'Кефир' });
    const updated = await harness.catalog.saveProduct(
      buildProductRequest({ expectedVersion: created.version, name: 'Кефир 1%', productId: created.id, sku: created.sku }),
      SUPPLIER_1_CALL,
    );

    expect(created.version).toBe(1n);
    expect(created.tenantId).toBe(SeedOrganizationId.SUPPLIER_1);
    expect(updated.product?.version).toBe(2n);
    expect(updated.product?.name).toBe('Кефир 1%');
    expect(harness.state.read.list('products')).toHaveLength(1);
  });

  it('rejects creation over an existing own product and a stale version with the current version', async () => {
    const harness = createModuleHarness();
    const product = await createProduct(harness);
    await harness.catalog.saveProduct(
      buildProductRequest({ expectedVersion: 1n, productId: product.id, sku: product.sku }),
      SUPPLIER_1_CALL,
    );

    const duplicateCreation = await captureFailure(harness.catalog.saveProduct(
      buildProductRequest({ productId: product.id, sku: product.sku }),
      SUPPLIER_1_CALL,
    ));
    const staleEdit = await captureFailure(harness.catalog.saveProduct(
      buildProductRequest({ expectedVersion: 1n, productId: product.id, sku: product.sku }),
      SUPPLIER_1_CALL,
    ));

    expect(duplicateCreation).toMatchObject({ code: ErrorCode.VERSION_CONFLICT, currentVersion: 2, entity: EntityKind.PRODUCT });
    expect(staleEdit).toMatchObject({ code: ErrorCode.VERSION_CONFLICT, currentVersion: 2, entity: EntityKind.PRODUCT });
  });

  it('answers not_found for an edit of a missing product', async () => {
    const harness = createModuleHarness();

    const failure = await captureFailure(harness.catalog.saveProduct(buildProductRequest({ expectedVersion: 3n }), SUPPLIER_1_CALL));

    expect(failure).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.PRODUCT });
  });

  it('hides a product of another organization and leaves it untouched', async () => {
    const harness = createModuleHarness();
    const foreign = await createProduct(harness, { name: 'Чужой товар' }, SUPPLIER_2_CALL);

    const asCreation = await captureFailure(harness.catalog.saveProduct(
      buildProductRequest({ name: 'Подмена', productId: foreign.id }),
      SUPPLIER_1_CALL,
    ));
    const asEdit = await captureFailure(harness.catalog.saveProduct(
      buildProductRequest({ expectedVersion: 1n, name: 'Подмена', productId: foreign.id }),
      SUPPLIER_1_CALL,
    ));

    expect(asCreation).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.PRODUCT });
    expect(asEdit).toMatchObject({ code: ErrorCode.NOT_FOUND, entity: EntityKind.PRODUCT });
    expect(harness.state.read.get('products', foreign.id)).toMatchObject({ name: 'Чужой товар', tenantId: SeedOrganizationId.SUPPLIER_2 });
  });

  it('replays a repeated key without a second record or event and rejects a changed body under the same key', async () => {
    const harness = createModuleHarness();
    const request = buildProductRequest();

    const first = await harness.catalog.saveProduct(request, SUPPLIER_1_CALL);
    const eventsAfterFirst = listCatalogEvents(harness.events).length;
    const replay = await harness.catalog.saveProduct(request, SUPPLIER_1_CALL);
    const reused = await captureFailure(harness.catalog.saveProduct(
      buildProductRequest({ idempotencyKey: request.idempotencyKey, name: 'Другое имя', productId: request.productId }),
      SUPPLIER_1_CALL,
    ));

    expect(replay.product?.version).toBe(first.product?.version);
    expect(harness.state.read.list('products')).toHaveLength(1);
    expect(listCatalogEvents(harness.events)).toHaveLength(eventsAfterFirst);
    expect(reused.code).toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
  });

  it('keeps a sku and a gtin unique inside the organization only', async () => {
    const harness = createModuleHarness();
    const own = await createProduct(harness, { gtin: GTIN_ONE, sku: 'SKU-1' });
    await createProduct(harness, { gtin: GTIN_ONE, sku: 'SKU-1' }, SUPPLIER_2_CALL);

    const failure = await captureFailure(harness.catalog.saveProduct(
      buildProductRequest({ gtin: GTIN_ONE, sku: 'SKU-1' }),
      SUPPLIER_1_CALL,
    ));
    const selfEdit = await harness.catalog.saveProduct(
      buildProductRequest({ expectedVersion: own.version, gtin: GTIN_ONE, productId: own.id, sku: 'SKU-1' }),
      SUPPLIER_1_CALL,
    );

    expect(failure.violations).toEqual([
      { fieldPath: 'sku', ruleId: 'catalog.sku_taken' },
      { fieldPath: 'gtin', ruleId: 'catalog.gtin_taken' },
    ]);
    expect(selfEdit.product?.version).toBe(2n);
  });

  it('allows several products without a gtin', async () => {
    const harness = createModuleHarness();
    await createProduct(harness, { sku: 'NO-GTIN-1' });

    const second = await createProduct(harness, { sku: 'NO-GTIN-2' });

    expect(second.gtin).toBe('');
  });

  it('refuses a minimum price above a tier of the product listing and accepts it after the tier is raised', async () => {
    const harness = createModuleHarness();
    const product = await createProduct(harness);
    const listing = await createListing(harness, product);
    await createPrice(harness, listing);
    const request = buildProductRequest({
      expectedVersion: product.version,
      minPrice: buildRub(8600n),
      productId: product.id,
      sku: product.sku,
    });

    const failure = await captureFailure(harness.catalog.saveProduct(request, SUPPLIER_1_CALL));
    const accepted = await harness.catalog.saveProduct(
      buildProductRequest({ ...request, idempotencyKey: nextUuid(), minPrice: buildRub(8500n) }),
      SUPPLIER_1_CALL,
    );

    expect(failure.violations).toEqual([{ fieldPath: 'min_price.amount_minor', ruleId: 'catalog.min_price_above_tier' }]);
    expect(accepted.product?.minPrice?.amountMinor).toBe(8500n);
  });

  it('refuses a changed base unit of a product with a published listing and leaves the product untouched', async () => {
    const harness = createModuleHarness();
    const { listing, product } = await createPublishedListing(harness);

    const failure = await captureFailure(harness.catalog.saveProduct(
      buildProductRequest({ baseUnit: BaseUnit.GRAM, expectedVersion: product.version, productId: product.id, sku: product.sku }),
      SUPPLIER_1_CALL,
    ));

    expect(failure.violations).toEqual([{ fieldPath: 'base_unit', ruleId: 'catalog.base_unit_locked' }]);
    expect(harness.state.read.get('products', product.id)).toMatchObject({ baseUnit: BaseUnit.PIECE, version: product.version });
    expect(harness.state.read.get('listings', listing.id)?.version).toBe(listing.version);
    expect(harness.state.read.get('listingPrices', listing.id)?.version).toBe(1n);
  });

  it('refuses a changed base unit while the product has a draft listing without a price', async () => {
    const harness = createModuleHarness();
    const product = await createProduct(harness);
    await createListing(harness, product);

    const failure = await captureFailure(harness.catalog.saveProduct(
      buildProductRequest({ baseUnit: BaseUnit.MILLILITER, expectedVersion: product.version, productId: product.id, sku: product.sku }),
      SUPPLIER_1_CALL,
    ));

    expect(failure.violations).toEqual([{ fieldPath: 'base_unit', ruleId: 'catalog.base_unit_locked' }]);
    expect(harness.state.read.get('products', product.id)).toMatchObject({ baseUnit: BaseUnit.PIECE, version: 1n });
  });

  it('allows a changed base unit while the product has no listing and keeps other edits under a lock', async () => {
    const harness = createModuleHarness();
    const free = await createProduct(harness, { sku: 'FREE' });
    const used = await createProduct(harness, { sku: 'USED' });
    await createListing(harness, used);

    const changed = await harness.catalog.saveProduct(
      buildProductRequest({ baseUnit: BaseUnit.GRAM, expectedVersion: free.version, productId: free.id, sku: free.sku }),
      SUPPLIER_1_CALL,
    );
    const renamed = await harness.catalog.saveProduct(
      buildProductRequest({ expectedVersion: used.version, name: 'Новое имя', productId: used.id, sku: used.sku }),
      SUPPLIER_1_CALL,
    );

    expect(changed.product).toMatchObject({ baseUnit: BaseUnit.GRAM, version: 2n });
    expect(renamed.product).toMatchObject({ baseUnit: BaseUnit.PIECE, name: 'Новое имя', version: 2n });
  });

  it('collects every violation of one command in a single error', async () => {
    const harness = createModuleHarness();
    await createProduct(harness, { gtin: GTIN_TWO, sku: 'SKU-A' });
    const packagingId = nextUuid();

    const failure = await captureFailure(harness.catalog.saveProduct(
      buildProductRequest({
        gtin: GTIN_TWO,
        minPrice: { amountMinor: 1n, currencyCode: 'USD' },
        packagings: [buildPackaging(packagingId), buildPackaging(packagingId)],
        sku: 'SKU-A',
        storageTemperature: { maxCelsius: 1, minCelsius: 5 },
      }),
      SUPPLIER_1_CALL,
    ));

    expect(failure.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(failure.violations.map(violation => violation.ruleId)).toEqual([
      'catalog.sku_taken',
      'catalog.gtin_taken',
      'catalog.packaging_id_duplicate',
      'catalog.temperature_range_order',
      'money.currency_unsupported',
    ]);
  });
});

describe('CatalogService.listProducts', () => {
  it('returns only own products ordered by name with the id as a tie-breaker', async () => {
    const harness = createModuleHarness();
    await createProduct(harness, { name: 'Ряженка', sku: 'R-1' });
    await createProduct(harness, { name: 'Айран', sku: 'A-1' });
    await createProduct(harness, { name: 'Ёмкость', sku: 'E-1' });
    await createProduct(harness, { name: 'Сыр чужой', sku: 'F-1' }, SUPPLIER_2_CALL);

    const response = await harness.catalog.listProducts({}, SUPPLIER_1_CALL);

    expect(response.products.map(product => product.name)).toEqual(['Айран', 'Ёмкость', 'Ряженка']);
    expect(response.products.every(product => product.tenantId === SeedOrganizationId.SUPPLIER_1)).toBe(true);
  });

  it('filters by a case-insensitive substring of the name or the sku', async () => {
    const harness = createModuleHarness();
    await createProduct(harness, { name: 'Творог мягкий', sku: 'TV-10' });
    await createProduct(harness, { name: 'Сметана', sku: 'SM-20' });

    const byName = await harness.catalog.listProducts({ query: 'ТВОРОГ' }, SUPPLIER_1_CALL);
    const bySku = await harness.catalog.listProducts({ query: 'sm-2' }, SUPPLIER_1_CALL);
    const nothing = await harness.catalog.listProducts({ query: 'нет такого' }, SUPPLIER_1_CALL);

    expect(byName.products.map(product => product.sku)).toEqual(['TV-10']);
    expect(bySku.products.map(product => product.sku)).toEqual(['SM-20']);
    expect(nothing.products).toEqual([]);
  });

  it('pages through the products with the next page token', async () => {
    const harness = createModuleHarness();
    await createProduct(harness, { name: 'Б', sku: 'B' });
    await createProduct(harness, { name: 'А', sku: 'A' });
    await createProduct(harness, { name: 'В', sku: 'V' });

    const first = await harness.catalog.listProducts({ page: { pageSize: 2 } }, SUPPLIER_1_CALL);
    const second = await harness.catalog.listProducts(
      { page: { pageSize: 2, pageToken: first.page?.nextPageToken } },
      SUPPLIER_1_CALL,
    );

    expect(first.products.map(product => product.name)).toEqual(['А', 'Б']);
    expect(second.products.map(product => product.name)).toEqual(['В']);
    expect(second.page?.nextPageToken).toBe('');
  });
});
