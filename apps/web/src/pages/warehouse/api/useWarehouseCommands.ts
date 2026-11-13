import type { DescMethod } from '@bufbuild/protobuf';
import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { WarehousePickingService } from '@skladburg/contracts/wms/v1/picking';
import { WarehouseReceivingService } from '@skladburg/contracts/wms/v1/receiving';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { CommandValue } from '@/shared/api';

import {
  useActingContext,
  useApiClient,
  useCommand,
} from '@/shared/api';

import type { WarehouseCommandAttemptValue } from '../model/warehouseCommandAttempt';

import { createWarehouseCommandAttempt } from '../model/warehouseCommandAttempt';
import { warehouseWorkspaceKey } from './warehouseWorkspaceKey';

type WarehouseTaskValue = Pick<PickingTask, 'id' | 'version' | 'warehouseId'>;

const pickingMethods = WarehousePickingService.method;
export const receivingMethods = WarehouseReceivingService.method;

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

const useWarehouseTaskCommand = (
  task: WarehouseTaskValue,
  method: DescMethod,
  execute: (idempotencyKey: string) => Promise<unknown>,
  onSuccess: () => void,
): CommandValue => {
  const attempt = useWarehouseCommandAttempt();
  const refresh = useRefreshWarehouseWorkspace(task.warehouseId, onSuccess);

  return useCommand({ execute: idempotencyKey => attempt(idempotencyKey, () => execute(idempotencyKey)), method, onSuccess: refresh });
};

export const useClaimPicking = (task: PickingTask, onSuccess: () => void): CommandValue => {
  const client = useApiClient();

  return useWarehouseTaskCommand(task, pickingMethods.claimPickingTask, idempotencyKey =>
    client.service(WarehousePickingService).claimPickingTask(warehouseTaskCommandRequest(task, idempotencyKey)), onSuccess);
};

export const useConfirmPicking = (
  task: PickingTask, handlingUnitIds: readonly string[], onSuccess: () => void,
): CommandValue => {
  const client = useApiClient();

  return useWarehouseTaskCommand(task, pickingMethods.confirmPicking, idempotencyKey =>
    client.service(WarehousePickingService).confirmPicking({
      ...warehouseTaskCommandRequest(task, idempotencyKey),
      handlingUnitIds: [...handlingUnitIds],
    }), onSuccess);
};

export const useConfirmWarehouseShipment = (task: PickingTask, onSuccess: () => void): CommandValue => {
  const client = useApiClient();

  return useWarehouseTaskCommand(task, pickingMethods.confirmWarehouseShipment, idempotencyKey =>
    client.service(WarehousePickingService).confirmWarehouseShipment(warehouseTaskCommandRequest(task, idempotencyKey)), onSuccess);
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
