import type { OrganizationProfile } from '@skladburg/contracts/organization/v1/organization';
import type { OrganizationShowcase } from '@skladburg/contracts/organization/v1/showcase';

import type { NetworkMapModelValue } from '@/entities/network';

import { resolveSphereNames } from './resolveSphereNames';
import { sortOrganizationProfiles } from './sortOrganizationProfiles';

export interface BuildOrganizationDirectoryRowsOptionsValue {
  model: NetworkMapModelValue;
  ownOrganizationId: string | undefined;
  showcases: readonly OrganizationShowcase[];
  sphereNameById: ReadonlyMap<string, string>;
}

export interface OrganizationDirectoryRowValue {
  cityNames: readonly string[];
  id: string;
  isOwn: boolean;
  name: string;
  profiles: readonly OrganizationProfile[];
  sphereNames: readonly string[];
}

const buildCityNamesByOrganizationId = (model: NetworkMapModelValue): Map<string, readonly string[]> => {
  const organizationIdsByNodeId = new Map<string, Set<string>>();

  for (const site of model.sites) {
    const organizationIds = organizationIdsByNodeId.get(site.nodeId) ?? new Set<string>();

    organizationIds.add(site.organizationId);
    organizationIdsByNodeId.set(site.nodeId, organizationIds);
  }

  const cityNamesByOrganizationId = new Map<string, string[]>();

  for (const city of model.cities) {
    for (const organizationId of organizationIdsByNodeId.get(city.id) ?? []) {
      cityNamesByOrganizationId.set(organizationId, [...cityNamesByOrganizationId.get(organizationId) ?? [], city.name]);
    }
  }

  return cityNamesByOrganizationId;
};

export const buildOrganizationDirectoryRows = ({
  model,
  ownOrganizationId,
  showcases,
  sphereNameById,
}: BuildOrganizationDirectoryRowsOptionsValue): OrganizationDirectoryRowValue[] => {
  const cityNamesByOrganizationId = buildCityNamesByOrganizationId(model);

  return showcases.map(showcase => ({
    cityNames: cityNamesByOrganizationId.get(showcase.id) ?? [],
    id: showcase.id,
    isOwn: showcase.id === ownOrganizationId,
    name: showcase.name,
    profiles: sortOrganizationProfiles(showcase.profiles),
    sphereNames: resolveSphereNames(showcase.sphereIds, sphereNameById),
  }));
};
