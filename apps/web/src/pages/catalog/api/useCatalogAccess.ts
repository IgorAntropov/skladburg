import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { useMemo } from 'react';

import { useActingOrganizationQuery } from '@/entities/organization';
import { useCan } from '@/entities/session';

import type { CatalogAccessValue } from '../lib/resolveCatalogAccess';

import { resolveCatalogAccess } from '../lib/resolveCatalogAccess';

export interface CatalogAccessStateValue {
  access: CatalogAccessValue | undefined;
  error: Error | null;
  isRetrying: boolean;
  retry: () => void;
}

export const useCatalogAccess = (): CatalogAccessStateValue => {
  const { data: organization, error, isFetching, refetch } = useActingOrganizationQuery();
  const canViewCatalog = useCan(PermissionCode.CATALOG_VIEW);
  const canViewMarketplace = useCan(PermissionCode.MARKETPLACE_VIEW);

  const profiles = organization?.profiles;

  const access = useMemo(
    () => (profiles === undefined ? undefined : resolveCatalogAccess({ canViewCatalog, canViewMarketplace, profiles })),
    [canViewCatalog, canViewMarketplace, profiles],
  );

  const retry = (): void => {
    console.log('> useCatalogAccess -> retry:', {});
    void refetch();
  };

  return { access, error, isRetrying: isFetching, retry };
};
