import type {
  DescMessage,
  MessageShape,
} from '@bufbuild/protobuf';
import type {
  Membership,
  Role,
  User,
} from '@skladburg/contracts/access/v1/access';
import type {
  City,
  MapNode,
  RouteLeg,
} from '@skladburg/contracts/network/v1/network';
import type {
  Organization,
  OrganizationSettings,
  Sphere,
  Warehouse,
} from '@skladburg/contracts/organization/v1/organization';
import type { SupportAccessSession } from '@skladburg/contracts/support/v1/support_access';

import {
  clone,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  MembershipSchema,
  RoleSchema,
  UserSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  CitySchema,
  MapNodeSchema,
  RouteLegSchema,
} from '@skladburg/contracts/network/v1/network';
import {
  OrganizationSchema,
  OrganizationSettingsSchema,
  SphereSchema,
  WarehouseSchema,
} from '@skladburg/contracts/organization/v1/organization';
import { SupportAccessSessionSchema } from '@skladburg/contracts/support/v1/support_access';

import type {
  EngineCollectionName,
  StoredObjectValue,
  StoredRecordValue,
} from '../ports/index';
import type {
  DemoPersonaValue,
  IdempotencyRecordValue,
  NotificationRecordValue,
} from './records';

import {
  parseDemoPersona,
  parseIdempotencyRecord,
  parseNotificationRecord,
  serializeDemoPersona,
  serializeIdempotencyRecord,
  serializeNotificationRecord,
} from './records';

export interface TableDefinition<TRecord, TIndex extends string> {
  clone: (record: TRecord) => TRecord;
  decode: (stored: StoredRecordValue) => TRecord;
  encode: (record: TRecord) => StoredRecordValue;
  getId: (record: TRecord) => string;
  indexKeys: Readonly<Record<TIndex, (record: TRecord) => string>>;
}

export type TableDefinitionsValue = {
  [TName in TableName]: TableDefinition<TableRecordsValue[TName], TableIndexesValue[TName]>;
};

export interface TableIndexesValue {
  cities: never;
  idempotency: never;
  mapNodes: never;
  memberships: 'organizationId' | 'userId';
  notifications: 'userId';
  organizations: never;
  organizationSettings: never;
  personas: never;
  roles: 'tenantId';
  routeLegs: never;
  spheres: never;
  supportAccessSessions: 'organizationId' | 'staffUserId';
  users: never;
  warehouses: 'tenantId';
}

export type TableName = EngineCollectionName;

export interface TableRecordsValue {
  cities: City;
  idempotency: IdempotencyRecordValue;
  mapNodes: MapNode;
  memberships: Membership;
  notifications: NotificationRecordValue;
  organizations: Organization;
  organizationSettings: OrganizationSettings;
  personas: DemoPersonaValue;
  roles: Role;
  routeLegs: RouteLeg;
  spheres: Sphere;
  supportAccessSessions: SupportAccessSession;
  users: User;
  warehouses: Warehouse;
}

const defineMessageTable = <TDesc extends DescMessage, TIndex extends string>(
  schema: TDesc,
  getId: (record: MessageShape<TDesc>) => string,
  indexKeys: Readonly<Record<TIndex, (record: MessageShape<TDesc>) => string>>,
): TableDefinition<MessageShape<TDesc>, TIndex> => ({
  clone: record => clone(schema, record),
  decode: (stored) => {
    if (!(stored instanceof Uint8Array)) {
      throw new TypeError(`Stored ${schema.typeName} must be binary`);
    }

    return fromBinary(schema, stored);
  },
  encode: record => toBinary(schema, record),
  getId,
  indexKeys,
});

const defineRecordTable = <TRecord extends { id: string }>(
  parse: (stored: StoredRecordValue) => TRecord,
  serialize: (record: TRecord) => StoredObjectValue,
): TableDefinition<TRecord, never> => ({
  clone: record => parse(serialize(record)),
  decode: parse,
  encode: serialize,
  getId: record => record.id,
  indexKeys: {},
});

const NOTIFICATION_TABLE: TableDefinition<NotificationRecordValue, 'userId'> = {
  clone: record => parseNotificationRecord(serializeNotificationRecord(record)),
  decode: parseNotificationRecord,
  encode: serializeNotificationRecord,
  getId: record => record.notification.id,
  indexKeys: { userId: record => record.userId },
};

export const TABLE_DEFINITIONS: TableDefinitionsValue = {
  cities: defineMessageTable(CitySchema, city => city.id, {}),
  idempotency: defineRecordTable(parseIdempotencyRecord, serializeIdempotencyRecord),
  mapNodes: defineMessageTable(MapNodeSchema, node => node.id, {}),
  memberships: defineMessageTable(MembershipSchema, membership => membership.id, {
    organizationId: membership => membership.organizationId,
    userId: membership => membership.userId,
  }),
  notifications: NOTIFICATION_TABLE,
  organizations: defineMessageTable(OrganizationSchema, organization => organization.id, {}),
  organizationSettings: defineMessageTable(OrganizationSettingsSchema, settings => settings.organizationId, {}),
  personas: defineRecordTable(parseDemoPersona, serializeDemoPersona),
  roles: defineMessageTable(RoleSchema, role => role.id, { tenantId: role => role.tenantId }),
  routeLegs: defineMessageTable(RouteLegSchema, leg => leg.id, {}),
  spheres: defineMessageTable(SphereSchema, sphere => sphere.id, {}),
  supportAccessSessions: defineMessageTable(SupportAccessSessionSchema, session => session.id, {
    organizationId: session => session.organizationId,
    staffUserId: session => session.staffUserId,
  }),
  users: defineMessageTable(UserSchema, user => user.id, {}),
  warehouses: defineMessageTable(WarehouseSchema, warehouse => warehouse.id, { tenantId: warehouse => warehouse.tenantId }),
};
