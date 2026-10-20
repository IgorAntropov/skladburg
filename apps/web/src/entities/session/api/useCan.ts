import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';
import type { KnownPermissionCode } from '@skladburg/contracts/runtime';

import { useCallback } from 'react';

import type { PermissionScopeValue } from '../model/permissionScope';

import { isPermissionGranted } from '../lib/isPermissionGranted';
import { useSessionQuery } from './useSessionQuery';
import {
  ANY_PERMISSION_SCOPE,
  useStablePermissionScope,
} from './useStablePermissionScope';

export const useCan = (code: KnownPermissionCode, scope: PermissionScopeValue = ANY_PERMISSION_SCOPE): boolean => {
  const stableScope = useStablePermissionScope(scope);

  const selectIsGranted = useCallback(
    (session: GetSessionResponse): boolean => isPermissionGranted(session.permissions, code, stableScope),
    [code, stableScope],
  );

  const { data } = useSessionQuery({ select: selectIsGranted });

  return data === true;
};
