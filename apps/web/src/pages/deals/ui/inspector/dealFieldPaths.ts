type DealLinePricePathValue = `lines.${number}.price.amountMinor`;
type DealLineQuantityPathValue = `lines.${number}.quantity`;

export const getDealLineQuantityPath = (index: number): DealLineQuantityPathValue =>
  `lines.${String(index)}.quantity` as DealLineQuantityPathValue;

export const getDealLinePricePath = (index: number): DealLinePricePathValue =>
  `lines.${String(index)}.price.amountMinor` as DealLinePricePathValue;
