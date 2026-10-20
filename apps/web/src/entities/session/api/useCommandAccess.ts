import type { DescMethod } from '@bufbuild/protobuf';
import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';

import { useCallback } from 'react';

import type { CommandAccessValue } from '@/shared/api';

import type { PermissionScopeValue } from '../model/permissionScope';

import { readCommandRequirement } from '../lib/readCommandRequirement';
import { resolveCommandAccess } from '../lib/resolveCommandAccess';
import { useSessionQuery } from './useSessionQuery';
import {
  ANY_PERMISSION_SCOPE,
  useStablePermissionScope,
} from './useStablePermissionScope';

const ALLOWED_ACCESS: CommandAccessValue = { status: 'allowed' };
const CHECKING_ACCESS: CommandAccessValue = { status: 'checking' };

export const useCommandAccess = (
  method?: DescMethod,
  scope: PermissionScopeValue = ANY_PERMISSION_SCOPE,
): CommandAccessValue => {
  const requirement = readCommandRequirement(method);
  const stableScope = useStablePermissionScope(scope);
  const isOpen = requirement.kind === 'open';

  const selectAccess = useCallback(
    (session: GetSessionResponse): CommandAccessValue =>
      resolveCommandAccess(requirement, session.permissions, stableScope),
    [requirement, stableScope],
  );

  const { data } = useSessionQuery({ isEnabled: !isOpen, select: selectAccess });

  if (isOpen) {
    return ALLOWED_ACCESS;
  }

  return data ?? CHECKING_ACCESS;
};
