import type { NetworkMapSiteValue } from '@/entities/network';
import type { OrganizationSideValue } from '@/entities/organization';

const SIDE_ORDER: readonly OrganizationSideValue[] = ['customer', 'supplier', 'carrier'];

export const listCitySides = (sites: readonly NetworkMapSiteValue[]): readonly OrganizationSideValue[] => {
  const presentSides = new Set(sites.map(site => site.side));

  return SIDE_ORDER.filter(side => presentSides.has(side));
};
