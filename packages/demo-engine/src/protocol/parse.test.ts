import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  DemoPersonaGroup,
  DemoPersonaKind,
} from './constants';
import { EngineControlCommand } from './messages';
import {
  parseEngineClientMessage,
  parseEngineHostMessage,
} from './parse';
import { LEGACY_PERSONA_KIND } from './testLegacyNames';

const PERSONA = {
  group: DemoPersonaGroup.FRESH,
  id: 'persona-1',
  kind: DemoPersonaKind.CUSTOMER,
  organizationId: 'organization-1',
  organizationName: 'Organization 1',
  roleName: 'Role 1',
  userDisplayName: 'User One',
  userId: 'user-1',
};

const PERSONA_WITHOUT_ORGANIZATION_NAME = {
  group: PERSONA.group,
  id: PERSONA.id,
  kind: PERSONA.kind,
  organizationId: PERSONA.organizationId,
  roleName: PERSONA.roleName,
  userDisplayName: PERSONA.userDisplayName,
  userId: PERSONA.userId,
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseEngineClientMessage', () => {
  it.each([
    {
      body: new ArrayBuffer(2),
      headers: [['content-type', 'application/proto']],
      method: 'POST',
      requestId: 'r1',
      type: 'request',
      url: 'https://x.invalid/a',
    },
    { requestId: 'r1', type: 'abort' },
    { channel: 'org:1', headers: [['x-demo-user-id', 'u']], subscriptionId: 's1', type: 'subscribe' },
    { subscriptionId: 's1', type: 'unsubscribe' },
    { command: EngineControlCommand.LIST_PERSONAS, requestId: 'c1', type: 'control' },
    { command: EngineControlCommand.RESET, requestId: 'c2', type: 'control' },
  ])('accepts a valid $type message and strips unknown fields', (valid) => {
    expect(parseEngineClientMessage({ ...valid, extra: 1 })).toEqual(valid);
    expect(console.log).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    null,
    'request',
    [],
    {},
    { type: 'nonsense' },
    { requestId: 7, type: 'abort' },
    { command: 'format_disk', requestId: 'c1', type: 'control' },
    { body: new ArrayBuffer(0), headers: [['a']], method: 'POST', requestId: 'r1', type: 'request', url: 'u' },
    { body: new Uint8Array(1), headers: [], method: 'POST', requestId: 'r1', type: 'request', url: 'u' },
    { channel: 'org:1', headers: 'x', subscriptionId: 's1', type: 'subscribe' },
    { body: new ArrayBuffer(0), headers: [['bad name', 'x']], method: 'POST', requestId: 'r1', type: 'request', url: 'u' },
    { body: new ArrayBuffer(0), headers: [['x-ok', 'a'], ['bad name', 'x']], method: 'POST', requestId: 'r1', type: 'request', url: 'u' },
    { channel: 'org:1', headers: [['bad name', 'x']], subscriptionId: 's1', type: 'subscribe' },
    { channel: 'org:1', headers: [['x-demo-user-id', 'line\nbreak']], subscriptionId: 's1', type: 'subscribe' },
    { subscriptionId: undefined, type: 'unsubscribe' },
    { requestId: 'r1', status: 200, type: 'response' },
  ])('ignores an invalid message and logs it: %j', (invalid) => {
    expect(parseEngineClientMessage(invalid)).toBeUndefined();
    expect(console.log).toHaveBeenCalledWith('> parseEngineClientMessage -> readClientMessage:', { data: invalid });
  });
});

describe('parseEngineHostMessage', () => {
  it.each([
    { body: new ArrayBuffer(3), headers: [['content-type', 'application/proto']], requestId: 'r1', status: 200, type: 'response' },
    { requestId: 'r1', type: 'transport_error' },
    { epoch: 'e1', seq: 0n, subscriptionId: 's1', type: 'subscribed' },
    { events: [new ArrayBuffer(1), new ArrayBuffer(4)], subscriptionId: 's1', type: 'events' },
    { events: [], subscriptionId: 's1', type: 'events' },
    { detail: new ArrayBuffer(2), subscriptionId: 's1', type: 'subscription_denied' },
    { personas: [PERSONA], requestId: 'c1', type: 'control_result' },
    { personas: [], requestId: 'c1', type: 'control_result' },
    { requestId: 'c2', type: 'control_result' },
    { epoch: 'e2', type: 'reset_done' },
    { reason: 'start_failed', type: 'engine_unavailable' },
    { coordination: 'shared', epoch: 'e1', role: 'leader', storage: 'indexed-db', storageHealth: 'ok', type: 'status' },
    { coordination: 'shared', epoch: 'e1', role: 'follower', storage: 'memory', storageHealth: 'failing', type: 'status' },
    { coordination: 'single-tab', epoch: 'e1', role: 'leader', storage: 'indexed-db', storageHealth: 'ok', type: 'status' },
  ])('accepts a valid $type message and strips unknown fields', (valid) => {
    expect(parseEngineHostMessage({ ...valid, extra: 1 })).toEqual(valid);
    expect(console.log).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    42,
    {},
    { type: 'request' },
    { body: new ArrayBuffer(0), headers: [], requestId: 'r1', status: 99, type: 'response' },
    { body: new ArrayBuffer(0), headers: [], requestId: 'r1', status: 200.5, type: 'response' },
    { body: new ArrayBuffer(0), headers: [], requestId: 'r1', status: 700, type: 'response' },
    { epoch: 'e1', seq: 1, subscriptionId: 's1', type: 'subscribed' },
    { events: [new ArrayBuffer(1), 'x'], subscriptionId: 's1', type: 'events' },
    { detail: 'x', subscriptionId: 's1', type: 'subscription_denied' },
    { personas: [{ ...PERSONA, kind: 'robot' }], requestId: 'c1', type: 'control_result' },
    { personas: [{ ...PERSONA, kind: LEGACY_PERSONA_KIND }], requestId: 'c1', type: 'control_result' },
    { personas: [PERSONA_WITHOUT_ORGANIZATION_NAME], requestId: 'c1', type: 'control_result' },
    { personas: [{ ...PERSONA, organizationName: 7 }], requestId: 'c1', type: 'control_result' },
    { personas: [{ ...PERSONA, organizationName: undefined }], requestId: 'c1', type: 'control_result' },
    { personas: [{ ...PERSONA, organizationName: null }], requestId: 'c1', type: 'control_result' },
    { personas: [{ ...PERSONA, group: 'garden' }], requestId: 'c1', type: 'control_result' },
    { personas: [{ ...PERSONA, group: undefined }], requestId: 'c1', type: 'control_result' },
    { personas: [{ ...PERSONA, roleName: 7 }], requestId: 'c1', type: 'control_result' },
    { personas: [{ ...PERSONA, roleName: undefined }], requestId: 'c1', type: 'control_result' },
    { personas: [{ ...PERSONA, userDisplayName: null }], requestId: 'c1', type: 'control_result' },
    { personas: [{ ...PERSONA, userDisplayName: undefined }], requestId: 'c1', type: 'control_result' },
    { personas: {}, requestId: 'c1', type: 'control_result' },
    { coordination: 'shared', epoch: 'e1', role: 'boss', storage: 'memory', storageHealth: 'ok', type: 'status' },
    { coordination: 'shared', epoch: 'e1', role: 'leader', storage: 'cloud', storageHealth: 'ok', type: 'status' },
    { coordination: 'shared', epoch: 'e1', role: 'leader', storage: 'memory', storageHealth: 'broken', type: 'status' },
    { coordination: 'solo', epoch: 'e1', role: 'leader', storage: 'memory', storageHealth: 'ok', type: 'status' },
    { epoch: 'e1', role: 'leader', storage: 'memory', storageHealth: 'ok', type: 'status' },
    { coordination: 'shared', epoch: 'e1', role: 'leader', storage: 'memory', type: 'status' },
    { coordination: 'shared', epoch: 1, role: 'leader', storage: 'memory', storageHealth: 'ok', type: 'status' },
    { epoch: 1, type: 'reset_done' },
    { reason: 'unknown', type: 'engine_unavailable' },
    { reason: 1, type: 'engine_unavailable' },
    { type: 'engine_unavailable' },
  ])('ignores an invalid message and logs it: %j', (invalid) => {
    expect(parseEngineHostMessage(invalid)).toBeUndefined();
    expect(console.log).toHaveBeenCalledWith('> parseEngineHostMessage -> readHostMessage:', { data: invalid });
  });

  it('accepts a structurally cloned message with an ArrayBuffer and a bigint', () => {
    const cloned: unknown = structuredClone({ epoch: 'e1', seq: 9n, subscriptionId: 's1', type: 'subscribed' });

    expect(parseEngineHostMessage(cloned)).toEqual({ epoch: 'e1', seq: 9n, subscriptionId: 's1', type: 'subscribed' });
  });

  it('knows every persona group of the engine', () => {
    for (const group of Object.values(DemoPersonaGroup)) {
      expect(parseEngineHostMessage({ personas: [{ ...PERSONA, group }], requestId: 'c1', type: 'control_result' })).toBeDefined();
    }
  });

  it('accepts an empty role name', () => {
    expect(parseEngineHostMessage({ personas: [{ ...PERSONA, roleName: '' }], requestId: 'c1', type: 'control_result' })).toBeDefined();
  });

  it('knows every persona kind of the engine', () => {
    for (const kind of Object.values(DemoPersonaKind)) {
      expect(parseEngineHostMessage({ personas: [{ ...PERSONA, kind }], requestId: 'c1', type: 'control_result' })).toBeDefined();
    }
  });
});
