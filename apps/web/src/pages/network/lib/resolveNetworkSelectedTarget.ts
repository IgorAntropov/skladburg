import type { NetworkMapSiteValue } from '@/entities/network';
import type { ObjectTypeValue } from '@/shared/routing';

import type { NetworkMapSelectionValue } from '../model/networkSceneInteraction';

import { listOrganizationSiteIds } from './listOrganizationSiteIds';

export const resolveNetworkSelectedTarget = (
  id: string | undefined,
  type: ObjectTypeValue | undefined,
  sites: readonly NetworkMapSiteValue[],
): NetworkMapSelectionValue | undefined => {
  if (id === undefined) {
    return undefined;
  }

  if (type === 'site' || type === 'city') {
    return { id, kind: type };
  }

  if (type === 'organization') {
    const siteIds = listOrganizationSiteIds(sites, id);

    return siteIds.length === 0 ? undefined : { id, kind: 'sites', siteIds };
  }

  return undefined;
};
