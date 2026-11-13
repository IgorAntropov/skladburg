import type { StockBalance } from '@skladburg/contracts/wms/v1/stock';

import type { WarehouseCargoValue } from './warehouseSceneCargo';

export interface WarehouseSceneInteractionValue {
  balances: readonly StockBalance[] | undefined;
  cargo: undefined | WarehouseCargoValue;
  focusRequest: number;
  onCellSelect: (id: string) => void;
  scannedCell: undefined | WarehouseSceneScanValue;
  selectedCellId: string | undefined;
}

export interface WarehouseSceneScanValue {
  cellId: string;
  focusId: string | undefined;
}
