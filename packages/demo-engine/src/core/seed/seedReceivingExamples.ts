import { create } from '@bufbuild/protobuf';
import {
  ListingPriceSchema,
  ListingSchema,
  MarkingMode,
  ProductSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { HandlingUnitKind } from '@skladburg/contracts/wms/v1/stock';

import type { EngineSnapshotValue } from '../ports/index';
import type { HistoryRouteValue } from './seedDealHistory';

import { encodeWarehouseTopology } from '../modules/wms/warehouseTopologyCodec';
import { TABLE_DEFINITIONS } from '../state/index';
import {
  SeedCityId,
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from './seedIds';
import { addSeedReceivingDock } from './seedReceivingDocks';
import { createSeedWarehouseTopology } from './seedWarehouseTopologies';
import { SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID } from './seedWarehouseWorkspaceConfig';

interface ReceivingExamplesValue {
  routes: readonly HistoryRouteValue[];
  snapshot: EngineSnapshotValue;
}

const CUSTOMER = {
  organizationId: SeedOrganizationId.CUSTOMER_1,
  userId: SeedUserId.ADMIN_1,
  warehouseId: SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID,
};
const COTTAGE_LISTING_ID = 'd1020020-0000-4000-8000-000000000000';
const YOGURT_LISTING_ID = 'd1020013-0000-4000-8000-000000000000';
const MARKED_LISTING_ID = 'd4010001-0000-4000-8000-000000000000';
const MARKED_PRODUCT_ID = 'd4010002-0000-4000-8000-000000000000';
const MARKED_GTIN = '2000002999911';
const MARKED_QUANTITY = 3n;
const COTTAGE_QUANTITY = 100_000n;

const RECEIVING_ROUTES: readonly HistoryRouteValue[] = [
  {
    cityId: SeedCityId.VORONEZH,
    customer: CUSTOMER,
    orders: [{
      listingId: COTTAGE_LISTING_ID,
      manifest: {
        sourceDocumentNumber: 'DEMO-WMS-02',
        units: [
          {
            batches: [{ batchNumber: 'DEMO-COTTAGE-1', listingId: COTTAGE_LISTING_ID, quantityBase: 50_000n }],
            kind: HandlingUnitKind.PALLET,
            sscc: '000000000000000017',
          },
          {
            batches: [{ batchNumber: 'DEMO-COTTAGE-2', listingId: COTTAGE_LISTING_ID, quantityBase: 50_000n }],
            kind: HandlingUnitKind.PALLET,
            sscc: undefined,
          },
        ],
      },
      quantity: COTTAGE_QUANTITY,
      submittedAtMs: Date.UTC(2026, 9, 5, 8),
    }, {
      listingId: MARKED_LISTING_ID,
      manifest: {
        sourceDocumentNumber: 'DEMO-WMS-03',
        units: [{
          batches: [{
            batchNumber: 'DEMO-YOGURT',
            listingId: MARKED_LISTING_ID,
            markingCodes: ['DEMO101', 'DEMO102', 'DEMO103'].map(serial => `010${MARKED_GTIN}21${serial}\u001D10DEMO-YOGURT`),
            quantityBase: MARKED_QUANTITY,
          }],
          kind: HandlingUnitKind.BOX,
          sscc: '000000000000000024',
        }],
      },
      quantity: MARKED_QUANTITY,
      submittedAtMs: Date.UTC(2026, 9, 5, 8, 15),
    }, {
      listingId: COTTAGE_LISTING_ID,
      manifest: {
        sourceDocumentNumber: 'DEMO-WMS-04',
        units: [{
          batches: [{ batchNumber: 'DEMO-COTTAGE-3', listingId: COTTAGE_LISTING_ID, quantityBase: COTTAGE_QUANTITY }],
          kind: HandlingUnitKind.PALLET,
          sscc: '000000000000000031',
        }],
      },
      quantity: COTTAGE_QUANTITY,
      submittedAtMs: Date.UTC(2026, 9, 5, 8, 30),
    }],
    supplier: {
      organizationId: SeedOrganizationId.SUPPLIER_2,
      userId: SeedUserId.ADMIN_3,
      warehouseId: SeedWarehouseId.SUPPLIER_2_WAREHOUSE_1,
    },
  },
];

export const createSeedReceivingExamples = (snapshot: EngineSnapshotValue): ReceivingExamplesValue => {
  const { listingPrices, listings, products, warehouseTopologies } = snapshot.collections;
  const sourceListing = listings.get(YOGURT_LISTING_ID);
  const sourcePrice = listingPrices.get(YOGURT_LISTING_ID);
  if (sourceListing === undefined || sourcePrice === undefined) {
    throw new Error('Missing listing data for the demo receipt');
  }

  const listing = TABLE_DEFINITIONS.listings.decode(sourceListing);
  const price = TABLE_DEFINITIONS.listingPrices.decode(sourcePrice);
  const [tier] = price.tiers;
  const sourceProduct = products.get(listing.productId);
  if (sourceProduct === undefined || tier === undefined) {
    throw new Error('Missing product data for the demo receipt');
  }

  const product = create(ProductSchema, {
    ...TABLE_DEFINITIONS.products.decode(sourceProduct),
    gtin: MARKED_GTIN,
    id: MARKED_PRODUCT_ID,
    markingMode: MarkingMode.UNIT,
    name: 'Йогурт натуральный, пробная партия',
    packagings: [],
    sku: 'S2-DEMO',
  });
  const markedListing = create(ListingSchema, {
    ...listing,
    id: MARKED_LISTING_ID,
    minOrderQuantity: MARKED_QUANTITY,
    orderStep: MARKED_QUANTITY,
    productId: product.id,
  });
  const markedPrice = create(ListingPriceSchema, {
    ...price,
    listingId: markedListing.id,
    tiers: [{ ...tier, minQuantity: MARKED_QUANTITY }],
  });
  const kazansTopology = createSeedWarehouseTopology({
    prefix: '8f000004',
    tenantId: CUSTOMER.organizationId,
    warehouseId: CUSTOMER.warehouseId,
  });
  addSeedReceivingDock(kazansTopology);
  const topology = encodeWarehouseTopology(kazansTopology);

  return {
    routes: RECEIVING_ROUTES,
    snapshot: {
      ...snapshot,
      collections: {
        ...snapshot.collections,
        listingPrices: new Map([...listingPrices, [markedListing.id, TABLE_DEFINITIONS.listingPrices.encode(markedPrice)]]),
        listings: new Map([...listings, [markedListing.id, TABLE_DEFINITIONS.listings.encode(markedListing)]]),
        products: new Map([...products, [product.id, TABLE_DEFINITIONS.products.encode(product)]]),
        warehouseTopologies: new Map([...warehouseTopologies, [topology.id, TABLE_DEFINITIONS.warehouseTopologies.encode(topology)]]),
      },
    },
  };
};
