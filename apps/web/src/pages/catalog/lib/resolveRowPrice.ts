import type { ListingPrice } from '@skladburg/contracts/catalog/v1/catalog';

export interface RowPriceInputValue {
  canViewPrices: boolean;
  isFailed: boolean;
  listingId: string;
  prices: ReadonlyMap<string, ListingPrice> | undefined;
}

export type RowPriceValue
  = | { kind: 'hidden' }
    | { kind: 'pending' }
    | { kind: 'ready'; price: ListingPrice | undefined };

const HIDDEN_PRICE: RowPriceValue = { kind: 'hidden' };
const PENDING_PRICE: RowPriceValue = { kind: 'pending' };

export const resolveRowPrice = ({ canViewPrices, isFailed, listingId, prices }: RowPriceInputValue): RowPriceValue => {
  if (!canViewPrices || isFailed) {
    return HIDDEN_PRICE;
  }

  if (prices === undefined) {
    return PENDING_PRICE;
  }

  return { kind: 'ready', price: prices.get(listingId) };
};
