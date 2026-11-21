import type {
  StoredObjectValue,
  StoredRecordValue,
} from '../ports/index';

export interface WarehouseSensorAlertRecordValue {
  alertBytes?: Uint8Array | undefined;
  id: string;
  lastSample: number;
  tenantId: string;
  warehouseId: string;
}

export const parseWarehouseSensorAlertRecord = (stored: StoredRecordValue): WarehouseSensorAlertRecordValue => {
  if (stored instanceof Uint8Array) {
    throw new TypeError('Stored warehouse sensor channel must be a plain object');
  }
  const { alertBytes, id, lastSample, tenantId, warehouseId } = stored;
  if (typeof id !== 'string' || typeof lastSample !== 'number' || !Number.isSafeInteger(lastSample) || lastSample < 0
    || typeof tenantId !== 'string' || typeof warehouseId !== 'string'
    || (alertBytes !== undefined && !(alertBytes instanceof Uint8Array))) {
    throw new TypeError('Stored warehouse sensor channel has an unexpected shape');
  }
  return { alertBytes: alertBytes?.slice(), id, lastSample, tenantId, warehouseId };
};

export const serializeWarehouseSensorAlertRecord = ({ alertBytes, ...record }: WarehouseSensorAlertRecordValue): StoredObjectValue =>
  alertBytes === undefined ? record : { ...record, alertBytes: alertBytes.slice() };
