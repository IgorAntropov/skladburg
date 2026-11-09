import type { Client } from '@connectrpc/connect';
import type { UseQueryResult } from '@tanstack/react-query';

import { FleetService } from '@skladburg/contracts/fleet/v1/fleet';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import type {
  PageRequestValue,
  PageValue,
} from '@/shared/api';

import {
  collectPages,
  createOrganizationQueryMeta,
  getOrganizationScope,
  RESYNC_ONLY_EVENT_CASES,
  useActingContext,
  useApiClient,
} from '@/shared/api';

export type FleetListKindValue = 'drivers' | 'lanes' | 'vehicles';

export const FLEET_SAVE_METHODS = {
  drivers: FleetService.method.saveDriver,
  lanes: FleetService.method.saveCarrierLane,
  vehicles: FleetService.method.saveVehicle,
} as const;

export type FleetPageReader<TRecord> = (
  client: Client<typeof FleetService>,
  page: PageRequestValue,
  signal: AbortSignal,
) => Promise<PageValue<TRecord>>;

export const fleetListKey = (
  organizationId: string | undefined,
  userId: string | undefined,
  kind: FleetListKindValue,
): readonly string[] => ['garage', getOrganizationScope(organizationId), userId ?? '', kind];

export const useFleetList = <TRecord>(
  kind: FleetListKindValue,
  fetchPage: FleetPageReader<TRecord>,
): UseQueryResult<TRecord[]> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();

  return useQuery({
    meta: createOrganizationQueryMeta(organizationId, RESYNC_ONLY_EVENT_CASES),
    queryFn: organizationId === undefined || userId === undefined
      ? skipToken
      : ({ signal }): Promise<TRecord[]> => collectPages(page => fetchPage(client.service(FleetService), page, signal)),
    queryKey: fleetListKey(organizationId, userId, kind),
  });
};
