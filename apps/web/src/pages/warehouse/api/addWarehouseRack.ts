import type { Client } from '@connectrpc/connect';
import type { WarehouseLayoutSessionService } from '@skladburg/contracts/wms/v1/layout_session';
import type { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';

import { parseApiError } from '@/shared/api';

import type { WarehouseRackPlacementValue } from '../model/warehouseRackPlacement';

export interface WarehouseRackSavedValue {
  draft: WarehouseRackPlacementValue;
  revision: number;
}

export const addWarehouseRack = async (
  draft: WarehouseRackPlacementValue,
  idempotencyKey: string,
  layout: Pick<Client<typeof WarehouseLayoutSessionService>, 'openWarehouseLayoutSession' | 'releaseWarehouseLayoutSession'>,
  topology: Pick<Client<typeof WarehouseTopologyService>, 'addWarehouseCells'>,
): Promise<WarehouseRackSavedValue> => {
  const { cells, expectedRevision, warehouseId, zoneId } = draft;
  const sessionScope = { idempotencyKey, warehouseId, zoneId };
  const { layoutSessionId } = await layout.openWarehouseLayoutSession(sessionScope);
  let hasRetryableFailure = false;

  try {
    const { revision } = await topology.addWarehouseCells({
      cells: [...cells], expectedRevision, idempotencyKey, layoutSessionId, warehouseId,
    });

    return { draft, revision };
  }
  catch (error) {
    hasRetryableFailure = parseApiError(error).isRetryable;
    throw error;
  }
  finally {
    if (!hasRetryableFailure) {
      void layout.releaseWarehouseLayoutSession({ ...sessionScope, layoutSessionId }).catch(() => undefined);
    }
  }
};
