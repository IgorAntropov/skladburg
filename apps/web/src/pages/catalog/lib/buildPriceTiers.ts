import type { FormFieldIssueValue } from '@skladburg/contracts/forms';

import type {
  PriceFormOutputValue,
  TierRowOutputValue,
  TierRowValue,
} from './listingFormValues';

import { createEmptyTierRow } from './listingFormValues';

export interface PriceTierCommandValue {
  minQuantity: bigint;
  price: { amountMinor: bigint; currencyCode: string };
}

const REQUIRED_RULE_ID = 'required';
const GREATER_THAN_ZERO_RULE_ID = 'int64.gt';

const isRowEmpty = (row: TierRowOutputValue): boolean => row.minQuantity === undefined && row.price.amountMinor === undefined;

const countFilledRows = (rows: readonly TierRowOutputValue[]): number => {
  const lastFilledIndex = rows.findLastIndex(row => !isRowEmpty(row));

  return Math.max(1, lastFilledIndex + 1);
};

const collectRowIssues = (row: TierRowOutputValue, index: number): FormFieldIssueValue[] => {
  const issues: FormFieldIssueValue[] = [];

  if (row.minQuantity === undefined) {
    issues.push({ field: `tiers.${String(index)}.minQuantity`, ruleId: REQUIRED_RULE_ID });
  }
  else if (row.minQuantity <= 0n) {
    issues.push({ field: `tiers.${String(index)}.minQuantity`, ruleId: GREATER_THAN_ZERO_RULE_ID });
  }

  if (row.price.amountMinor === undefined) {
    issues.push({ field: `tiers.${String(index)}.price.amountMinor`, ruleId: REQUIRED_RULE_ID });
  }

  return issues;
};

export const collectTierIssues = (values: PriceFormOutputValue, visibleCount: number): readonly FormFieldIssueValue[] => {
  const rows = values.tiers.slice(0, visibleCount);

  return rows.slice(0, countFilledRows(rows)).flatMap(collectRowIssues);
};

export const buildTiers = (values: PriceFormOutputValue, visibleCount: number): PriceTierCommandValue[] => {
  const rows = values.tiers.slice(0, visibleCount);

  return rows.slice(0, countFilledRows(rows)).flatMap((row) => {
    const { minQuantity } = row;
    const { amountMinor, currencyCode } = row.price;

    return minQuantity === undefined || amountMinor === undefined
      ? []
      : [{ minQuantity, price: { amountMinor, currencyCode } }];
  });
};

export const removeTierRow = (rows: readonly TierRowValue[], removedIndex: number): TierRowValue[] => [
  ...rows.slice(0, removedIndex),
  ...rows.slice(removedIndex + 1),
  createEmptyTierRow(),
];
