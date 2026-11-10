import {
  useCallback,
  useMemo,
} from 'react';

import {
  hasVerifiedProfile,
  useActingOrganizationQuery,
  useSpheresQuery,
} from '@/entities/organization';
import { useActingContext } from '@/shared/api';

import type { OrganizationDirectoryRowValue } from '../../lib/buildOrganizationDirectoryRows';
import type { OrganizationDirectoryFilterValue } from '../../model/organizationDirectoryFilter';
import type { NetworkMapModelStateValue } from '../useNetworkMapModel';

import { buildOrganizationDirectoryRows } from '../../lib/buildOrganizationDirectoryRows';
import { useOrganizationShowcasesQuery } from './useOrganizationShowcasesQuery';

export interface OrganizationDirectoryStateValue {
  data: readonly OrganizationDirectoryRowValue[] | undefined;
  error: Error | null;
  isPlaceholderData: boolean;
  isRetrying: boolean;
  isViewerUnverified: boolean;
  retry: () => void;
}

export const useOrganizationDirectory = (
  filter: OrganizationDirectoryFilterValue,
  modelState: NetworkMapModelStateValue,
): OrganizationDirectoryStateValue => {
  const { organizationId } = useActingContext();
  const showcasesQuery = useOrganizationShowcasesQuery(filter);
  const spheresQuery = useSpheresQuery();
  const actingOrganizationQuery = useActingOrganizationQuery();

  const showcases = showcasesQuery.data;
  const spheres = spheresQuery.data;
  const model = modelState.data;
  const { refetch: refetchShowcases } = showcasesQuery;
  const { refetch: refetchSpheres } = spheresQuery;
  const { retry: retryModel } = modelState;
  const isShowcasesFailed = showcasesQuery.isError;
  const isSpheresFailed = spheresQuery.isError;
  const isModelFailed = modelState.error !== null;

  const data = useMemo(() => {
    if (showcases === undefined || spheres === undefined || model === undefined) {
      return undefined;
    }

    return buildOrganizationDirectoryRows({
      model,
      ownOrganizationId: organizationId,
      showcases,
      sphereNameById: new Map(spheres.map(sphere => [sphere.id, sphere.name])),
    });
  }, [model, organizationId, showcases, spheres]);

  const error = data === undefined
    ? (showcasesQuery.error ?? spheresQuery.error ?? modelState.error)
    : null;

  const actingProfiles = actingOrganizationQuery.data?.profiles;
  const isViewerUnverified = actingProfiles !== undefined && !hasVerifiedProfile(actingProfiles);

  const retry = useCallback((): void => {
    console.log('> useOrganizationDirectory -> retry:', { isModelFailed, isShowcasesFailed, isSpheresFailed });

    if (isShowcasesFailed) {
      void refetchShowcases();
    }

    if (isSpheresFailed) {
      void refetchSpheres();
    }

    if (isModelFailed) {
      retryModel();
    }
  }, [isModelFailed, isShowcasesFailed, isSpheresFailed, refetchShowcases, refetchSpheres, retryModel]);

  return {
    data,
    error,
    isPlaceholderData: showcasesQuery.isPlaceholderData,
    isRetrying: showcasesQuery.isFetching || spheresQuery.isFetching || modelState.isRetrying,
    isViewerUnverified,
    retry,
  };
};
