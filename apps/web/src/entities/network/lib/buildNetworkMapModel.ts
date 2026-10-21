import { compareCodeUnits } from '@skladburg/contracts/runtime';

import { toOrganizationSide } from '@/entities/organization/@x/network';

import type {
  NetworkMapCityValue,
  NetworkMapModelValue,
  NetworkMapRoadValue,
  NetworkMapSiteValue,
  NetworkMapSourceValue,
} from '../model/networkMapTypes';

const buildCities = (source: NetworkMapSourceValue, collator: Intl.Collator): Map<string, NetworkMapCityValue> => {
  const cityById = new Map(source.directory.cities.map(city => [city.id, city]));
  const cities: NetworkMapCityValue[] = [];

  for (const node of source.directory.mapNodes) {
    const city = cityById.get(node.cityId);

    if (city !== undefined) {
      cities.push({
        cityId: city.id,
        id: node.id,
        name: city.name,
        position: { column: node.position?.column ?? 0, row: node.position?.row ?? 0 },
        siteIds: [],
        timeZone: city.timeZone,
      });
    }
  }

  const sortedCities = cities.toSorted(
    (current, prev) => collator.compare(current.name, prev.name) || compareCodeUnits(current.id, prev.id),
  );

  return new Map(sortedCities.map(city => [city.id, city]));
};

const buildSites = (
  source: NetworkMapSourceValue,
  cityByNodeId: ReadonlyMap<string, NetworkMapCityValue>,
  collator: Intl.Collator,
): NetworkMapSiteValue[] => {
  const sites: NetworkMapSiteValue[] = [];

  for (const site of source.sites) {
    const side = toOrganizationSide(site.profileKind);
    const city = cityByNodeId.get(site.mapNodeId);

    if (side !== undefined && city !== undefined) {
      const isOwn = site.organizationId === source.organizationId;

      sites.push({
        cityId: city.cityId,
        id: site.id,
        isOwn,
        label: isOwn ? site.name : site.organizationName,
        nodeId: site.mapNodeId,
        organizationName: site.organizationName,
        side,
      });
    }
  }

  const cityOrder = new Map([...cityByNodeId.keys()].map((nodeId, index) => [nodeId, index]));

  return sites.toSorted((current, prev) => (
    Number(prev.isOwn) - Number(current.isOwn)
    || (cityOrder.get(current.nodeId) ?? 0) - (cityOrder.get(prev.nodeId) ?? 0)
    || collator.compare(current.label, prev.label)
    || compareCodeUnits(current.id, prev.id)
  ));
};

const buildRoads = (source: NetworkMapSourceValue, cityByNodeId: ReadonlyMap<string, NetworkMapCityValue>): NetworkMapRoadValue[] => source
  .directory
  .routeLegs
  .filter(leg => cityByNodeId.has(leg.fromMapNodeId) && cityByNodeId.has(leg.toMapNodeId))
  .map(leg => ({
    distanceKm: leg.distanceKm,
    driveMinutes: leg.driveMinutes,
    fromNodeId: leg.fromMapNodeId,
    id: leg.id,
    toNodeId: leg.toMapNodeId,
  }))
  .toSorted((current, prev) => compareCodeUnits(current.id, prev.id));

export const buildNetworkMapModel = (source: NetworkMapSourceValue): NetworkMapModelValue => {
  const collator = new Intl.Collator(source.locale);
  const cityByNodeId = buildCities(source, collator);
  const sites = buildSites(source, cityByNodeId, collator);

  const cities = [...cityByNodeId.values()].map(city => ({
    ...city,
    siteIds: sites.filter(site => site.nodeId === city.id).map(site => site.id),
  }));

  return { cities, roads: buildRoads(source, cityByNodeId), sites };
};
