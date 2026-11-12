import type {
  Listing,
  ListingPrice,
  Product,
  SalesTerms,
  WarehouseAvailability,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { Money } from '@skladburg/contracts/common/v1/money';
import type {
  Organization,
  Warehouse,
} from '@skladburg/contracts/organization/v1/organization';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import {
  PriceTierSchema,
  PriceUnitSchema,
  TemperatureRangeSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  type CityAvailability,
  CityAvailabilitySchema,
  DeliveryMethod,
  type DeliveryQuote,
  DeliveryQuoteSchema,
  type ShowcaseListing,
  ShowcaseListingSchema,
  ShowcasePackagingSchema,
  ShowcaseSupplierSchema,
} from '@skladburg/contracts/catalog/v1/showcase';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type {
  CityAvailabilityValue,
  QuoteValue,
} from '../quote/index';
import type { ShowcaseDestinationValue } from './showcaseDestination';

import { RU_BUSINESS_CALENDAR } from '../../../calendar/ruBusinessCalendar';
import { cloneOrganizationLogo } from '../../../visibility/index';
import { SUPPORTED_CURRENCY_CODE } from '../catalogRules';
import {
  projectCityAvailability,
  quoteListing,
} from '../quote/index';

export interface ShowcaseProjectionInputValue {
  availability?: readonly WarehouseAvailability[] | undefined;
  destination: ShowcaseDestinationValue;
  listing: Listing;
  listingPrice: ListingPrice;
  product: Product;
  quantity: bigint;
  supplier: Organization;
  terms: SalesTerms;
  warehouses: ReadonlyMap<string, Warehouse>;
  worldTimeMs: number;
}

const buildRub = (amountMinor: bigint): Money =>
  create(MoneySchema, { amountMinor, currencyCode: SUPPORTED_CURRENCY_CODE });

const projectQuote = (quote: QuoteValue): DeliveryQuote => create(DeliveryQuoteSchema, {
  deliveryPrice: buildRub(quote.deliveryPriceMinor),
  distanceKm: quote.distanceKm,
  etaDate: quote.etaDate === undefined ? undefined : create(CalendarDateSchema, quote.etaDate),
  goodsTotal: buildRub(quote.goodsTotalMinor),
  method: quote.isSupplierDelivery ? DeliveryMethod.SUPPLIER : DeliveryMethod.CUSTOMER,
  quantity: quote.quantity,
  shipFromCityId: quote.shipFromCityId,
  total: buildRub(quote.totalMinor),
  unitPrice: buildRub(quote.unitPriceMinor),
});

const projectCity = (city: CityAvailabilityValue): CityAvailability => create(CityAvailabilitySchema, {
  cityId: city.cityId,
  quantity: city.quantity,
  status: city.status,
});

const buildQuotes = (
  input: ShowcaseProjectionInputValue,
  cities: readonly CityAvailabilityValue[],
): DeliveryQuote[] => {
  const { destination, listing, listingPrice, quantity, terms } = input;
  const priceUnitBaseQuantity = listing.priceUnit?.baseQuantity;

  if (destination.routes === undefined || priceUnitBaseQuantity === undefined) {
    return [];
  }

  return quoteListing({
    calendar: RU_BUSINESS_CALENDAR,
    cities,
    ownDelivery: terms.ownDelivery,
    preparationWorkingDays: terms.preparationWorkingDays,
    priceUnitBaseQuantity,
    quantity,
    routes: destination.routes,
    tiers: listingPrice.tiers,
    timeZone: destination.timeZone,
    worldTimeMs: input.worldTimeMs,
  }).map(projectQuote);
};

export const projectShowcaseListing = (input: ShowcaseProjectionInputValue): ShowcaseListing => {
  const { listing, listingPrice, product, supplier } = input;
  const cities = projectCityAvailability(input.availability ?? listing.availability, input.warehouses);
  const supplierProfile = supplier.profiles.find(profile => profile.kind === ProfileKind.SUPPLIER);

  return create(ShowcaseListingSchema, {
    baseUnit: product.baseUnit,
    cityAvailability: cities.map(projectCity),
    gtin: product.gtin,
    id: listing.id,
    minOrderQuantity: listing.minOrderQuantity,
    orderStep: listing.orderStep,
    packagings: product.packagings.map(packaging => create(ShowcasePackagingSchema, {
      baseQuantity: packaging.baseQuantity,
      name: packaging.name,
    })),
    priceUnit: listing.priceUnit === undefined ? undefined : clone(PriceUnitSchema, listing.priceUnit),
    productName: product.name,
    quotes: buildQuotes(input, cities),
    shelfLifeDays: product.shelfLifeDays,
    sphereIds: [...listing.sphereIds],
    storageTemperature: product.storageTemperature === undefined
      ? undefined
      : clone(TemperatureRangeSchema, product.storageTemperature),
    supplier: create(ShowcaseSupplierSchema, {
      logo: cloneOrganizationLogo(supplier),
      name: supplier.name,
      organizationId: supplier.id,
      verificationLevel: supplierProfile?.verificationLevel ?? 0,
    }),
    tiers: listingPrice.tiers.map(tier => clone(PriceTierSchema, tier)),
    vatRate: product.vatRate,
  });
};
