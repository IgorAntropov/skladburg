import type {
  StockBalance,
  StockMovement,
} from '@skladburg/contracts/wms/v1/stock';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import { PickingTaskStatus } from '@skladburg/contracts/wms/v1/picking';
import { ReceivingTaskStatus } from '@skladburg/contracts/wms/v1/receiving';
import {
  StockMovementKind,
  StockStatus,
} from '@skladburg/contracts/wms/v1/stock';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

import { getWarehouseCells } from '../../model/warehouseCells';

export const readCells = (topology: null | undefined | WarehouseTopology): ReadonlyMap<string, string> =>
  new Map(getWarehouseCells(topology).map(({ code, id }) => [id, code]));

const STOCK_TEXT = {
  [StockStatus.AVAILABLE]: 'warehouseWork.state.available',
  [StockStatus.DEFECTIVE]: 'warehouseWork.state.defective',
  [StockStatus.QUARANTINE]: 'warehouseWork.state.quarantine',
  [StockStatus.RESERVED]: 'warehouseWork.state.reserved',
  [StockStatus.UNSPECIFIED]: undefined,
} as const;

const MOVEMENT_TEXT = {
  [StockMovementKind.OPENING_BALANCE]: 'warehouseWork.movement.opening',
  [StockMovementKind.RECEIPT]: 'warehouseWork.movement.receipt',
  [StockMovementKind.RECEIPT_CLASSIFICATION]: 'warehouseWork.movement.classification',
  [StockMovementKind.RELEASE_RESERVATION]: 'warehouseWork.movement.release',
  [StockMovementKind.RESERVE]: 'warehouseWork.movement.reserve',
  [StockMovementKind.SHIPMENT]: 'warehouseWork.movement.shipment',
  [StockMovementKind.TRANSFER]: 'warehouseWork.movement.transfer',
  [StockMovementKind.UNSPECIFIED]: undefined,
} as const;

export const PICKING_TEXT = {
  [PickingTaskStatus.CANCELLED]: 'warehouseWork.state.cancelled',
  [PickingTaskStatus.IN_PROGRESS]: 'warehouseWork.state.assigned',
  [PickingTaskStatus.OPEN]: 'warehouseWork.state.open',
  [PickingTaskStatus.PICKED]: 'warehouseWork.state.picked',
  [PickingTaskStatus.SHIPPED]: 'warehouseWork.state.shipped',
  [PickingTaskStatus.UNSPECIFIED]: 'warehouseWork.state.open',
} as const;

export const RECEIVING_TEXT = {
  [ReceivingTaskStatus.IN_PROGRESS]: 'warehouseWork.state.assigned',
  [ReceivingTaskStatus.OPEN]: 'warehouseWork.state.open',
  [ReceivingTaskStatus.READY_FOR_RECONCILIATION]: 'warehouseWork.state.finished',
  [ReceivingTaskStatus.RECONCILED]: 'warehouseWork.state.reconciled',
  [ReceivingTaskStatus.UNSPECIFIED]: 'warehouseWork.state.open',
} as const;

export const readStockLocation = (balance: StockBalance, cells: ReadonlyMap<string, string>, t: WarehouseWorkTranslate): string =>
  balance.receivingAreaId !== undefined ? t('warehouseWork.receivingArea') : cells.get(balance.cellId) ?? t('warehouseWork.noCell');

export const readStockStatus = (status: StockStatus, t: WarehouseWorkTranslate): string | undefined => {
  const key = STOCK_TEXT[status];
  return key === undefined ? undefined : t(key);
};

export const readMovementKind = (movement: StockMovement, t: WarehouseWorkTranslate): string | undefined => {
  const key = MOVEMENT_TEXT[movement.kind];
  return key === undefined ? undefined : t(key);
};
