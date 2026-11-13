import type {
  DescMessage,
  DescMethodUnary,
  MessageShape,
} from '@bufbuild/protobuf';
import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createFetchHandler } from '@connectrpc/connect/protocol';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ClaimReceivingTaskResponseSchema,
  FinishReceivingTaskResponseSchema,
  ListReceivingTasksResponseSchema,
  PutAwayHandlingUnitResponseSchema,
  ReceiveHandlingUnitResponseSchema,
  type ReceivingTask,
  ReceivingTaskStatus,
  WarehouseReceivingService,
} from '@skladburg/contracts/wms/v1/receiving';

import type { PermissionCallerValue } from '../../access/index';
import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import { paginate } from '../pagination';
import {
  readInboundTask,
  saveInboundTask,
} from './inboundRecords';
import { putAwayHandlingUnit } from './putAwayHandlingUnit';
import { receiveHandlingUnit } from './receiveHandlingUnit';

interface ReceivingCommandValue<TInput extends DescMessage, TOutput extends DescMessage> {
  allowedStatuses: readonly ReceivingTaskStatus[];
  handle: (transaction: IStateTransaction, caller: PermissionCallerValue, task: ReceivingTask) => MessageShape<TOutput>;
  headers: Headers;
  method: DescMethodUnary<TInput, TOutput>;
  request: MessageShape<TInput> & ReceivingRequestValue;
}

interface ReceivingRequestValue {
  expectedVersion: number;
  idempotencyKey: string;
  taskId: string;
  warehouseId: string;
}

const runReceivingCommand = <TInput extends DescMessage, TOutput extends DescMessage>(
  runtime: IModuleRuntime,
  input: ReceivingCommandValue<TInput, TOutput>,
): Promise<MessageShape<TOutput>> => runtime.command((transaction) => {
  const { errors, guard, idempotency } = runtime;
  const { expectedVersion, idempotencyKey, taskId, warehouseId } = input.request;
  const caller = guard.guardPermissionCall(transaction, input.method, input.request, input.headers);
  if (caller.admission.kind !== 'membership') {
    throw errors.permissionDenied('task_edit', warehouseId);
  }

  return idempotency.run(transaction, {
    handler: () => {
      const record = transaction.get('warehouseInbound', taskId);
      if (record?.scopeId !== warehouseId || record.lookupKey !== caller.organizationId) {
        throw errors.notFound(EntityKind.RECEIVING_TASK);
      }

      const task = readInboundTask(record, errors);
      if (task.version === 0) {
        throw errors.notFound(EntityKind.RECEIVING_TASK);
      }
      if (task.version !== expectedVersion) {
        throw errors.versionConflict(EntityKind.RECEIVING_TASK, task.version);
      }
      if (!input.allowedStatuses.includes(task.status)) {
        throw errors.invalidTransition(EntityKind.RECEIVING_TASK, ReceivingTaskStatus[task.status], input.method.name);
      }
      if (task.status !== ReceivingTaskStatus.OPEN && task.assigneeUserId !== caller.user.id) {
        throw errors.permissionDenied('task_edit', warehouseId);
      }
      if (task.version >= 2_147_483_647) {
        throw errors.unavailable();
      }

      task.version += 1;
      const result = input.handle(transaction, caller, task);
      saveInboundTask(transaction, runtime, task, caller.organizationId);
      return result;
    },
    idempotencyKey,
    method: input.method,
    request: input.request,
    scope: `${caller.organizationId}:${caller.user.id}`,
  });
});

export const createWarehouseReceivingService = (runtime: IModuleRuntime): ServiceImpl<typeof WarehouseReceivingService> => {
  const { errors, guard, read } = runtime;
  const { method } = WarehouseReceivingService;

  return {
    claimReceivingTask: (request, context) => runReceivingCommand(runtime, {
      allowedStatuses: [ReceivingTaskStatus.OPEN],
      handle: (_transaction, caller, task) => {
        task.status = ReceivingTaskStatus.IN_PROGRESS;
        task.assigneeUserId = caller.user.id;
        return create(ClaimReceivingTaskResponseSchema, { task });
      },
      headers: context.requestHeader,
      method: method.claimReceivingTask,
      request,
    }),
    finishReceivingTask: (request, context) => runReceivingCommand(runtime, {
      allowedStatuses: [ReceivingTaskStatus.IN_PROGRESS],
      handle: (transaction, _caller, task) => {
        task.status = ReceivingTaskStatus.READY_FOR_RECONCILIATION;
        task.finishedAt = timestampFromMs(transaction.worldTimeMs);
        runtime.finishInboundReceipt?.(transaction, runtime, task);
        return create(FinishReceivingTaskResponseSchema, { task });
      },
      headers: context.requestHeader,
      method: method.finishReceivingTask,
      request,
    }),
    listReceivingTasks: (request, context) => {
      const caller = guard.guardPermissionCall(read, method.listReceivingTasks, request, context.requestHeader);
      const tasks = read.listBy('warehouseInbound', 'scopeId', request.warehouseId)
        .filter(record => record.lookupKey === caller.organizationId)
        .map(record => readInboundTask(record, errors))
        .filter(task => task.version > 0);
      const { items, page } = paginate(tasks, task => task.id, request.page, errors);
      return create(ListReceivingTasksResponseSchema, { page, tasks: items });
    },
    putAwayHandlingUnit: (request, context) => runReceivingCommand(runtime, {
      allowedStatuses: [
        ReceivingTaskStatus.IN_PROGRESS,
        ReceivingTaskStatus.READY_FOR_RECONCILIATION,
        ReceivingTaskStatus.RECONCILED,
      ],
      handle: (transaction, caller, task) => {
        putAwayHandlingUnit(transaction, runtime, caller, task, request);
        return create(PutAwayHandlingUnitResponseSchema, { task });
      },
      headers: context.requestHeader,
      method: method.putAwayHandlingUnit,
      request,
    }),
    receiveHandlingUnit: (request, context) => runReceivingCommand(runtime, {
      allowedStatuses: [ReceivingTaskStatus.IN_PROGRESS],
      handle: (transaction, caller, task) => {
        receiveHandlingUnit(transaction, runtime, caller, task, request);
        return create(ReceiveHandlingUnitResponseSchema, { task });
      },
      headers: context.requestHeader,
      method: method.receiveHandlingUnit,
      request,
    }),
  };
};

export const createWarehouseReceivingHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(WarehouseReceivingService, createWarehouseReceivingService(runtime));

  return createFetchHandler(createPathDispatcher(router.handlers));
};
