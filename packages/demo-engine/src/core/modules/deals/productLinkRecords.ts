import type {
  StoredObjectValue,
  StoredRecordValue,
} from '../../ports/index';

export interface ProductLinkRecordValue {
  customerOrganizationId: string;
  customerProductId: string;
  id: string;
  isCreatedFromDeal: boolean;
  supplierOrganizationId: string;
  supplierProductId: string;
}

export const serializeProductLink = (record: ProductLinkRecordValue): StoredObjectValue => ({ ...record });

export const parseProductLink = (stored: StoredRecordValue): ProductLinkRecordValue => {
  if (stored instanceof Uint8Array) {
    throw new TypeError('Stored product link must be a record');
  }
  const { customerOrganizationId, customerProductId, id, isCreatedFromDeal, supplierOrganizationId, supplierProductId } = stored;
  if (typeof customerOrganizationId !== 'string' || typeof customerProductId !== 'string' || typeof id !== 'string'
    || typeof isCreatedFromDeal !== 'boolean' || typeof supplierOrganizationId !== 'string' || typeof supplierProductId !== 'string') {
    throw new TypeError('Stored product link has an unexpected shape');
  }
  return { customerOrganizationId, customerProductId, id, isCreatedFromDeal, supplierOrganizationId, supplierProductId };
};
