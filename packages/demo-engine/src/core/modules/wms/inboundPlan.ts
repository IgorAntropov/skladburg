import type { MessageInitShape } from '@bufbuild/protobuf';
import type { CalendarDate } from '@skladburg/contracts/common/v1/date';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { StockBalance } from '@skladburg/contracts/wms/v1/stock';

import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { hasGs1CheckDigit } from '@skladburg/contracts/forms';
import {
  type ExpectedReceivingBatchSchema,
  ReceivingTaskSchema,
} from '@skladburg/contracts/wms/v1/receiving';
import { HandlingUnitKind } from '@skladburg/contracts/wms/v1/stock';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { failDealValidation } from '../deals/dealRules';
import { saveInboundTask } from './inboundRecords';
import { normalizeStockReference } from './stockLocations';
import { readWarehouseTopology } from './warehouseTopologyCodec';

export interface ReceivingManifestValue {
  sourceDocumentNumber: string;
  units: readonly ManifestUnitValue[];
}

interface ManifestBatchValue {
  batchNumber: string;
  expiresOn?: CalendarDate | undefined;
  listingId: string;
  quantityBase: bigint;
}

interface ManifestUnitValue {
  batches: readonly ManifestBatchValue[];
  kind: HandlingUnitKind;
  sscc?: string | undefined;
}

const resolveOrderProducts = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  deal: Deal,
): Map<string, string> => {
  const links = transaction.listBy('productLinks', 'customerOrganizationId', deal.customerOrganizationId)
    .filter(link => link.supplierOrganizationId === deal.supplierOrganizationId);
  const customerProductsBySupplier = new Map(links.map(link => [link.supplierProductId, link.customerProductId]));

  return new Map(deal.lines.map((line) => {
    const listing = transaction.get('listings', line.listingId);
    const supplierProduct = listing?.tenantId === deal.supplierOrganizationId
      ? transaction.get('products', listing.productId)
      : undefined;
    const customerProduct = transaction.get('products', customerProductsBySupplier.get(supplierProduct?.id ?? '') ?? '');
    if (supplierProduct?.tenantId !== deal.supplierOrganizationId || customerProduct?.tenantId !== deal.customerOrganizationId) {
      throw runtime.errors.internal();
    }
    if (customerProduct.baseUnit !== line.productSnapshot?.baseUnit) {
      failDealValidation(runtime.errors, 'deal_id', 'deal.product.unit_mismatch');
    }

    return [line.listingId, customerProduct.id];
  }));
};

const manifestFromShipment = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  deal: Deal,
  units: readonly StockBalance[],
): ReceivingManifestValue => {
  const listingByProduct = new Map(deal.lines.map(({ listingId }) => [transaction.get('listings', listingId)?.productId, listingId]));
  return {
    sourceDocumentNumber: String(deal.number),
    units: units.map(({ handlingUnit, lines }) => {
      if (handlingUnit?.tenantId !== deal.supplierOrganizationId || handlingUnit.warehouseId !== deal.shipFromWarehouseId) {
        throw runtime.errors.internal();
      }
      return {
        batches: lines.map(({ batch, quantityBase }) => {
          const listingId = listingByProduct.get(batch?.productId);
          if (batch?.tenantId !== deal.supplierOrganizationId || listingId === undefined) {
            throw runtime.errors.internal();
          }

          return { batchNumber: batch.number, expiresOn: batch.expiresOn, listingId, quantityBase };
        }),
        kind: handlingUnit.kind,
        sscc: handlingUnit.sscc,
      };
    }),
  };
};

export const prepareInboundShipment = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  deal: Deal,
  shippedUnits: readonly StockBalance[] | undefined,
): void => {
  const warehouseId = deal.shipToWarehouseId;
  if (!runtime.wmsInboundWarehouseIds?.has(warehouseId)) {
    return;
  }
  const { errors } = runtime;
  const record = transaction.get('warehouseTopologies', warehouseId);
  const topology = record === undefined ? undefined : readWarehouseTopology(record);
  if (topology?.tenantId !== deal.customerOrganizationId || topology.warehouseId !== warehouseId || topology.receivingArea === undefined) {
    throw errors.notFound(EntityKind.WAREHOUSE);
  }
  if (transaction.get('warehouseInbound', deal.id) !== undefined) {
    throw errors.internal();
  }

  const manifest = shippedUnits === undefined
    ? runtime.wmsInboundManifests?.get(deal.id)
    : manifestFromShipment(transaction, runtime, deal, shippedUnits);
  if (manifest === undefined || manifest.units.length === 0) {
    throw errors.invalidTransition(EntityKind.DEAL, 'MISSING_RECEIVING_MANIFEST', 'SHIPPED');
  }

  const customerProductIds = resolveOrderProducts(transaction, runtime, deal);
  const byListing = new Map(deal.lines.map(line => [line.listingId, line]));
  const seenSsccs = new Set<string>();
  const expectedUnits = manifest.units.map(({ batches, kind, sscc }) => {
    if ((kind !== HandlingUnitKind.PALLET && kind !== HandlingUnitKind.BOX) || batches.length === 0
      || (sscc === undefined && batches.length !== 1)) {
      throw errors.internal();
    }
    if (sscc !== undefined) {
      if (sscc.length !== 18 || !hasGs1CheckDigit(sscc) || seenSsccs.has(sscc)) {
        throw errors.internal();
      }
      seenSsccs.add(sscc);
    }
    return {
      batches: batches.map((batch): MessageInitShape<typeof ExpectedReceivingBatchSchema> => {
        const line = byListing.get(batch.listingId);
        if (line === undefined || batch.quantityBase <= 0n) {
          throw errors.internal();
        }
        return {
          batchNumber: normalizeStockReference(batch.batchNumber, 'batch_number', errors),
          dealLineId: line.id,
          expiresOn: batch.expiresOn,
          quantityBase: batch.quantityBase,
        };
      }),
      id: runtime.random.uuid(),
      kind,
      sscc,
    };
  });
  const orderLines = deal.lines.map(({ id, listingId, productSnapshot, quantity }) => {
    const productId = customerProductIds.get(listingId);
    if (productId === undefined || productSnapshot === undefined) {
      throw errors.internal();
    }

    return {
      baseUnit: productSnapshot.baseUnit,
      dealLineId: id,
      gtin: productSnapshot.gtin,
      productId,
      productName: productSnapshot.name,
      quantityBase: quantity,
    };
  });
  const task = create(ReceivingTaskSchema, {
    dealId: deal.id,
    expectedUnits,
    id: deal.id,
    orderLines,
    receivingAreaId: topology.receivingArea.id,
    sourceDocumentNumber: normalizeStockReference(manifest.sourceDocumentNumber, 'source_document_number', errors),
    warehouseId,
  });
  saveInboundTask(transaction, runtime, task, deal.customerOrganizationId);
};
