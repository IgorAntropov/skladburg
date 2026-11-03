import type {
  Listing,
  ListingPrice,
} from '@skladburg/contracts/catalog/v1/catalog';

import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';

import { RUB_CURRENCY_CODE } from '@/shared/lib/money';

export const TIER_CAPACITY = 10;

export const NOT_SHIPPED_STATUS_VALUE = String(AvailabilityStatus.UNSPECIFIED);

export interface ListingFormOutputValue {
  availability: StockRowOutputValue[];
  minOrderQuantity: bigint;
  orderStep: bigint;
  priceUnit: { baseQuantity: bigint; name: string };
}

export interface ListingFormValues {
  availability: StockRowValue[];
  minOrderQuantity: string;
  orderStep: string;
  priceUnit: { baseQuantity: string; name: string };
}

export interface PriceFormOutputValue {
  tiers: TierRowOutputValue[];
}

export interface PriceFormValues {
  tiers: TierRowValue[];
}

export interface StockRowOutputValue {
  quantity?: bigint | undefined;
  status?: AvailabilityStatus | undefined;
  warehouseId: string;
}

export interface StockRowValue {
  quantity: string;
  status: string;
  warehouseId: string;
}

export interface TierRowOutputValue {
  minQuantity?: bigint | undefined;
  price: { amountMinor?: bigint | undefined; currencyCode: string };
}

export interface TierRowValue {
  minQuantity: string;
  price: { amountMinor: string; currencyCode: string };
}

export const createEmptyTierRow = (): TierRowValue => ({
  minQuantity: '',
  price: { amountMinor: '', currencyCode: RUB_CURRENCY_CODE },
});

const toStockRow = (listing: Listing, warehouseId: string): StockRowValue => {
  const entry = listing.availability.find(candidate => candidate.warehouseId === warehouseId);

  if (entry === undefined || entry.status === AvailabilityStatus.UNSPECIFIED) {
    return { quantity: '', status: NOT_SHIPPED_STATUS_VALUE, warehouseId };
  }

  return {
    quantity: entry.quantity > 0n ? entry.quantity.toString() : '',
    status: String(entry.status),
    warehouseId,
  };
};

export const toListingFormValues = (listing: Listing, warehouseIds: readonly string[]): ListingFormValues => ({
  availability: warehouseIds.map(warehouseId => toStockRow(listing, warehouseId)),
  minOrderQuantity: listing.minOrderQuantity.toString(),
  orderStep: listing.orderStep.toString(),
  priceUnit: {
    baseQuantity: (listing.priceUnit?.baseQuantity ?? 0n).toString(),
    name: listing.priceUnit?.name ?? '',
  },
});

export const toPriceFormValues = (price: ListingPrice | undefined): PriceFormValues => {
  const tiers = price?.tiers ?? [];

  return {
    tiers: Array.from({ length: TIER_CAPACITY }, (_item, index): TierRowValue => {
      const tier = tiers[index];

      return tier === undefined
        ? createEmptyTierRow()
        : {
            minQuantity: tier.minQuantity.toString(),
            price: {
              amountMinor: (tier.price?.amountMinor ?? 0n).toString(),
              currencyCode: tier.price?.currencyCode ?? RUB_CURRENCY_CODE,
            },
          };
    }),
  };
};

export const getInitialTierCount = (price: ListingPrice | undefined): number => Math.max(1, price?.tiers.length ?? 0);
