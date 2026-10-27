import type { GetDigestResponse } from '@skladburg/contracts/notification/v1/notification';
import type { UseQueryResult } from '@tanstack/react-query';

import { NotificationService } from '@skladburg/contracts/notification/v1/notification';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import { notificationKeys } from '@/entities/notification';
import {
  getOrganizationScope,
  useActingContext,
  useApiClient,
} from '@/shared/api';

export const useDigestQuery = (): UseQueryResult<GetDigestResponse> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();

  const isContextComplete = organizationId !== undefined && userId !== undefined;

  return useQuery({
    queryFn: isContextComplete
      ? (): Promise<GetDigestResponse> => client.service(NotificationService).getDigest({})
      : skipToken,
    queryKey: notificationKeys.digest(getOrganizationScope(organizationId)),
  });
};
