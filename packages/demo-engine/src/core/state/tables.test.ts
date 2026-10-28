import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import { UserSchema } from '@skladburg/contracts/access/v1/access';
import {
  CitySchema,
  MapNodeSchema,
} from '@skladburg/contracts/network/v1/network';
import { NotificationSchema } from '@skladburg/contracts/notification/v1/notification';
import {
  OrganizationSchema,
  OrganizationSettingsSchema,
  ProfileKind,
  SphereSchema,
} from '@skladburg/contracts/organization/v1/organization';
import { SupportAccessStatus } from '@skladburg/contracts/support/v1/support_access';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { LEGACY_PERSONA_KIND } from '../../protocol/testLegacyNames';
import {
  DemoPersonaGroup,
  DemoPersonaKind,
  parseDemoPersona,
  parseIdempotencyRecord,
  parseNotificationRecord,
} from './records';
import { TABLE_DEFINITIONS } from './tables';
import {
  createTestMembership,
  createTestSupportAccessSession,
  createTestWarehouse,
  FIRST_TENANT_ID,
} from './testRecords';

describe('message tables', () => {
  it('encode a message into bytes and decode it back to an equal message', () => {
    const warehouse = createTestWarehouse('wh-1', FIRST_TENANT_ID);
    const stored = TABLE_DEFINITIONS.warehouses.encode(warehouse);

    expect(stored).toBeInstanceOf(Uint8Array);
    expect(TABLE_DEFINITIONS.warehouses.decode(stored)).toEqual(warehouse);
  });

  it('round-trip every contract message of the engine', () => {
    const organization = create(OrganizationSchema, {
      id: 'org-1',
      name: 'Заказчик 1',
      profiles: [{ kind: ProfileKind.CUSTOMER, verificationLevel: 2 }],
      sphereIds: ['sphere-1'],
    });
    const settings = create(OrganizationSettingsSchema, {
      availableLocales: ['ru'],
      brandName: 'Заказчик 1',
      defaultLocale: 'ru',
      organizationId: 'org-1',
    });
    const city = create(CitySchema, { id: 'city-1', name: 'Москва', timeZone: 'Europe/Moscow' });
    const node = create(MapNodeSchema, { cityId: 'city-1', id: 'node-1', position: { column: 2, row: 3 } });

    expect(TABLE_DEFINITIONS.organizations.decode(TABLE_DEFINITIONS.organizations.encode(organization))).toEqual(organization);
    expect(TABLE_DEFINITIONS.organizationSettings.decode(TABLE_DEFINITIONS.organizationSettings.encode(settings))).toEqual(settings);
    expect(TABLE_DEFINITIONS.cities.decode(TABLE_DEFINITIONS.cities.encode(city))).toEqual(city);
    expect(TABLE_DEFINITIONS.mapNodes.decode(TABLE_DEFINITIONS.mapNodes.encode(node))).toEqual(node);
    const sphere = create(SphereSchema, { id: 'sphere-1', name: 'Продукты' });
    const user = create(UserSchema, { displayName: 'Анна Смирнова', id: 'user-1' });

    expect(TABLE_DEFINITIONS.spheres.decode(TABLE_DEFINITIONS.spheres.encode(sphere))).toEqual(sphere);
    expect(TABLE_DEFINITIONS.users.decode(TABLE_DEFINITIONS.users.encode(user))).toEqual(user);
  });

  it('key settings by the organization id', () => {
    const settings = create(OrganizationSettingsSchema, { organizationId: 'org-1' });

    expect(TABLE_DEFINITIONS.organizationSettings.getId(settings)).toBe('org-1');
  });

  it('read index keys from foreign keys', () => {
    expect(TABLE_DEFINITIONS.warehouses.indexKeys.tenantId(createTestWarehouse('wh-1', 'tenant-1'))).toBe('tenant-1');
    expect(TABLE_DEFINITIONS.memberships.indexKeys.userId(createTestMembership('m-1', 'user-1', 'org-1'))).toBe('user-1');
    expect(TABLE_DEFINITIONS.memberships.indexKeys.organizationId(createTestMembership('m-1', 'user-1', 'org-1'))).toBe('org-1');
  });

  it('clone into an independent message', () => {
    const warehouse = createTestWarehouse('wh-1', FIRST_TENANT_ID);
    const copy = TABLE_DEFINITIONS.warehouses.clone(warehouse);
    copy.name = 'Изменено';

    expect(warehouse.name).toBe('Склад 1');
  });

  it('refuse a plain object where bytes are expected', () => {
    expect(() => TABLE_DEFINITIONS.warehouses.decode({ id: 'wh-1' })).toThrow(TypeError);
  });
});

const VALID_PERSONA_FIELDS = {
  group: DemoPersonaGroup.FRESH,
  id: 'p',
  kind: DemoPersonaKind.SUPPLIER,
  organizationId: 'o',
  userId: 'u',
};

describe('plain record tables', () => {
  it('round-trip a persona and keep it independent of the original', () => {
    const persona = {
      group: DemoPersonaGroup.CONSTRUCTION,
      id: 'persona-1',
      kind: DemoPersonaKind.CUSTOMER,
      organizationId: 'org-1',
      userId: 'user-1',
    };
    const stored = TABLE_DEFINITIONS.personas.encode(persona);

    expect(TABLE_DEFINITIONS.personas.decode(stored)).toEqual(persona);
    expect(stored).not.toBe(persona);
  });

  it('round-trip an idempotency record with its bytes', () => {
    const record = {
      id: 'scope:method:key',
      method: 'organization.v1.OrganizationService/CreateWarehouse',
      requestBytes: new Uint8Array([1, 2, 3]),
      responseBytes: new Uint8Array([4, 5]),
    };
    const decoded = TABLE_DEFINITIONS.idempotency.decode(TABLE_DEFINITIONS.idempotency.encode(record));

    expect(decoded).toEqual(record);
    expect(decoded.requestBytes).toBeInstanceOf(Uint8Array);
  });

  it('reject a persona of an unknown kind', () => {
    expect(() => parseDemoPersona({ ...VALID_PERSONA_FIELDS, kind: 'robot' })).toThrow(TypeError);
  });

  it('reject a persona of the kind used before the side names changed', () => {
    expect(() => parseDemoPersona({ ...VALID_PERSONA_FIELDS, kind: LEGACY_PERSONA_KIND })).toThrow(TypeError);
  });

  it('reject a persona with a missing field', () => {
    const withoutUser = { group: DemoPersonaGroup.FRESH, id: 'p', kind: DemoPersonaKind.SUPPLIER, organizationId: 'o' };

    expect(() => parseDemoPersona(withoutUser)).toThrow(TypeError);
  });

  it('reject a persona of an unknown group or without a group', () => {
    expect(() => parseDemoPersona({ ...VALID_PERSONA_FIELDS, group: 'garden' })).toThrow(TypeError);
    expect(() => parseDemoPersona({ id: 'p', kind: DemoPersonaKind.SUPPLIER, organizationId: 'o', userId: 'u' })).toThrow(TypeError);
  });

  it('reject binary data where an object is expected', () => {
    expect(() => parseDemoPersona(new Uint8Array([1]))).toThrow(TypeError);
    expect(() => parseIdempotencyRecord(new Uint8Array([1]))).toThrow(TypeError);
  });

  it('reject an idempotency record without bytes', () => {
    const stored = { id: 'k', method: 'm', requestBytes: 'text', responseBytes: new Uint8Array() };

    expect(() => parseIdempotencyRecord(stored)).toThrow(TypeError);
  });
});

describe('notification table', () => {
  const notification = create(NotificationSchema, {
    id: 'notification-1',
    organizationId: 'org-1',
    params: { case: 'verificationNextLevel', value: { currentLevel: 1, nextLevel: 2 } },
  });

  it('round-trips a notification with its recipient and keys it by the notification id', () => {
    const record = { notification, userId: 'user-1' };
    const decoded = TABLE_DEFINITIONS.notifications.decode(TABLE_DEFINITIONS.notifications.encode(record));

    expect(decoded).toEqual(record);
    expect(TABLE_DEFINITIONS.notifications.getId(record)).toBe('notification-1');
    expect(TABLE_DEFINITIONS.notifications.indexKeys.userId(record)).toBe('user-1');
  });

  it('clones into an independent record', () => {
    const record = { notification, userId: 'user-1' };
    const copy = TABLE_DEFINITIONS.notifications.clone(record);
    copy.notification.organizationId = 'org-2';

    expect(record.notification.organizationId).toBe('org-1');
  });

  it('rejects a stored record without bytes or with a different id inside', () => {
    const notificationBytes = toBinary(NotificationSchema, notification);

    expect(() => parseNotificationRecord({ id: 'n', userId: 'u' })).toThrow(TypeError);
    expect(() => parseNotificationRecord(new Uint8Array([1]))).toThrow(TypeError);
    expect(() => parseNotificationRecord({ id: 'other', notificationBytes, userId: 'user-1' })).toThrow(TypeError);
  });
});

describe('support access session table', () => {
  const session = createTestSupportAccessSession('session-1', 'org-1', 'staff-1', SupportAccessStatus.ACTIVE);

  it('round-trips a session and keys it by the session id', () => {
    const decoded = TABLE_DEFINITIONS.supportAccessSessions.decode(TABLE_DEFINITIONS.supportAccessSessions.encode(session));

    expect(decoded).toEqual(session);
    expect(TABLE_DEFINITIONS.supportAccessSessions.getId(session)).toBe('session-1');
  });

  it('indexes a session by the organization and by the staff member', () => {
    expect(TABLE_DEFINITIONS.supportAccessSessions.indexKeys.organizationId(session)).toBe('org-1');
    expect(TABLE_DEFINITIONS.supportAccessSessions.indexKeys.staffUserId(session)).toBe('staff-1');
  });
});
