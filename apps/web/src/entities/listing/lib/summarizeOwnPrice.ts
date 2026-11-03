import type {
  ListingPrice,
  PriceTier,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { Money } from '@skladburg/contracts/common/v1/money';

export type OwnPriceSummaryValue
  = | { kind: 'from'; price: Money }
    | { kind: 'none' }
    | { kind: 'single'; price: Money };

const NO_PRICE: OwnPriceSummaryValue = { kind: 'none' };

const toPrice = (tier: PriceTier): Money[] => (tier.price === undefined ? [] : [tier.price]);

export const summarizeOwnPrice = (listingPrice: ListingPrice | undefined): OwnPriceSummaryValue => {
  const prices = listingPrice?.tiers.flatMap(toPrice) ?? [];
  const [first, ...rest] = prices;

  if (first === undefined) {
    return NO_PRICE;
  }

  let lowest = first;
  let highest = first;

  for (const price of rest) {
    if (price.amountMinor < lowest.amountMinor) {
      lowest = price;
    }

    if (price.amountMinor > highest.amountMinor) {
      highest = price;
    }
  }

  return lowest.amountMinor === highest.amountMinor
    ? { kind: 'single', price: lowest }
    : { kind: 'from', price: lowest };
};
