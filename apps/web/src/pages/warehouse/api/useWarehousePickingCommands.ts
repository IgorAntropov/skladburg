import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';

import { WarehousePickingService } from '@skladburg/contracts/wms/v1/picking';

import type { CommandValue } from '@/shared/api';

import { useApiClient } from '@/shared/api';

import {
  useWarehouseTaskCommand,
  warehouseTaskCommandRequest,
} from './useWarehouseCommands';

const pickingMethods = WarehousePickingService.method;

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
