import type {
  NetworkMapCityValue,
  NetworkMapModelValue,
  NetworkMapSiteValue,
} from '@/entities/network';
import type { ObjectRefValue } from '@/shared/routing';

export type NetworkMapObjectValue
  = | { cities: readonly NetworkMapCityValue[]; kind: 'organization'; sites: readonly NetworkMapSiteValue[] }
    | { city: NetworkMapCityValue; kind: 'city'; sites: readonly NetworkMapSiteValue[] }
    | { city: NetworkMapCityValue; kind: 'site'; site: NetworkMapSiteValue };

export const findNetworkMapObject = (
  model: NetworkMapModelValue,
  focus: ObjectRefValue | undefined,
): NetworkMapObjectValue | undefined => {
  if (focus?.type === 'site') {
    const site = model.sites.find(candidate => candidate.id === focus.id);
    const city = site === undefined ? undefined : model.cities.find(candidate => candidate.id === site.nodeId);

    return site === undefined || city === undefined ? undefined : { city, kind: 'site', site };
  }

  if (focus?.type === 'city') {
    const city = model.cities.find(candidate => candidate.id === focus.id);

    return city === undefined
      ? undefined
      : { city, kind: 'city', sites: model.sites.filter(site => site.nodeId === city.id) };
  }

  if (focus?.type === 'organization') {
    const sites = model.sites.filter(site => site.organizationId === focus.id);
    const nodeIds = new Set(sites.map(site => site.nodeId));

    return { cities: model.cities.filter(city => nodeIds.has(city.id)), kind: 'organization', sites };
  }

  return undefined;
};
