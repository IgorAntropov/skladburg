import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { warehouseChannel } from '@skladburg/contracts/runtime';
import { WarehouseEquipmentChangedSchema } from '@skladburg/contracts/wms/v1/warehouse_equipment_events';
import {
  type WarehouseEquipmentRecord,
  WarehouseEquipmentRecordSchema,
} from '@skladburg/contracts/wms/v1/warehouse_equipment_records';

import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { WarehouseStockRecordValue } from '../../state/records';
import type { IEventOutbox } from '../moduleRuntime';

export const encodeWarehouseEquipmentRecord = (record: WarehouseEquipmentRecord): WarehouseStockRecordValue => ({
  bytes: toBinary(WarehouseEquipmentRecordSchema, record),
  id: record.warehouseId,
  lookupKey: record.tenantId,
  scopeId: record.warehouseId,
});

export const decodeWarehouseEquipmentRecord = (stored: WarehouseStockRecordValue): WarehouseEquipmentRecord => {
  const record = fromBinary(WarehouseEquipmentRecordSchema, stored.bytes);
  if (stored.scopeId !== stored.id || record.warehouseId !== stored.id || record.tenantId !== stored.lookupKey) {
    throw new TypeError('Warehouse equipment does not match its storage scope');
  }
  return record;
};

export const readWarehouseEquipmentRecord = (read: IStateReader, warehouseId: string): undefined | WarehouseEquipmentRecord => {
  const stored = read.get('warehouseEquipment', warehouseId);
  return stored === undefined ? undefined : decodeWarehouseEquipmentRecord(stored);
};

export const saveWarehouseEquipmentRecord = (transaction: IStateTransaction, record: WarehouseEquipmentRecord): void => {
  transaction.put('warehouseEquipment', encodeWarehouseEquipmentRecord(record));
};

export const publishWarehouseEquipmentChanged = (transaction: IStateTransaction, outbox: IEventOutbox, warehouseId: string): void => {
  outbox.add(transaction, warehouseChannel(warehouseId), {
    case: 'warehouseEquipmentChanged',
    value: create(WarehouseEquipmentChangedSchema, { warehouseId }),
  });
};
