import { BaseUnit } from '@skladburg/contracts/catalog/v1/catalog';

export type BaseUnitLabelKeyValue = 'listing.baseUnit.gram' | 'listing.baseUnit.milliliter' | 'listing.baseUnit.piece';

const BASE_UNIT_LABEL_KEYS: Readonly<Partial<Record<BaseUnit, BaseUnitLabelKeyValue>>> = {
  [BaseUnit.GRAM]: 'listing.baseUnit.gram',
  [BaseUnit.MILLILITER]: 'listing.baseUnit.milliliter',
  [BaseUnit.PIECE]: 'listing.baseUnit.piece',
};

export const getBaseUnitLabelKey = (baseUnit: BaseUnit): BaseUnitLabelKeyValue | undefined => BASE_UNIT_LABEL_KEYS[baseUnit];
