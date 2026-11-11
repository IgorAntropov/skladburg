import { create } from '@bufbuild/protobuf';
import {
  ErrorCode,
  ImportRollbackBlockedParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import { ImportStatus } from '@skladburg/contracts/import/v1/import';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';
import type { ImportRecordValue } from './importRecords';

import { createCatalogChangePublisher } from '../catalog/catalogEvents';

export const rollbackImport = (transaction: IStateTransaction, runtime: IModuleRuntime, record: ImportRecordValue): void => {
  const organizationId = record.job.tenantId;
  const listingIds = new Set(record.provenance.map(entry => entry.listingId));
  const productIds = new Set(record.provenance.map(entry => entry.productId));
  const hasChangedRecord = record.provenance.some((entry) => {
    const product = transaction.get('products', entry.productId);
    const listing = transaction.get('listings', entry.listingId);
    const price = transaction.get('listingPrices', entry.listingId);
    return product?.tenantId !== organizationId || listing?.tenantId !== organizationId || price?.tenantId !== organizationId
      || product.version !== entry.productVersion || listing.version !== entry.listingVersion || price.version !== entry.priceVersion;
  });
  const hasExternalProductReference = transaction.list('listings')
    .some(listing => productIds.has(listing.productId) && !listingIds.has(listing.id))
    || [...productIds].some(productId => transaction.listBy('stockBatches', 'productId', productId).length > 0);
  const createdPriceList = record.createdPriceListId === '' ? undefined : transaction.get('priceLists', record.createdPriceListId);
  const hasChangedPriceList = record.createdPriceListId !== ''
    && (createdPriceList?.version !== record.createdPriceListVersion || createdPriceList.tenantId !== organizationId);
  const hasExternalPriceReference = record.createdPriceListId !== '' && transaction.list('listingPrices')
    .some(price => price.priceListId === record.createdPriceListId && !listingIds.has(price.listingId));

  const isBlocked = record.usedListingIds.length > 0 || hasChangedRecord || hasExternalProductReference
    || hasChangedPriceList || hasExternalPriceReference;
  if (isBlocked) {
    throw runtime.errors.create(ErrorCode.IMPORT_ROLLBACK_BLOCKED, {
      case: 'importRollbackBlocked', value: create(ImportRollbackBlockedParamsSchema, { jobId: record.id }),
    });
  }
  for (const entry of record.provenance) {
    transaction.delete('listingPrices', entry.listingId);
    transaction.delete('listings', entry.listingId);
    transaction.delete('products', entry.productId);
  }
  if (record.createdPriceListId !== '') {
    transaction.delete('priceLists', record.createdPriceListId);
  }
  record.job.status = ImportStatus.ROLLED_BACK;
  createCatalogChangePublisher(runtime.outbox)(transaction, organizationId, false);
};
