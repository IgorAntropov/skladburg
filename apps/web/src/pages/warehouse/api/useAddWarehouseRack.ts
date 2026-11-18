import { WarehouseLayoutSessionService } from '@skladburg/contracts/wms/v1/layout_session';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';
import { useState } from 'react';

import type { CommandValue } from '@/shared/api';

import {
  useApiClient,
  useCommand,
} from '@/shared/api';

import type { WarehouseRackPlacementValue } from '../model/warehouseRackPlacement';
import type { WarehouseRackSavedValue } from './addWarehouseRack';

import { addWarehouseRack } from './addWarehouseRack';
import {
  useRefreshWarehouseWorkspace,
  useWarehouseCommandAttempt,
} from './useWarehouseCommands';

const NO_CHANGE = (): void => undefined;

interface WarehouseRackCommandValue {
  attemptedDraft: undefined | WarehouseRackPlacementValue;
  command: CommandValue;
}

export const useAddWarehouseRack = (
  warehouseId: string,
  draft: undefined | WarehouseRackPlacementValue,
  onSaved: (saved: WarehouseRackSavedValue) => void,
): WarehouseRackCommandValue => {
  const client = useApiClient();
  const attempt = useWarehouseCommandAttempt<WarehouseRackSavedValue>();
  const refresh = useRefreshWarehouseWorkspace(warehouseId, NO_CHANGE);
  const [attemptedDraft, setAttemptedDraft] = useState<WarehouseRackPlacementValue>();

  const command = useCommand({
    execute: key => attempt(key, () => {
      if (draft === undefined) {
        return Promise.reject(new Error('Warehouse rack preview is unavailable'));
      }
      setAttemptedDraft(draft);

      return addWarehouseRack(draft, key, client.service(WarehouseLayoutSessionService), client.service(WarehouseTopologyService));
    }),
    method: WarehouseTopologyService.method.addWarehouseCells,
    onSuccess: (saved) => {
      refresh();
      onSaved(saved);
    },
  });

  return { attemptedDraft, command };
};
