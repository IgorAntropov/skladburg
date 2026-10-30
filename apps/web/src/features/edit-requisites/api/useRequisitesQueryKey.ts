import {
  getOrganizationScope,
  useActingContext,
} from '@/shared/api';

import { requisitesKeys } from './requisitesKeys';

export const useRequisitesQueryKey = (): ReturnType<typeof requisitesKeys.detail> => {
  const { organizationId } = useActingContext();

  return requisitesKeys.detail(getOrganizationScope(organizationId));
};
