import type { DescMethod } from '@bufbuild/protobuf';
import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { WarehouseReceivingService } from '@skladburg/contracts/wms/v1/receiving';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { CommandValue } from '@/shared/api';

import {
  useActingContext,
  useApiClient,
  useCommand,
} from '@/shared/api';

import type { createReceiveUnitRequest } from '../model/receiveUnitInput';
import type { WarehouseCommandAttemptValue } from '../model/warehouseCommandAttempt';

import { createWarehouseCommandAttempt } from '../model/warehouseCommandAttempt';
import { warehouseWorkspaceKey } from './warehouseWorkspaceKey';

type WarehouseTaskValue = Pick<PickingTask, 'id' | 'version' | 'warehouseId'>;

export const receivingMethods = WarehouseReceivingService.method;

export interface ReceiveUnitCommandValue {
  execute: (request: ReturnType<typeof createReceiveUnitRequest>, idempotencyKey: string) => Promise<unknown>;
  method: typeof receivingMethods.receiveHandlingUnit;
  onSuccess: () => void;
}

export const warehouseTaskCommandRequest = (task: WarehouseTaskValue, idempotencyKey: string): {
  expectedVersion: number;
  idempotencyKey: string;
  taskId: string;
  warehouseId: string;
} => ({
  expectedVersion: task.version,
  idempotencyKey,
  taskId: task.id,
  warehouseId: task.warehouseId,
});

export const useRefreshWarehouseWorkspace = (warehouseId: string, onSuccess: () => void): (() => void) => {
  const queryClient = useQueryClient();
  const { organizationId, userId } = useActingContext();

  return () => {
    void queryClient.invalidateQueries({ queryKey: warehouseWorkspaceKey({ organizationId, userId, warehouseId }) });
    onSuccess();
  };
};

export const useWarehouseCommandAttempt = <TResult>(): WarehouseCommandAttemptValue<TResult> => {
  const [attempt] = useState(createWarehouseCommandAttempt<TResult>);

  return attempt;
};

export const useWarehouseTaskCommand = (
  task: WarehouseTaskValue,
  method: DescMethod,
  execute: (idempotencyKey: string) => Promise<unknown>,
  onSuccess: () => void,
): CommandValue => {
  const attempt = useWarehouseCommandAttempt();
  const refresh = useRefreshWarehouseWorkspace(task.warehouseId, onSuccess);

  return useCommand({ execute: idempotencyKey => attempt(idempotencyKey, () => execute(idempotencyKey)), method, onSuccess: refresh });
};

export const useClaimReceiving = (task: ReceivingTask, onSuccess: () => void): CommandValue => {
  const client = useApiClient();

  return useWarehouseTaskCommand(task, receivingMethods.claimReceivingTask, idempotencyKey =>
    client.service(WarehouseReceivingService).claimReceivingTask(warehouseTaskCommandRequest(task, idempotencyKey)), onSuccess);
};

export const useFinishReceiving = (task: ReceivingTask, onSuccess: () => void): CommandValue => {
  const client = useApiClient();

  return useWarehouseTaskCommand(task, receivingMethods.finishReceivingTask, idempotencyKey =>
    client.service(WarehouseReceivingService).finishReceivingTask(warehouseTaskCommandRequest(task, idempotencyKey)), onSuccess);
};

export const useReceiveUnitCommand = (task: ReceivingTask, onSuccess: () => void): ReceiveUnitCommandValue => {
  const client = useApiClient();
  const attempt = useWarehouseCommandAttempt();
  const refresh = useRefreshWarehouseWorkspace(task.warehouseId, onSuccess);

  return {
    execute: (request, idempotencyKey) => attempt(idempotencyKey, () => client.service(WarehouseReceivingService).receiveHandlingUnit({
      ...warehouseTaskCommandRequest(task, idempotencyKey),
      ...request,
    })),
    method: receivingMethods.receiveHandlingUnit,
    onSuccess: refresh,
  };
};

export const usePutAway = (
  task: ReceivingTask, handlingUnitId: string, toCellId: string, onSuccess: () => void,
): CommandValue => {
  const client = useApiClient();

  return useWarehouseTaskCommand(task, receivingMethods.putAwayHandlingUnit, idempotencyKey =>
    client.service(WarehouseReceivingService).putAwayHandlingUnit({
      ...warehouseTaskCommandRequest(task, idempotencyKey),
      handlingUnitId,
      toCellId,
    }), onSuccess);
};
