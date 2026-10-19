import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';
import type { KnownPermissionCode } from '@skladburg/contracts/runtime';

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  useActingContext,
  useApiClient,
} from '@/shared/api';

import type { PermissionScopeValue } from '../model/permissionScope';

import { isPermissionGranted } from '../lib/isPermissionGranted';
import { createSessionQueryOptions } from './sessionQueryOptions';

const ANY_SCOPE: PermissionScopeValue = { kind: 'any' };

const restoreScope = (kind: PermissionScopeValue['kind'], warehouseId: string | undefined): PermissionScopeValue => {
  if (warehouseId !== undefined) {
    return { kind: 'warehouse', warehouseId };
  }

  return kind === 'organization' ? { kind: 'organization' } : ANY_SCOPE;
};

export const useCan = (code: KnownPermissionCode, scope: PermissionScopeValue = ANY_SCOPE): boolean => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();
  const scopeKind = scope.kind;
  const warehouseId = scope.kind === 'warehouse' ? scope.warehouseId : undefined;

  const selectIsGranted = useCallback(
    (session: GetSessionResponse): boolean =>
      isPermissionGranted(session.permissions, code, restoreScope(scopeKind, warehouseId)),
    [code, scopeKind, warehouseId],
  );

  const { data } = useQuery({
    ...createSessionQueryOptions({ client, organizationId, userId }),
    select: selectIsGranted,
  });

  return data === true;
};
