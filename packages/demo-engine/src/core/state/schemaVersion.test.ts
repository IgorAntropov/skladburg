import { create } from '@bufbuild/protobuf';
import {
  ListingPriceSchema,
  ListingSchema,
  PriceListSchema,
  ProductSchema,
  SalesTermsSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  DealSchema,
  SupplyContractSchema,
} from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentNumberSequenceSchema,
  DocumentSchema,
} from '@skladburg/contracts/document/v1/document';
import {
  ImportJobSchema,
  ImportRowSchema,
} from '@skladburg/contracts/import/v1/import';
import {
  TransportOfferSchema,
  TransportRequestRecordSchema,
} from '@skladburg/contracts/logistics/v1/logistics_records';
import { TripRecordSchema } from '@skladburg/contracts/logistics/v1/trip_records';
import { NotificationSchema } from '@skladburg/contracts/notification/v1/notification';
import { OrganizationRequisitesSchema } from '@skladburg/contracts/organization/v1/requisites';
import { SafeDealPaymentRecordSchema } from '@skladburg/contracts/payment/v1/payment';
import {
  SupportAccessSessionSchema,
  SupportAuditEntrySchema,
} from '@skladburg/contracts/support/v1/support_access';
import {
  SupportTicketMessageSchema,
  SupportTicketSchema,
} from '@skladburg/contracts/support/v1/support_ticket';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { EngineSnapshotValue } from '../ports/index';
import type { SchedulerTaskValue } from '../scheduler/index';

import { createEngineWithTasks } from '../engine/createEngine';
import {
  createEngineCaller,
  createFakeRealTime,
  createSpyStorage,
  createWarehouseRequest,
} from '../engine/testing/engineHarness';
import { ENGINE_COLLECTION_NAMES } from '../ports/index';
import {
  createSeedSnapshot,
  SeedOrganizationId,
  SeedUserId,
} from '../seed/index';
import { createEmptySnapshot } from './emptySnapshot';
import {
  DemoPersonaGroup,
  DemoPersonaKind,
} from './records';
import {
  ENGINE_SCHEMA_VERSION,
  isCurrentSnapshot,
} from './schemaVersion';

const SHAPE_FINGERPRINTS: Readonly<Record<number, readonly string[]>> = {
  1: [
    'collection.boardNodes:bytes',
    'collection.cities:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.memberships:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{id:string,kind:string,organizationId:string,userId:string}',
    'collection.roles:bytes',
    'collection.spheres:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  2: [
    'collection.boardNodes:bytes',
    'collection.cities:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.memberships:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{id:string,kind:string,organizationId:string,userId:string}',
    'collection.roles:bytes',
    'collection.spheres:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  3: [
    'collection.boardNodes:bytes',
    'collection.cities:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.memberships:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.roles:bytes',
    'collection.spheres:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  4: [
    'collection.cities:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.roles:bytes',
    'collection.spheres:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  5: [
    'collection.cities:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.spheres:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  6: [
    'collection.cities:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.spheres:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  7: [
    'collection.cities:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.spheres:bytes',
    'collection.supportAccessSessions:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  8: [
    'collection.cities:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.spheres:bytes',
    'collection.supportAccessSessions:bytes',
    'collection.supportBotQueue:{dueAtMs:number,id:string}',
    'collection.supportTicketMessages:bytes',
    'collection.supportTickets:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  9: [
    'collection.cities:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.spheres:bytes',
    'collection.supportAccessSessions:bytes',
    'collection.supportAuditEntries:bytes',
    'collection.supportBotQueue:{dueAtMs:number,id:string}',
    'collection.supportTicketMessages:bytes',
    'collection.supportTickets:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  10: [
    'collection.cities:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationRequisites:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.spheres:bytes',
    'collection.supportAccessSessions:bytes',
    'collection.supportAuditEntries:bytes',
    'collection.supportBotQueue:{dueAtMs:number,id:string}',
    'collection.supportTicketMessages:bytes',
    'collection.supportTickets:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  11: [
    'collection.cities:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.listingPrices:bytes',
    'collection.listings:bytes',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationRequisites:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.priceLists:bytes',
    'collection.products:bytes',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.salesTerms:bytes',
    'collection.spheres:bytes',
    'collection.supportAccessSessions:bytes',
    'collection.supportAuditEntries:bytes',
    'collection.supportBotQueue:{dueAtMs:number,id:string}',
    'collection.supportTicketMessages:bytes',
    'collection.supportTickets:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  12: [
    'collection.cities:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.importJobs:{columns:{0:string},createdPriceListId:string,createdPriceListVersion:bigint,id:string,'
    + 'jobBytes:bytes,provenance:{0:{listingId:string,listingVersion:bigint,priceVersion:bigint,productId:string,'
    + 'productVersion:bigint}},rowBytes:{0:bytes},usedListingIds:{0:string}}',
    'collection.listingPrices:bytes',
    'collection.listings:bytes',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationRequisites:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.priceLists:bytes',
    'collection.products:bytes',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.salesTerms:bytes',
    'collection.spheres:bytes',
    'collection.supportAccessSessions:bytes',
    'collection.supportAuditEntries:bytes',
    'collection.supportBotQueue:{dueAtMs:number,id:string}',
    'collection.supportTicketMessages:bytes',
    'collection.supportTickets:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  13: [
    'collection.cities:bytes',
    'collection.dealReminderMarks:{confirmationDueAtMs:number,counterOfferDueAtMs:number,id:string}',
    'collection.deals:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.importJobs:{columns:{0:string},createdPriceListId:string,createdPriceListVersion:bigint,id:string,'
    + 'jobBytes:bytes,provenance:{0:{listingId:string,listingVersion:bigint,priceVersion:bigint,productId:string,'
    + 'productVersion:bigint}},rowBytes:{0:bytes},usedListingIds:{0:string}}',
    'collection.listingPrices:bytes',
    'collection.listings:bytes',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationRequisites:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.priceLists:bytes',
    'collection.productLinks:{customerOrganizationId:string,customerProductId:string,id:string,isCreatedFromDeal:boolean,'
    + 'supplierOrganizationId:string,supplierProductId:string}',
    'collection.products:bytes',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.salesTerms:bytes',
    'collection.spheres:bytes',
    'collection.supplyContracts:bytes',
    'collection.supportAccessSessions:bytes',
    'collection.supportAuditEntries:bytes',
    'collection.supportBotQueue:{dueAtMs:number,id:string}',
    'collection.supportTicketMessages:bytes',
    'collection.supportTickets:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  14: [
    'collection.cities:bytes',
    'collection.dealReminderMarks:{confirmationDueAtMs:number,counterOfferDueAtMs:number,id:string}',
    'collection.deals:bytes',
    'collection.documentNumbers:bytes',
    'collection.documents:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.importJobs:{columns:{0:string},createdPriceListId:string,createdPriceListVersion:bigint,id:string,'
    + 'jobBytes:bytes,provenance:{0:{listingId:string,listingVersion:bigint,priceVersion:bigint,productId:string,'
    + 'productVersion:bigint}},rowBytes:{0:bytes},usedListingIds:{0:string}}',
    'collection.listingPrices:bytes',
    'collection.listings:bytes',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationRequisites:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.priceLists:bytes',
    'collection.productLinks:{customerOrganizationId:string,customerProductId:string,id:string,isCreatedFromDeal:boolean,'
    + 'supplierOrganizationId:string,supplierProductId:string}',
    'collection.products:bytes',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.salesTerms:bytes',
    'collection.spheres:bytes',
    'collection.supplyContracts:bytes',
    'collection.supportAccessSessions:bytes',
    'collection.supportAuditEntries:bytes',
    'collection.supportBotQueue:{dueAtMs:number,id:string}',
    'collection.supportTicketMessages:bytes',
    'collection.supportTickets:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],

  15: [
    'collection.cities:bytes',
    'collection.dealReminderMarks:{confirmationDueAtMs:number,counterOfferDueAtMs:number,id:string}',
    'collection.deals:bytes',
    'collection.documentNumbers:bytes',
    'collection.documents:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.importJobs:{columns:{0:string},createdPriceListId:string,createdPriceListVersion:bigint,id:string,'
    + 'jobBytes:bytes,provenance:{0:{listingId:string,listingVersion:bigint,priceVersion:bigint,productId:string,'
    + 'productVersion:bigint}},rowBytes:{0:bytes},usedListingIds:{0:string}}',
    'collection.listingPrices:bytes',
    'collection.listings:bytes',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationRequisites:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.payments:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.priceLists:bytes',
    'collection.productLinks:{customerOrganizationId:string,customerProductId:string,id:string,isCreatedFromDeal:boolean,'
    + 'supplierOrganizationId:string,supplierProductId:string}',
    'collection.products:bytes',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.salesTerms:bytes',
    'collection.spheres:bytes',
    'collection.supplyContracts:bytes',
    'collection.supportAccessSessions:bytes',
    'collection.supportAuditEntries:bytes',
    'collection.supportBotQueue:{dueAtMs:number,id:string}',
    'collection.supportTicketMessages:bytes',
    'collection.supportTickets:bytes',
    'collection.users:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],

  16: [
    'collection.carrierLanes:bytes',
    'collection.cities:bytes',
    'collection.dealReminderMarks:{confirmationDueAtMs:number,counterOfferDueAtMs:number,id:string}',
    'collection.deals:bytes',
    'collection.documentNumbers:bytes',
    'collection.documents:bytes',
    'collection.drivers:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.importJobs:{columns:{0:string},createdPriceListId:string,createdPriceListVersion:bigint,id:string,'
    + 'jobBytes:bytes,provenance:{0:{listingId:string,listingVersion:bigint,priceVersion:bigint,productId:string,'
    + 'productVersion:bigint}},rowBytes:{0:bytes},usedListingIds:{0:string}}',
    'collection.listingPrices:bytes',
    'collection.listings:bytes',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationRequisites:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.payments:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.priceLists:bytes',
    'collection.productLinks:{customerOrganizationId:string,customerProductId:string,id:string,isCreatedFromDeal:boolean,'
    + 'supplierOrganizationId:string,supplierProductId:string}',
    'collection.products:bytes',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.salesTerms:bytes',
    'collection.spheres:bytes',
    'collection.supplyContracts:bytes',
    'collection.supportAccessSessions:bytes',
    'collection.supportAuditEntries:bytes',
    'collection.supportBotQueue:{dueAtMs:number,id:string}',
    'collection.supportTicketMessages:bytes',
    'collection.supportTickets:bytes',
    'collection.users:bytes',
    'collection.vehicles:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  17: [
    'collection.carrierLanes:bytes',
    'collection.cities:bytes',
    'collection.dealReminderMarks:{confirmationDueAtMs:number,counterOfferDueAtMs:number,id:string}',
    'collection.deals:bytes',
    'collection.documentNumbers:bytes',
    'collection.documents:bytes',
    'collection.drivers:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.importJobs:{columns:{0:string},createdPriceListId:string,createdPriceListVersion:bigint,id:string,'
    + 'jobBytes:bytes,provenance:{0:{listingId:string,listingVersion:bigint,priceVersion:bigint,productId:string,'
    + 'productVersion:bigint}},rowBytes:{0:bytes},usedListingIds:{0:string}}',
    'collection.listingPrices:bytes',
    'collection.listings:bytes',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationRequisites:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.payments:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.priceLists:bytes',
    'collection.productLinks:{customerOrganizationId:string,customerProductId:string,id:string,isCreatedFromDeal:boolean,'
    + 'supplierOrganizationId:string,supplierProductId:string}',
    'collection.products:bytes',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.salesTerms:bytes',
    'collection.spheres:bytes',
    'collection.supplyContracts:bytes',
    'collection.supportAccessSessions:bytes',
    'collection.supportAuditEntries:bytes',
    'collection.supportBotQueue:{dueAtMs:number,id:string}',
    'collection.supportTicketMessages:bytes',
    'collection.supportTickets:bytes',
    'collection.transportOffers:bytes',
    'collection.transportRequests:bytes',
    'collection.users:bytes',
    'collection.vehicles:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  18: [
    'collection.carrierLanes:bytes',
    'collection.cities:bytes',
    'collection.dealReminderMarks:{confirmationDueAtMs:number,counterOfferDueAtMs:number,id:string}',
    'collection.deals:bytes',
    'collection.documentNumbers:bytes',
    'collection.documents:bytes',
    'collection.drivers:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.importJobs:{columns:{0:string},createdPriceListId:string,createdPriceListVersion:bigint,id:string,'
    + 'jobBytes:bytes,provenance:{0:{listingId:string,listingVersion:bigint,priceVersion:bigint,productId:string,'
    + 'productVersion:bigint}},rowBytes:{0:bytes},usedListingIds:{0:string}}',
    'collection.listingPrices:bytes',
    'collection.listings:bytes',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationRequisites:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.payments:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.priceLists:bytes',
    'collection.productLinks:{customerOrganizationId:string,customerProductId:string,id:string,isCreatedFromDeal:boolean,'
    + 'supplierOrganizationId:string,supplierProductId:string}',
    'collection.products:bytes',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.salesTerms:bytes',
    'collection.spheres:bytes',
    'collection.supplyContracts:bytes',
    'collection.supportAccessSessions:bytes',
    'collection.supportAuditEntries:bytes',
    'collection.supportBotQueue:{dueAtMs:number,id:string}',
    'collection.supportTicketMessages:bytes',
    'collection.supportTickets:bytes',
    'collection.transportOffers:bytes',
    'collection.transportRequests:bytes',
    'collection.trips:bytes',
    'collection.users:bytes',
    'collection.vehicles:bytes',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  19: [
    'collection.carrierLanes:bytes',
    'collection.cities:bytes',
    'collection.dealReminderMarks:{confirmationDueAtMs:number,counterOfferDueAtMs:number,id:string}',
    'collection.deals:bytes',
    'collection.documentNumbers:bytes',
    'collection.documents:bytes',
    'collection.drivers:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.importJobs:{columns:{0:string},createdPriceListId:string,createdPriceListVersion:bigint,id:string,'
    + 'jobBytes:bytes,provenance:{0:{listingId:string,listingVersion:bigint,priceVersion:bigint,productId:string,'
    + 'productVersion:bigint}},rowBytes:{0:bytes},usedListingIds:{0:string}}',
    'collection.listingPrices:bytes',
    'collection.listings:bytes',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationRequisites:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.payments:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.priceLists:bytes',
    'collection.productLinks:{customerOrganizationId:string,customerProductId:string,id:string,isCreatedFromDeal:boolean,'
    + 'supplierOrganizationId:string,supplierProductId:string}',
    'collection.products:bytes',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.salesTerms:bytes',
    'collection.spheres:bytes',
    'collection.supplyContracts:bytes',
    'collection.supportAccessSessions:bytes',
    'collection.supportAuditEntries:bytes',
    'collection.supportBotQueue:{dueAtMs:number,id:string}',
    'collection.supportTicketMessages:bytes',
    'collection.supportTickets:bytes',
    'collection.transportOffers:bytes',
    'collection.transportRequests:bytes',
    'collection.trips:bytes',
    'collection.users:bytes',
    'collection.vehicles:bytes',
    'collection.warehouseTopologies:{id:string,topologyBytes:bytes}',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
  20: [
    'collection.carrierLanes:bytes',
    'collection.cities:bytes',
    'collection.dealReminderMarks:{confirmationDueAtMs:number,counterOfferDueAtMs:number,id:string}',
    'collection.deals:bytes',
    'collection.documentNumbers:bytes',
    'collection.documents:bytes',
    'collection.drivers:bytes',
    'collection.idempotency:{id:string,method:string,requestBytes:bytes,responseBytes:bytes}',
    'collection.importJobs:{columns:{0:string},createdPriceListId:string,createdPriceListVersion:bigint,id:string,'
    + 'jobBytes:bytes,provenance:{0:{listingId:string,listingVersion:bigint,priceVersion:bigint,productId:string,'
    + 'productVersion:bigint}},rowBytes:{0:bytes},usedListingIds:{0:string}}',
    'collection.listingPrices:bytes',
    'collection.listings:bytes',
    'collection.mapNodes:bytes',
    'collection.memberships:bytes',
    'collection.notifications:{id:string,notificationBytes:bytes,userId:string}',
    'collection.organizationRequisites:bytes',
    'collection.organizationSettings:bytes',
    'collection.organizations:bytes',
    'collection.payments:bytes',
    'collection.personas:{group:string,id:string,kind:string,organizationId:string,userId:string}',
    'collection.priceLists:bytes',
    'collection.productLinks:{customerOrganizationId:string,customerProductId:string,id:string,isCreatedFromDeal:boolean,'
    + 'supplierOrganizationId:string,supplierProductId:string}',
    'collection.products:bytes',
    'collection.roles:bytes',
    'collection.routeLegs:bytes',
    'collection.salesTerms:bytes',
    'collection.spheres:bytes',
    'collection.stockBalances:{bytes:bytes,id:string,lookupKey:string,scopeId:string}',
    'collection.stockBatches:{bytes:bytes,id:string,lookupKey:string,scopeId:string}',
    'collection.stockMovements:{bytes:bytes,id:string,lookupKey:string,scopeId:string}',
    'collection.supplyContracts:bytes',
    'collection.supportAccessSessions:bytes',
    'collection.supportAuditEntries:bytes',
    'collection.supportBotQueue:{dueAtMs:number,id:string}',
    'collection.supportTicketMessages:bytes',
    'collection.supportTickets:bytes',
    'collection.transportOffers:bytes',
    'collection.transportRequests:bytes',
    'collection.trips:bytes',
    'collection.users:bytes',
    'collection.vehicles:bytes',
    'collection.warehouseTopologies:{id:string,topologyBytes:bytes}',
    'collection.warehouses:bytes',
    'meta.channelSeq:record<bigint>',
    'meta.randomState:{a:number,b:number,c:number,d:number}',
    'meta.schedulerDueAtMs:record<number>',
    'meta.seedVersion:number',
    'meta.timeScale:number',
    'meta.traceRandomState:{a:number,b:number,c:number,d:number}',
    'meta.worldTimeMs:number',
  ],
};

const isPlainRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !(value instanceof Uint8Array) && !(value instanceof Map);

const joinUnique = (shapes: readonly string[], separator: string): string =>
  shapes.length === 0 ? 'empty' : [...new Set(shapes)].sort().join(separator);

const describeShape = (value: unknown): string => {
  if (value instanceof Uint8Array) {
    return 'bytes';
  }

  if (value === null) {
    return 'null';
  }

  if (isPlainRecord(value)) {
    const fields = Object.keys(value).sort().map(key => `${key}:${describeShape(value[key])}`);

    return `{${fields.join(',')}}`;
  }

  return typeof value;
};

const describeKeyedRecord = (value: unknown): string =>
  isPlainRecord(value) ? `record<${joinUnique(Object.values(value).map(describeShape), '|')}>` : describeShape(value);

const KEYED_META_FIELDS: ReadonlySet<string> = new Set(['channelSeq', 'schedulerDueAtMs']);

const describeSnapshotShape = (snapshot: EngineSnapshotValue): string[] => {
  const collections = [...ENGINE_COLLECTION_NAMES].sort().map((name) => {
    const records = [...snapshot.collections[name].values()];

    return `collection.${name}:${joinUnique(records.map(describeShape), '|')}`;
  });
  const meta = Object.keys(snapshot.meta).sort().map((key) => {
    const value: unknown = Reflect.get(snapshot.meta, key);

    return `meta.${key}:${KEYED_META_FIELDS.has(key) ? describeKeyedRecord(value) : describeShape(value)}`;
  });

  return [...collections, ...meta];
};

const populatedTask: SchedulerTaskValue = {
  id: 'fingerprint-task',
  intervalMs: 1_000,
  run: (transaction) => {
    transaction.put('notifications', {
      notification: create(NotificationSchema, { id: 'fingerprint-notification' }),
      userId: SeedUserId.ADMIN_1,
    });
    transaction.put('personas', {
      group: DemoPersonaGroup.FRESH,
      id: 'fingerprint-persona',
      kind: DemoPersonaKind.CUSTOMER,
      organizationId: SeedOrganizationId.CUSTOMER_1,
      userId: SeedUserId.ADMIN_1,
    });
    transaction.put('organizationRequisites', create(OrganizationRequisitesSchema, { organizationId: 'fingerprint-organization' }));
    transaction.put('supportAccessSessions', create(SupportAccessSessionSchema, { id: 'fingerprint-session' }));
    transaction.put('supportAuditEntries', create(SupportAuditEntrySchema, { id: 'fingerprint-audit-entry' }));
    transaction.put('supportTickets', create(SupportTicketSchema, { id: 'fingerprint-ticket' }));
    transaction.put('supportTicketMessages', create(SupportTicketMessageSchema, {
      id: 'fingerprint-message',
      ticketId: 'fingerprint-ticket',
    }));
    transaction.put('supportBotQueue', { dueAtMs: 1, id: 'fingerprint-ticket' });
    transaction.put('importJobs', {
      columns: ['name'], createdPriceListId: 'fingerprint-list', createdPriceListVersion: 1n,
      id: 'fingerprint-import', job: create(ImportJobSchema, { id: 'fingerprint-import' }),
      provenance: [{ listingId: 'listing', listingVersion: 1n, priceVersion: 1n, productId: 'product', productVersion: 1n }],
      rows: [create(ImportRowSchema, { rowNumber: 2 })], usedListingIds: ['listing'],
    });
    transaction.put('deals', create(DealSchema, { id: 'fingerprint-deal' }));
    transaction.put('payments', create(SafeDealPaymentRecordSchema, { id: 'fingerprint-payment' }));
    transaction.put('documents', create(DocumentSchema, { id: 'fingerprint-document' }));
    transaction.put('documentNumbers', create(DocumentNumberSequenceSchema, { id: 'fingerprint-sequence' }));
    transaction.put('supplyContracts', create(SupplyContractSchema, { id: 'fingerprint-contract' }));
    transaction.put('productLinks',
      { customerOrganizationId: 'customer',
        customerProductId: 'product',
        id: 'fingerprint-link',
        isCreatedFromDeal: true,
        supplierOrganizationId: 'supplier',
        supplierProductId: 'source' });
    transaction.put('dealReminderMarks', { confirmationDueAtMs: 1, counterOfferDueAtMs: 2, id: 'fingerprint-deal' });
    transaction.put('products', create(ProductSchema, { id: 'fingerprint-product' }));
    transaction.put('listings', create(ListingSchema, { id: 'fingerprint-listing' }));
    transaction.put('listingPrices', create(ListingPriceSchema, { listingId: 'fingerprint-listing' }));
    transaction.put('priceLists', create(PriceListSchema, { id: 'fingerprint-price-list' }));
    transaction.put('salesTerms', create(SalesTermsSchema, { organizationId: 'fingerprint-organization' }));
    transaction.put('transportOffers', create(TransportOfferSchema, {
      id: 'fingerprint-offer',
      transportRequestId: 'fingerprint-request',
    }));
    transaction.put('transportRequests', create(TransportRequestRecordSchema, { dealId: 'fingerprint-deal', id: 'fingerprint-request' }));
    transaction.put('trips', create(TripRecordSchema, { dealId: 'fingerprint-deal', id: 'fingerprint-request' }));
    const stockRecord = { bytes: Uint8Array.of(), id: 'fingerprint-stock', lookupKey: 'lookup', scopeId: 'scope' };
    transaction.put('stockBalances', stockRecord);
    transaction.put('stockBatches', stockRecord);
    transaction.put('stockMovements', stockRecord);
  },
};

const createPopulatedSnapshot = async (): Promise<EngineSnapshotValue> => {
  const realTime = createFakeRealTime(0);
  const storage = createSpyStorage();
  const engine = await createEngineWithTasks({ epoch: 'e', realTime, storage }, () => [populatedTask]);
  const caller = createEngineCaller(engine);

  await caller.organization.createWarehouse(
    createWarehouseRequest('3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153'),
    caller.options(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
  );
  realTime.advance(1_000);
  await engine.tick();

  const snapshot = await storage.load();

  if (snapshot === undefined) {
    throw new Error('Expected a stored snapshot');
  }

  return snapshot;
};

describe('snapshot shape', () => {
  it('has a fingerprint recorded for every schema version up to the current one', () => {
    const versions = Object.keys(SHAPE_FINGERPRINTS).map(Number).sort((current, next) => current - next);

    expect(versions).toEqual(Array.from({ length: ENGINE_SCHEMA_VERSION }, (_, index) => index + 1));
  });

  it('matches the fingerprint of the current schema version, so a changed shape needs a new version', async () => {
    expect(describeSnapshotShape(await createPopulatedSnapshot())).toEqual(SHAPE_FINGERPRINTS[ENGINE_SCHEMA_VERSION]);
  });

  it('differs from the fingerprints of all earlier schema versions', () => {
    const earlier = Object.entries(SHAPE_FINGERPRINTS)
      .filter(([version]) => Number(version) < ENGINE_SCHEMA_VERSION)
      .map(([, fingerprint]) => fingerprint.join('\n'));

    expect(earlier.length).toBeGreaterThan(0);
    expect(earlier).not.toContain(SHAPE_FINGERPRINTS[ENGINE_SCHEMA_VERSION]?.join('\n'));
    expect(new Set(earlier).size).toBe(earlier.length);
  });

  it('keeps the same collections and meta keys in the starting snapshot as in the populated one', async () => {
    const populated = await createPopulatedSnapshot();
    const seed = createSeedSnapshot();

    expect(Object.keys(seed.collections).sort()).toEqual(Object.keys(populated.collections).sort());
    expect(Object.keys(seed.collections).sort()).toEqual([...ENGINE_COLLECTION_NAMES].sort());
    expect(Object.keys(seed.meta).sort()).toEqual(Object.keys(populated.meta).sort());
  });
});

describe('schema version of a snapshot', () => {
  it('accepts the current version and rejects the first one', () => {
    const empty = createEmptySnapshot();

    expect(isCurrentSnapshot({ ...empty, schemaVersion: ENGINE_SCHEMA_VERSION }, empty.meta.seedVersion)).toBe(true);
    expect(isCurrentSnapshot({ ...empty, schemaVersion: 1 }, empty.meta.seedVersion)).toBe(false);
  });

  it('is version 20 since warehouse stock records joined', () => {
    expect(ENGINE_SCHEMA_VERSION).toBe(20);
    expect(createSeedSnapshot().meta.schedulerDueAtMs).toEqual({});
  });
});
