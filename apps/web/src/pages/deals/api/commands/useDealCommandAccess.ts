import type { DescMethod } from '@bufbuild/protobuf';
import type { Money } from '@skladburg/contracts/common/v1/money';

import type { CommandAccessValue } from '@/shared/api';

import {
  useCommandAccess,
  useSessionQuery,
} from '@/entities/session';

import { findDealApprovalLimit } from './dealApprovalLimit';

export const useDealCommandAccess = (method: DescMethod): CommandAccessValue => useCommandAccess(method, { kind: 'organization' });

export const useDealApprovalAccess = (method: DescMethod, amount: Money | undefined, permission?: string): {
  access: CommandAccessValue;
  limit: Money | undefined;
} => {
  const access = useDealCommandAccess(method);
  const { data } = useSessionQuery();
  const limit = access.status === 'allowed' && data !== undefined && amount !== undefined
    ? findDealApprovalLimit(data.permissions, amount, permission)
    : undefined;

  return { access, limit };
};
