import type { Notification } from '@skladburg/contracts/notification/v1/notification';

import {
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { NotificationSchema } from '@skladburg/contracts/notification/v1/notification';

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

export interface NotificationRecordValue {
  notification: Notification;
  userId: string;
}

export interface SupportBotQueueRecordValue {
  dueAtMs: number;
  id: string;
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

export const parseNotificationRecord = (stored: StoredRecordValue): NotificationRecordValue => {
  const { id, notificationBytes, userId } = readPlainObject(stored, 'notification record');

  if (typeof id !== 'string' || typeof userId !== 'string' || !(notificationBytes instanceof Uint8Array)) {
    throw new TypeError('Stored notification record has an unexpected shape');
  }

  const notification = fromBinary(NotificationSchema, notificationBytes);

  if (notification.id !== id) {
    throw new TypeError('Stored notification record does not match the id inside the notification');
  }

  return { notification, userId };
};

export const parseSupportBotQueueRecord = (stored: StoredRecordValue): SupportBotQueueRecordValue => {
  const { dueAtMs, id } = readPlainObject(stored, 'support bot queue record');

  if (typeof id !== 'string' || typeof dueAtMs !== 'number' || !Number.isFinite(dueAtMs)) {
    throw new TypeError('Stored support bot queue record has an unexpected shape');
  }

  return { dueAtMs, id };
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

export const serializeNotificationRecord = (record: NotificationRecordValue): StoredObjectValue => ({
  id: record.notification.id,
  notificationBytes: toBinary(NotificationSchema, record.notification),
  userId: record.userId,
});

export const serializeSupportBotQueueRecord = (record: SupportBotQueueRecordValue): StoredObjectValue => ({
  dueAtMs: record.dueAtMs,
  id: record.id,
});
