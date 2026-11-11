import type {
  EngineClientMessageValue,
  EngineControlResultMessageValue,
  EngineHostMessageValue,
  HeaderPairValue,
} from './messages';
import type { DemoPersonaListItemValue } from './personas';

import {
  DemoPersonaGroup,
  DemoPersonaKind,
} from './constants';
import {
  ENGINE_COORDINATIONS,
  ENGINE_ROLES,
  ENGINE_STORAGE_HEALTHS,
  ENGINE_STORAGE_KINDS,
  ENGINE_UNAVAILABLE_REASONS,
  EngineControlCommand,
} from './messages';

const MIN_HTTP_STATUS = 200;
const MAX_HTTP_STATUS = 599;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  Object.prototype.toString.call(value) === '[object ArrayBuffer]';

const isHeaderPair = (value: unknown): value is HeaderPairValue =>
  Array.isArray(value) && value.length === 2 && isString(value[0]) && isString(value[1]);

const canBuildHeaders = (pairs: HeaderPairValue[]): boolean => {
  try {
    return new Headers(pairs) instanceof Headers;
  }
  catch {
    return false;
  }
};

const isHeaderPairList = (value: unknown): value is HeaderPairValue[] =>
  Array.isArray(value) && value.every(isHeaderPair) && canBuildHeaders(value);

const isArrayBufferList = (value: unknown): value is ArrayBuffer[] =>
  Array.isArray(value) && value.every(isArrayBuffer);

const isHttpStatus = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= MIN_HTTP_STATUS && value <= MAX_HTTP_STATUS;

const hasValue = <T>(values: readonly T[], value: unknown): value is T => values.some(candidate => candidate === value);

const readPersona = (value: unknown): DemoPersonaListItemValue | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const { group, id, kind, organizationId, organizationName, roleName, userAvatarUrl, userDisplayName, userId } = value;
  const isAvatarValid = userAvatarUrl === undefined || isString(userAvatarUrl);

  return isAvatarValid
    && hasValue(Object.values(DemoPersonaGroup), group)
    && isString(id)
    && hasValue(Object.values(DemoPersonaKind), kind)
    && isString(organizationId)
    && isString(organizationName)
    && isString(roleName)
    && isString(userDisplayName)
    && isString(userId)
    ? {
        group,
        id,
        kind,
        organizationId,
        organizationName,
        roleName,
        ...(isString(userAvatarUrl) ? { userAvatarUrl } : {}),
        userDisplayName,
        userId,
      }
    : undefined;
};

const readPersonas = (value: unknown): DemoPersonaListItemValue[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const personas: DemoPersonaListItemValue[] = [];

  for (const candidate of value) {
    const persona = readPersona(candidate);

    if (persona === undefined) {
      return undefined;
    }

    personas.push(persona);
  }

  return personas;
};

const readControlResult = (data: Record<string, unknown>): EngineControlResultMessageValue | undefined => {
  const { personas, requestId } = data;

  if (!isString(requestId)) {
    return undefined;
  }

  if (personas === undefined) {
    return { requestId, type: 'control_result' };
  }

  const parsedPersonas = readPersonas(personas);

  return parsedPersonas === undefined ? undefined : { personas: parsedPersonas, requestId, type: 'control_result' };
};

const readClientMessage = (data: Record<string, unknown>): EngineClientMessageValue | undefined => {
  const { body, channel, command, headers, method, requestId, subscriptionId, url } = data;

  switch (data.type) {
    case 'abort':
      return isString(requestId) ? { requestId, type: 'abort' } : undefined;
    case 'control':
      return isString(requestId) && hasValue(Object.values(EngineControlCommand), command)
        ? { command, requestId, type: 'control' }
        : undefined;
    case 'request':
      return isString(requestId) && isString(url) && isString(method) && isHeaderPairList(headers) && isArrayBuffer(body)
        ? { body, headers, method, requestId, type: 'request', url }
        : undefined;
    case 'subscribe':
      return isString(subscriptionId) && isString(channel) && isHeaderPairList(headers)
        ? { channel, headers, subscriptionId, type: 'subscribe' }
        : undefined;
    case 'unsubscribe':
      return isString(subscriptionId) ? { subscriptionId, type: 'unsubscribe' } : undefined;
    default:
      return undefined;
  }
};

const readHostMessage = (data: Record<string, unknown>): EngineHostMessageValue | undefined => {
  const {
    body,
    coordination,
    detail,
    epoch,
    events,
    headers,
    reason,
    requestId,
    role,
    seq,
    status,
    storage,
    storageHealth,
    subscriptionId,
    type,
  } = data;

  switch (type) {
    case 'control_result':
      return readControlResult(data);
    case 'engine_unavailable':
      return hasValue(ENGINE_UNAVAILABLE_REASONS, reason) ? { reason, type } : undefined;
    case 'events':
      return isString(subscriptionId) && isArrayBufferList(events) ? { events, subscriptionId, type } : undefined;
    case 'reset_done':
      return isString(epoch) ? { epoch, type } : undefined;
    case 'response':
      return isString(requestId) && isHttpStatus(status) && isHeaderPairList(headers) && isArrayBuffer(body)
        ? { body, headers, requestId, status, type }
        : undefined;
    case 'status':
      return hasValue(ENGINE_COORDINATIONS, coordination)
        && isString(epoch)
        && hasValue(ENGINE_ROLES, role)
        && hasValue(ENGINE_STORAGE_KINDS, storage)
        && hasValue(ENGINE_STORAGE_HEALTHS, storageHealth)
        ? { coordination, epoch, role, storage, storageHealth, type }
        : undefined;
    case 'subscribed':
      return isString(subscriptionId) && isString(epoch) && typeof seq === 'bigint'
        ? { epoch, seq, subscriptionId, type }
        : undefined;
    case 'subscription_denied':
      return isString(subscriptionId) && isArrayBuffer(detail)
        ? { detail, subscriptionId, type }
        : undefined;
    case 'transport_error':
      return isString(requestId) ? { requestId, type } : undefined;
    default:
      return undefined;
  }
};

export const parseEngineClientMessage = (data: unknown): EngineClientMessageValue | undefined => {
  const message = isRecord(data) ? readClientMessage(data) : undefined;

  if (message === undefined) {
    console.log('> parseEngineClientMessage -> readClientMessage:', { data });
  }

  return message;
};

export const parseEngineHostMessage = (data: unknown): EngineHostMessageValue | undefined => {
  const message = isRecord(data) ? readHostMessage(data) : undefined;

  if (message === undefined) {
    console.log('> parseEngineHostMessage -> readHostMessage:', { data });
  }

  return message;
};
