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

const isControlCommand = (value: unknown): value is EngineControlCommand =>
  Object.values<unknown>(EngineControlCommand).includes(value);

const isCoordination = (value: unknown): value is typeof ENGINE_COORDINATIONS[number] =>
  ENGINE_COORDINATIONS.some(coordination => coordination === value);

const isEngineRole = (value: unknown): value is typeof ENGINE_ROLES[number] => ENGINE_ROLES.some(role => role === value);

const isStorageKind = (value: unknown): value is typeof ENGINE_STORAGE_KINDS[number] =>
  ENGINE_STORAGE_KINDS.some(kind => kind === value);

const isStorageHealth = (value: unknown): value is typeof ENGINE_STORAGE_HEALTHS[number] =>
  ENGINE_STORAGE_HEALTHS.some(health => health === value);

const isUnavailableReason = (value: unknown): value is typeof ENGINE_UNAVAILABLE_REASONS[number] =>
  ENGINE_UNAVAILABLE_REASONS.some(reason => reason === value);

const isPersonaKind = (value: unknown): value is DemoPersonaKind => Object.values<unknown>(DemoPersonaKind).includes(value);

const isPersonaGroup = (value: unknown): value is DemoPersonaGroup => Object.values<unknown>(DemoPersonaGroup).includes(value);

const readPersona = (value: unknown): DemoPersonaListItemValue | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const { group, id, kind, organizationId, organizationName, roleName, userDisplayName, userId } = value;

  return isPersonaGroup(group)
    && isString(id)
    && isPersonaKind(kind)
    && isString(organizationId)
    && isString(organizationName)
    && isString(roleName)
    && isString(userDisplayName)
    && isString(userId)
    ? { group, id, kind, organizationId, organizationName, roleName, userDisplayName, userId }
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
      return isString(requestId) && isControlCommand(command) ? { command, requestId, type: 'control' } : undefined;
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
  } = data;

  switch (data.type) {
    case 'control_result':
      return readControlResult(data);
    case 'engine_unavailable':
      return isUnavailableReason(reason) ? { reason, type: 'engine_unavailable' } : undefined;
    case 'events':
      return isString(subscriptionId) && isArrayBufferList(events) ? { events, subscriptionId, type: 'events' } : undefined;
    case 'reset_done':
      return isString(epoch) ? { epoch, type: 'reset_done' } : undefined;
    case 'response':
      return isString(requestId) && isHttpStatus(status) && isHeaderPairList(headers) && isArrayBuffer(body)
        ? { body, headers, requestId, status, type: 'response' }
        : undefined;
    case 'status':
      return isCoordination(coordination)
        && isString(epoch)
        && isEngineRole(role)
        && isStorageKind(storage)
        && isStorageHealth(storageHealth)
        ? { coordination, epoch, role, storage, storageHealth, type: 'status' }
        : undefined;
    case 'subscribed':
      return isString(subscriptionId) && isString(epoch) && typeof seq === 'bigint'
        ? { epoch, seq, subscriptionId, type: 'subscribed' }
        : undefined;
    case 'subscription_denied':
      return isString(subscriptionId) && isArrayBuffer(detail)
        ? { detail, subscriptionId, type: 'subscription_denied' }
        : undefined;
    case 'transport_error':
      return isString(requestId) ? { requestId, type: 'transport_error' } : undefined;
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
