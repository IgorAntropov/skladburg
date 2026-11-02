import type { JsonValue } from '@bufbuild/protobuf';
import type {
  CallOptions,
  Client,
} from '@connectrpc/connect';
import type {
  Listing,
  Product,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { Organization } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import {
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import {
  OwnDeliveryTermsSchema,
  SavePriceListRequestSchema,
  SaveSalesTermsRequestSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { ShowcaseService } from '@skladburg/contracts/catalog/v1/showcase';
import {
  OrganizationProfileSchema,
  OrganizationSchema,
  type ProfileKind,
  WarehouseSchema,
} from '@skladburg/contracts/organization/v1/organization';

import type { CalendarDateValue } from '../../../../calendar/index';
import type { ModuleHarnessValue } from '../../../testing/moduleHarness';
import type {
  ListingOverridesValue,
  PriceOverridesValue,
  ProductOverridesValue,
} from '../../testing/catalogFixtures';

import {
  SeedCityId,
  SeedMapNodeId,
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../../../seed/index';
import {
  addTestMember,
  callAs,
} from '../../../testing/moduleHarness';
import {
  buildRub,
  createListing,
  createPrice,
  createProduct,
  nextUuid,
  publishListing,
  SUPPLIER_1_CALL,
} from '../../testing/catalogFixtures';
import { createCatalogShowcaseService } from '../index';

export const CUSTOMER_CALL: CallOptions = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
export const CARRIER_CALL: CallOptions = callAs(SeedUserId.ADMIN_4, SeedOrganizationId.CARRIER_1);
export const SUPPLIER_6_CALL: CallOptions = callAs(SeedUserId.ADMIN_10, SeedOrganizationId.SUPPLIER_6);
export const CUSTOMER_WAREHOUSE_ID = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1;
export const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

export interface CreatedShowcaseListingValue {
  listing: Listing;
  product: Product;
}

export interface ProfileLevelValue {
  kind: ProfileKind;
  verificationLevel: number;
}

export interface ShowcaseListingOptionsValue {
  call?: CallOptions;
  hasPrice?: boolean;
  isDraft?: boolean;
  listing?: ListingOverridesValue;
  price?: PriceOverridesValue;
  product?: ProductOverridesValue;
}

let skuCounter = 0;

const nextSku = (): string => {
  skuCounter += 1;

  return `SHW-${String(skuCounter)}`;
};

export const createShowcaseListing = async (
  harness: ModuleHarnessValue,
  options: ShowcaseListingOptionsValue = {},
): Promise<CreatedShowcaseListingValue> => {
  const call = options.call ?? SUPPLIER_1_CALL;
  const product = await createProduct(harness, { sku: nextSku(), ...options.product }, call);
  const listing = await createListing(harness, product, options.listing, call);

  if (options.hasPrice !== false) {
    await createPrice(harness, listing, options.price, call);
  }

  return { listing: options.isDraft === true ? listing : await publishListing(harness, listing, call), product };
};

export const setProfiles = async (
  harness: ModuleHarnessValue,
  organizationId: string,
  profiles: readonly ProfileLevelValue[],
): Promise<Organization> => {
  const organization = create(OrganizationSchema, harness.state.read.get('organizations', organizationId));

  organization.profiles = profiles.map(profile => create(OrganizationProfileSchema, profile));

  await harness.runtime.command((transaction) => {
    transaction.put('organizations', organization);
  });

  return organization;
};

export const createSupplierViewerCall = async (
  harness: ModuleHarnessValue,
  organizationId: string,
  profiles: readonly ProfileLevelValue[],
): Promise<CallOptions> => {
  await setProfiles(harness, organizationId, profiles);

  const userId = await addTestMember(harness, { organizationId, permissions: ['marketplace_view'], warehouseIds: [] });

  return callAs(userId, organizationId);
};

export const addSupplierWarehouse = async (
  harness: ModuleHarnessValue,
  organizationId: string,
  location: { cityId: string; mapNodeId: string },
): Promise<string> => {
  const id = nextUuid();

  await harness.runtime.command((transaction) => {
    transaction.put('warehouses', create(WarehouseSchema, {
      cityId: location.cityId,
      id,
      mapNodeId: location.mapNodeId,
      name: 'Склад 3',
      tenantId: organizationId,
      timeZone: 'Europe/Moscow',
    }));
  });

  return id;
};

export const VORONEZH_LOCATION = { cityId: SeedCityId.VORONEZH, mapNodeId: SeedMapNodeId.VORONEZH };
export const NOVOSIBIRSK_LOCATION = { cityId: SeedCityId.NOVOSIBIRSK, mapNodeId: SeedMapNodeId.NOVOSIBIRSK };

export interface OwnDeliveryOptionsValue {
  minimumChargeMinor: bigint;
  pricePerKmMinor: bigint;
}

export const saveSalesTerms = async (
  harness: ModuleHarnessValue,
  call: CallOptions,
  terms: { ownDelivery?: OwnDeliveryOptionsValue; preparationWorkingDays: number },
): Promise<void> => {
  const current = await harness.catalog.getSalesTerms({}, call);

  await harness.catalog.saveSalesTerms(create(SaveSalesTermsRequestSchema, {
    expectedVersion: current.terms?.version ?? 0n,
    idempotencyKey: nextUuid(),
    ownDelivery: terms.ownDelivery === undefined
      ? undefined
      : create(OwnDeliveryTermsSchema, {
          minimumCharge: buildRub(terms.ownDelivery.minimumChargeMinor),
          pricePerKm: buildRub(terms.ownDelivery.pricePerKmMinor),
        }),
    preparationWorkingDays: terms.preparationWorkingDays,
  }), call);
};

export const savePriceListEnd = async (
  harness: ModuleHarnessValue,
  call: CallOptions,
  validUntil: CalendarDateValue | undefined,
): Promise<void> => {
  const current = await harness.catalog.getPriceList({}, call);

  await harness.catalog.savePriceList(create(SavePriceListRequestSchema, {
    expectedVersion: current.priceList?.version ?? 0n,
    idempotencyKey: nextUuid(),
    validUntil,
  }), call);
};

export const createShowcaseClientAt = (harness: ModuleHarnessValue, worldTimeMs: number): Client<typeof ShowcaseService> =>
  createClient(ShowcaseService, createRouterTransport(({ service }) => {
    service(ShowcaseService, createCatalogShowcaseService({ ...harness.runtime, getWorldTimeMs: () => worldTimeMs }));
  }));

export const collectJsonKeys = (value: JsonValue): Set<string> => {
  const keys = new Set<string>();

  const visit = (node: JsonValue): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
    }
    else if (node !== null && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        keys.add(key);
        visit(child);
      }
    }
  };

  visit(value);

  return keys;
};
