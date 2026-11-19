import type { YardWaitingReason } from '@skladburg/contracts/wms/v1/receiving';
import type { UseQueryResult } from '@tanstack/react-query';

import {
  organizationChannel,
  tasksChannel,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import {
  collectPages,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { warehouseWorkspaceKey } from './warehouseWorkspaceKey';

export const useYardWaitingReasons = (warehouseId: string, isEnabled: boolean): UseQueryResult<YardWaitingReason[]> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();
  const canRead = isEnabled && organizationId !== undefined && userId !== undefined;

  return useQuery({
    meta: canRead
      ? {
          channels: [organizationChannel(organizationId), tasksChannel(warehouseId), warehouseChannel(warehouseId)],
          eventCases: ['yardQueuePolicyChanged', 'receivingTasksChanged', 'pickingTasksChanged', 'warehouseChanged'],
        }
      : undefined,
    queryFn: canRead
      ? async ({ signal }) => {
        const { WarehouseReceivingService } = await import('@skladburg/contracts/wms/v1/receiving');
        const service = client.service(WarehouseReceivingService);
        return collectPages(async (page) => {
          signal.throwIfAborted();
          const response = await service.listYardWaitingReasons({ page, warehouseId }, { signal });
          return { items: response.reasons, nextPageToken: response.page?.nextPageToken ?? '' };
        });
      }
      : skipToken,
    queryKey: canRead ? [...warehouseWorkspaceKey({ organizationId, userId, warehouseId }), 'yard-waiting'] : ['yard-waiting-disabled'],
  });
};
