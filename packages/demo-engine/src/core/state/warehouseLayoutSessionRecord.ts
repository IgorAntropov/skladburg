import type {
  StoredObjectValue,
  StoredRecordValue,
} from '../ports/index';

export interface WarehouseLayoutDraftRecordValue {
  baseRevision: number;
  cellsBytes: Uint8Array;
  draftRevision: number;
  footprintBytes: Uint8Array;
  idempotencyKey: string;
  requestBytes: Uint8Array;
  rowId: string;
}

export interface WarehouseLayoutSessionRecordValue {
  draft?: undefined | WarehouseLayoutDraftRecordValue;
  expiresAtMs: number;
  id: string;
  layoutSessionId: string;
  ownerKey: string;
}

const parseWarehouseLayoutDraft = (draft: unknown): WarehouseLayoutDraftRecordValue => {
  if (typeof draft !== 'object' || draft === null || !('baseRevision' in draft) || typeof draft.baseRevision !== 'number'
    || !('cellsBytes' in draft) || !(draft.cellsBytes instanceof Uint8Array)
    || !('draftRevision' in draft) || typeof draft.draftRevision !== 'number'
    || !('footprintBytes' in draft) || !(draft.footprintBytes instanceof Uint8Array)
    || !('idempotencyKey' in draft) || typeof draft.idempotencyKey !== 'string'
    || !('requestBytes' in draft) || !(draft.requestBytes instanceof Uint8Array)
    || !('rowId' in draft) || typeof draft.rowId !== 'string') {
    throw new TypeError('Stored warehouse layout draft has an unexpected shape');
  }

  const { baseRevision, cellsBytes, draftRevision, footprintBytes, idempotencyKey, requestBytes, rowId } = draft;

  return { baseRevision, cellsBytes, draftRevision, footprintBytes, idempotencyKey, requestBytes, rowId };
};

export const parseWarehouseLayoutSessionRecord = (stored: StoredRecordValue): WarehouseLayoutSessionRecordValue => {
  if (stored instanceof Uint8Array) {
    throw new TypeError('Stored warehouse layout session must be a plain object');
  }

  const { draft, expiresAtMs, id, layoutSessionId, ownerKey } = stored;
  if (typeof expiresAtMs !== 'number' || !Number.isFinite(expiresAtMs)
    || typeof id !== 'string' || typeof layoutSessionId !== 'string' || typeof ownerKey !== 'string') {
    throw new TypeError('Stored warehouse layout session has an unexpected shape');
  }

  const record = { expiresAtMs, id, layoutSessionId, ownerKey };

  return draft === undefined ? record : { ...record, draft: parseWarehouseLayoutDraft(draft) };
};

export const serializeWarehouseLayoutSessionRecord = ({
  draft,
  ...record
}: WarehouseLayoutSessionRecordValue): StoredObjectValue => draft === undefined ? record : { ...record, draft: { ...draft } };
