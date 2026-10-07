import { create } from '@bufbuild/protobuf';
import { UserSchema } from '@skladburg/contracts/access/v1/access';
import {
  BoardNodeSchema,
  CitySchema,
} from '@skladburg/contracts/network/v1/network';
import {
  OrganizationSchema,
  OrganizationSettingsSchema,
  ProfileKind,
  SphereSchema,
} from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  DemoPersonaKind,
  parseDemoPersona,
  parseIdempotencyRecord,
} from './records';
import { TABLE_DEFINITIONS } from './tables';
import {
  createTestMembership,
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
      name: 'Покупатель 1',
      profiles: [{ kind: ProfileKind.BUYER, verificationLevel: 2 }],
      sphereIds: ['sphere-1'],
    });
    const settings = create(OrganizationSettingsSchema, {
      availableLocales: ['ru'],
      brandName: 'Покупатель 1',
      defaultLocale: 'ru',
      organizationId: 'org-1',
    });
    const city = create(CitySchema, { id: 'city-1', name: 'Москва', timeZone: 'Europe/Moscow' });
    const node = create(BoardNodeSchema, { cityId: 'city-1', id: 'node-1', position: { column: 2, row: 3 } });

    expect(TABLE_DEFINITIONS.organizations.decode(TABLE_DEFINITIONS.organizations.encode(organization))).toEqual(organization);
    expect(TABLE_DEFINITIONS.organizationSettings.decode(TABLE_DEFINITIONS.organizationSettings.encode(settings))).toEqual(settings);
    expect(TABLE_DEFINITIONS.cities.decode(TABLE_DEFINITIONS.cities.encode(city))).toEqual(city);
    expect(TABLE_DEFINITIONS.boardNodes.decode(TABLE_DEFINITIONS.boardNodes.encode(node))).toEqual(node);
    const sphere = create(SphereSchema, { id: 'sphere-1', name: 'Продукты' });
    const user = create(UserSchema, { displayName: 'Администратор 1', id: 'user-1' });

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

describe('plain record tables', () => {
  it('round-trip a persona and keep it independent of the original', () => {
    const persona = { id: 'persona-1', kind: DemoPersonaKind.BUYER, organizationId: 'org-1', userId: 'user-1' };
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
    expect(() => parseDemoPersona({ id: 'p', kind: 'robot', organizationId: 'o', userId: 'u' })).toThrow(TypeError);
  });

  it('reject a persona with a missing field', () => {
    expect(() => parseDemoPersona({ id: 'p', kind: DemoPersonaKind.SELLER, organizationId: 'o' })).toThrow(TypeError);
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
