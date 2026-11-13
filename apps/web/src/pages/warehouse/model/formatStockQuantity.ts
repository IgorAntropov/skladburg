import type { StockLine } from '@skladburg/contracts/wms/v1/stock';

import { BaseUnit } from '@skladburg/contracts/catalog/v1/catalog';

import type { WarehouseWorkTranslate } from '../i18n/workspaceSection';

const BASE_UNIT_TEXT = {
  [BaseUnit.GRAM]: 'warehouseWork.unitGram',
  [BaseUnit.MILLILITER]: 'warehouseWork.unitMilliliter',
  [BaseUnit.PIECE]: 'warehouseWork.unitPiece',
  [BaseUnit.UNSPECIFIED]: 'warehouseWork.unitUnknown',
} as const;

export const formatStockQuantity = (line: StockLine, format: Intl.NumberFormat, t: WarehouseWorkTranslate): string =>
  t(BASE_UNIT_TEXT[line.batch?.baseUnit ?? BaseUnit.UNSPECIFIED], { quantity: format.format(line.quantityBase) });
