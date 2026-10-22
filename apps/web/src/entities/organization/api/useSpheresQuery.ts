import type { Sphere } from '@skladburg/contracts/organization/v1/organization';
import type { UseQueryResult } from '@tanstack/react-query';

import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '@/shared/api';

import { fetchSpheres } from './fetchSpheres';
import { organizationKeys } from './organizationKeys';

export const useSpheresQuery = (): UseQueryResult<readonly Sphere[]> => {
  const client = useApiClient();

  return useQuery({
    meta: { channels: [] },
    queryFn: (): Promise<readonly Sphere[]> => fetchSpheres(client),
    queryKey: organizationKeys.spheres(),
    staleTime: Infinity,
  });
};
