import type {
  Listing,
  Product,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { CalendarDate } from '@skladburg/contracts/common/v1/date';
import type { Money } from '@skladburg/contracts/common/v1/money';
import type {
  CounterDealLine,
  Deal,
  DealLine,
  DraftDealLine,
} from '@skladburg/contracts/deal/v1/deal';
import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { DealLineSchema } from '@skladburg/contracts/deal/v1/deal';

import type { IStateReader } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  compareCalendarDates,
  toCalendarDate,
} from '../../calendar/index';
import { RU_BUSINESS_CALENDAR } from '../../calendar/ruBusinessCalendar';
import { isShowcaseListingVisible } from '../../visibility/index';
import {
  checkOrderQuantity,
  computeGoodsTotal,
  findPriceList,
  MAX_CATALOG_AMOUNT_MINOR,
  projectCityAvailability,
  quoteListing,
  readSalesTerms,
  resolveTier,
} from '../catalog/index';
import {
  createRouteGraph,
  findRoutesFrom,
} from '../network/index';
import { snapshotProduct } from './dealProducts';
import {
  checkDealInteger,
  failDealValidation,
  rub,
} from './dealRules';

interface DealCatalogContextValue {
  customerOrganizationId: string;
  shipFromCityId: string;
  shipToWarehouseId: string;
  supplierOrganizationId: string;
}

interface DealCatalogPairValue {
  listing: Listing;
  product: Product;
}

const readDestination = (runtime: IModuleRuntime, reader: IStateReader, context: DealCatalogContextValue): Warehouse => {
  const warehouse = reader.get('warehouses', context.shipToWarehouseId);
  if (warehouse?.tenantId !== context.customerOrganizationId) {
    throw runtime.errors.notFound(EntityKind.WAREHOUSE);
  }
  return warehouse;
};

export const checkDealDate = (
  runtime: IModuleRuntime,
  reader: IStateReader,
  context: DealCatalogContextValue,
  desiredDate: CalendarDate | undefined,
): void => {
  const warehouse = readDestination(runtime, reader, context);
  if (desiredDate === undefined || compareCalendarDates(desiredDate, toCalendarDate(runtime.getWorldTimeMs(), warehouse.timeZone)) < 0
    || !RU_BUSINESS_CALENDAR.getCoveredYears().includes(desiredDate.year)) {
    failDealValidation(runtime.errors, 'desired_date', 'deal.date.invalid');
  }
};

const readDealPair = (
  runtime: IModuleRuntime,
  reader: IStateReader,
  context: DealCatalogContextValue,
  listingId: string,
): DealCatalogPairValue => {
  const listing = reader.get('listings', listingId);
  const product = listing === undefined ? undefined : reader.get('products', listing.productId);
  const listingPrice = reader.get('listingPrices', listingId);
  const supplier = reader.get('organizations', context.supplierOrganizationId);
  const customer = reader.get('organizations', context.customerOrganizationId);
  const destination = readDestination(runtime, reader, context);
  if (listing === undefined || product === undefined || listingPrice === undefined || supplier === undefined || customer === undefined
    || listing.tenantId !== supplier.id || product.tenantId !== supplier.id
    || !isShowcaseListingVisible({
      listing,
      listingPrice,
      priceList: findPriceList(reader, supplier.id),
      supplier,
      today: toCalendarDate(runtime.getWorldTimeMs(), destination.timeZone),
      viewer: customer,
    })) {
    throw runtime.errors.notFound(EntityKind.LISTING);
  }
  return { listing, product };
};

const checkQuantity = (runtime: IModuleRuntime, listing: Listing, quantity: bigint, index: number): void => {
  const violations = checkOrderQuantity({ minOrderQuantity: listing.minOrderQuantity, orderStep: listing.orderStep, quantity })
    .map(violation => ({ ...violation, fieldPath: `lines[${String(index)}].quantity` }));
  if (violations.length > 0) {
    throw runtime.errors.validationFailed(violations);
  }
};

const checkAvailability = (
  runtime: IModuleRuntime,
  reader: IStateReader,
  context: DealCatalogContextValue,
  listing: Listing,
  quantity: bigint,
  warehouseId: string | undefined,
  index: number,
): void => {
  const available = listing.availability.filter((entry) => {
    const warehouse = reader.get('warehouses', entry.warehouseId);
    return warehouse?.tenantId === context.supplierOrganizationId && warehouse.cityId === context.shipFromCityId
      && (warehouseId === undefined || warehouse.id === warehouseId);
  });
  const hasOnOrder = available.some(entry => entry.status === AvailabilityStatus.ON_ORDER);
  const total = available.reduce((sum, entry) => sum + entry.quantity, 0n);
  if (available.length === 0 || (!hasOnOrder && quantity > total)) {
    failDealValidation(runtime.errors, `lines[${String(index)}].quantity`, 'deal.quantity.unavailable');
  }
};

export const buildDraftLines = (
  runtime: IModuleRuntime,
  reader: IStateReader,
  context: DealCatalogContextValue,
  requested: readonly DraftDealLine[],
  previous: readonly DealLine[],
): DealLine[] => {
  const seen = new Set<string>();
  return requested.map((request, index) => {
    if (seen.has(request.listingId)) {
      failDealValidation(runtime.errors, 'lines', 'deal.lines.mismatch');
    }
    seen.add(request.listingId);
    const { listing, product } = readDealPair(runtime, reader, context, request.listingId);
    checkQuantity(runtime, listing, request.quantity, index);
    checkAvailability(runtime, reader, context, listing, request.quantity, undefined, index);
    const price = resolveTier(reader.get('listingPrices', listing.id)?.tiers ?? [], request.quantity)?.price;
    const coefficient = listing.priceUnit?.baseQuantity;
    if (price === undefined || coefficient === undefined || coefficient <= 0n) {
      throw runtime.errors.notFound(EntityKind.LISTING);
    }
    const amount = checkDealInteger(runtime.errors, computeGoodsTotal(request.quantity, price.amountMinor, coefficient), 'lines');
    return create(DealLineSchema, {
      amount: rub(amount),
      id: previous.find(line => line.listingId === listing.id)?.id ?? runtime.random.uuid(),
      listingId: listing.id,
      price,
      priceUnitCoefficient: coefficient,
      productSnapshot: snapshotProduct(product),
      quantity: request.quantity,
      vatRate: product.vatRate,
    });
  });
};

export const checkCurrentDealLines = (
  runtime: IModuleRuntime,
  reader: IStateReader,
  deal: Deal,
  lines: readonly DealLine[],
  warehouseId: string | undefined,
): void => {
  if (warehouseId !== undefined) {
    const warehouse = reader.get('warehouses', warehouseId);
    if (warehouse?.tenantId !== deal.supplierOrganizationId || warehouse.cityId !== deal.shipFromCityId) {
      failDealValidation(runtime.errors, 'ship_from_warehouse_id', 'deal.warehouse.unavailable');
    }
  }
  lines.forEach((line, index) => {
    const { listing, product } = readDealPair(runtime, reader, deal, line.listingId);
    checkQuantity(runtime, listing, line.quantity, index);
    checkAvailability(runtime, reader, deal, listing, line.quantity, warehouseId, index);
    if (line.productSnapshot?.baseUnit !== product.baseUnit || line.priceUnitCoefficient !== listing.priceUnit?.baseQuantity) {
      failDealValidation(runtime.errors, 'lines', 'deal.product.unit_mismatch');
    }
    const tier = resolveTier(reader.get('listingPrices', listing.id)?.tiers ?? [], line.quantity)?.price;
    if (product.isDiscountForbidden && tier !== undefined && (line.price?.amountMinor ?? 0n) < tier.amountMinor) {
      failDealValidation(runtime.errors, `lines[${String(index)}].price.amount_minor`, 'deal.price.discount_forbidden');
    }
    if (product.minPrice !== undefined && (line.price?.amountMinor ?? 0n) < product.minPrice.amountMinor) {
      failDealValidation(runtime.errors, `lines[${String(index)}].price.amount_minor`, 'deal.price.below_minimum');
    }
  });
};

export const buildCounterLines = (
  runtime: IModuleRuntime,
  deal: Deal,
  requested: readonly CounterDealLine[],
): DealLine[] => {
  if (requested.length !== deal.lines.length || new Set(requested.map(line => line.lineId)).size !== requested.length) {
    failDealValidation(runtime.errors, 'lines', 'deal.lines.mismatch');
  }
  return requested.map((request, index) => {
    const original = deal.lines.find(line => line.id === request.lineId);
    if (original === undefined || request.price === undefined) {
      return failDealValidation(runtime.errors, 'lines', 'deal.lines.mismatch');
    }
    if (request.price.currencyCode !== 'RUB') {
      failDealValidation(runtime.errors, `lines[${String(index)}].price.currency_code`, 'money.currency_unsupported');
    }
    if (request.price.amountMinor > MAX_CATALOG_AMOUNT_MINOR) {
      failDealValidation(runtime.errors, `lines[${String(index)}].price.amount_minor`, 'catalog.amount_above_limit');
    }
    const line = clone(DealLineSchema, original);
    line.quantity = request.quantity;
    line.price = request.price;
    line.amount = rub(checkDealInteger(runtime.errors,
      computeGoodsTotal(request.quantity, request.price.amountMinor, original.priceUnitCoefficient), 'lines'));
    return line;
  });
};

export const quoteDealDelivery = (
  runtime: IModuleRuntime,
  reader: IStateReader,
  context: DealCatalogContextValue,
  lines: readonly DealLine[],
): Money | undefined => {
  const destination = readDestination(runtime, reader, context);
  const line = lines[0];
  const listing = line === undefined ? undefined : reader.get('listings', line.listingId);
  if (line === undefined || listing === undefined) {
    throw runtime.errors.internal();
  }
  const terms = readSalesTerms(reader, context.supplierOrganizationId);
  const quote = quoteListing({
    calendar: RU_BUSINESS_CALENDAR,
    cities: projectCityAvailability(listing.availability,
      new Map(reader.listBy('warehouses', 'tenantId', context.supplierOrganizationId).map(warehouse => [warehouse.id, warehouse]))),
    ownDelivery: terms.ownDelivery,
    preparationWorkingDays: terms.preparationWorkingDays,
    priceUnitBaseQuantity: line.priceUnitCoefficient,
    quantity: line.quantity,
    routes: findRoutesFrom(createRouteGraph(reader.list('routeLegs')), destination.mapNodeId),
    tiers: reader.get('listingPrices', line.listingId)?.tiers ?? [],
    timeZone: destination.timeZone,
    worldTimeMs: runtime.getWorldTimeMs(),
  }).find(candidate => candidate.shipFromCityId === context.shipFromCityId);
  if (quote === undefined) {
    return failDealValidation(runtime.errors, 'ship_from_city_id', 'deal.warehouse.unavailable');
  }
  return quote.isSupplierDelivery ? rub(checkDealInteger(runtime.errors, quote.deliveryPriceMinor, 'delivery_total')) : undefined;
};
