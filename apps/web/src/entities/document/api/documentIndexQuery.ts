import type { UseQueryResult } from '@tanstack/react-query';

import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import {
  createOrganizationQueryMeta,
  getOrganizationScope,
  useActingContext,
  useApiClient,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import type { DocumentIndexEntryValue } from './documentIndex';

export const useDocumentIndexQuery = (isEnabled: boolean): UseQueryResult<DocumentIndexEntryValue[]> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();
  const { locale } = useI18n();

  return useQuery({
    meta: createOrganizationQueryMeta(organizationId, ['dealChanged']),
    queryFn: isEnabled && organizationId !== undefined && userId !== undefined
      ? ({ signal }) => import('./documentIndex').then(module => module.fetchDocumentIndex(client, locale, signal))
      : skipToken,
    queryKey: ['documents', getOrganizationScope(organizationId), userId ?? '', 'index', locale],
    staleTime: 30_000,
  });
};
