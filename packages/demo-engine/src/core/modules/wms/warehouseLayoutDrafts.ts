import type { WarehouseCellInput } from '@skladburg/contracts/wms/v1/topology';

import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import { layoutChannel } from '@skladburg/contracts/runtime';
import { WarehouseLayoutDraftsChangedSchema } from '@skladburg/contracts/wms/v1/layout_events';
import { AddWarehouseCellsRequestSchema } from '@skladburg/contracts/wms/v1/topology';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

export const areLayoutDraftBytesEqual = (current: Uint8Array, next: Uint8Array): boolean =>
  current.length === next.length && current.every((byte, index) => byte === next[index]);

export const encodeLayoutDraftCells = (cells: readonly WarehouseCellInput[]): Uint8Array => {
  const ordered = cells.toSorted((current, next) => current.cellCode < next.cellCode ? -1 : Number(current.cellCode !== next.cellCode));
  const request = create(AddWarehouseCellsRequestSchema, { cells: ordered });

  return toBinary(AddWarehouseCellsRequestSchema, request, { writeUnknownFields: false });
};

export const publishWarehouseLayoutDraftChange = (runtime: IModuleRuntime, transaction: IStateTransaction, warehouseId: string): void => {
  runtime.outbox.add(transaction, layoutChannel(warehouseId), {
    case: 'warehouseLayoutDraftsChanged',
    value: create(WarehouseLayoutDraftsChangedSchema, { warehouseId }),
  });
};
