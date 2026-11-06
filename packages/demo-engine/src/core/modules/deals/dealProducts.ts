import type { Product } from '@skladburg/contracts/catalog/v1/catalog';
import type {
  DealLine,
  DealProductSnapshot,
  SupplyContract,
} from '@skladburg/contracts/deal/v1/deal';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { ProductSchema } from '@skladburg/contracts/catalog/v1/catalog';
import {
  DealProductSnapshotSchema,
  SupplyContractSchema,
} from '@skladburg/contracts/deal/v1/deal';
import { parseSearchQuery } from '@skladburg/contracts/runtime';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { failDealValidation } from './dealRules';

export const snapshotProduct = (product: Product): DealProductSnapshot => create(DealProductSnapshotSchema, {
  baseUnit: product.baseUnit,
  gtin: product.gtin,
  markingMode: product.markingMode,
  name: product.name,
  packagings: product.packagings,
  shelfLifeDays: product.shelfLifeDays,
  storageTemperature: product.storageTemperature,
  vatRate: product.vatRate,
});

export const linkDealProducts = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  customerOrganizationId: string,
  supplierOrganizationId: string,
  lines: readonly DealLine[],
): void => {
  for (const line of lines) {
    const listing = transaction.get('listings', line.listingId);
    const product = listing === undefined ? undefined : transaction.get('products', listing.productId);
    if (product === undefined) {
      throw runtime.errors.internal();
    }
    const existingLink = transaction.listBy('productLinks', 'customerOrganizationId', customerOrganizationId)
      .find(link => link.supplierProductId === product.id && link.supplierOrganizationId === supplierOrganizationId);
    if (existingLink !== undefined) {
      const linkedProduct = transaction.get('products', existingLink.customerProductId);
      if (linkedProduct?.tenantId !== customerOrganizationId || linkedProduct.baseUnit !== product.baseUnit) {
        failDealValidation(runtime.errors, 'lines', 'deal.product.unit_mismatch');
      }
      continue;
    }
    const gtin = parseSearchQuery(product.gtin).gtin;
    let customerProduct = gtin === undefined
      ? undefined
      : transaction.listBy('products', 'tenantId', customerOrganizationId)
          .find(candidate => parseSearchQuery(candidate.gtin).gtin === gtin);
    const isCreatedFromDeal = customerProduct === undefined;
    if (customerProduct !== undefined && customerProduct.baseUnit !== product.baseUnit) {
      failDealValidation(runtime.errors, 'lines', 'deal.product.unit_mismatch');
    }
    if (customerProduct === undefined) {
      const id = runtime.random.uuid();
      const snapshot = snapshotProduct(product);
      customerProduct = create(ProductSchema, {
        baseUnit: snapshot.baseUnit,
        gtin: snapshot.gtin,
        id,
        isDiscountForbidden: false,
        markingMode: snapshot.markingMode,
        minPrice: undefined,
        name: snapshot.name,
        packagings: snapshot.packagings,
        shelfLifeDays: snapshot.shelfLifeDays,
        sku: id,
        storageTemperature: snapshot.storageTemperature,
        tenantId: customerOrganizationId,
        vatRate: snapshot.vatRate,
        version: 1n,
      });
      transaction.put('products', clone(ProductSchema, customerProduct));
    }
    transaction.put('productLinks', {
      customerOrganizationId,
      customerProductId: customerProduct.id,
      id: runtime.random.uuid(),
      isCreatedFromDeal,
      supplierOrganizationId,
      supplierProductId: product.id,
    });
  }
};

export const getOrCreateSupplyContract = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  supplierOrganizationId: string,
  customerOrganizationId: string,
): SupplyContract => {
  const existing = transaction.listBy('supplyContracts', 'customerOrganizationId', customerOrganizationId)
    .find(contract => contract.supplierOrganizationId === supplierOrganizationId);
  if (existing !== undefined) {
    return existing;
  }
  const contract = create(SupplyContractSchema, {
    acceptanceTerms: 'acceptance_by_customer',
    customerOrganizationId,
    id: runtime.random.uuid(),
    paymentTerms: 'safe_deal_prepayment',
    supplierOrganizationId,
    templateVersion: 1,
  });
  transaction.put('supplyContracts', contract);
  return contract;
};
