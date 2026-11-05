import { ImportStatus } from '@skladburg/contracts/import/v1/import';

import type { IStateTransaction } from '../../state/index';
import type { IRequestValidator } from '../../validation/index';
import type { IModuleRuntime } from '../moduleRuntime';
import type { ImportRecordValue } from './importRecords';

import { createCatalogChangePublisher } from '../catalog/catalogEvents';
import { findPriceList } from '../catalog/catalogRecords';
import { writeListing } from '../catalog/listingMutation';
import { writeListingPrice } from '../catalog/listingPriceMutation';
import { writeProduct } from '../catalog/productMutation';
import {
  buildImportRequests,
  validateImportRows,
} from './importValidation';

export const commitImport = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  validator: IRequestValidator,
  record: ImportRecordValue,
): void => {
  const organizationId = record.job.tenantId;
  const errors = validateImportRows(record.rows, transaction, organizationId, validator, record.columns);
  const violations = record.rows.flatMap((row, index) => [...row.errors, ...(errors[index] ?? [])]
    .map(error => ({ fieldPath: `rows[${String(row.rowNumber - 2)}].${error.fieldPath}`, ruleId: error.ruleId })));
  if (record.rows.length === 0) {
    violations.push({ fieldPath: 'rows', ruleId: 'repeated.min_items' });
  }
  if (violations.length > 0) {
    throw runtime.errors.validationFailed(violations.slice(0, 1000));
  }
  const previousPriceList = findPriceList(transaction, organizationId);

  for (const row of record.rows) {
    const requests = buildImportRequests(row);
    const product = writeProduct(transaction, requests.product, organizationId, undefined);
    const listing = writeListing(transaction, requests.listing, organizationId, undefined);
    const price = writeListingPrice(transaction, requests.price, organizationId, 0n, runtime.random);
    row.product = product;
    row.listing = listing;
    row.price = price;
    record.provenance.push({
      listingId: listing.id,
      listingVersion: listing.version,
      priceVersion: price.version,
      productId: product.id,
      productVersion: product.version,
    });
  }
  if (previousPriceList === undefined) {
    const created = findPriceList(transaction, organizationId);
    record.createdPriceListId = created?.id ?? '';
    record.createdPriceListVersion = created?.version ?? 0n;
  }
  record.job.status = ImportStatus.COMMITTED;
  createCatalogChangePublisher(runtime.outbox)(transaction, organizationId, false);
};
