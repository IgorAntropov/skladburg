import type {
  DescMessage,
  DescMethodUnary,
  MessageShape,
} from '@bufbuild/protobuf';
import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createFetchHandler } from '@connectrpc/connect/protocol';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  DealSchema,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import { DealChange } from '@skladburg/contracts/deal/v1/deal_events';
import { DealNotice } from '@skladburg/contracts/notification/v1/notification';
import {
  ClaimPickingTaskResponseSchema,
  ConfirmPickingResponseSchema,
  ConfirmWarehouseShipmentResponseSchema,
  ListPickingTasksResponseSchema,
  type PickingTask,
  PickingTaskStatus,
  WarehousePickingService,
} from '@skladburg/contracts/wms/v1/picking';
import { StockMovementKind } from '@skladburg/contracts/wms/v1/stock';

import type { PermissionCallerValue } from '../../access/index';
import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  compareCalendarDates,
  toCalendarDate,
} from '../../calendar/index';
import {
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import { requireDealPartyProfiles } from '../deals/dealAccess';
import { writeUserDealTransition } from '../deals/dealCommand';
import { advanceSystemDeal } from '../deals/dealEffects';
import { dealMachine } from '../deals/dealMachine';
import { paginate } from '../pagination';
import { loadPayments } from '../payments/loadPayments';
import {
  readOutboundTask,
  saveOutboundTask,
} from './outboundRecords';
import {
  applyOutboundMovement,
  readReservedUnits,
} from './outboundReservation';
import { publishStockAvailabilityChanged } from './stockRecords';

interface PickingCommandValue<TInput extends DescMessage, TOutput extends DescMessage> {
  handle: (transaction: IStateTransaction, caller: PermissionCallerValue, task: PickingTask) => MessageShape<TOutput>;
  headers: Headers;
  method: DescMethodUnary<TInput, TOutput>;
  next: PickingTaskStatus;
  prev: PickingTaskStatus;
  request: MessageShape<TInput> & PickingRequestValue;
}

interface PickingRequestValue {
  expectedVersion: number;
  idempotencyKey: string;
  taskId: string;
  warehouseId: string;
}

const runPickingCommand = <TInput extends DescMessage, TOutput extends DescMessage>(
  runtime: IModuleRuntime,
  input: PickingCommandValue<TInput, TOutput>,
): Promise<MessageShape<TOutput>> => runtime.command((transaction) => {
  const { errors, guard, idempotency } = runtime;
  const { expectedVersion, idempotencyKey, taskId, warehouseId } = input.request;
  const caller = guard.guardPermissionCall(transaction, input.method, input.request, input.headers);
  if (caller.admission.kind !== 'membership') {
    throw errors.permissionDenied('task_edit', warehouseId);
  }

  return idempotency.run(transaction, {
    handler: () => {
      const record = transaction.get('warehouseOutbound', taskId);
      if (record?.scopeId !== warehouseId || record.lookupKey !== caller.organizationId) {
        throw errors.notFound(EntityKind.PICKING_TASK);
      }
      const task = readOutboundTask(record, errors);
      if (task.version === 0) {
        throw errors.notFound(EntityKind.PICKING_TASK);
      }
      if (task.version !== expectedVersion) {
        throw errors.versionConflict(EntityKind.PICKING_TASK, task.version);
      }
      if (task.status !== input.prev) {
        throw errors.invalidTransition(EntityKind.PICKING_TASK, PickingTaskStatus[task.status], PickingTaskStatus[input.next]);
      }
      if (input.prev !== PickingTaskStatus.OPEN && task.assigneeUserId !== caller.user.id) {
        throw errors.permissionDenied('task_edit', warehouseId);
      }
      if (task.version >= 2_147_483_647) {
        throw errors.unavailable();
      }

      task.status = input.next;
      task.version += 1;
      const result = input.handle(transaction, caller, task);
      saveOutboundTask(transaction, runtime, task, caller.organizationId, true);
      return result;
    },
    idempotencyKey,
    method: input.method,
    request: input.request,
    scope: `${caller.organizationId}:${caller.user.id}`,
  });
});

const readTaskDeal = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  caller: PermissionCallerValue,
  task: PickingTask,
): Deal => {
  const deal = transaction.get('deals', task.dealId);
  if (deal?.supplierOrganizationId !== caller.organizationId || deal.shipFromWarehouseId !== task.warehouseId) {
    throw runtime.errors.internal();
  }
  requireDealPartyProfiles(transaction, runtime.errors, deal.supplierOrganizationId, deal.customerOrganizationId);
  return deal;
};

export const createWarehousePickingService = (runtime: IModuleRuntime): ServiceImpl<typeof WarehousePickingService> => {
  const { errors, guard, read } = runtime;
  const { method } = WarehousePickingService;

  return {
    claimPickingTask: (request, context) => runPickingCommand(runtime, {
      handle: (transaction, caller, task) => {
        const deal = readTaskDeal(transaction, runtime, caller, task);
        task.assigneeUserId = caller.user.id;
        advanceSystemDeal(runtime, transaction, deal, 'startPicking');
        return create(ClaimPickingTaskResponseSchema, { task });
      },
      headers: context.requestHeader,
      method: method.claimPickingTask,
      next: PickingTaskStatus.IN_PROGRESS,
      prev: PickingTaskStatus.OPEN,
      request,
    }),
    confirmPicking: (request, context) => runPickingCommand(runtime, {
      handle: (transaction, caller, task) => {
        const ids = new Set(request.handlingUnitIds);
        if (task.units.length !== ids.size || task.units.some(unit => !ids.has(unit.handlingUnit?.id ?? ''))) {
          throw errors.validationFailed([{ fieldPath: 'handling_unit_ids', ruleId: 'stock.picking_units_mismatch' }]);
        }
        readReservedUnits(transaction, runtime, task.units, task.warehouseId, caller.organizationId);
        task.pickedAt = timestampFromMs(transaction.worldTimeMs);
        return create(ConfirmPickingResponseSchema, { task });
      },
      headers: context.requestHeader,
      method: method.confirmPicking,
      next: PickingTaskStatus.PICKED,
      prev: PickingTaskStatus.IN_PROGRESS,
      request,
    }),
    confirmWarehouseShipment: async (request, context) => {
      const { holdPaymentForShipment } = await loadPayments();
      return runPickingCommand(runtime, {
        handle: (transaction, caller, task) => {
          const deal = readTaskDeal(transaction, runtime, caller, task);
          const transition = dealMachine.requireTransition(errors, 'markDealShipped', deal, undefined);
          if (deal.status !== DealStatus.PICKING || task.pickedAt === undefined) {
            throw errors.invalidTransition(EntityKind.DEAL, DealStatus[deal.status], DealStatus[transition.status]);
          }
          const units = readReservedUnits(transaction, runtime, task.units, task.warehouseId, caller.organizationId);
          const warehouse = transaction.get('warehouses', task.warehouseId);
          if (warehouse?.tenantId !== caller.organizationId) {
            throw errors.internal();
          }
          const today = toCalendarDate(transaction.worldTimeMs, warehouse.timeZone);
          if (units.some(unit => unit.lines.some(line => line.batch?.expiresOn !== undefined
            && compareCalendarDates(line.batch.expiresOn, today) < 0))) {
            throw errors.validationFailed([{ fieldPath: 'task_id', ruleId: 'stock.picking_expired' }]);
          }

          const next = clone(DealSchema, deal);
          holdPaymentForShipment(runtime, transaction, next, units);
          for (const unit of units) {
            applyOutboundMovement(transaction, runtime, deal, caller.user.id, unit, StockMovementKind.SHIPMENT);
          }
          writeUserDealTransition(runtime, transaction, caller, deal, next, {
            change: DealChange.STATUS,
            notice: DealNotice.SHIPPED,
            reason: '',
            status: transition.status,
          });
          task.shippedAt = timestampFromMs(transaction.worldTimeMs);
          publishStockAvailabilityChanged(transaction, runtime, task.warehouseId, caller.organizationId);
          return create(ConfirmWarehouseShipmentResponseSchema, { task });
        },
        headers: context.requestHeader,
        method: method.confirmWarehouseShipment,
        next: PickingTaskStatus.SHIPPED,
        prev: PickingTaskStatus.PICKED,
        request,
      });
    },
    listPickingTasks: (request, context) => {
      const caller = guard.guardPermissionCall(read, method.listPickingTasks, request, context.requestHeader);
      const tasks = read.listBy('warehouseOutbound', 'scopeId', request.warehouseId)
        .filter(record => record.lookupKey === caller.organizationId)
        .map(record => readOutboundTask(record, errors))
        .filter(task => task.version > 0);
      const { items, page } = paginate(tasks, task => task.id, request.page, errors);
      return create(ListPickingTasksResponseSchema, { page, tasks: items });
    },
  };
};

export const createWarehousePickingHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(WarehousePickingService, createWarehousePickingService(runtime));

  return createFetchHandler(createPathDispatcher(router.handlers));
};
