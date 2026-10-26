import type {
  City,
  MapNode,
  MapSite,
  RouteLeg,
} from '@skladburg/contracts/network/v1/network';

import type {
  OrganizationLogoValue,
  OrganizationSideValue,
} from '@/entities/organization/@x/network';

export interface MapGridPointValue {
  column: number;
  row: number;
}

export type MapSideValue = OrganizationSideValue;

export type NetworkCityTierValue = 'large' | 'medium' | 'small';

export interface NetworkDirectoryValue {
  cities: readonly City[];
  mapNodes: readonly MapNode[];
  routeLegs: readonly RouteLeg[];
}

export interface NetworkMapCityValue {
  cityId: string;
  id: string;
  name: string;
  position: MapGridPointValue;
  siteIds: readonly string[];
  tier: NetworkCityTierValue;
  timeZone: string;
}

export interface NetworkMapModelValue {
  cities: readonly NetworkMapCityValue[];
  roads: readonly NetworkMapRoadValue[];
  sites: readonly NetworkMapSiteValue[];
}

export interface NetworkMapRoadValue {
  distanceKm: number;
  driveMinutes: number;
  fromNodeId: string;
  id: string;
  toNodeId: string;
}

export interface NetworkMapSiteValue {
  cityId: string;
  id: string;
  isOwn: boolean;
  label: string;
  nodeId: string;
  organizationId: string;
  organizationLogo?: OrganizationLogoValue | undefined;
  organizationName: string;
  side: MapSideValue;
}

export interface NetworkMapSourceValue {
  directory: NetworkDirectoryValue;
  locale: string;
  organizationId: string | undefined;
  sites: readonly MapSite[];
}
