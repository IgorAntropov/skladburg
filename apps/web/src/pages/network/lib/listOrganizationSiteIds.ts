import type { NetworkMapSiteValue } from '@/entities/network';

const EMPTY_ID_LIST: readonly string[] = [];

export const listOrganizationSiteIds = (
  sites: readonly NetworkMapSiteValue[],
  organizationId: string | undefined,
): readonly string[] => {
  if (organizationId === undefined) {
    return EMPTY_ID_LIST;
  }

  const siteIds = sites.filter(site => site.organizationId === organizationId).map(site => site.id);

  return siteIds.length === 0 ? EMPTY_ID_LIST : siteIds;
};
