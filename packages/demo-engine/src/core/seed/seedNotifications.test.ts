import { timestampMs } from '@bufbuild/protobuf/wkt';
import { ObjectKind } from '@skladburg/contracts/common/v1/object_link';
import {
  type Notification,
  NotificationImportance,
  NotificationKind,
  NotificationSchema,
} from '@skladburg/contracts/notification/v1/notification';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveWarehouseRecipients } from '../modules/notifications/index';
import {
  createEngineState,
  type IStateReader,
} from '../state/index';
import {
  isOrganizationVisibleToViewer,
  listVisibleOrganizationShowcases,
  MIN_SHOWCASE_VERIFICATION_LEVEL,
} from '../visibility/index';
import { SeedPersonaId } from './seedIds';
import { createSeedNotifications } from './seedNotifications';
import { createSeedPersonas } from './seedPersonas';
import {
  createSeedSnapshot,
  SEED_WORLD_START_MS,
} from './seedSnapshot';

const ALLOWED_PARAM_FIELDS: ReadonlySet<string> = new Set([
  'cityName',
  'currentLevel',
  'nextLevel',
  'organizationId',
  'organizationName',
  'verificationLevel',
  'warehouseId',
  'warehouseName',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const createSeedReader = (): IStateReader => createEngineState(createSeedSnapshot()).read;

const listParamMessageFields = (): { fieldNames: string[]; messageName: string }[] => {
  const paramsOneof = NotificationSchema.oneofs.find(oneof => oneof.name === 'params');

  return (paramsOneof?.fields ?? []).map(field => ({
    fieldNames: field.message?.fields.map(messageField => messageField.localName) ?? [],
    messageName: field.message?.name ?? field.name,
  }));
};

const resolveMs = (timestamp: Notification['createdAt']): number => timestamp === undefined ? Number.NaN : timestampMs(timestamp);

const collectParamStrings = (notification: Notification): string[] => {
  const { params } = notification;

  if (params.case === undefined) {
    return [];
  }

  return Object.values(params.value).filter((value): value is string => typeof value === 'string');
};

describe('createSeedNotifications', () => {
  const records = createSeedNotifications(SEED_WORLD_START_MS);
  const personas = createSeedPersonas();

  it('gives each of the eight personas one or two notifications in their own organization', () => {
    expect(personas).toHaveLength(8);

    for (const persona of personas) {
      const own = records.filter(record => record.userId === persona.userId);

      expect(own.length, persona.id).toBeGreaterThanOrEqual(1);
      expect(own.length, persona.id).toBeLessThanOrEqual(2);
      own.forEach((record) => {
        expect(record.notification.organizationId, persona.id).toBe(persona.organizationId);
      });
    }

    expect(records.every(record => personas.some(persona => persona.userId === record.userId))).toBe(true);
  });

  it('is deterministic and keeps ids unique UUIDs', () => {
    const ids = records.map(record => record.notification.id);

    expect(createSeedNotifications(SEED_WORLD_START_MS)).toEqual(records);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => {
      expect(id).toMatch(UUID_PATTERN);
    });
  });

  it('places the notifications before the world start at distinct moments for one person', () => {
    for (const persona of personas) {
      const moments = records
        .filter(record => record.userId === persona.userId)
        .map(record => resolveMs(record.notification.createdAt));

      expect(new Set(moments).size, persona.id).toBe(moments.length);
      moments.forEach((moment) => {
        expect(moment, persona.id).toBeLessThan(SEED_WORLD_START_MS);
      });
    }
  });

  it('leaves exactly one notification read, read after it was created and before the start', () => {
    const read = records.filter(record => record.notification.readAt !== undefined);

    expect(read).toHaveLength(1);

    const readAtMs = resolveMs(read[0]?.notification.readAt);

    expect(readAtMs).toBeGreaterThan(resolveMs(read[0]?.notification.createdAt));
    expect(readAtMs).toBeLessThan(SEED_WORLD_START_MS);
  });

  it('points every link at an existing object and keeps at most three links', () => {
    const reader = createSeedReader();

    for (const { notification } of records) {
      expect(notification.links.length, notification.id).toBeGreaterThanOrEqual(1);
      expect(notification.links.length, notification.id).toBeLessThanOrEqual(3);

      for (const link of notification.links) {
        for (const ref of [link.target, link.cameraFocus]) {
          if (ref === undefined) {
            continue;
          }

          if (ref.kind === ObjectKind.ORGANIZATION) {
            expect(reader.get('organizations', ref.id), notification.id).toBeDefined();
          }
          else if (ref.kind === ObjectKind.SITE) {
            expect(reader.get('warehouses', ref.id), notification.id).toBeDefined();
          }
          else {
            expect.unreachable(`Unexpected object kind ${String(ref.kind)}`);
          }
        }
      }
    }
  });

  it('shows verified partners to the person: visible, not their own organization, with the seed level and name', () => {
    const reader = createSeedReader();

    for (const { notification } of records.filter(record => record.notification.kind === NotificationKind.PARTNER_VERIFIED)) {
      const { params } = notification;

      if (params.case !== 'partnerVerified') {
        expect.unreachable('Expected partner params');
      }

      const partner = reader.get('organizations', params.value.organizationId);
      const visibleIds = listVisibleOrganizationShowcases(reader, notification.organizationId, {
        minVerificationLevel: MIN_SHOWCASE_VERIFICATION_LEVEL,
        profileKind: ProfileKind.UNSPECIFIED,
        sphereId: '',
      }).map(showcase => showcase.id);

      if (partner === undefined) {
        expect.unreachable('Expected the partner in the seed');
      }

      expect(params.value.organizationId, notification.id).not.toBe(notification.organizationId);
      expect(isOrganizationVisibleToViewer(reader, notification.organizationId, partner), notification.id).toBe(true);
      expect(visibleIds, notification.id).toContain(params.value.organizationId);
      expect(params.value.organizationName, notification.id).toBe(partner.name);
      expect(params.value.verificationLevel, notification.id).toBe(Math.max(...partner.profiles.map(profile => profile.verificationLevel)));
      expect(params.value.verificationLevel, notification.id).toBeGreaterThanOrEqual(MIN_SHOWCASE_VERIFICATION_LEVEL);
    }
  });

  it('links a verified partner by its card first and by its own sites after', () => {
    const reader = createSeedReader();

    for (const { notification } of records.filter(record => record.notification.kind === NotificationKind.PARTNER_VERIFIED)) {
      const [first, ...sites] = notification.links;

      expect(first?.target?.kind, notification.id).toBe(ObjectKind.ORGANIZATION);
      expect(first?.cameraFocus?.kind, notification.id).toBe(ObjectKind.ORGANIZATION);
      expect(first?.cameraFocus?.id, notification.id).toBe(first?.target?.id);
      expect(notification.params.case, notification.id).toBe('partnerVerified');
      expect(notification.params.value, notification.id).toMatchObject({ organizationId: first?.target?.id });

      for (const site of sites) {
        expect(site.target?.kind, notification.id).toBe(ObjectKind.SITE);
        expect(reader.get('warehouses', site.target?.id ?? '')?.tenantId, notification.id).toBe(first?.target?.id);
      }
    }
  });

  it('gives the first carrier an important next-level notice that links its own card', () => {
    const reader = createSeedReader();
    const carrier = personas.find(persona => persona.id === SeedPersonaId.FRESH_CARRIER);
    const [record, ...rest] = records.filter(candidate => candidate.notification.kind === NotificationKind.VERIFICATION_NEXT_LEVEL);
    const organization = reader.get('organizations', carrier?.organizationId ?? '');
    const level = organization?.profiles[0]?.verificationLevel;

    expect(rest).toHaveLength(0);
    expect(record?.userId).toBe(carrier?.userId);
    expect(record?.notification.importance).toBe(NotificationImportance.IMPORTANT);
    expect(record?.notification.params).toMatchObject({
      case: 'verificationNextLevel',
      value: { currentLevel: level, nextLevel: (level ?? 0) + 1 },
    });
    expect(record?.notification.links).toHaveLength(1);
    expect(record?.notification.links[0]?.target).toMatchObject({ id: organization?.id, kind: ObjectKind.ORGANIZATION });
  });

  it('tells the storekeepers only about warehouses inside their scope', () => {
    const reader = createSeedReader();

    for (const persona of personas) {
      const warehouseRecords = records.filter(record =>
        record.userId === persona.userId && record.notification.kind === NotificationKind.WAREHOUSE_CREATED);

      for (const { notification } of warehouseRecords) {
        const warehouseId = notification.params.case === 'warehouseCreated' ? notification.params.value.warehouseId : '';
        const warehouse = reader.get('warehouses', warehouseId);

        expect(warehouse?.tenantId, notification.id).toBe(persona.organizationId);
        expect(warehouse === undefined ? [] : resolveWarehouseRecipients(reader, warehouse), notification.id).toContain(persona.userId);
        expect(notification.links[0]?.target, notification.id).toMatchObject({ id: warehouseId, kind: ObjectKind.SITE });
      }
    }
  });

  it('fills the warehouse notice with the names of the warehouse and its city from the seed', () => {
    const reader = createSeedReader();

    for (const { notification } of records.filter(record => record.notification.kind === NotificationKind.WAREHOUSE_CREATED)) {
      if (notification.params.case !== 'warehouseCreated') {
        expect.unreachable('Expected warehouse params');
      }

      const warehouse = reader.get('warehouses', notification.params.value.warehouseId);

      expect(notification.params.value.warehouseName, notification.id).toBe(warehouse?.name);
      expect(notification.params.value.cityName, notification.id).toBe(reader.get('cities', warehouse?.cityId ?? '')?.name);
    }
  });

  it('keeps people out of the parameters: only whitelisted fields exist in every params message', () => {
    const messages = listParamMessageFields();

    expect(messages.length).toBeGreaterThanOrEqual(3);

    for (const { fieldNames, messageName } of messages) {
      fieldNames.forEach((fieldName) => {
        expect(ALLOWED_PARAM_FIELDS.has(fieldName), `${messageName}.${fieldName}`).toBe(true);
      });
    }
  });

  it('never puts a person name into the parameter values', () => {
    const reader = createSeedReader();
    const personNames = reader.list('users').map(user => user.displayName);

    for (const { notification } of records) {
      const strings = collectParamStrings(notification);

      expect(strings.length, notification.id).toBeGreaterThan(0);
      strings.forEach((value) => {
        expect(personNames, notification.id).not.toContain(value);
      });
    }
  });
});
