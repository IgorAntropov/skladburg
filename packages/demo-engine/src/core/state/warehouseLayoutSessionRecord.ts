import type {
  StoredObjectValue,
  StoredRecordValue,
} from '../ports/index';

export interface WarehouseLayoutSessionRecordValue {
  expiresAtMs: number;
  id: string;
  layoutSessionId: string;
  ownerKey: string;
}

export const parseWarehouseLayoutSessionRecord = (stored: StoredRecordValue): WarehouseLayoutSessionRecordValue => {
  if (stored instanceof Uint8Array) {
    throw new TypeError('Stored warehouse layout session must be a plain object');
  }

  const { expiresAtMs, id, layoutSessionId, ownerKey } = stored;
  if (typeof expiresAtMs !== 'number' || !Number.isFinite(expiresAtMs)
    || typeof id !== 'string' || typeof layoutSessionId !== 'string' || typeof ownerKey !== 'string') {
    throw new TypeError('Stored warehouse layout session has an unexpected shape');
  }

  return { expiresAtMs, id, layoutSessionId, ownerKey };
};

export const serializeWarehouseLayoutSessionRecord = (record: WarehouseLayoutSessionRecordValue): StoredObjectValue => ({ ...record });
