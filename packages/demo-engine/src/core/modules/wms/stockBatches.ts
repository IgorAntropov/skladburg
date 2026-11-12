import type { Product } from '@skladburg/contracts/catalog/v1/catalog';
import type { CalendarDate } from '@skladburg/contracts/common/v1/date';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  type Batch,
  BatchSchema,
} from '@skladburg/contracts/wms/v1/stock';

import type { IDomainErrors } from '../../errors/index';
import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

export const buildStockBatchKey = (tenantId: string, productId: string, number: string): string =>
  JSON.stringify([tenantId, productId, number]);

export const readStockBatch = (
  reader: IStateReader,
  errors: IDomainErrors,
  lookupKey: string,
  product: Pick<Product, 'id' | 'tenantId'>,
  number: string,
): Batch | undefined => {
  const [record, duplicate] = reader.listBy('stockBatches', 'lookupKey', lookupKey);
  if (duplicate !== undefined) {
    throw errors.internal();
  }
  if (record === undefined) {
    return undefined;
  }

  const batch = fromBinary(BatchSchema, record.bytes);
  if (batch.id !== record.id || record.scopeId !== product.id || batch.tenantId !== product.tenantId
    || batch.productId !== product.id || batch.number !== number) {
    throw errors.internal();
  }
  return batch;
};

export const writeStockBatch = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  details: Pick<Batch, 'baseUnit' | 'expiresOn' | 'number' | 'productId' | 'tenantId'>,
): Batch => {
  const id = runtime.random.uuid();
  if (transaction.get('stockBatches', id) !== undefined) {
    throw runtime.errors.internal();
  }

  const batch = create(BatchSchema, { ...details, id });
  transaction.put('stockBatches', {
    bytes: toBinary(BatchSchema, batch),
    id,
    lookupKey: buildStockBatchKey(batch.tenantId, batch.productId, batch.number),
    scopeId: batch.productId,
  });
  return batch;
};

export const hasSameStockExpiry = (current: CalendarDate | undefined, prev: CalendarDate | undefined): boolean =>
  current?.year === prev?.year && current?.month === prev?.month && current?.day === prev?.day;
