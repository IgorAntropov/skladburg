import type {
  Listing,
  WarehouseAvailability,
} from '@skladburg/contracts/catalog/v1/catalog';
import type {
  CounterDealLine,
  Deal,
} from '@skladburg/contracts/deal/v1/deal';

import { create } from '@bufbuild/protobuf';
import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';
import { CounterDealLineSchema } from '@skladburg/contracts/deal/v1/deal';

import type { IStateReader } from '../../state/index';
import type { OutboundDemandLineValue } from '../wms/outboundReservation';

import { compareIds } from '../../state/index';
import {
  checkOrderQuantity,
  resolveTier,
} from '../catalog/index';

type SupplierOrderValue
  = | { kind: 'confirm'; warehouseId: string }
    | { kind: 'counter'; lines: CounterDealLine[]; warehouseId: string };

const getStock = (availability: readonly WarehouseAvailability[], warehouseId: string): bigint =>
  availability.find(entry => entry.warehouseId === warehouseId
    && (entry.status === AvailabilityStatus.IN_STOCK || entry.status === AvailabilityStatus.LOW))?.quantity ?? 0n;

const buildCounterLine = (
  reader: IStateReader,
  listing: Listing,
  lineId: string,
  requested: bigint,
  available: bigint,
): CounterDealLine | undefined => {
  const upperBound = available < requested ? available : requested;
  const { minOrderQuantity, orderStep } = listing;
  const quantity = orderStep > 0n ? upperBound - upperBound % orderStep : upperBound;
  const price = resolveTier(reader.get('listingPrices', listing.id)?.tiers ?? [], quantity)?.price;
  if (price === undefined || checkOrderQuantity({ minOrderQuantity, orderStep, quantity }).length > 0) {
    return undefined;
  }
  return create(CounterDealLineSchema, { lineId, price, quantity });
};

export const planSupplierOrder = (
  reader: IStateReader,
  deal: Deal,
  availabilityFor?: ((listing: Listing) => readonly WarehouseAvailability[]),
  canFulfill?: ((warehouseId: string, lines: readonly OutboundDemandLineValue[]) => boolean),
): SupplierOrderValue | undefined => {
  const listings = deal.lines.flatMap((line) => {
    const listing = reader.get('listings', line.listingId);
    if (listing?.tenantId !== deal.supplierOrganizationId) {
      return [];
    }
    return [{ availability: availabilityFor?.(listing) ?? listing.availability, line, listing }];
  });
  if (listings.length === 0 || listings.length !== deal.lines.length) {
    return undefined;
  }

  const warehouses = reader.listBy('warehouses', 'tenantId', deal.supplierOrganizationId)
    .filter(warehouse => warehouse.cityId === deal.shipFromCityId)
    .sort((current, prev) => compareIds(current.id, prev.id));

  let counter: SupplierOrderValue | undefined;
  for (const warehouse of warehouses) {
    const stocks = listings.map(entry => ({ ...entry, available: getStock(entry.availability, warehouse.id) }));
    if (stocks.every(({ available, line }) => available >= line.quantity) && canFulfill?.(warehouse.id, deal.lines) !== false) {
      return { kind: 'confirm', warehouseId: warehouse.id };
    }
    if (counter === undefined) {
      const counterLines = stocks.flatMap(({ available, line, listing }) => {
        const change = buildCounterLine(reader, listing, line.id, line.quantity, available);
        return change === undefined ? [] : [{ change, listingId: listing.id, quantity: change.quantity }];
      });
      if (counterLines.length === listings.length && canFulfill?.(warehouse.id, counterLines) !== false) {
        counter = { kind: 'counter', lines: counterLines.map(({ change }) => change), warehouseId: warehouse.id };
      }
    }
  }
  return counter;
};
