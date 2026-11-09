import type {
  DescMessage,
  DescMethodUnary,
  MessageInitShape,
  MessageShape,
} from '@bufbuild/protobuf';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import { RoleAssignmentSchema } from '@skladburg/contracts/access/v1/access';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import {
  DealService,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  type Document,
  DocumentService,
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import { PaymentService } from '@skladburg/contracts/payment/v1/payment';
import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';

import type { CalendarDateValue } from '../calendar/index';
import type { IDemoEngine } from '../engine/engineTypes';
import type {
  EngineSnapshotValue,
  IEngineStorage,
  IRealTimeSource,
} from '../ports/index';

import { createMemoryStorage } from '../ports/index';
import {
  DEMO_USER_HEADER,
  ENGINE_BASE_URL,
} from '../protocol';
import { TABLE_DEFINITIONS } from '../state/index';
import {
  SeedCityId,
  SeedMembershipId,
  SeedOrganizationId,
  SeedRoleId,
  SeedUserId,
  SeedWarehouseId,
} from './seedIds';

interface HistoryOrderValue {
  listingId: string;
  quantity: bigint;
  submittedAtMs: number;
}

interface HistoryPartyValue {
  organizationId: string;
  userId: string;
  warehouseId: string;
}

interface HistoryRouteValue {
  cityId: string;
  customer: HistoryPartyValue;
  orders: readonly HistoryOrderValue[];
  supplier: HistoryPartyValue;
}

const HISTORY_START_MS = Date.UTC(2026, 9, 5, 7);
const HISTORY_DATE: CalendarDateValue = { day: 5, month: 10, year: 2026 };

const HISTORY_ROUTES: readonly HistoryRouteValue[] = [
  {
    cityId: SeedCityId.MOSCOW,
    customer: {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      userId: SeedUserId.ADMIN_1,
      warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1,
    },
    orders: [
      { listingId: 'd1060003-0000-4000-8000-000000000000', quantity: 240_000n, submittedAtMs: HISTORY_START_MS },
      { listingId: 'd1060006-0000-4000-8000-000000000000', quantity: 320_000n, submittedAtMs: Date.UTC(2026, 9, 5, 7, 15) },
    ],
    supplier: {
      organizationId: SeedOrganizationId.SUPPLIER_6,
      userId: SeedUserId.ADMIN_10,
      warehouseId: SeedWarehouseId.SUPPLIER_6_WAREHOUSE_1,
    },
  },
  {
    cityId: SeedCityId.NOVOSIBIRSK,
    customer: {
      organizationId: SeedOrganizationId.CUSTOMER_2,
      userId: SeedUserId.ADMIN_5,
      warehouseId: SeedWarehouseId.CUSTOMER_2_SITE_2,
    },
    orders: [
      { listingId: 'd1070001-0000-4000-8000-000000000000', quantity: 6_000_000n, submittedAtMs: Date.UTC(2026, 9, 5, 7, 30) },
      { listingId: 'd1070003-0000-4000-8000-000000000000', quantity: 9_000_000n, submittedAtMs: Date.UTC(2026, 9, 5, 7, 45) },
    ],
    supplier: {
      organizationId: SeedOrganizationId.SUPPLIER_7,
      userId: SeedUserId.ADMIN_11,
      warehouseId: SeedWarehouseId.SUPPLIER_7_WAREHOUSE_1,
    },
  },
];

const partyHeaders = (party: HistoryPartyValue): Record<string, string> => ({
  [ACTING_ORGANIZATION_HEADER]: party.organizationId,
  [DEMO_USER_HEADER]: party.userId,
});

const requireSeedValue = <TValue>(value: TValue | undefined, description: string): TValue => {
  if (value === undefined) {
    throw new Error(`Missing ${description} while preparing seed deal history`);
  }
  return value;
};

export const addSeedDealHistory = async (
  snapshot: EngineSnapshotValue,
  createReplayEngine: (storage: IEngineStorage, realTime: IRealTimeSource) => Promise<IDemoEngine>,
): Promise<EngineSnapshotValue> => {
  const memberships = new Map(snapshot.collections.memberships);
  const directorRecord = requireSeedValue(memberships.get(SeedMembershipId.ADMIN_5), 'construction director');
  const director = TABLE_DEFINITIONS.memberships.decode(directorRecord);
  director.roleAssignments.push(create(RoleAssignmentSchema, { roleId: SeedRoleId.ACCOUNTANT_CUSTOMER_2 }));
  memberships.set(director.id, TABLE_DEFINITIONS.memberships.encode(director));
  const storage = createMemoryStorage({
    ...snapshot,
    collections: { ...snapshot.collections, memberships },
    meta: { ...snapshot.meta, channelSeq: {}, schedulerDueAtMs: {}, timeScale: 1, worldTimeMs: HISTORY_START_MS },
  });
  let elapsedMs = 0;
  let identifier = 0;
  const nextId = (): string => `d4000000-0000-4000-8000-${String(++identifier).padStart(12, '0')}`;
  const engine = await createReplayEngine(storage, { now: () => elapsedMs });
  const deals = DealService.method;
  const documents = DocumentService.method;
  const payments = PaymentService.method;
  const call = async <TInput extends DescMessage, TOutput extends DescMessage>(
    method: DescMethodUnary & { input: TInput; output: TOutput },
    input: MessageInitShape<TInput>,
    headers: Record<string, string>,
  ): Promise<MessageShape<TOutput>> => {
    const response = await engine.handle(new Request(`${ENGINE_BASE_URL}/${method.parent.typeName}/${method.name}`, {
      body: toBinary(method.input, create(method.input, input)),
      headers: { ...headers, 'connect-protocol-version': '1', 'content-type': 'application/proto' },
      method: 'POST',
    }));
    if (!response.ok) {
      throw new Error(`Seed deal history ${method.name} failed (${String(response.status)}): ${await response.text()}`);
    }
    return fromBinary<TOutput>(method.output, new Uint8Array(await response.arrayBuffer()));
  };

  const tickAt = async (worldTimeMs: number): Promise<void> => {
    elapsedMs = worldTimeMs - HISTORY_START_MS;
    await engine.tick();
  };

  const tickAtBankDeadline = async (dealId: string): Promise<void> => {
    const record = requireSeedValue((await storage.load())?.collections.payments.get(dealId), 'payment record');
    const dueAt = requireSeedValue(TABLE_DEFINITIONS.payments.decode(record).bankDueAt, 'bank deadline');
    await tickAt(timestampMs(dueAt));
  };

  const replayOrder = async (route: HistoryRouteValue, order: HistoryOrderValue): Promise<void> => {
    const customerHeaders = partyHeaders(route.customer);
    const supplierHeaders = partyHeaders(route.supplier);
    elapsedMs = order.submittedAtMs - HISTORY_START_MS;
    const dealId = nextId();
    const { deal: draft } = await call(deals.createDealDraft, {
      dealId,
      desiredDate: HISTORY_DATE,
      idempotencyKey: nextId(),
      lines: [{ listingId: order.listingId, quantity: order.quantity }],
      shipFromCityId: route.cityId,
      shipToWarehouseId: route.customer.warehouseId,
      supplierOrganizationId: route.supplier.organizationId,
    }, customerHeaders);
    const { deal: submitted } = await call(deals.submitDeal, {
      dealId,
      expectedVersion: requireSeedValue(draft, 'draft').version,
      goodsTotal: draft?.goodsTotal,
      idempotencyKey: nextId(),
    }, customerHeaders);
    const { deal: confirmed } = await call(deals.confirmDeal, {
      dealId,
      expectedVersion: requireSeedValue(submitted, 'submitted deal').version,
      goodsTotal: submitted?.goodsTotal,
      idempotencyKey: nextId(),
      shipFromWarehouseId: route.supplier.warehouseId,
    }, supplierHeaders);
    await call(deals.chooseDelivery, {
      dealId,
      deliveryMethod: DeliveryMethod.CUSTOMER,
      expectedVersion: requireSeedValue(confirmed, 'confirmed deal').version,
      idempotencyKey: nextId(),
    }, customerHeaders);

    const folder = await call(documents.listDealDocuments, { dealId }, supplierHeaders);
    for (const document of folder.documents) {
      if (document.status === DocumentStatus.SIGNED) {
        continue;
      }
      const sign = async (headers: Record<string, string>, expectedVersion: number): Promise<Document | undefined> => {
        const request = { dealId, documentId: document.id, expectedVersion, idempotencyKey: nextId() };
        const response = document.type === DocumentType.SUPPLY_CONTRACT
          ? await call(documents.signSupplyContract, request, headers)
          : await call(documents.signDocument, request, headers);
        return response.document;
      };
      const approved = await sign(supplierHeaders, document.version);
      await sign(customerHeaders, requireSeedValue(approved, 'approved document').version);
    }

    const invoiceTerms = folder.documents.find(document => document.type === DocumentType.INVOICE)?.content?.terms;
    const amount = requireSeedValue(invoiceTerms?.case === 'invoice' ? invoiceTerms.value.total : undefined, 'invoice total');
    const { payment } = await call(payments.getDealPayment, { dealId }, customerHeaders);
    await call(payments.fundDeal, {
      amount,
      dealId,
      expectedVersion: requireSeedValue(payment, 'issued invoice').version,
      idempotencyKey: nextId(),
    }, customerHeaders);
    await tickAtBankDeadline(dealId);
    const { deal: paid } = await call(deals.getDeal, { dealId }, supplierHeaders);
    const { deal: shipped } = await call(deals.markDealShipped, {
      dealId, expectedVersion: requireSeedValue(paid, 'paid deal').version, idempotencyKey: nextId(),
    }, supplierHeaders);
    await tickAt(timestampMs(requireSeedValue(shipped?.deadlines?.arrivalDueAt, 'arrival deadline')));
    const { deal: arrived } = await call(deals.getDeal, { dealId }, customerHeaders);
    await call(deals.acceptDeal, {
      dealId, expectedVersion: requireSeedValue(arrived, 'arrived deal').version, idempotencyKey: nextId(),
    }, customerHeaders);
    await tickAtBankDeadline(dealId);
    const { deal: closed } = await call(deals.getDeal, { dealId }, customerHeaders);
    if (closed?.status !== DealStatus.CLOSED) {
      throw new Error(`Seed deal ${dealId} did not close`);
    }
  };

  for (const route of HISTORY_ROUTES) {
    for (const order of route.orders) {
      await replayOrder(route, order);
    }
  }

  const replayed = requireSeedValue(await storage.load(), 'replayed snapshot');
  return {
    ...replayed,
    collections: {
      ...replayed.collections,
      memberships: snapshot.collections.memberships,
      notifications: snapshot.collections.notifications,
    },
    meta: { ...snapshot.meta, randomState: replayed.meta.randomState, traceRandomState: replayed.meta.traceRandomState },
  };
};
