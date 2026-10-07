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
  BoardNode,
  City,
} from '@skladburg/contracts/network/v1/network';
import type {
  Organization,
  OrganizationSettings,
  Sphere,
  Warehouse,
} from '@skladburg/contracts/organization/v1/organization';

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
  BoardNodeSchema,
  CitySchema,
} from '@skladburg/contracts/network/v1/network';
import {
  OrganizationSchema,
  OrganizationSettingsSchema,
  SphereSchema,
  WarehouseSchema,
} from '@skladburg/contracts/organization/v1/organization';

import type {
  EngineCollectionName,
  StoredObjectValue,
  StoredRecordValue,
} from '../ports/index';
import type {
  DemoPersonaValue,
  IdempotencyRecordValue,
} from './records';

import {
  parseDemoPersona,
  parseIdempotencyRecord,
  serializeDemoPersona,
  serializeIdempotencyRecord,
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
  boardNodes: never;
  cities: never;
  idempotency: never;
  memberships: 'organizationId' | 'userId';
  organizations: never;
  organizationSettings: never;
  personas: never;
  roles: 'tenantId';
  spheres: never;
  users: never;
  warehouses: 'tenantId';
}

export type TableName = EngineCollectionName;

export interface TableRecordsValue {
  boardNodes: BoardNode;
  cities: City;
  idempotency: IdempotencyRecordValue;
  memberships: Membership;
  organizations: Organization;
  organizationSettings: OrganizationSettings;
  personas: DemoPersonaValue;
  roles: Role;
  spheres: Sphere;
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

export const TABLE_DEFINITIONS: TableDefinitionsValue = {
  boardNodes: defineMessageTable(BoardNodeSchema, node => node.id, {}),
  cities: defineMessageTable(CitySchema, city => city.id, {}),
  idempotency: defineRecordTable(parseIdempotencyRecord, serializeIdempotencyRecord),
  memberships: defineMessageTable(MembershipSchema, membership => membership.id, {
    organizationId: membership => membership.organizationId,
    userId: membership => membership.userId,
  }),
  organizations: defineMessageTable(OrganizationSchema, organization => organization.id, {}),
  organizationSettings: defineMessageTable(OrganizationSettingsSchema, settings => settings.organizationId, {}),
  personas: defineRecordTable(parseDemoPersona, serializeDemoPersona),
  roles: defineMessageTable(RoleSchema, role => role.id, { tenantId: role => role.tenantId }),
  spheres: defineMessageTable(SphereSchema, sphere => sphere.id, {}),
  users: defineMessageTable(UserSchema, user => user.id, {}),
  warehouses: defineMessageTable(WarehouseSchema, warehouse => warehouse.id, { tenantId: warehouse => warehouse.tenantId }),
};
