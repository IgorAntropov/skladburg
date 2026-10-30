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
  Listing,
  ListingPrice,
  PriceList,
  Product,
  SalesTerms,
} from '@skladburg/contracts/catalog/v1/catalog';
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
import type { OrganizationRequisites } from '@skladburg/contracts/organization/v1/requisites';
import type {
  SupportAccessSession,
  SupportAuditEntry,
} from '@skladburg/contracts/support/v1/support_access';
import type {
  SupportTicket,
  SupportTicketMessage,
} from '@skladburg/contracts/support/v1/support_ticket';

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
  ListingPriceSchema,
  ListingSchema,
  PriceListSchema,
  ProductSchema,
  SalesTermsSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
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
import { OrganizationRequisitesSchema } from '@skladburg/contracts/organization/v1/requisites';
import {
  SupportAccessSessionSchema,
  SupportAuditEntrySchema,
} from '@skladburg/contracts/support/v1/support_access';
import {
  SupportTicketMessageSchema,
  SupportTicketSchema,
} from '@skladburg/contracts/support/v1/support_ticket';

import type {
  EngineCollectionName,
  StoredObjectValue,
  StoredRecordValue,
} from '../ports/index';
import type {
  DemoPersonaValue,
  IdempotencyRecordValue,
  NotificationRecordValue,
  SupportBotQueueRecordValue,
} from './records';

import {
  parseDemoPersona,
  parseIdempotencyRecord,
  parseNotificationRecord,
  parseSupportBotQueueRecord,
  serializeDemoPersona,
  serializeIdempotencyRecord,
  serializeNotificationRecord,
  serializeSupportBotQueueRecord,
} from './records';

export const ListingPublication = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;

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
  listingPrices: 'tenantId';
  listings: 'publication' | 'tenantId';
  mapNodes: never;
  memberships: 'organizationId' | 'userId';
  notifications: 'userId';
  organizationRequisites: never;
  organizations: never;
  organizationSettings: never;
  personas: never;
  priceLists: 'tenantId';
  products: 'tenantId';
  roles: 'tenantId';
  routeLegs: never;
  salesTerms: never;
  spheres: never;
  supportAccessSessions: 'organizationId' | 'staffUserId';
  supportAuditEntries: 'organizationId';
  supportBotQueue: never;
  supportTicketMessages: 'ticketId';
  supportTickets: 'authorUserId';
  users: never;
  warehouses: 'tenantId';
}

export type TableName = EngineCollectionName;

export interface TableRecordsValue {
  cities: City;
  idempotency: IdempotencyRecordValue;
  listingPrices: ListingPrice;
  listings: Listing;
  mapNodes: MapNode;
  memberships: Membership;
  notifications: NotificationRecordValue;
  organizationRequisites: OrganizationRequisites;
  organizations: Organization;
  organizationSettings: OrganizationSettings;
  personas: DemoPersonaValue;
  priceLists: PriceList;
  products: Product;
  roles: Role;
  routeLegs: RouteLeg;
  salesTerms: SalesTerms;
  spheres: Sphere;
  supportAccessSessions: SupportAccessSession;
  supportAuditEntries: SupportAuditEntry;
  supportBotQueue: SupportBotQueueRecordValue;
  supportTicketMessages: SupportTicketMessage;
  supportTickets: SupportTicket;
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
  listingPrices: defineMessageTable(ListingPriceSchema, price => price.listingId, { tenantId: price => price.tenantId }),
  listings: defineMessageTable(ListingSchema, listing => listing.id, {
    publication: listing => (listing.isPublished ? ListingPublication.PUBLISHED : ListingPublication.DRAFT),
    tenantId: listing => listing.tenantId,
  }),
  mapNodes: defineMessageTable(MapNodeSchema, node => node.id, {}),
  memberships: defineMessageTable(MembershipSchema, membership => membership.id, {
    organizationId: membership => membership.organizationId,
    userId: membership => membership.userId,
  }),
  notifications: NOTIFICATION_TABLE,
  organizationRequisites: defineMessageTable(OrganizationRequisitesSchema, requisites => requisites.organizationId, {}),
  organizations: defineMessageTable(OrganizationSchema, organization => organization.id, {}),
  organizationSettings: defineMessageTable(OrganizationSettingsSchema, settings => settings.organizationId, {}),
  personas: defineRecordTable(parseDemoPersona, serializeDemoPersona),
  priceLists: defineMessageTable(PriceListSchema, priceList => priceList.id, { tenantId: priceList => priceList.tenantId }),
  products: defineMessageTable(ProductSchema, product => product.id, { tenantId: product => product.tenantId }),
  roles: defineMessageTable(RoleSchema, role => role.id, { tenantId: role => role.tenantId }),
  routeLegs: defineMessageTable(RouteLegSchema, leg => leg.id, {}),
  salesTerms: defineMessageTable(SalesTermsSchema, terms => terms.organizationId, {}),
  spheres: defineMessageTable(SphereSchema, sphere => sphere.id, {}),
  supportAccessSessions: defineMessageTable(SupportAccessSessionSchema, session => session.id, {
    organizationId: session => session.organizationId,
    staffUserId: session => session.staffUserId,
  }),
  supportAuditEntries: defineMessageTable(SupportAuditEntrySchema, entry => entry.id, {
    organizationId: entry => entry.organizationId,
  }),
  supportBotQueue: defineRecordTable(parseSupportBotQueueRecord, serializeSupportBotQueueRecord),
  supportTicketMessages: defineMessageTable(SupportTicketMessageSchema, message => message.id, {
    ticketId: message => message.ticketId,
  }),
  supportTickets: defineMessageTable(SupportTicketSchema, ticket => ticket.id, {
    authorUserId: ticket => ticket.authorUserId,
  }),
  users: defineMessageTable(UserSchema, user => user.id, {}),
  warehouses: defineMessageTable(WarehouseSchema, warehouse => warehouse.id, { tenantId: warehouse => warehouse.tenantId }),
};
