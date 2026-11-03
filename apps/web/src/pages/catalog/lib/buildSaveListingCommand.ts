import type { PriceUnit } from '@skladburg/contracts/catalog/v1/catalog';

import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';

import type {
  ListingFormOutputValue,
  StockRowOutputValue,
} from './listingFormValues';

export interface SaveListingAvailabilityValue {
  quantity: bigint;
  status: AvailabilityStatus;
  warehouseId: string;
}

export interface SaveListingCommandContextValue {
  isUnitLocked: boolean;
  savedUnit: PriceUnit | undefined;
}

export interface SaveListingCommandValue {
  availability: SaveListingAvailabilityValue[];
  priceUnit: { baseQuantity: bigint; name: string };
}

const AVAILABILITY_PATH_PATTERN = /^availability\[(\d+)\](.*)$/u;

const isShipped = (row: StockRowOutputValue): boolean => row.status !== undefined && row.status !== AvailabilityStatus.UNSPECIFIED;

export const collectShippedRowIndexes = (rows: readonly StockRowOutputValue[]): readonly number[] => rows.flatMap(
  (row, index) => (isShipped(row) ? [index] : []),
);

export const remapAvailabilityPath = (fieldPath: string, values: { availability: readonly StockRowOutputValue[] }): string => {
  const match = AVAILABILITY_PATH_PATTERN.exec(fieldPath);

  if (match === null) {
    return fieldPath;
  }

  const rowIndex = collectShippedRowIndexes(values.availability)[Number(match[1])];

  return rowIndex === undefined ? fieldPath : `availability[${String(rowIndex)}]${match[2] ?? ''}`;
};

export const buildSaveListingCommand = (
  values: ListingFormOutputValue,
  context: SaveListingCommandContextValue,
): SaveListingCommandValue => {
  const { savedUnit } = context;
  const isSavedUnitKept = context.isUnitLocked && savedUnit !== undefined;

  return {
    availability: collectShippedRowIndexes(values.availability).flatMap((index) => {
      const row = values.availability[index];

      return row?.status === undefined
        ? []
        : [{ quantity: row.quantity ?? 0n, status: row.status, warehouseId: row.warehouseId }];
    }),
    priceUnit: isSavedUnitKept
      ? { baseQuantity: savedUnit.baseQuantity, name: savedUnit.name }
      : { baseQuantity: values.priceUnit.baseQuantity, name: values.priceUnit.name },
  };
};
