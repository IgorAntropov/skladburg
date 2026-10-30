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
  buildRub,
  captureFailure,
  listCatalogEvents,
  nextUuid,
  SUPPLIER_1_CALL,
  SUPPLIER_2_CALL,
} from './testing/catalogFixtures';

const ownDelivery = { minimumCharge: buildRub(150000n), pricePerKm: buildRub(4500n) };

describe('CatalogService.getSalesTerms', () => {
  it('returns the defaults at version 0 when nothing is saved', async () => {
    const harness = createModuleHarness();

    const response = await harness.catalog.getSalesTerms({}, SUPPLIER_1_CALL);

    expect(response.terms).toMatchObject({
      isAutoConfirmEnabled: false,
      organizationId: SeedOrganizationId.SUPPLIER_1,
      preparationWorkingDays: 1,
      version: 0n,
    });
    expect(response.terms?.ownDelivery).toBeUndefined();
  });

  it('keeps the terms of each organization apart', async () => {
    const harness = createModuleHarness();
    await harness.catalog.saveSalesTerms(
      { idempotencyKey: nextUuid(), isAutoConfirmEnabled: true, ownDelivery, preparationWorkingDays: 3 },
      SUPPLIER_1_CALL,
    );

    const other = await harness.catalog.getSalesTerms({}, SUPPLIER_2_CALL);

    expect(other.terms).toMatchObject({ organizationId: SeedOrganizationId.SUPPLIER_2, preparationWorkingDays: 1, version: 0n });
    expect(other.terms?.ownDelivery).toBeUndefined();
  });
});

describe('CatalogService.saveSalesTerms', () => {
  it('creates the terms at version 1, edits them and drops the own delivery when it is left empty', async () => {
    const harness = createModuleHarness();
    const created = await harness.catalog.saveSalesTerms(
      { idempotencyKey: nextUuid(), isAutoConfirmEnabled: true, ownDelivery, preparationWorkingDays: 2 },
      SUPPLIER_1_CALL,
    );
    const edited = await harness.catalog.saveSalesTerms(
      { expectedVersion: 1n, idempotencyKey: nextUuid(), preparationWorkingDays: 0 },
      SUPPLIER_1_CALL,
    );

    expect(created.terms).toMatchObject({ isAutoConfirmEnabled: true, organizationId: SeedOrganizationId.SUPPLIER_1, version: 1n });
    expect(created.terms?.ownDelivery?.pricePerKm?.amountMinor).toBe(4500n);
    expect(edited.terms).toMatchObject({ isAutoConfirmEnabled: false, preparationWorkingDays: 0, version: 2n });
    expect(edited.terms?.ownDelivery).toBeUndefined();
    expect(harness.state.read.list('salesTerms')).toHaveLength(1);
  });

  it('reports conflicts with the organization entity and the initial version of a missing record', async () => {
    const harness = createModuleHarness();
    const missing = await captureFailure(
      harness.catalog.saveSalesTerms({ expectedVersion: 1n, idempotencyKey: nextUuid() }, SUPPLIER_1_CALL),
    );
    await harness.catalog.saveSalesTerms({ idempotencyKey: nextUuid() }, SUPPLIER_1_CALL);
    const duplicate = await captureFailure(harness.catalog.saveSalesTerms({ idempotencyKey: nextUuid() }, SUPPLIER_1_CALL));
    const stale = await captureFailure(
      harness.catalog.saveSalesTerms({ expectedVersion: 4n, idempotencyKey: nextUuid() }, SUPPLIER_1_CALL),
    );

    expect(missing).toMatchObject({ code: ErrorCode.VERSION_CONFLICT, currentVersion: 0, entity: EntityKind.ORGANIZATION });
    expect(duplicate).toMatchObject({ code: ErrorCode.VERSION_CONFLICT, currentVersion: 1, entity: EntityKind.ORGANIZATION });
    expect(stale).toMatchObject({ code: ErrorCode.VERSION_CONFLICT, currentVersion: 1, entity: EntityKind.ORGANIZATION });
  });

  it('rejects the own delivery tariffs in an unsupported currency', async () => {
    const harness = createModuleHarness();

    const failure = await captureFailure(harness.catalog.saveSalesTerms(
      {
        idempotencyKey: nextUuid(),
        ownDelivery: {
          minimumCharge: { amountMinor: 1n, currencyCode: 'USD' },
          pricePerKm: { amountMinor: 1n, currencyCode: 'EUR' },
        },
      },
      SUPPLIER_1_CALL,
    ));

    expect(failure.violations).toEqual([
      { fieldPath: 'own_delivery.price_per_km.currency_code', ruleId: 'money.currency_unsupported' },
      { fieldPath: 'own_delivery.minimum_charge.currency_code', ruleId: 'money.currency_unsupported' },
    ]);
    expect(harness.state.read.list('salesTerms')).toEqual([]);
  });

  it('replays a repeated key without a second version bump or event', async () => {
    const harness = createModuleHarness();
    const request = { idempotencyKey: nextUuid(), preparationWorkingDays: 2 };

    await harness.catalog.saveSalesTerms(request, SUPPLIER_1_CALL);
    const eventsAfterFirst = listCatalogEvents(harness.events).length;
    const replay = await harness.catalog.saveSalesTerms(request, SUPPLIER_1_CALL);

    expect(replay.terms?.version).toBe(1n);
    expect(harness.state.read.get('salesTerms', SeedOrganizationId.SUPPLIER_1)?.version).toBe(1n);
    expect(listCatalogEvents(harness.events)).toHaveLength(eventsAfterFirst);
  });
});
