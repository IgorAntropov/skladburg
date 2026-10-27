import type { Organization } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  ObjectKind,
  type ObjectLink,
  ObjectLinkSchema,
  ObjectRefSchema,
} from '@skladburg/contracts/common/v1/object_link';
import {
  NotificationImportance,
  NotificationKind,
  NotificationSchema,
  PartnerVerifiedParamsSchema,
  VerificationNextLevelParamsSchema,
  WarehouseCreatedParamsSchema,
} from '@skladburg/contracts/notification/v1/notification';

import type { NotificationRecordValue } from '../state/index';

import {
  SeedOrganizationId,
  SeedPersonaId,
  SeedWarehouseId,
} from './seedIds';
import { createSeedCities } from './seedNetwork';
import { createSeedOrganizations } from './seedOrganizations';
import { createSeedPersonas } from './seedPersonas';
import { createSeedWarehouses } from './seedWarehouses';

export const SeedNotificationId = {
  CARRIER_1_NEXT_LEVEL: 'b0000005-0000-4000-8000-000000000000',
  CARRIER_1_PARTNER_SUPPLIER_1: 'b0000006-0000-4000-8000-000000000000',
  CARRIER_2_PARTNER_SUPPLIER_3: 'b0000012-0000-4000-8000-000000000000',
  CONSTRUCTION_CUSTOMER_PARTNER_SUPPLIER_3: 'b0000009-0000-4000-8000-000000000000',
  CONSTRUCTION_CUSTOMER_PARTNER_SUPPLIER_4: 'b0000010-0000-4000-8000-000000000000',
  CONSTRUCTION_STOREKEEPER_WAREHOUSE: 'b0000013-0000-4000-8000-000000000000',
  CONSTRUCTION_SUPPLIER_PARTNER_CUSTOMER_2: 'b0000011-0000-4000-8000-000000000000',
  FRESH_CUSTOMER_PARTNER_SUPPLIER_1: 'b0000002-0000-4000-8000-000000000000',
  FRESH_CUSTOMER_PARTNER_SUPPLIER_2: 'b0000001-0000-4000-8000-000000000000',
  FRESH_STOREKEEPER_WAREHOUSE: 'b0000007-0000-4000-8000-000000000000',
  FRESH_SUPPLIER_PARTNER_CUSTOMER_1: 'b0000003-0000-4000-8000-000000000000',
} as const;

const MAX_LINKED_SITES = 2;
const MINUTE_MS = 60_000;

interface SeedNotificationDefinitionValue {
  id: string;
  importance: NotificationImportance;
  kind: NotificationKind;
  minutesBeforeStart: number;
  personaId: string;
  readAfterMinutes?: number;
  subjectId: string;
}

const SEED_NOTIFICATION_DEFINITIONS: readonly SeedNotificationDefinitionValue[] = [
  {
    id: SeedNotificationId.FRESH_CUSTOMER_PARTNER_SUPPLIER_2,
    importance: NotificationImportance.NORMAL,
    kind: NotificationKind.PARTNER_VERIFIED,
    minutesBeforeStart: 20,
    personaId: SeedPersonaId.FRESH_CUSTOMER,
    subjectId: SeedOrganizationId.SUPPLIER_2,
  },
  {
    id: SeedNotificationId.FRESH_CUSTOMER_PARTNER_SUPPLIER_1,
    importance: NotificationImportance.NORMAL,
    kind: NotificationKind.PARTNER_VERIFIED,
    minutesBeforeStart: 55,
    personaId: SeedPersonaId.FRESH_CUSTOMER,
    readAfterMinutes: 5,
    subjectId: SeedOrganizationId.SUPPLIER_1,
  },
  {
    id: SeedNotificationId.FRESH_SUPPLIER_PARTNER_CUSTOMER_1,
    importance: NotificationImportance.NORMAL,
    kind: NotificationKind.PARTNER_VERIFIED,
    minutesBeforeStart: 25,
    personaId: SeedPersonaId.FRESH_SUPPLIER,
    subjectId: SeedOrganizationId.CUSTOMER_1,
  },
  {
    id: SeedNotificationId.CARRIER_1_NEXT_LEVEL,
    importance: NotificationImportance.IMPORTANT,
    kind: NotificationKind.VERIFICATION_NEXT_LEVEL,
    minutesBeforeStart: 15,
    personaId: SeedPersonaId.FRESH_CARRIER,
    subjectId: SeedOrganizationId.CARRIER_1,
  },
  {
    id: SeedNotificationId.CARRIER_1_PARTNER_SUPPLIER_1,
    importance: NotificationImportance.NORMAL,
    kind: NotificationKind.PARTNER_VERIFIED,
    minutesBeforeStart: 40,
    personaId: SeedPersonaId.FRESH_CARRIER,
    subjectId: SeedOrganizationId.SUPPLIER_1,
  },
  {
    id: SeedNotificationId.FRESH_STOREKEEPER_WAREHOUSE,
    importance: NotificationImportance.NORMAL,
    kind: NotificationKind.WAREHOUSE_CREATED,
    minutesBeforeStart: 35,
    personaId: SeedPersonaId.FRESH_STOREKEEPER,
    subjectId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1,
  },
  {
    id: SeedNotificationId.CONSTRUCTION_CUSTOMER_PARTNER_SUPPLIER_3,
    importance: NotificationImportance.NORMAL,
    kind: NotificationKind.PARTNER_VERIFIED,
    minutesBeforeStart: 22,
    personaId: SeedPersonaId.CONSTRUCTION_CUSTOMER,
    subjectId: SeedOrganizationId.SUPPLIER_3,
  },
  {
    id: SeedNotificationId.CONSTRUCTION_CUSTOMER_PARTNER_SUPPLIER_4,
    importance: NotificationImportance.NORMAL,
    kind: NotificationKind.PARTNER_VERIFIED,
    minutesBeforeStart: 48,
    personaId: SeedPersonaId.CONSTRUCTION_CUSTOMER,
    subjectId: SeedOrganizationId.SUPPLIER_4,
  },
  {
    id: SeedNotificationId.CONSTRUCTION_SUPPLIER_PARTNER_CUSTOMER_2,
    importance: NotificationImportance.NORMAL,
    kind: NotificationKind.PARTNER_VERIFIED,
    minutesBeforeStart: 28,
    personaId: SeedPersonaId.CONSTRUCTION_SUPPLIER,
    subjectId: SeedOrganizationId.CUSTOMER_2,
  },
  {
    id: SeedNotificationId.CARRIER_2_PARTNER_SUPPLIER_3,
    importance: NotificationImportance.NORMAL,
    kind: NotificationKind.PARTNER_VERIFIED,
    minutesBeforeStart: 32,
    personaId: SeedPersonaId.CONSTRUCTION_CARRIER,
    subjectId: SeedOrganizationId.SUPPLIER_3,
  },
  {
    id: SeedNotificationId.CONSTRUCTION_STOREKEEPER_WAREHOUSE,
    importance: NotificationImportance.NORMAL,
    kind: NotificationKind.WAREHOUSE_CREATED,
    minutesBeforeStart: 38,
    personaId: SeedPersonaId.CONSTRUCTION_STOREKEEPER,
    subjectId: SeedWarehouseId.CUSTOMER_2_SITE_1,
  },
];

const createObjectLink = (kind: ObjectKind, id: string): ObjectLink =>
  create(ObjectLinkSchema, {
    cameraFocus: create(ObjectRefSchema, { id, kind }),
    target: create(ObjectRefSchema, { id, kind }),
  });

const resolveVerificationLevel = (organization: Organization): number =>
  Math.max(...organization.profiles.map(profile => profile.verificationLevel));

export const createSeedNotifications = (worldStartMs: number): NotificationRecordValue[] => {
  const personas = new Map(createSeedPersonas().map(persona => [persona.id, persona]));
  const organizations = new Map(createSeedOrganizations().map(organization => [organization.id, organization]));
  const warehouses = createSeedWarehouses();
  const cityNames = new Map(createSeedCities().map(city => [city.id, city.name]));

  return SEED_NOTIFICATION_DEFINITIONS.map((definition): NotificationRecordValue => {
    const persona = personas.get(definition.personaId);

    if (persona === undefined) {
      throw new Error(`Seed notification ${definition.id} refers to an unknown persona`);
    }

    const createdAtMs = worldStartMs - definition.minutesBeforeStart * MINUTE_MS;
    const base = {
      createdAt: timestampFromMs(createdAtMs),
      id: definition.id,
      importance: definition.importance,
      kind: definition.kind,
      organizationId: persona.organizationId,
      readAt: definition.readAfterMinutes === undefined
        ? undefined
        : timestampFromMs(createdAtMs + definition.readAfterMinutes * MINUTE_MS),
    };

    if (definition.kind === NotificationKind.PARTNER_VERIFIED) {
      const partner = organizations.get(definition.subjectId);

      if (partner === undefined) {
        throw new Error(`Seed notification ${definition.id} refers to an unknown organization`);
      }

      const siteLinks = warehouses
        .filter(warehouse => warehouse.tenantId === partner.id)
        .slice(0, MAX_LINKED_SITES)
        .map(warehouse => createObjectLink(ObjectKind.SITE, warehouse.id));

      return {
        notification: create(NotificationSchema, {
          ...base,
          links: [createObjectLink(ObjectKind.ORGANIZATION, partner.id), ...siteLinks],
          params: {
            case: 'partnerVerified',
            value: create(PartnerVerifiedParamsSchema, {
              organizationId: partner.id,
              organizationName: partner.name,
              verificationLevel: resolveVerificationLevel(partner),
            }),
          },
        }),
        userId: persona.userId,
      };
    }

    if (definition.kind === NotificationKind.VERIFICATION_NEXT_LEVEL) {
      const own = organizations.get(definition.subjectId);

      if (own === undefined) {
        throw new Error(`Seed notification ${definition.id} refers to an unknown organization`);
      }

      const currentLevel = resolveVerificationLevel(own);

      return {
        notification: create(NotificationSchema, {
          ...base,
          links: [create(ObjectLinkSchema, { target: create(ObjectRefSchema, { id: own.id, kind: ObjectKind.ORGANIZATION }) })],
          params: {
            case: 'verificationNextLevel',
            value: create(VerificationNextLevelParamsSchema, { currentLevel, nextLevel: currentLevel + 1 }),
          },
        }),
        userId: persona.userId,
      };
    }

    const warehouse = warehouses.find(candidate => candidate.id === definition.subjectId);

    if (warehouse === undefined) {
      throw new Error(`Seed notification ${definition.id} refers to an unknown warehouse`);
    }

    return {
      notification: create(NotificationSchema, {
        ...base,
        links: [createObjectLink(ObjectKind.SITE, warehouse.id)],
        params: {
          case: 'warehouseCreated',
          value: create(WarehouseCreatedParamsSchema, {
            cityName: cityNames.get(warehouse.cityId) ?? '',
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
          }),
        },
      }),
      userId: persona.userId,
    };
  });
};
