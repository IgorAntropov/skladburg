import type { DescMethod } from '@bufbuild/protobuf';
import type { Money } from '@skladburg/contracts/common/v1/money';

import type { CommandAccessValue } from '@/shared/api';

import {
  useCommandAccess,
  useOrganizationApprovalAccess,
} from '@/entities/session';

export const useDealCommandAccess = (method: DescMethod): CommandAccessValue => useCommandAccess(method, { kind: 'organization' });

export const useDealApprovalAccess = (method: DescMethod, amount: Money | undefined, permission = 'deal_approve'): {
  access: CommandAccessValue;
  limit: Money | undefined;
} => useOrganizationApprovalAccess(method, amount, permission);
