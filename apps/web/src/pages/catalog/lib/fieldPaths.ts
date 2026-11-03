export type StockQuantityPathValue = `availability.${number}.quantity`;

export type StockStatusPathValue = `availability.${number}.status`;

export type TierMinPathValue = `tiers.${number}.minQuantity`;

export type TierPricePathValue = `tiers.${number}.price.amountMinor`;

export const getStockStatusPath = (index: number): StockStatusPathValue => `availability.${String(index)}.status` as StockStatusPathValue;

export const getStockQuantityPath = (index: number): StockQuantityPathValue => (
  `availability.${String(index)}.quantity` as StockQuantityPathValue
);

export const getTierMinPath = (index: number): TierMinPathValue => `tiers.${String(index)}.minQuantity` as TierMinPathValue;

export const getTierPricePath = (index: number): TierPricePathValue => `tiers.${String(index)}.price.amountMinor` as TierPricePathValue;
