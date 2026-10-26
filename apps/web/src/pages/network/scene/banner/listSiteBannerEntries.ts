import type { NetworkMapSiteValue } from '@/entities/network';

import { buildMonogramParts } from '@/entities/organization';

import type { NetworkSceneBuildingValue } from '../layout';
import type { SiteBannerEntryValue } from './siteBannerEntry';

import { compareIds } from '../layout';

export const listSiteBannerEntries = (
  buildings: readonly NetworkSceneBuildingValue[],
  sites: readonly NetworkMapSiteValue[],
): SiteBannerEntryValue[] => {
  const siteById = new Map(sites.map((site): [string, NetworkMapSiteValue] => [site.id, site]));
  const entryByOrganizationId = new Map<string, SiteBannerEntryValue>();

  for (const building of buildings) {
    if (!building.isCompany) {
      continue;
    }

    const site = siteById.get(building.siteId ?? building.id);

    if (site !== undefined && !entryByOrganizationId.has(site.organizationId)) {
      entryByOrganizationId.set(site.organizationId, {
        monogram: buildMonogramParts(site.organizationName),
        organizationId: site.organizationId,
        side: site.side,
      });
    }
  }

  return [...entryByOrganizationId.values()].toSorted((current, prev) => (
    compareIds(current.organizationId, prev.organizationId)
  ));
};
