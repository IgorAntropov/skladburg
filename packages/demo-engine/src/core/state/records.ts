import type {
  StoredObjectValue,
  StoredRecordValue,
} from '../ports/index';

export const DemoPersonaKind = {
  BUYER: 'buyer',
  CARRIER: 'carrier',
  SELLER: 'seller',
  STOREKEEPER: 'storekeeper',
} as const;

export type DemoPersonaKind = typeof DemoPersonaKind[keyof typeof DemoPersonaKind];

export interface DemoPersonaValue {
  id: string;
  kind: DemoPersonaKind;
  organizationId: string;
  userId: string;
}

export interface IdempotencyRecordValue {
  id: string;
  method: string;
  requestBytes: Uint8Array;
  responseBytes: Uint8Array;
}

const isDemoPersonaKind = (value: unknown): value is DemoPersonaKind => Object.values<unknown>(DemoPersonaKind).includes(value);

const readPlainObject = (stored: StoredRecordValue, recordName: string): Exclude<StoredRecordValue, Uint8Array> => {
  if (stored instanceof Uint8Array) {
    throw new TypeError(`Stored ${recordName} must be a plain object`);
  }

  return stored;
};

export const parseDemoPersona = (stored: StoredRecordValue): DemoPersonaValue => {
  const { id, kind, organizationId, userId } = readPlainObject(stored, 'persona');

  if (typeof id !== 'string' || typeof organizationId !== 'string' || typeof userId !== 'string' || !isDemoPersonaKind(kind)) {
    throw new TypeError('Stored persona has an unexpected shape');
  }

  return { id, kind, organizationId, userId };
};

export const parseIdempotencyRecord = (stored: StoredRecordValue): IdempotencyRecordValue => {
  const { id, method, requestBytes, responseBytes } = readPlainObject(stored, 'idempotency record');

  if (
    typeof id !== 'string'
    || typeof method !== 'string'
    || !(requestBytes instanceof Uint8Array)
    || !(responseBytes instanceof Uint8Array)
  ) {
    throw new TypeError('Stored idempotency record has an unexpected shape');
  }

  return { id, method, requestBytes, responseBytes };
};

export const serializeDemoPersona = (persona: DemoPersonaValue): StoredObjectValue => ({
  id: persona.id,
  kind: persona.kind,
  organizationId: persona.organizationId,
  userId: persona.userId,
});

export const serializeIdempotencyRecord = (record: IdempotencyRecordValue): StoredObjectValue => ({
  id: record.id,
  method: record.method,
  requestBytes: record.requestBytes.slice(),
  responseBytes: record.responseBytes.slice(),
});
