import type {
  ImportJob,
  ImportRow,
} from '@skladburg/contracts/import/v1/import';

import {
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  ImportJobSchema,
  ImportRowSchema,
} from '@skladburg/contracts/import/v1/import';

import type {
  StoredObjectValue,
  StoredRecordValue,
} from '../../ports/index';
import type { WarehouseImportMetadataValue } from './warehouseImportMetadata';

import {
  readWarehouseImportMetadata,
  serializeWarehouseImportMetadata,
} from './warehouseImportMetadata';

export interface ImportProvenanceValue {
  listingId: string;
  listingVersion: bigint;
  priceVersion: bigint;
  productId: string;
  productVersion: bigint;
}

export interface ImportRecordValue {
  columns: string[];
  createdPriceListId: string;
  createdPriceListVersion: bigint;
  id: string;
  job: ImportJob;
  provenance: ImportProvenanceValue[];
  rows: ImportRow[];
  usedListingIds: string[];
  warehouseImport?: WarehouseImportMetadataValue;
}

export const serializeImportRecord = (record: ImportRecordValue): StoredObjectValue => ({
  columns: [...record.columns],
  createdPriceListId: record.createdPriceListId,
  createdPriceListVersion: record.createdPriceListVersion,
  id: record.id,
  jobBytes: toBinary(ImportJobSchema, record.job),
  provenance: record.provenance.map(entry => ({ ...entry })),
  rowBytes: record.rows.map(row => toBinary(ImportRowSchema, row)),
  usedListingIds: [...record.usedListingIds],
  ...(record.warehouseImport === undefined ? {} : { warehouseImport: serializeWarehouseImportMetadata(record.warehouseImport) }),
});

export const parseImportRecord = (stored: StoredRecordValue): ImportRecordValue => {
  if (stored instanceof Uint8Array) {
    throw new TypeError('Stored import must be a record');
  }
  const {
    columns, createdPriceListId, createdPriceListVersion, id, jobBytes, provenance, rowBytes, usedListingIds, warehouseImport,
  } = stored;
  if (!Array.isArray(columns) || typeof id !== 'string'
    || typeof createdPriceListId !== 'string' || typeof createdPriceListVersion !== 'bigint'
    || !(jobBytes instanceof Uint8Array) || !Array.isArray(provenance) || !Array.isArray(rowBytes) || !Array.isArray(usedListingIds)) {
    throw new TypeError('Stored import has an unexpected shape');
  }
  const job = fromBinary(ImportJobSchema, jobBytes);
  if (job.id !== id || (job.warehouseId === undefined) !== (warehouseImport === undefined)) {
    throw new TypeError('Stored import id mismatch');
  }

  return {
    ...(warehouseImport === undefined ? {} : { warehouseImport: readWarehouseImportMetadata(warehouseImport) }),
    columns: columns.map((value: unknown): string => {
      if (typeof value !== 'string') {
        throw new TypeError('Stored import columns must contain strings');
      }
      return value;
    }),
    createdPriceListId,
    createdPriceListVersion,
    id,
    job,
    provenance: provenance.map((entry: unknown): ImportProvenanceValue => {
      if (typeof entry !== 'object' || entry === null || !('listingId' in entry) || typeof entry.listingId !== 'string'
        || !('productId' in entry) || typeof entry.productId !== 'string'
        || !('listingVersion' in entry) || typeof entry.listingVersion !== 'bigint'
        || !('productVersion' in entry) || typeof entry.productVersion !== 'bigint'
        || !('priceVersion' in entry) || typeof entry.priceVersion !== 'bigint') {
        throw new TypeError('Stored import provenance has an unexpected shape');
      }
      return {
        listingId: entry.listingId,
        listingVersion: entry.listingVersion,
        priceVersion: entry.priceVersion,
        productId: entry.productId,
        productVersion: entry.productVersion,
      };
    }),
    rows: rowBytes.map((bytes: unknown): ImportRow => {
      if (!(bytes instanceof Uint8Array)) {
        throw new TypeError('Stored import row must be binary');
      }
      return fromBinary(ImportRowSchema, bytes);
    }),
    usedListingIds: usedListingIds.map((value: unknown): string => {
      if (typeof value !== 'string') {
        throw new TypeError('Stored import usage must contain ids');
      }
      return value;
    }),
  };
};
