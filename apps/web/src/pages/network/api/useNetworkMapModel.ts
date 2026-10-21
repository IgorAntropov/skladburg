import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import type { NetworkMapModelValue } from '@/entities/network';

import {
  buildNetworkMapModel,
  useMapSitesQuery,
  useNetworkDirectoryQuery,
} from '@/entities/network';
import { useActingContext } from '@/shared/api';
import { useI18n } from '@/shared/i18n';

export interface NetworkMapModelStateValue {
  data: NetworkMapModelValue | undefined;
  error: Error | null;
  isRetrying: boolean;
  retry: () => void;
}

export const useNetworkMapModel = (): NetworkMapModelStateValue => {
  const { organizationId } = useActingContext();
  const { locale } = useI18n();
  const directoryQuery = useNetworkDirectoryQuery();
  const sitesQuery = useMapSitesQuery();
  const [isRetrying, setIsRetrying] = useState(false);

  const directory = directoryQuery.data;
  const sites = sitesQuery.data;
  const { refetch: refetchDirectory } = directoryQuery;
  const { refetch: refetchSites } = sitesQuery;
  const isDirectoryFailed = directoryQuery.isError;
  const isSitesFailed = sitesQuery.isError;

  const data = useMemo(
    () => (directory === undefined || sites === undefined
      ? undefined
      : buildNetworkMapModel({ directory, locale, organizationId, sites })),
    [directory, locale, organizationId, sites],
  );

  const error = data === undefined
    ? (directoryQuery.error ?? sitesQuery.error)
    : null;

  const retry = useCallback((): void => {
    console.log('> useNetworkMapModel -> retry:', { isDirectoryFailed, isSitesFailed });

    const refetches: Promise<unknown>[] = [];

    if (isDirectoryFailed) {
      refetches.push(refetchDirectory());
    }

    if (isSitesFailed) {
      refetches.push(refetchSites());
    }

    if (refetches.length === 0) {
      return;
    }

    setIsRetrying(true);

    void Promise.all(refetches).finally(() => {
      setIsRetrying(false);
    });
  }, [isDirectoryFailed, isSitesFailed, refetchDirectory, refetchSites]);

  return { data, error, isRetrying, retry };
};
