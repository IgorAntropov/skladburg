import type { NetworkMapSiteValue } from '@/entities/network';

export interface NetworkSiteGroupsValue {
  network: readonly NetworkMapSiteValue[];
  own: readonly NetworkMapSiteValue[];
}

export const groupNetworkSites = (sites: readonly NetworkMapSiteValue[]): NetworkSiteGroupsValue => ({
  network: sites.filter(site => !site.isOwn),
  own: sites.filter(site => site.isOwn),
});
