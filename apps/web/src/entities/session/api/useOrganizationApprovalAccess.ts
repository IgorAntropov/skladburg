import type { DescMethod } from '@bufbuild/protobuf';
import type { Money } from '@skladburg/contracts/common/v1/money';

import type { CommandAccessValue } from '@/shared/api';

import { findOrganizationApprovalLimit } from '../lib/findOrganizationApprovalLimit';
import { useCommandAccess } from './useCommandAccess';
import { useSessionQuery } from './useSessionQuery';

export const useOrganizationApprovalAccess = (method: DescMethod, amount: Money | undefined, permission: string): {
  access: CommandAccessValue;
  limit: Money | undefined;
} => {
  const access = useCommandAccess(method, { kind: 'organization' });
  const { data } = useSessionQuery();
  const limit = access.status === 'allowed' && data !== undefined && amount !== undefined
    ? findOrganizationApprovalLimit(data.permissions, amount, permission)
    : undefined;

  return { access, limit };
};
