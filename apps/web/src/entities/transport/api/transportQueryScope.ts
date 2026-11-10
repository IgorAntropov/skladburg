import { getOrganizationScope } from '@/shared/api';

export const TRANSPORT_EVENTS = ['transportRequestChanged'] as const;

export const transportScope = (organizationId: string | undefined, userId: string | undefined): readonly string[] =>
  ['transport', getOrganizationScope(organizationId), userId ?? ''];
