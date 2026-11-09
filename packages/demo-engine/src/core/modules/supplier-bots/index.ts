import type { DescMethodUnary } from '@bufbuild/protobuf';
import type { HandlerContext } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
  ConnectError,
  createHandlerContext,
} from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  ConfirmDealRequestSchema,
  CounterDealRequestSchema,
  type Deal,
  DealService,
  DealStatus,
  MarkDealShippedRequestSchema,
} from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentService,
  DocumentStatus,
  DocumentType,
  SignDocumentRequestSchema,
  SignSupplyContractRequestSchema,
} from '@skladburg/contracts/document/v1/document';
import { SafeDealPaymentStatus } from '@skladburg/contracts/payment/v1/payment';
import {
  ACTING_ORGANIZATION_HEADER,
  getMethodAccess,
} from '@skladburg/contracts/runtime';

import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { resolveEffectivePermissions } from '../../access/index';
import { DEMO_USER_HEADER } from '../../protocol';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../../seed/seedIds';
import { compareIds } from '../../state/index';
import { createDealService } from '../deals/index';
import {
  createDocumentService,
  readDealDocuments,
} from '../documents/index';
import { planSupplierOrder } from './supplierOrder';

const RESPONSE_DELAY_MS = 60_000;
const AUTOMATION_DISABLED = new Error('Supplier automation is disabled');
const DEMO_BOT_USERS: ReadonlyMap<string, string> = new Map([
  [SeedOrganizationId.SUPPLIER_4, SeedUserId.ADMIN_7],
  [SeedOrganizationId.SUPPLIER_6, SeedUserId.ADMIN_10],
  [SeedOrganizationId.SUPPLIER_7, SeedUserId.ADMIN_11],
]);

const isEnabled = (reader: IStateReader, organizationId: string): boolean =>
  reader.get('salesTerms', organizationId)?.isAutoConfirmEnabled === true;

const createSupplierRuntime = (runtime: IModuleRuntime, organizationId: string): IModuleRuntime => ({
  ...runtime,
  command: <TResult>(work: (transaction: IStateTransaction) => TResult): Promise<TResult> => runtime.command((transaction) => {
    if (!isEnabled(transaction, organizationId)) {
      throw AUTOMATION_DISABLED;
    }
    return work(transaction);
  }),
});

const MEMBER_ERRORS = new Set([
  ErrorCode.LIMIT_EXCEEDED,
  ErrorCode.MEMBERSHIP_REQUIRED,
  ErrorCode.PERMISSION_DENIED,
  ErrorCode.SESSION_REQUIRED,
]);

const DEAL_ERRORS = new Set([
  ErrorCode.INVALID_TRANSITION,
  ErrorCode.NOT_FOUND,
  ErrorCode.VALIDATION_FAILED,
  ErrorCode.VERSION_CONFLICT,
]);

const runSupplierAction = async (
  runtime: IModuleRuntime,
  organizationId: string,
  method: DescMethodUnary,
  userId: string | undefined,
  action: (context: HandlerContext) => unknown,
): Promise<void> => {
  const requirement = getMethodAccess(method)?.requirement;
  if (requirement?.case !== 'permission') {
    throw runtime.errors.internal();
  }

  const memberships = runtime.read.listBy('memberships', 'organizationId', organizationId)
    .sort((current, prev) => compareIds(current.userId, prev.userId));
  for (const membership of memberships) {
    const isActor = userId === undefined || membership.userId === userId;
    const hasPermission = isActor && runtime.read.get('users', membership.userId) !== undefined
      && resolveEffectivePermissions(runtime.read, membership)
        .some(permission => permission.isOrganizationWide && permission.permission === requirement.value.name);
    if (!hasPermission) {
      continue;
    }

    const context = createHandlerContext({
      method,
      protocolName: 'connect',
      requestHeader: {
        [ACTING_ORGANIZATION_HEADER]: organizationId,
        [DEMO_USER_HEADER]: membership.userId,
      },
      requestMethod: 'POST',
      service: method.parent,
      url: method.name,
    });

    try {
      await action(context);
      return;
    }
    catch (error) {
      const [detail] = error instanceof ConnectError ? error.findDetails(ErrorDetailSchema) : [];
      if (error === AUTOMATION_DISABLED || (detail !== undefined && DEAL_ERRORS.has(detail.code))) {
        return;
      }
      if (detail === undefined || !MEMBER_ERRORS.has(detail.code)) {
        throw error;
      }
    }
    finally {
      context.abort();
    }
  }
};

const respondToOrder = async (runtime: IModuleRuntime, deal: Deal): Promise<void> => {
  if (deal.updatedAt === undefined || runtime.getWorldTimeMs() - timestampMs(deal.updatedAt) < RESPONSE_DELAY_MS) {
    return;
  }
  const plan = planSupplierOrder(runtime.read, deal);
  if (plan === undefined) {
    return;
  }

  const service = createDealService(runtime);
  const request = {
    dealId: deal.id,
    expectedVersion: deal.version,
    shipFromWarehouseId: plan.warehouseId,
  };
  if (plan.kind === 'confirm') {
    await runSupplierAction(runtime, deal.supplierOrganizationId, DealService.method.confirmDeal, undefined, context =>
      service.confirmDeal(create(ConfirmDealRequestSchema, {
        ...request,
        goodsTotal: deal.goodsTotal,
        idempotencyKey: runtime.random.uuid(),
      }), context));
  }
  else {
    await runSupplierAction(runtime, deal.supplierOrganizationId, DealService.method.counterDeal, undefined, context =>
      service.counterDeal(create(CounterDealRequestSchema, {
        ...request,
        desiredDate: deal.desiredDate,
        idempotencyKey: runtime.random.uuid(),
        lines: plan.lines,
      }), context));
  }
};

const signDocuments = async (runtime: IModuleRuntime, deal: Deal, userId: string): Promise<void> => {
  const { supplierOrganizationId } = deal;
  const service = createDocumentService(runtime);
  for (const { id } of readDealDocuments(runtime.read, deal)) {
    const current = runtime.read.get('deals', deal.id);
    if (current?.status !== DealStatus.LOGISTICS_CHOSEN || !isEnabled(runtime.read, supplierOrganizationId)) {
      return;
    }
    const document = runtime.read.get('documents', id);
    if (document?.status !== DocumentStatus.DRAFT || document.issuerOrganizationId !== supplierOrganizationId) {
      continue;
    }

    const request = {
      dealId: deal.id,
      documentId: document.id,
      expectedVersion: document.version,
    };
    if (document.type === DocumentType.SUPPLY_CONTRACT) {
      await runSupplierAction(runtime, supplierOrganizationId, DocumentService.method.signSupplyContract, userId, context =>
        service.signSupplyContract(create(SignSupplyContractRequestSchema, {
          ...request,
          idempotencyKey: runtime.random.uuid(),
        }), context));
    }
    else {
      await runSupplierAction(runtime, supplierOrganizationId, DocumentService.method.signDocument, userId, context =>
        service.signDocument(create(SignDocumentRequestSchema, {
          ...request,
          idempotencyKey: runtime.random.uuid(),
        }), context));
    }
  }
};

const shipPaidOrder = async (runtime: IModuleRuntime, deal: Deal, userId: string): Promise<void> => {
  if (runtime.read.get('payments', deal.id)?.payment?.status !== SafeDealPaymentStatus.BLOCKED) {
    return;
  }
  const service = createDealService(runtime);
  await runSupplierAction(runtime, deal.supplierOrganizationId, DealService.method.markDealShipped, userId, context =>
    service.markDealShipped(create(MarkDealShippedRequestSchema, {
      dealId: deal.id,
      expectedVersion: deal.version,
      idempotencyKey: runtime.random.uuid(),
    }), context));
};

export const runSupplierBots = async (runtime: IModuleRuntime): Promise<void> => {
  const deals = runtime.read.list('deals').filter(deal => deal.status === DealStatus.SUBMITTED
    || deal.status === DealStatus.LOGISTICS_CHOSEN || deal.status === DealStatus.PAID)
    .sort((current, prev) => compareIds(current.id, prev.id));

  for (const { id } of deals) {
    const deal = runtime.read.get('deals', id);
    if (deal === undefined || !isEnabled(runtime.read, deal.supplierOrganizationId)) {
      continue;
    }
    const botRuntime = createSupplierRuntime(runtime, deal.supplierOrganizationId);
    if (deal.status === DealStatus.SUBMITTED) {
      await respondToOrder(botRuntime, deal);
      continue;
    }

    const botUserId = DEMO_BOT_USERS.get(deal.supplierOrganizationId);
    if (botUserId === undefined) {
      continue;
    }
    if (deal.status === DealStatus.LOGISTICS_CHOSEN) {
      await signDocuments(botRuntime, deal, botUserId);
    }
    else if (deal.status === DealStatus.PAID) {
      await shipPaidOrder(botRuntime, deal, botUserId);
    }
  }
};
