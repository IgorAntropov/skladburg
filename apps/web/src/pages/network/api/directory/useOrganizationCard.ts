import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  toOrganizationLogo,
  useSpheresQuery,
} from '@/entities/organization';
import { parseApiError } from '@/shared/api';

import type { OrganizationCardValue } from '../../lib/organizationCardTypes';

import { resolveSphereNames } from '../../lib/resolveSphereNames';
import { sortOrganizationProfiles } from '../../lib/sortOrganizationProfiles';
import { useOrganizationShowcaseQuery } from './useOrganizationShowcaseQuery';

export interface OrganizationCardStateValue {
  data: OrganizationCardValue | undefined;
  error: Error | null;
  isNotFound: boolean;
  isRetrying: boolean;
  retry: () => void;
}

export const useOrganizationCard = (organizationId: string): OrganizationCardStateValue => {
  const showcaseQuery = useOrganizationShowcaseQuery(organizationId);
  const spheresQuery = useSpheresQuery();
  const [isRetrying, setIsRetrying] = useState(false);

  const showcase = showcaseQuery.data;
  const spheres = spheresQuery.data;
  const { refetch: refetchShowcase } = showcaseQuery;
  const { refetch: refetchSpheres } = spheresQuery;
  const isShowcaseFailed = showcaseQuery.isError;
  const isSpheresFailed = spheresQuery.isError;

  const data = useMemo(() => {
    if (showcase === undefined || spheres === undefined) {
      return undefined;
    }

    return {
      id: showcase.id,
      logo: toOrganizationLogo(showcase.logo),
      name: showcase.name,
      profiles: sortOrganizationProfiles(showcase.profiles),
      sphereNames: resolveSphereNames(showcase.sphereIds, new Map(spheres.map(sphere => [sphere.id, sphere.name]))),
    };
  }, [showcase, spheres]);

  const error = data === undefined ? (showcaseQuery.error ?? spheresQuery.error) : null;
  const isNotFound = showcaseQuery.error !== null && parseApiError(showcaseQuery.error).code === ErrorCode.NOT_FOUND;

  const retry = useCallback((): void => {
    console.log('> useOrganizationCard -> retry:', { isShowcaseFailed, isSpheresFailed });

    const refetches: Promise<unknown>[] = [];

    if (isShowcaseFailed) {
      refetches.push(refetchShowcase());
    }

    if (isSpheresFailed) {
      refetches.push(refetchSpheres());
    }

    if (refetches.length === 0) {
      return;
    }

    setIsRetrying(true);

    void Promise.all(refetches).finally(() => {
      setIsRetrying(false);
    });
  }, [isShowcaseFailed, isSpheresFailed, refetchShowcase, refetchSpheres]);

  return { data, error, isNotFound, isRetrying, retry };
};
