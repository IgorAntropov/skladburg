import { dealChannel } from '@skladburg/contracts/runtime';

import type { ApiQueryMetaValue } from '@/shared/api';

import {
  createOrganizationQueryMeta,
  getOrganizationScope,
} from '@/shared/api';

const DEAL_EVENT_CASES = ['dealChanged'] as const;

export const dealKeys = {
  detail: (organizationId: string | undefined, userId: string | undefined, dealId: string | undefined): readonly string[] =>
    ['deal', 'detail', getOrganizationScope(organizationId), userId ?? '', dealId ?? ''],
  list: (organizationId: string | undefined, userId: string | undefined): readonly string[] =>
    ['deal', 'list', getOrganizationScope(organizationId), userId ?? ''],

};

export const createDealQueryMeta = (organizationId: string | undefined, dealId?: string): ApiQueryMetaValue => {
  const meta = createOrganizationQueryMeta(organizationId, DEAL_EVENT_CASES);

  return organizationId === undefined || dealId === undefined
    ? meta
    : { ...meta, channels: [...(meta.channels ?? []), dealChannel(dealId)] };
};
