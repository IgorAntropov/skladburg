import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import { UserSchema } from '@skladburg/contracts/access/v1/access';
import {
  ListingPriceSchema,
  ListingSchema,
  PriceListSchema,
  ProductSchema,
  SalesTermsSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
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
import {
  OrganizationRequisitesSchema,
  VatMode,
} from '@skladburg/contracts/organization/v1/requisites';
import { SupportAccessStatus } from '@skladburg/contracts/support/v1/support_access';
import {
  SupportMessageAuthorKind,
  SupportTicketCategory,
  SupportTicketMessageSchema,
  SupportTicketSchema,
} from '@skladburg/contracts/support/v1/support_ticket';
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
  parseSupportBotQueueRecord,
} from './records';
import {
  ListingPublication,
  TABLE_DEFINITIONS,
} from './tables';
import {
  createTestMembership,
  createTestSupportAccessSession,
  createTestSupportAuditEntry,
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

  it('round-trip the requisites and key them by the organization id', () => {
    const requisites = create(OrganizationRequisitesSchema, {
      bank: { bankName: 'АО «Тестовый банк»', bik: '040000501' },
      legalAddress: '000000, г. Москва, ул. Тестовая, д. 1',
      organizationId: 'org-1',
      signatories: [{ fullName: 'Тестов Тест Тестович', id: 'signatory-1', isDefault: true }],
      timeZone: 'Europe/Moscow',
      vatMode: VatMode.GENERAL,
      version: 1n,
    });

    const stored = TABLE_DEFINITIONS.organizationRequisites.encode(requisites);

    expect(TABLE_DEFINITIONS.organizationRequisites.decode(stored)).toEqual(requisites);
    expect(TABLE_DEFINITIONS.organizationRequisites.getId(requisites)).toBe('org-1');
    expect(TABLE_DEFINITIONS.organizationRequisites.indexKeys).toEqual({});
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

describe('support audit entry table', () => {
  const entry = createTestSupportAuditEntry('entry-1', 'org-1', { occurredAtMs: 5_000, sessionId: 'session-1' });

  it('round-trips an entry and keys it by the entry id and the organization', () => {
    const decoded = TABLE_DEFINITIONS.supportAuditEntries.decode(TABLE_DEFINITIONS.supportAuditEntries.encode(entry));

    expect(decoded).toEqual(entry);
    expect(TABLE_DEFINITIONS.supportAuditEntries.getId(entry)).toBe('entry-1');
    expect(TABLE_DEFINITIONS.supportAuditEntries.indexKeys.organizationId(entry)).toBe('org-1');
  });

  it('clones an entry into an independent record', () => {
    const copy = TABLE_DEFINITIONS.supportAuditEntries.clone(entry);
    copy.sessionId = 'other';

    expect(entry.sessionId).toBe('session-1');
  });
});

describe('support ticket tables', () => {
  const ticket = create(SupportTicketSchema, {
    authorUserId: 'user-1',
    category: SupportTicketCategory.MONEY,
    context: {
      appVersion: '0.1.0',
      errors: [{ code: ErrorCode.NOT_FOUND, occurredAt: { seconds: 5n }, traceId: 'trace-1' }],
      screenPath: '/map',
    },
    id: 'ticket-1',
    number: 1001,
    organizationId: 'org-1',
  });
  const message = create(SupportTicketMessageSchema, {
    authorKind: SupportMessageAuthorKind.SUPPORT,
    body: { case: 'reply', value: { traceId: 'trace-1' } },
    id: 'message-1',
    ticketId: 'ticket-1',
  });

  it('round-trips a ticket and keys it by the ticket id and the author', () => {
    const decoded = TABLE_DEFINITIONS.supportTickets.decode(TABLE_DEFINITIONS.supportTickets.encode(ticket));

    expect(decoded).toEqual(ticket);
    expect(TABLE_DEFINITIONS.supportTickets.getId(ticket)).toBe('ticket-1');
    expect(TABLE_DEFINITIONS.supportTickets.indexKeys.authorUserId(ticket)).toBe('user-1');
  });

  it('round-trips a message and keys it by the message id and the ticket', () => {
    const decoded = TABLE_DEFINITIONS.supportTicketMessages.decode(TABLE_DEFINITIONS.supportTicketMessages.encode(message));

    expect(decoded).toEqual(message);
    expect(TABLE_DEFINITIONS.supportTicketMessages.getId(message)).toBe('message-1');
    expect(TABLE_DEFINITIONS.supportTicketMessages.indexKeys.ticketId(message)).toBe('ticket-1');
  });

  it('clones a ticket into an independent record', () => {
    const copy = TABLE_DEFINITIONS.supportTickets.clone(ticket);
    copy.number = 2000;

    expect(ticket.number).toBe(1001);
  });
});

describe('support bot queue table', () => {
  const record = { dueAtMs: 1_791_784_804_000, id: 'ticket-1' };

  it('round-trips a record, keyed by the ticket id and without indexes', () => {
    const decoded = TABLE_DEFINITIONS.supportBotQueue.decode(TABLE_DEFINITIONS.supportBotQueue.encode(record));

    expect(decoded).toEqual(record);
    expect(TABLE_DEFINITIONS.supportBotQueue.getId(record)).toBe('ticket-1');
    expect(TABLE_DEFINITIONS.supportBotQueue.indexKeys).toEqual({});
  });

  it('clones into an independent record', () => {
    const copy = TABLE_DEFINITIONS.supportBotQueue.clone(record);
    copy.dueAtMs = 0;

    expect(record.dueAtMs).toBe(1_791_784_804_000);
  });

  it('rejects binary data, a missing id and a due time that is not a finite number', () => {
    expect(() => parseSupportBotQueueRecord(new Uint8Array([1]))).toThrow(TypeError);
    expect(() => parseSupportBotQueueRecord({ dueAtMs: 1 })).toThrow(TypeError);
    expect(() => parseSupportBotQueueRecord({ dueAtMs: '1', id: 'ticket-1' })).toThrow(TypeError);
    expect(() => parseSupportBotQueueRecord({ dueAtMs: Number.NaN, id: 'ticket-1' })).toThrow(TypeError);
    expect(() => parseSupportBotQueueRecord({ dueAtMs: Number.POSITIVE_INFINITY, id: 'ticket-1' })).toThrow(TypeError);
  });
});

describe('catalog tables', () => {
  it('key a product and a price list by the id and index them by the tenant', () => {
    const product = create(ProductSchema, { id: 'product-1', tenantId: 'org-1' });
    const priceList = create(PriceListSchema, { id: 'price-list-1', tenantId: 'org-2' });

    expect(TABLE_DEFINITIONS.products.getId(product)).toBe('product-1');
    expect(TABLE_DEFINITIONS.products.indexKeys.tenantId(product)).toBe('org-1');
    expect(TABLE_DEFINITIONS.products.decode(TABLE_DEFINITIONS.products.encode(product))).toEqual(product);
    expect(TABLE_DEFINITIONS.priceLists.getId(priceList)).toBe('price-list-1');
    expect(TABLE_DEFINITIONS.priceLists.indexKeys.tenantId(priceList)).toBe('org-2');
  });

  it('key a listing price by the listing and sales terms by the organization', () => {
    const price = create(ListingPriceSchema, { listingId: 'listing-1', tenantId: 'org-1' });
    const terms = create(SalesTermsSchema, { organizationId: 'org-3' });

    expect(TABLE_DEFINITIONS.listingPrices.getId(price)).toBe('listing-1');
    expect(TABLE_DEFINITIONS.listingPrices.indexKeys.tenantId(price)).toBe('org-1');
    expect(TABLE_DEFINITIONS.salesTerms.getId(terms)).toBe('org-3');
    expect(TABLE_DEFINITIONS.salesTerms.decode(TABLE_DEFINITIONS.salesTerms.encode(terms))).toEqual(terms);
  });

  it('index a listing by the tenant and by the publication state', () => {
    const draft = create(ListingSchema, { id: 'listing-1', isPublished: false, tenantId: 'org-1' });
    const published = create(ListingSchema, { id: 'listing-2', isPublished: true, tenantId: 'org-1' });

    expect(TABLE_DEFINITIONS.listings.getId(draft)).toBe('listing-1');
    expect(TABLE_DEFINITIONS.listings.indexKeys.tenantId(draft)).toBe('org-1');
    expect(TABLE_DEFINITIONS.listings.indexKeys.publication(draft)).toBe(ListingPublication.DRAFT);
    expect(TABLE_DEFINITIONS.listings.indexKeys.publication(published)).toBe(ListingPublication.PUBLISHED);
    expect(ListingPublication).toEqual({ DRAFT: 'draft', PUBLISHED: 'published' });
  });
});
