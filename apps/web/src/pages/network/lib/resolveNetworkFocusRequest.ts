import type { NetworkMapSiteValue } from '@/entities/network';

import type { NetworkFocusRequestValue } from '../model/networkSceneInteraction';
import type { NetworkMapFocusCommandValue } from '../model/useNetworkMapStore';

import { listOrganizationSiteIds } from './listOrganizationSiteIds';

export const resolveNetworkFocusRequest = (
  command: NetworkMapFocusCommandValue | undefined,
  sites: readonly NetworkMapSiteValue[],
): NetworkFocusRequestValue | undefined => {
  if (command === undefined) {
    return undefined;
  }

  if (!command.isOrganization) {
    return { id: command.id, sequence: command.sequence, siteIds: undefined };
  }

  const siteIds = listOrganizationSiteIds(sites, command.id);

  return siteIds.length === 0 ? undefined : { id: command.id, sequence: command.sequence, siteIds };
};
