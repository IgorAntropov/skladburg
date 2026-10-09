import type {
  StoredObjectValue,
  StoredRecordValue,
} from '../ports/index';

import {
  DemoPersonaGroup,
  DemoPersonaKind,
} from '../../protocol/constants';

export {
  DemoPersonaGroup,
  DemoPersonaKind,
};

export interface DemoPersonaValue {
  group: DemoPersonaGroup;
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

const isDemoPersonaGroup = (value: unknown): value is DemoPersonaGroup => Object.values<unknown>(DemoPersonaGroup).includes(value);

const isDemoPersonaKind = (value: unknown): value is DemoPersonaKind => Object.values<unknown>(DemoPersonaKind).includes(value);

const readPlainObject = (stored: StoredRecordValue, recordName: string): Exclude<StoredRecordValue, Uint8Array> => {
  if (stored instanceof Uint8Array) {
    throw new TypeError(`Stored ${recordName} must be a plain object`);
  }

  return stored;
};

export const parseDemoPersona = (stored: StoredRecordValue): DemoPersonaValue => {
  const { group, id, kind, organizationId, userId } = readPlainObject(stored, 'persona');

  if (
    typeof id !== 'string'
    || typeof organizationId !== 'string'
    || typeof userId !== 'string'
    || !isDemoPersonaKind(kind)
    || !isDemoPersonaGroup(group)
  ) {
    throw new TypeError('Stored persona has an unexpected shape');
  }

  return { group, id, kind, organizationId, userId };
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
  group: persona.group,
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
